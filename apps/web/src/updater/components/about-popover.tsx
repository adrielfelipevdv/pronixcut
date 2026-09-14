"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	InformationCircleIcon,
	CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { useUpdaterBridge } from "@/updater/use-updater-bridge";
import { useUpdaterStore } from "@/updater/updater-store";
import { isRunningInElectron } from "@/updater/types";

export function AboutPopover() {
	useUpdaterBridge();
	const status = useUpdaterStore((s) => s.status);
	const currentVersion = useUpdaterStore((s) => s.currentVersion);
	const [isOpen, setIsOpen] = useState(false);

	if (!isRunningInElectron()) return null;

	const isChecking = status.state === "checking";

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<Button variant="ghost" size="icon" className="size-8 rounded-md" title="Sobre">
					<HugeiconsIcon icon={InformationCircleIcon} className="size-4" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-72 p-4">
				<p className="text-foreground text-[13px] font-semibold">PronixCut</p>
				<p className="text-muted-foreground mt-0.5 text-[12px]">
					Versão {currentVersion ?? "…"}
				</p>

				<div className="mt-3">
					<AboutStatus status={status} currentVersion={currentVersion} />
				</div>

				<Button
					variant="outline"
					size="sm"
					className="mt-3 w-full gap-1.5"
					disabled={isChecking}
					onClick={() => void window.pronixUpdater?.check()}
				>
					{isChecking && <Spinner className="size-3.5" />}
					Verificar atualizações
				</Button>
			</PopoverContent>
		</Popover>
	);
}

function AboutStatus({
	status,
	currentVersion,
}: {
	status: ReturnType<typeof useUpdaterStore.getState>["status"];
	currentVersion: string | null;
}) {
	if (status.state === "checking") {
		return (
			<p className="text-muted-foreground flex items-center gap-1.5 text-[12px]">
				<Spinner className="size-3.5" />
				Verificando…
			</p>
		);
	}

	if (status.state === "upToDate") {
		return (
			<p className="text-success flex items-start gap-1.5 text-[12px]">
				<HugeiconsIcon icon={CheckmarkCircle02Icon} className="mt-0.5 size-3.5 shrink-0" />
				Você está usando a versão mais recente do PronixCut.
			</p>
		);
	}

	if (status.state === "updateAvailable") {
		return (
			<div className="text-[12px]">
				<p className="text-muted-foreground">
					Versão instalada: <span className="text-foreground">{currentVersion}</span>
				</p>
				<p className="text-muted-foreground">
					Versão disponível:{" "}
					<span className="text-pronix-yellow">{status.version}</span>
				</p>
			</div>
		);
	}

	if (status.state === "downloading") {
		return (
			<p className="text-muted-foreground text-[12px]">
				Baixando atualização… {status.percent}%
			</p>
		);
	}

	if (status.state === "downloaded") {
		return (
			<div className="text-[12px]">
				<p className="text-muted-foreground mb-2">
					PronixCut {status.version} já foi baixado.
				</p>
				<Button
					size="sm"
					className="w-full"
					onClick={() => void window.pronixUpdater?.quitAndInstall()}
				>
					Atualizar e reiniciar
				</Button>
			</div>
		);
	}

	if (status.state === "error") {
		return (
			<p className="text-danger text-[12px]">
				Não foi possível verificar atualizações agora.
			</p>
		);
	}

	return null;
}
