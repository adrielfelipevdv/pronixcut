// electron-builder's built-in icon-embedding step (signAndEditExecutable)
// shares code with its code-signing step, which unconditionally tries to
// download/extract the "winCodeSign" vendor package. On a Windows machine
// without Developer Mode enabled, extracting it fails (it contains symlinks,
// and creating those requires either Developer Mode or admin rights), which
// crashes packaging before the icon is ever written — so we keep
// signAndEditExecutable disabled and burn the icon + product metadata into
// the packaged exe ourselves here, using the standalone `rcedit` package
// (a plain resource editor, unrelated to winCodeSign, no symlinks involved).
const path = require("node:path");
const { rcedit } = require("rcedit");

module.exports = async function afterPack(context) {
	if (context.electronPlatformName !== "win32") return;

	const exePath = path.join(
		context.appOutDir,
		`${context.packager.appInfo.productFilename}.exe`,
	);
	const iconPath = path.join(__dirname, "icon.ico");

	await rcedit(exePath, {
		icon: iconPath,
		"version-string": {
			ProductName: "PronixCut",
			FileDescription: "PronixCut",
			CompanyName: "Pronix",
		},
	});

	console.log(`[after-pack] Embedded icon into ${exePath}`);
};
