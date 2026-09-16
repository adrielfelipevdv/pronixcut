// Builds a portable, self-contained copy of the Next.js "standalone" output
// so it can run on an end user's machine, not just this dev checkout.
//
// Two gaps in Next's standalone output make it non-portable as-is with a
// Bun-managed monorepo:
//   1. Bun installs packages as symlinks into a global, absolute-path
//      content store (node_modules/.bun/<pkg>@<version>/...). Next's
//      file-tracer preserves some of these as symlinks instead of copying
//      their real contents, so the emitted .next/standalone still contains
//      symlinks pointing at this exact machine's checkout path. This script
//      dereferences every symlink (copies the real target in its place) so
//      the result has zero dependency on this machine's filesystem layout.
//   2. Next's standalone output does not include .next/static (client JS/CSS
//      chunks), and only copies the subset of public/ that its file-tracer
//      can prove is referenced by traced code (next/image usages etc.) —
//      not the whole folder. Both have to be copied in manually per Next's
//      own docs. Caught for real: the packaged app's Home background image
//      (public/backgrounds/pronixcut-home.jpg, only ever referenced via a
//      plain CSS `url()` string, which the tracer can't see) 404'd because
//      only 2 of the real public/ folder's 14 entries had survived tracing.
//
// Run after `next build` (apps/web) and before `electron-builder`. Output
// lands in apps/electron/resources/app, which electron-builder packages via
// the `extraResources` entry in apps/electron/package.json.

const fs = require("node:fs");
const path = require("node:path");

const ELECTRON_DIR = __dirname.endsWith(path.join("scripts"))
	? path.join(__dirname, "..")
	: __dirname;
const REPO_ROOT = path.join(ELECTRON_DIR, "..", "..");
const WEB_DIR = path.join(REPO_ROOT, "apps", "web");
const STANDALONE_SRC = path.join(WEB_DIR, ".next", "standalone");
const STATIC_SRC = path.join(WEB_DIR, ".next", "static");
const PUBLIC_SRC = path.join(WEB_DIR, "public");
const OUT_DIR = path.join(ELECTRON_DIR, "resources", "app");

function fail(message) {
	console.error(`[prepare-standalone] ${message}`);
	process.exit(1);
}

function rmrf(target) {
	fs.rmSync(target, { recursive: true, force: true });
}

/** Recursive copy that always dereferences symlinks (copies real file/dir
 * contents, never re-creates a symlink), so the output has no path
 * dependency on the machine it was built on. */
function copyDereferenced(src, dest) {
	const stat = fs.statSync(src); // statSync (not lstatSync) follows symlinks
	if (stat.isDirectory()) {
		fs.mkdirSync(dest, { recursive: true });
		for (const entry of fs.readdirSync(src)) {
			copyDereferenced(path.join(src, entry), path.join(dest, entry));
		}
		return;
	}
	fs.mkdirSync(path.dirname(dest), { recursive: true });
	fs.copyFileSync(src, dest);
}

function countSymlinks(dir) {
	let count = 0;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isSymbolicLink()) {
			count += 1;
		} else if (entry.isDirectory()) {
			count += countSymlinks(full);
		}
	}
	return count;
}

