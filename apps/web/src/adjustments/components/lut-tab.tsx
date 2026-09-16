"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { NoClipSelected } from "./no-clip-selected";
import { AdjustmentRow } from "./adjustment-row";
import { useClipGradeEditor } from "../hooks/use-clip-grade-editor";
import { useSelectedGradeableElement } from "../hooks/use-selected-gradeable-element";
import { GENERATED_LUT_SPECS, getGeneratedLutGrid } from "@/effects/color-grade/luts/generated-luts";
import {
	importedLutToGrid,
	useLutLibraryStore,
	type ImportedLut,
} from "@/effects/color-grade/luts/lut-library-store";
import { renderLutThumbnail } from "@/effects/color-grade/luts/thumbnail";
import type { AdjustmentRange } from "@/adjustments/types";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ArrowTurnBackwardIcon,
	CloudUploadIcon,
	SlidersHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/utils/ui";

const RANGE_0_100: AdjustmentRange = { min: 0, max: 100, step: 1, decimals: 0 };

export function LutTab() {
	const { element, trackId, selectionState } = useSelectedGradeableElement();

	if (!element || !trackId) {
		return (
			<NoClipSelected
				message={
					selectionState === "multiple"
						? "Selecione apenas um clipe para aplicar uma LUT."
						: undefined
				}
			/>
		);
	}

	return <LutTabContent element={element} trackId={trackId} />;
}

