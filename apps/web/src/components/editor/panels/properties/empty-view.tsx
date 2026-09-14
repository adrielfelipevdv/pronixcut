import { HugeiconsIcon } from "@hugeicons/react";
import { Settings05Icon } from "@hugeicons/core-free-icons";

export function EmptyView() {
	return (
		<div className="bg-background flex h-full flex-col items-center justify-center gap-3 p-6">
			<div className="bg-elevated border-border flex size-11 items-center justify-center rounded-full border">
				<HugeiconsIcon
					icon={Settings05Icon}
					className="text-subtle size-5"
					strokeWidth={1.5}
				/>
			</div>
			<div className="flex max-w-[220px] flex-col gap-1.5 text-center">
				<p className="text-[15px] font-semibold">Nada selecionado</p>
				<p className="text-muted-foreground text-[13px] text-balance leading-relaxed">
					Selecione um elemento na linha do tempo para editar suas propriedades.
				</p>
			</div>
		</div>
	);
}