function main() {
	if (!fs.existsSync(STANDALONE_SRC)) {
		fail(
			`No standalone build found at ${STANDALONE_SRC}. Run "next build" in apps/web first (requires next.config's output: "standalone", already set).`,
		);
	}
	if (!fs.existsSync(STATIC_SRC)) {
		fail(`Missing ${STATIC_SRC} — did "next build" fail partway?`);
	}
	if (!fs.existsSync(PUBLIC_SRC)) {
		fail(`Missing ${PUBLIC_SRC}.`);
	}

	console.log(`[prepare-standalone] Clearing ${OUT_DIR}`);
	rmrf(OUT_DIR);

	console.log(`[prepare-standalone] Copying standalone server (dereferencing symlinks)...`);
	copyDereferenced(STANDALONE_SRC, OUT_DIR);

	const remainingLinks = countSymlinks(OUT_DIR);
	if (remainingLinks > 0) {
		fail(
			`${remainingLinks} symlink(s) survived the copy — the packaged app would still depend on this machine's paths. Investigate before shipping.`,
		);
	}

	const staticDest = path.join(OUT_DIR, "apps", "web", ".next", "static");
	console.log(`[prepare-standalone] Copying .next/static -> ${staticDest}`);
	copyDereferenced(STATIC_SRC, staticDest);

	// Overwrite, don't merge with, the tracer's partial public/ copy — a
	// stale file the tracer picked up but the real public/ folder no longer
	// has would otherwise survive indefinitely.
	const publicDest = path.join(OUT_DIR, "apps", "web", "public");
	console.log(`[prepare-standalone] Copying the full public/ folder -> ${publicDest}`);
	rmrf(publicDest);
	copyDereferenced(PUBLIC_SRC, publicDest);

	const serverEntry = path.join(OUT_DIR, "apps", "web", "server.js");
	if (!fs.existsSync(serverEntry)) {
		fail(`Expected server entrypoint missing: ${serverEntry}`);
	}

	// Bun keeps a "flat hoist" layer at node_modules/.bun/node_modules/* —
	// real content for `.bun/node_modules/x` entries, symlinks for others —
	// that's how bare `require("x")` normally resolves package-manager-
	// agnostic code. Next's file-tracer doesn't always capture that a given
	// package is reached this way (styled-jsx and @swc/helpers both surfaced
	// `Cannot find module` errors when the packaged server was run from
	// outside this checkout, proving the gap for real rather than guessing).
	// Materializing the whole flat layer as real top-level node_modules
	// entries fixes the whole class of bug at once instead of allowlisting
	// packages one crash at a time.
	materializeBunFlatLayer({
		bunNodeModules: path.join(OUT_DIR, "node_modules", ".bun", "node_modules"),
		targetNodeModules: path.join(OUT_DIR, "node_modules"),
	});
	// styled-jsx additionally needs to resolve starting from apps/web itself
	// (Next's require-hook resolves it relative to the app directory, not
	// via the repo-root flat layer above) — verified the same way.
	materializeBunFlatLayer({
		bunNodeModules: path.join(OUT_DIR, "node_modules", ".bun", "node_modules"),
		targetNodeModules: path.join(OUT_DIR, "apps", "web", "node_modules"),
		only: ["styled-jsx"],
	});

	console.log(`[prepare-standalone] OK — portable standalone app ready at ${OUT_DIR}`);
}

function materializeBunFlatLayer({ bunNodeModules, targetNodeModules, only }) {
	if (!fs.existsSync(bunNodeModules)) return;

	for (const entry of fs.readdirSync(bunNodeModules)) {
		if (entry.startsWith("@")) {
			for (const scopedEntry of fs.readdirSync(path.join(bunNodeModules, entry))) {
				const name = `${entry}/${scopedEntry}`;
				if (only && !only.includes(name)) continue;
				materializeOne({ name, bunNodeModules, targetNodeModules });
			}
			continue;
		}
		if (only && !only.includes(entry)) continue;
		materializeOne({ name: entry, bunNodeModules, targetNodeModules });
	}
}

function materializeOne({ name, bunNodeModules, targetNodeModules }) {
	// Always take the Bun-store copy over whatever (if anything) the
	// tracer left at `dest` — a first pass here found @swc/helpers already
	// "existed" at the root but was missing its cjs/*.cjs files (the tracer
	// had only partially captured it), so existence alone isn't proof the
	// existing copy is complete or correct.
	const dest = path.join(targetNodeModules, ...name.split("/"));
	const source = path.join(bunNodeModules, ...name.split("/"));
	rmrf(dest);
	console.log(`[prepare-standalone] Fixing up ${name} resolution -> ${dest}`);
	copyDereferenced(source, dest);
}

main();
