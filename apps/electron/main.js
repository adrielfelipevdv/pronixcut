const { app, BrowserWindow, session, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const { fork } = require("node:child_process");
const { setupAutoUpdater, consumePendingUpdateMarker } = require("./updater");

// Works around a common Windows issue where certain GPU drivers render the
// BrowserWindow as a persistent blank white screen.
app.disableHardwareAcceleration();

const ICON_PATH = path.join(__dirname, "icon.ico");

// Windows groups taskbar entries and resolves the taskbar icon by this ID,
// not just by the exe's embedded resource. Without an explicit, product-
// specific AppUserModelId, Windows can keep showing a stale/generic icon
// (e.g. cached under the previous app's identity) even after the exe and
// BrowserWindow icon are both correct.
if (process.platform === "win32") {
	app.setAppUserModelId("com.pronix.pronixcut");
}

// The web app ships as a Next.js "standalone" server, pre-built and
// dereferenced by scripts/prepare-standalone.js (run before packaging — see
// apps/electron/package.json's "prepare:web" script) into resources/app.
// That script's own comment explains why the raw `next build` output can't
// just be copied as-is: Bun's node_modules layout leaves absolute-path
// symlinks in the standalone tracer output pointing back at the dev
// machine's checkout, which prepare-standalone.js resolves into real files.
// Packaged builds get this via electron-builder's extraResources (unpacked
// next to the exe, under resourcesPath/app); unpackaged dev runs use the
// same folder locally so `npm run dev` after `npm run prepare:web` behaves
// identically to the packaged app.
const appResourcesRoot = app.isPackaged
	? path.join(process.resourcesPath, "app")
	: path.join(__dirname, "resources", "app");
const webRoot = path.join(appResourcesRoot, "apps", "web");
const serverEntry = path.join(webRoot, "server.js");
// Copied in by scripts/prepare-standalone.js's copyFfmpegBinaries() (Next's
// standalone tracer can't capture these on its own — see that function's
// comment). Used for the HEVC/H.265 proxy pipeline; ffmpeg-paths.ts falls
// back to resolving the npm packages directly if these don't exist (e.g. a
// dev checkout where prepare:web hasn't been run yet).
const ffmpegBinDir = path.join(appResourcesRoot, "ffmpeg-bin");
const bundledFfmpegPath = path.join(
	ffmpegBinDir,
	process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
);
const bundledFfprobePath = path.join(
	ffmpegBinDir,
	process.platform === "win32" ? "ffprobe.exe" : "ffprobe",
);

function loadEnvFile(filePath) {
	const env = {};
	if (!fs.existsSync(filePath)) return env;
	const content = fs.readFileSync(filePath, "utf8");
	for (const line of content.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eq = trimmed.indexOf("=");
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		env[key] = value;
	}
	return env;
}

const userDataDir = app.getPath("userData");
const logFile = path.join(userDataDir, "server.log");

function log(message) {
	try {
		fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${message}\n`);
	} catch {
		// ignore logging failures
	}
}

process.on("uncaughtException", (err) => log(`Uncaught exception: ${err.stack || err}`));
process.on("unhandledRejection", (reason) => log(`Unhandled rejection: ${reason}`));

const PORT = 3100;
let serverProcess;
let mainWindow;
let serverStartupLog = "";

function waitForServer(url, timeoutMs = 60000) {
	const start = Date.now();
	return new Promise((resolve, reject) => {
		const tryOnce = () => {
			if (serverProcess?.exitCode !== null && serverProcess?.exitCode !== undefined) {
				reject(new Error(`Server process exited early with code ${serverProcess.exitCode}`));
				return;
			}
			http
				.get(url, (res) => {
					res.destroy();
					resolve();
				})
				.on("error", () => {
					if (Date.now() - start > timeoutMs) {
						reject(new Error("Server did not start in time"));
						return;
					}
					setTimeout(tryOnce, 300);
				});
		};
		tryOnce();
	});
}

function startServer() {
	if (!fs.existsSync(serverEntry)) {
		log(`Bundled server not found at ${serverEntry}`);
		return;
	}

	const fileEnv = loadEnvFile(path.join(webRoot, ".env.local"));

	log(`Starting bundled standalone server from ${serverEntry}`);

	serverProcess = fork(serverEntry, [], {
		cwd: webRoot,
		env: {
			...process.env,
			...fileEnv,
			NODE_ENV: "production",
			PORT: String(PORT),
			HOSTNAME: "127.0.0.1",
			// Lets server-side routes (e.g. the Sounds & effects local audio
			// library) persist real files under Electron's per-user app data
			// folder instead of somewhere inside the project checkout.
			PRONIX_USER_DATA_DIR: userDataDir,
			PRONIX_FFMPEG_PATH: bundledFfmpegPath,
			PRONIX_FFPROBE_PATH: bundledFfprobePath,
		},
		silent: true,
	});

	serverProcess.stdout?.on("data", (d) => {
		serverStartupLog += d.toString();
		log(`[stdout] ${d}`);
	});
	serverProcess.stderr?.on("data", (d) => {
		serverStartupLog += d.toString();
		log(`[stderr] ${d}`);
	});
	serverProcess.on("exit", (code) => log(`Server process exited with code ${code}`));
	serverProcess.on("error", (err) => log(`Server process error: ${err.stack || err}`));
}

// Shown immediately after createWindow(), replacing the brief blank-white
// gap that otherwise sits there while the bundled Next.js server boots
// (see the disableHardwareAcceleration comment above — some GPU drivers
// render that gap as a stuck white flash). When `pendingUpdate` is set, the
// message reflects that this launch is relaunching right after a silent
// update install rather than an ordinary cold start.
function showLoadingScreen({ pendingUpdate }) {
	const message = pendingUpdate?.version
		? `Atualizando o PronixCut para a versão ${pendingUpdate.version}…`
		: "Iniciando o PronixCut…";
	const html = `data:text/html,${encodeURIComponent(`
		<html>
			<head>
				<style>
					html, body {
						height: 100%;
						margin: 0;
						background: #0b0b0c;
						color: #eaeaea;
						font-family: -apple-system, "Segoe UI", sans-serif;
						display: flex;
						align-items: center;
						justify-content: center;
						flex-direction: column;
						gap: 16px;
					}
					.spinner {
						width: 32px;
						height: 32px;
						border-radius: 50%;
						border: 3px solid rgba(255,255,255,0.15);
						border-top-color: #FFC531;
						animation: spin 0.8s linear infinite;
					}
					@keyframes spin { to { transform: rotate(360deg); } }
					p { font-size: 14px; opacity: 0.85; margin: 0; }
				</style>
			</head>
			<body>
				<div class="spinner"></div>
				<p>${message}</p>
			</body>
		</html>
	`)}`;
	mainWindow.loadURL(html);
}

function showStartupError(message) {
	const escaped = message
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
	const html = `data:text/html,${encodeURIComponent(`
		<html>
			<body style="font-family: sans-serif; background:#111; color:#eee; padding:2rem;">
				<h2>PronixCut failed to start</h2>
				<p>The local server did not come up correctly. Log file:</p>
				<code style="user-select:text;">${logFile}</code>
				<pre style="white-space:pre-wrap; background:#222; padding:1rem; border-radius:6px; max-height:60vh; overflow:auto;">${escaped}</pre>
			</body>
		</html>
	`)}`;
	mainWindow.loadURL(html);
}

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1440,
		height: 900,
		minWidth: 1024,
		minHeight: 640,
		title: "PronixCut",
		icon: ICON_PATH,
		autoHideMenuBar: true,
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			// Needed for the PronixEditor "Navegador" tab to embed an in-app
			// browser (Google Images/Unsplash/Pexels/etc.) via <webview>. This
			// does not grant the embedded page (or the guest <webview> content)
			// any Node/Electron API access — contextIsolation above still
			// applies to the host window, and the <webview> guest runs in its
			// own separate, unprivileged renderer process by default.
			webviewTag: true,
			preload: path.join(__dirname, "preload.js"),
		},
	});
}

// Grants the Local Font Access API (window.queryLocalFonts(), used by the
// font picker to list fonts actually installed on this machine) only to our
// own app UI (the default session). The embedded "Navegador" webview tab
// runs under a separate partition (persist:pronix-assets) and is
// deliberately left out of this handler, so arbitrary third-party sites
// loaded there (Google Images, Unsplash, etc.) get Electron's normal
// permission behavior, not an automatic grant meant for our trusted UI.
function configurePermissions() {
	// Electron's built-in default (no handler installed) already approves
	// every permission request for the main window, which is what this app
	// relied on before local-fonts existed. We install an explicit handler
	// only to guarantee local-fonts specifically is granted; everything else
	// keeps that same pre-existing "allow" behavior.
	session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
		callback(true);
	});
	session.defaultSession.setPermissionCheckHandler(() => true);
}

ipcMain.handle("app:get-version", () => app.getVersion());

app.whenReady().then(async () => {
	fs.mkdirSync(userDataDir, { recursive: true });
	configurePermissions();
	const pendingUpdate = consumePendingUpdateMarker();
	createWindow();
	showLoadingScreen({ pendingUpdate });
	startServer();

	try {
		await waitForServer(`http://127.0.0.1:${PORT}`);
		// "/" is the public OpenCut marketing/landing page (roadmap, GitHub
		// stars, "try early beta", etc.) — meant for the project's website, not
		// this desktop app. The app's real home is the projects dashboard.
		mainWindow.loadURL(`http://127.0.0.1:${PORT}/projects`);
		// Only start looking for updates once the app itself has actually come
		// up successfully — never compete with startup, and never run against
		// a window that's stuck on the error screen below.
		setupAutoUpdater({ mainWindow, log });
	} catch (err) {
		log(`Startup failed: ${err.stack || err}`);
		showStartupError(`${err.message}\n\n${serverStartupLog}`);
	}

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on("window-all-closed", () => {
	if (serverProcess) serverProcess.kill();
	if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
	if (serverProcess) serverProcess.kill();
});