function LutTabContent({
	element,
	trackId,
}: {
	element: NonNullable<ReturnType<typeof useSelectedGradeableElement>["element"]>;
	trackId: string;
}) {
	const grade = useClipGradeEditor({ element, trackId });
	const importedLuts = useLutLibraryStore((s) => s.luts);
	const loadLuts = useLutLibraryStore((s) => s.load);
	const importCubeFile = useLutLibraryStore((s) => s.importCubeFile);
	const removeLut = useLutLibraryStore((s) => s.remove);
	const isImporting = useLutLibraryStore((s) => s.isImporting);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		void loadLuts();
	}, [loadLuts]);

	const handleImportFiles = async (files: FileList | null) => {
		if (!files || files.length === 0) return;
		for (const file of Array.from(files)) {
			if (!file.name.toLowerCase().endsWith(".cube")) {
				toast.error(`Formato não suportado: ${file.name}`, {
					description: "Apenas arquivos .cube podem ser importados.",
				});
				continue;
			}
			const text = await file.text();
			await importCubeFile({ name: file.name.replace(/\.cube$/i, ""), text });
		}
	};

	return (
		<div className="flex flex-col gap-5 px-4 py-4">
			<div className="flex items-center justify-between">
				<span className="text-foreground text-sm font-semibold">LUT</span>
				<Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5" onClick={grade.resetLut}>
					<HugeiconsIcon icon={ArrowTurnBackwardIcon} className="size-3.5" />
					Redefinir
				</Button>
			</div>

			<button
				type="button"
				onClick={() => grade.setLutId(null)}
				className={cn(
					"flex h-9 items-center justify-center rounded-md border text-sm font-medium transition-colors duration-150",
					!grade.lutId
						? "border-primary/40 bg-primary/10 text-primary"
						: "border-border text-muted-foreground hover:text-foreground",
				)}
			>
				Nenhum
			</button>

			{grade.lutId && (
				<AdjustmentRow
					icon={SlidersHorizontalIcon}
					label="Intensidade"
					value={grade.values.lutIntensity}
					range={RANGE_0_100}
					onChange={(value) => grade.setParam("lutIntensity", value)}
					onCommit={grade.commit}
				/>
			)}

			<div className="flex flex-col gap-2">
				<span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
					Predefinidas
				</span>
				<div className="grid grid-cols-3 gap-2">
					{GENERATED_LUT_SPECS.map((spec) => (
						<LutCard
							key={spec.id}
							id={spec.id}
							name={spec.name}
							isActive={grade.lutId === spec.id}
							onSelect={() => grade.setLutId(spec.id)}
						/>
					))}
				</div>
			</div>

			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between">
					<span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
						Importadas
					</span>
					<Button
						variant="outline"
						size="sm"
						className="gap-1.5"
						disabled={isImporting}
						onClick={() => fileInputRef.current?.click()}
					>
						{isImporting ? (
							<Spinner className="size-3.5" />
						) : (
							<HugeiconsIcon icon={CloudUploadIcon} className="size-3.5" />
						)}
						Importar LUT
					</Button>
					<input
						ref={fileInputRef}
						type="file"
						accept=".cube"
						multiple
						className="hidden"
						onChange={(event) => {
							void handleImportFiles(event.target.files);
							event.target.value = "";
						}}
					/>
				</div>
				{importedLuts.length === 0 ? (
					<p className="text-muted-foreground px-1 py-3 text-center text-xs">
						Nenhuma LUT importada ainda.
					</p>
				) : (
					<div className="grid grid-cols-3 gap-2">
						{importedLuts.map((lut) => (
							<ImportedLutCard
								key={lut.id}
								lut={lut}
								isActive={grade.lutId === lut.id}
								onSelect={() => grade.setLutId(lut.id)}
								onRemove={() => {
									if (grade.lutId === lut.id) grade.setLutId(null);
									removeLut({ id: lut.id });
								}}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

function LutCard({
	id,
	name,
	isActive,
	onSelect,
}: {
	id: string;
	name: string;
	isActive: boolean;
	onSelect: () => void;
}) {
	const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		const grid = getGeneratedLutGrid({ id });
		if (!grid) return;
		void renderLutThumbnail({ grid, cacheKey: id }).then((url) => {
			if (!cancelled) setThumbnailUrl(url);
		});
		return () => {
			cancelled = true;
		};
	}, [id]);

	return (
		<button
			type="button"
			onClick={onSelect}
			className={cn(
				"group flex flex-col gap-1.5 rounded-md border p-1 transition-colors duration-150",
				isActive ? "border-primary bg-primary/5" : "border-transparent hover:border-border",
			)}
		>
			<div className="bg-muted relative aspect-square w-full overflow-hidden rounded">
				{thumbnailUrl && (
					<Image src={thumbnailUrl} alt={name} fill sizes="120px" className="object-cover" unoptimized />
				)}
			</div>
			<span
				className={cn(
					"truncate text-[11px] font-medium",
					isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
				)}
			>
				{name}
			</span>
		</button>
	);
}

function ImportedLutCard({
	lut,
	isActive,
	onSelect,
	onRemove,
}: {
	lut: ImportedLut;
	isActive: boolean;
	onSelect: () => void;
	onRemove: () => void;
}) {
	const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		const grid = importedLutToGrid(lut);
		void renderLutThumbnail({ grid, cacheKey: lut.id }).then((url) => {
			if (!cancelled) setThumbnailUrl(url);
		});
		return () => {
			cancelled = true;
		};
	}, [lut]);

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<button
					type="button"
					onClick={onSelect}
					className={cn(
						"group flex flex-col gap-1.5 rounded-md border p-1 transition-colors duration-150",
						isActive ? "border-primary bg-primary/5" : "border-transparent hover:border-border",
					)}
				>
					<div className="bg-muted relative aspect-square w-full overflow-hidden rounded">
						{thumbnailUrl && (
							<Image src={thumbnailUrl} alt={lut.name} fill sizes="120px" className="object-cover" unoptimized />
						)}
					</div>
					<span
						className={cn(
							"truncate text-[11px] font-medium",
							isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
						)}
					>
						{lut.name}
					</span>
				</button>
			</ContextMenuTrigger>
			<ContextMenuContent>
				<ContextMenuItem variant="destructive" onClick={onRemove}>
					Excluir
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
