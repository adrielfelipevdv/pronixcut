"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
	Cancel01Icon,
	CloudDownloadIcon,
	SparklesIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useUpdaterBridge } from "@/updater/use-updater-bridge";
import { useUpdaterStore } from "@/updater/updater-store";
import { isRunningInElectron } from "@/updater/types";

// Discreet, bottom-right, never blocking the editor — shown only while
// there's something actionable (a new version available, or one already
// downloaded and ready). "idle"/"checking"/"upToDate" render nothing at
// all, matching "não incomodar o usuário se não houver nada novo".
export function UpdateBanner() {
	useUpdaterBridge();
	const status = useUpdaterStore((s) => s.status);
	const dismissedVersion = useUpdaterStore((s) => s.dismissedVersion);
	const dismiss = useUpdaterStore((s) => s.dismiss);

	if (!isRunningInElectron()) return null;

	if (status.state === "updateAvailable" && status.version !== dismissedVersion) {
		return (
			<Card>
				<div className="flex items-start gap-2.5">
					<HugeiconsIcon
						icon={SparklesIcon}
						className="text-pronix-yellow mt-0.5 size-4 shrink-0"
					/>
					<div className="flex flex-col gap-0.5">
						<p className="text-foreground text-[13px] font-semibold">
							Nova versão disponível
						</p>
						<p className="text-muted-foreground text-[12px]">
							PronixCut {status.version}
						</p>
					</div>
				</div>
				<div className="mt-3 flex justify-end gap-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => dismiss(status.version)}
					>
						Depois
					</Button>
					{/* Download already starts automatically in the background
						(autoDownload=true) — this just surfaces progress if the user
						wants to watch it, it isn't a separate action. */}
				</div>
			</Card>
		);
	}

	if (status.state === "downloading") {
		return (
			<Card>
				<div className="flex items-center gap-2.5">
					<HugeiconsIcon
						icon={CloudDownloadIcon}
						className="text-pronix-yellow size-4 shrink-0"
					/>
					<p className="text-foreground text-[13px] font-semibold">
						Baixando atualização…
					</p>
				</div>
				<div className="mt-2.5 flex items-center gap-2.5">
					<Progress value={status.percent} className="h-1.5 flex-1" />
					<span className="text-muted-foreground w-9 shrink-0 text-right text-[11px] tabular-nums">
						{status.percent}%
					</span>
				</div>
			</Card>
		);
	}

	if (status.state === "downloaded" && status.version !== dismissedVersion) {
		return (
			<Card>
				<div className="flex items-start justify-between gap-2">
					<div className="flex flex-col gap-0.5">
						<p className="text-foreground text-[13px] font-semibold">
							Atualização pronta
						</p>
						<p className="text-muted-foreground text-[12px]">
							PronixCut {status.version} foi baixado.
						</p>
					</div>
					<Button
						variant="text"
						size="icon"
						className="size-5 shrink-0"
						onClick={() => dismiss(status.version)}
						title="Fechar"
					>
						<HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
					</Button>
				</div>
				<div className="mt-3 flex justify-end gap-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => dismiss(status.version)}
					>
						Depois
					</Button>
					<Button
						size="sm"
						onClick={() => void window.pronixUpdater?.quitAndInstall()}
					>
						Atualizar e reiniciar
					</Button>
				</div>
			</Card>
		);
	}

	return null;
}

function Card({ children }: { children: React.ReactNode }) {
	return (
		<div className="border-border bg-elevated active-glow fixed right-4 bottom-4 z-50 w-80 rounded-[10px] border p-3.5">
			{children}
		</div>
	);
}
