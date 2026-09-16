import { HugeiconsIcon } from "@hugeicons/react";
import { Video01Icon } from "@hugeicons/core-free-icons";

export function NoClipSelected({
	message = "Selecione um vídeo ou imagem para ajustar.",
}: {
	message?: string;
}) {
	return (
		<div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 px-6 pt-8 text-center text-sm">
			<HugeiconsIcon icon={Video01Icon} className="size-6 opacity-60" />
			<span>{message}</span>
		</div>
	);
}
