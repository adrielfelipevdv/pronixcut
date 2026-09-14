// Real fonts installed on the user's computer, via Chromium's Local Font
// Access API (window.queryLocalFonts()). Distinct from the Google Fonts
// atlas (fonts/google-fonts.ts), which is a curated, network-loaded set —
// this reads whatever the OS actually has installed (Arial, Calibri, a
// custom brand font, etc.), so it is intentionally never hardcoded.
//
// Rendering local fonts by name in CSS/canvas needs no extra loading step
// (unlike Google Fonts, which must be fetched before canvas text can use
// them) — the OS font stack resolves an installed family name directly.

export type LocalFontQueryStatus = "unsupported" | "denied" | "ok" | "error";

export interface LocalFontQueryResult {
	status: LocalFontQueryStatus;
	families: string[];
}

let cached: Promise<LocalFontQueryResult> | null = null;

interface FontDataLike {
	family: string;
}

interface WindowWithLocalFonts extends Window {
	queryLocalFonts?: () => Promise<FontDataLike[]>;
}

async function query(): Promise<LocalFontQueryResult> {
	const win = window as WindowWithLocalFonts;
	if (typeof win.queryLocalFonts !== "function") {
		return { status: "unsupported", families: [] };
	}

	try {
		const fonts = await win.queryLocalFonts();
		const families = Array.from(new Set(fonts.map((font) => font.family))).sort((a, b) =>
			a.localeCompare(b),
		);
		return { status: "ok", families };
	} catch (error) {
		if (error instanceof DOMException && error.name === "NotAllowedError") {
			return { status: "denied", families: [] };
		}
		console.warn("Failed to query local fonts:", error);
		return { status: "error", families: [] };
	}
}

/** Loaded once and cached for the lifetime of the page — the OS font list doesn't change mid-session. */
export function loadLocalFonts(): Promise<LocalFontQueryResult> {
	if (!cached) {
		cached = query();
	}
	return cached;
}
