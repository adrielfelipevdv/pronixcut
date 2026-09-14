import { useEffect, useState } from "react";
import { loadLocalFonts, type LocalFontQueryStatus } from "@/fonts/local-fonts";

type Status = "idle" | "loading" | LocalFontQueryStatus;

export function useLocalFonts({ open }: { open: boolean }) {
	const [status, setStatus] = useState<Status>("idle");
	const [families, setFamilies] = useState<string[]>([]);

	useEffect(() => {
		if (!open || status !== "idle") return;
		setStatus("loading");
		loadLocalFonts().then((result) => {
			setStatus(result.status);
			setFamilies(result.families);
		});
	}, [open, status]);

	return { status, families };
}
