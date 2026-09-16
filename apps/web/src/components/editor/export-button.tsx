"use client";

import { useEffect, useMemo, useState } from "react";
import { TransitionTopIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { AudioCodec, VideoCodec } from "mediabunny";
import { mediaTimeToSeconds } from "opencut-wasm";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/utils/ui";
import {
	getExportMimeType,
	getExportFileExtension,
	downloadBuffer,
	EXPORT_CONTAINER_LABELS,
	EXPORT_QUALITY_LABELS,
	type ExportOptions,
	type ExportContainer,
	type ExportQualityPreset,
} from "@/export";
import { Check, Copy, Download, Folder, Play, RotateCcw } from "lucide-react";
import {
	Section,
	SectionContent,
	SectionHeader,
	SectionTitle,
} from "@/components/section";
import { useEditor } from "@/editor/use-editor";
import { buildDefaultExportOptions } from "@/export/defaults";
import {
	AUDIO_CODEC_LABELS,
	VIDEO_CODEC_LABELS,
	getEncodableAudioCodecsForContainer,
	getEncodableVideoCodecsForContainer,
	isHardwareEncodingAvailable,
} from "@/export/capabilities";
import {
	RESOLUTION_PRESET_LABELS,
	RESOLUTION_PRESET_VALUES,
	computeResolutionForPreset,
	type ResolutionPreset,
} from "@/export/resolution";
import { EXPORT_FRAME_RATE_OPTIONS, formatFrameRateLabel } from "@/export/frame-rates";
import { resolveExportSettings, resolveVideoBitrate } from "@/export/resolve";
import { estimateExportSizeBytes, formatEstimatedSize } from "@/export/estimate";
import { QUICK_EXPORT_PRESETS } from "@/export/presets";
import { useCustomExportPresetsStore } from "@/export/custom-presets-store";
import { pickExportSaveDirectory, writeExportFileToDirectory } from "@/export/save-location";

export function ExportButton() {
	const [isExportPopoverOpen, setIsExportPopoverOpen] = useState(false);
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActiveOrNull());
	const hasProject = !!activeProject;

	const handlePopoverOpenChange = ({ open }: { open: boolean }) => {
		if (!open) {
			editor.project.cancelExport();
			editor.project.clearExportState();
		}
		setIsExportPopoverOpen(open);
	};

	return (
		<Popover
			open={isExportPopoverOpen}
			onOpenChange={(open) => handlePopoverOpenChange({ open })}
		>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						"bg-primary text-primary-foreground flex items-center gap-1.5 rounded-[0.65rem] px-[0.12rem] py-[0.12rem] transition-[filter,box-shadow] duration-150",
						hasProject
							? "cursor-pointer shadow-[0_0_12px_rgba(255,198,0,0.12)] hover:brightness-110"
							: "cursor-not-allowed opacity-50",
					)}
					onClick={hasProject ? () => setIsExportPopoverOpen(true) : undefined}
					disabled={!hasProject}
					onKeyDown={(event) => {
						if (hasProject && (event.key === "Enter" || event.key === " ")) {
							event.preventDefault();
							setIsExportPopoverOpen(true);
						}
					}}
				>
					<div className="bg-primary relative flex items-center gap-1.5 rounded-[0.6rem] px-4 py-1 shadow-[0_1px_3px_0px_rgba(0,0,0,0.65)]">
						<HugeiconsIcon icon={TransitionTopIcon} className="z-50 size-3.5" />
						<span className="z-50 text-[0.875rem]">Exportar</span>
						<div className="absolute top-0 left-0 z-10 flex size-full items-center justify-center rounded-[0.6rem] bg-linear-to-t from-white/0 to-white/30">
							<div className="bg-primary absolute top-[0.08rem] z-50 h-[calc(100%-2px)] w-[calc(100%-2px)] rounded-[0.6rem]"></div>
						</div>
					</div>
				</button>
			</PopoverTrigger>
			{hasProject && <ExportPopover onOpenChange={setIsExportPopoverOpen} />}
		</Popover>
	);
}

function useElapsedTime({ isRunning }: { isRunning: boolean }) {
	const [elapsedMs, setElapsedMs] = useState(0);
	useEffect(() => {
		if (!isRunning) {
			setElapsedMs(0);
			return;
		}
		const start = Date.now();
		const interval = setInterval(() => setElapsedMs(Date.now() - start), 250);
		return () => clearInterval(interval);
	}, [isRunning]);
	return elapsedMs;
}

function formatDuration(ms: number): string {
	const totalSeconds = Math.max(0, Math.round(ms / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	const pad = (n: number) => n.toString().padStart(2, "0");
	return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function ExportPopover({
	onOpenChange,
}: {
	onOpenChange: (open: boolean) => void;
}) {
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActive());
	const exportState = useEditor((e) => e.project.getExportState());
	const { isExporting, progress, result: exportResult } = exportState;

	const [options, setOptions] = useState<ExportOptions>(() =>
		buildDefaultExportOptions({ filename: activeProject.metadata.name }),
	);
	const [advancedOpen, setAdvancedOpen] = useState(false);
	const [saveDir, setSaveDir] = useState<FileSystemDirectoryHandle | null>(null);
	const [presetNameDraft, setPresetNameDraft] = useState("");
	const [showSavePresetInput, setShowSavePresetInput] = useState(false);

	const [videoCodecs, setVideoCodecs] = useState<VideoCodec[]>([options.codec]);
	const [audioCodecs, setAudioCodecs] = useState<AudioCodec[]>([options.audio.codec]);
	const [hasHardwareAccel, setHasHardwareAccel] = useState(false);

	const customPresets = useCustomExportPresetsStore((s) => s.presets);
	const loadCustomPresets = useCustomExportPresetsStore((s) => s.load);
	const saveCustomPreset = useCustomExportPresetsStore((s) => s.save);
	const removeCustomPreset = useCustomExportPresetsStore((s) => s.remove);

	useEffect(() => {
		void loadCustomPresets();
	}, [loadCustomPresets]);

	useEffect(() => {
		void isHardwareEncodingAvailable().then(setHasHardwareAccel);
	}, []);

	useEffect(() => {
		let cancelled = false;
		void getEncodableVideoCodecsForContainer({ container: options.container }).then(
			(codecs) => {
				if (cancelled) return;
				setVideoCodecs(codecs.length > 0 ? codecs : [options.codec]);
				if (codecs.length > 0 && !codecs.includes(options.codec)) {
					setOptions((prev) => ({ ...prev, codec: codecs[0] }));
				}
			},
		);
		void getEncodableAudioCodecsForContainer({ container: options.container }).then(
			(codecs) => {
				if (cancelled) return;
				setAudioCodecs(codecs.length > 0 ? codecs : [options.audio.codec]);
				if (codecs.length > 0 && !codecs.includes(options.audio.codec)) {
					setOptions((prev) => ({
						...prev,
						audio: { ...prev.audio, codec: codecs[0] },
					}));
				}
			},
		);
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [options.container]);

	const resolved = useMemo(
		() =>
			resolveExportSettings({
				options,
				projectSize: activeProject.settings.canvasSize,
				projectFps: activeProject.settings.fps,
			}),
		[options, activeProject.settings.canvasSize, activeProject.settings.fps],
	);
	const videoBitrate = useMemo(
		() => resolveVideoBitrate({ options, resolved }),
		[options, resolved],
	);
	const durationSeconds = mediaTimeToSeconds({ time: editor.timeline.getTotalDuration() });
	const estimatedBytes = useMemo(() => {
		const seconds = durationSeconds;
		if (!seconds || seconds <= 0) return null;
		return estimateExportSizeBytes({
			durationSeconds: seconds,
			videoBitrate,
			audioBitrate: options.audio.bitrate,
			includeAudio: options.audio.include,
		});
	}, [durationSeconds, videoBitrate, options.audio.bitrate, options.audio.include]);

	const elapsedMs = useElapsedTime({ isRunning: isExporting });
	const remainingMs =
		progress > 0.01 && progress < 1 ? (elapsedMs / progress) * (1 - progress) : null;

	const handlePickSaveDir = async () => {
		const dir = await pickExportSaveDirectory();
		if (dir) setSaveDir(dir);
	};

	const handleExport = async () => {
		const result = await editor.project.export({ options });

		if (result.cancelled) {
			editor.project.clearExportState();
			return;
		}

		if (result.success && result.buffer) {
			const filename = `${options.filename || activeProject.metadata.name}${getExportFileExtension({ container: options.container })}`;
			const mimeType = getExportMimeType({ container: options.container });

			const wroteToDisk = saveDir
				? await writeExportFileToDirectory({
						directory: saveDir,
						filename,
						buffer: result.buffer,
					})
				: false;

			if (!wroteToDisk) {
				downloadBuffer({ buffer: result.buffer, filename, mimeType });
			}

			editor.project.clearExportState();
		}
	};

	const handleCancel = () => {
		editor.project.cancelExport();
	};

	const applyPreset = (id: string) => {
		const preset = QUICK_EXPORT_PRESETS.find((p) => p.id === id);
		if (preset) {
			setOptions((prev) => preset.apply(prev));
			return;
		}
		const custom = customPresets.find((p) => p.id === id);
		if (custom) {
			setOptions((prev) => ({ ...custom.settings, filename: prev.filename }));
		}
	};

	const summaryParts = [
		`${EXPORT_CONTAINER_LABELS[options.container]} • ${VIDEO_CODEC_LABELS[options.codec]}`,
		`${resolved.width} × ${resolved.height} • ${formatFrameRateLabel({ rate: resolved.fps })}`,
		EXPORT_QUALITY_LABELS[options.quality],
		options.audio.include
			? `${AUDIO_CODEC_LABELS[options.audio.codec]} • ${Math.round(options.audio.bitrate / 1000)} kbps`
			: "Sem áudio",
	];

	return (
		<PopoverContent className="bg-background mr-4 flex w-96 flex-col p-0">
			{exportResult && !exportResult.success ? (
				<ExportError
					error={exportResult.error || "Ocorreu um erro desconhecido"}
					onRetry={handleExport}
				/>
			) : exportResult?.success ? (
				<ExportComplete
					options={options}
					onClose={() => {
						editor.project.clearExportState();
						onOpenChange(false);
					}}
				/>
			) : (
				<>
					<div className="flex items-center justify-between border-b p-3">
						<h3 className="text-sm font-medium">
							{isExporting ? "Exportando vídeo…" : "Exportar vídeo"}
						</h3>
					</div>

					{!isExporting && (
						<div className="flex max-h-[70vh] flex-col overflow-y-auto">
							<div className="flex flex-wrap gap-1.5 p-3 pb-0">
								{QUICK_EXPORT_PRESETS.map((preset) => (
									<button
										key={preset.id}
										type="button"
										onClick={() => applyPreset(preset.id)}
										className="border-border bg-accent hover:bg-accent/70 text-muted-foreground hover:text-foreground rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
									>
										{preset.label}
									</button>
								))}
								{customPresets.map((preset) => (
									<button
										key={preset.id}
										type="button"
										onClick={() => applyPreset(preset.id)}
										className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
									>
										{preset.name}
									</button>
								))}
							</div>

							<Section collapsible defaultOpen showTopBorder={false}>
								<SectionHeader>
									<SectionTitle>Arquivo</SectionTitle>
								</SectionHeader>
								<SectionContent>
									<div className="flex flex-col gap-3">
										<div className="flex flex-col gap-1.5">
											<Label className="text-xs">Nome do arquivo</Label>
											<Input
												size="sm"
												value={options.filename}
												onChange={(e) =>
													setOptions((prev) => ({ ...prev, filename: e.target.value }))
												}
												placeholder="Meu vídeo"
											/>
										</div>
										<div className="flex flex-col gap-1.5">
											<Label className="text-xs">Salvar em</Label>
											<div className="flex items-center gap-1.5">
												<div className="border-border bg-accent text-muted-foreground h-7 flex-1 truncate rounded-md border px-2.5 text-xs leading-7">
													{saveDir ? saveDir.name : "Pasta de downloads do navegador"}
												</div>
												<Button
													variant="outline"
													size="sm"
													className="h-7 shrink-0 gap-1 px-2 text-xs"
													onClick={handlePickSaveDir}
												>
													<Folder className="size-3.5" />
													Procurar
												</Button>
											</div>
										</div>
									</div>
								</SectionContent>
							</Section>

							<Section collapsible defaultOpen>
								<SectionHeader>
									<SectionTitle>Vídeo</SectionTitle>
								</SectionHeader>
								<SectionContent>
									<div className="flex flex-col gap-3">
										<div className="grid grid-cols-2 gap-2">
											<LabeledSelect
												label="Formato"
												value={options.container}
												onChange={(value) => {
													const container = value as ExportContainer;
													setOptions((prev) => ({ ...prev, container }));
												}}
												options={Object.entries(EXPORT_CONTAINER_LABELS).map(([value, label]) => ({
													value,
													label,
												}))}
											/>
											<LabeledSelect
												label="Codec"
												value={options.codec}
												onChange={(value) =>
													setOptions((prev) => ({ ...prev, codec: value as VideoCodec }))
												}
												options={videoCodecs.map((codec) => ({
													value: codec,
													label: VIDEO_CODEC_LABELS[codec],
												}))}
											/>
										</div>
										<div className="grid grid-cols-2 gap-2">
											<LabeledSelect
												label="Resolução"
												value={options.resolution.preset}
												onChange={(value) =>
													setOptions((prev) => ({
														...prev,
														resolution: {
															...prev.resolution,
															preset: value as ResolutionPreset,
															custom:
																value === "custom"
																	? (prev.resolution.custom ?? activeProject.settings.canvasSize)
																	: prev.resolution.custom,
														},
													}))
												}
												options={RESOLUTION_PRESET_VALUES.map((value) => ({
													value,
													label: RESOLUTION_PRESET_LABELS[value],
												}))}
											/>
											<LabeledSelect
												label="Taxa de quadros"
												value={options.frameRateId}
												onChange={(value) =>
													setOptions((prev) => ({ ...prev, frameRateId: value }))
												}
												options={[
													{ value: "project", label: "Igual ao projeto" },
													...EXPORT_FRAME_RATE_OPTIONS.map((o) => ({
														value: o.id,
														label: o.label,
													})),
												]}
											/>
										</div>

										{options.resolution.preset === "custom" && (
											<CustomResolutionFields
												value={options.resolution.custom ?? activeProject.settings.canvasSize}
												lockAspectRatio={options.resolution.lockAspectRatio ?? true}
												onChange={(custom) =>
													setOptions((prev) => ({
														...prev,
														resolution: { ...prev.resolution, custom },
													}))
												}
												onToggleLock={(lockAspectRatio) =>
													setOptions((prev) => ({
														...prev,
														resolution: { ...prev.resolution, lockAspectRatio },
													}))
												}
											/>
										)}

										<div className="grid grid-cols-2 gap-2">
											<LabeledSelect
												label="Qualidade"
												value={options.quality}
												onChange={(value) =>
													setOptions((prev) => ({
														...prev,
														quality: value as ExportQualityPreset,
													}))
												}
												options={Object.entries(EXPORT_QUALITY_LABELS).map(([value, label]) => ({
													value,
													label,
												}))}
											/>
											{options.quality === "custom" ? (
												<div className="flex flex-col gap-1.5">
													<Label className="text-xs">Bitrate de vídeo</Label>
													<Input
														size="sm"
														type="number"
														min={1}
														value={Math.round(options.videoBitrate / 1_000_000 * 10) / 10}
														onChange={(e) => {
															const mbps = Number.parseFloat(e.target.value);
															if (Number.isFinite(mbps) && mbps > 0) {
																setOptions((prev) => ({
																	...prev,
																	videoBitrate: Math.round(mbps * 1_000_000),
																}));
															}
														}}
													/>
												</div>
											) : (
												<div className="flex flex-col gap-1.5">
													<Label className="text-muted-foreground text-xs">
														Bitrate estimado
													</Label>
													<div className="border-border bg-accent text-muted-foreground flex h-7 items-center rounded-md border px-2.5 text-xs">
														~{(videoBitrate / 1_000_000).toFixed(1)} Mbps
													</div>
												</div>
											)}
										</div>

										<button
											type="button"
											onClick={() => setAdvancedOpen((v) => !v)}
											className="text-muted-foreground hover:text-foreground w-fit text-xs underline underline-offset-2"
										>
											{advancedOpen ? "Ocultar configurações avançadas" : "Configurações avançadas"}
										</button>

										{advancedOpen && (
											<div className="grid grid-cols-2 gap-2">
												<LabeledSelect
													label="Modo de bitrate"
													value={options.bitrateMode}
													onChange={(value) =>
														setOptions((prev) => ({
															...prev,
															bitrateMode: value as ExportOptions["bitrateMode"],
														}))
													}
													options={[
														{ value: "variable", label: "VBR (variável)" },
														{ value: "constant", label: "CBR (constante)" },
													]}
												/>
												<LabeledSelect
													label="Codificação"
													value={options.hardwareAcceleration}
													onChange={(value) =>
														setOptions((prev) => ({
															...prev,
															hardwareAcceleration: value as ExportOptions["hardwareAcceleration"],
														}))
													}
													options={[
														{ value: "no-preference", label: "Automática" },
														...(hasHardwareAccel
															? [{ value: "prefer-hardware", label: "Hardware (GPU)" }]
															: []),
														{ value: "prefer-software", label: "Software" },
													]}
												/>
											</div>
										)}
									</div>
								</SectionContent>
							</Section>

							<Section collapsible defaultOpen>
								<SectionHeader
									trailing={
										<Switch
											checked={options.audio.include}
											onCheckedChange={(checked) =>
												setOptions((prev) => ({
													...prev,
													audio: { ...prev.audio, include: checked },
												}))
											}
										/>
									}
								>
									<SectionTitle>Áudio</SectionTitle>
								</SectionHeader>
								{options.audio.include && (
									<SectionContent>
										<div className="flex flex-col gap-3">
											<div className="grid grid-cols-2 gap-2">
												<LabeledSelect
													label="Codec"
													value={options.audio.codec}
													onChange={(value) =>
														setOptions((prev) => ({
															...prev,
															audio: { ...prev.audio, codec: value as AudioCodec },
														}))
													}
													options={audioCodecs.map((codec) => ({
														value: codec,
														label: AUDIO_CODEC_LABELS[codec],
													}))}
												/>
												<LabeledSelect
													label="Bitrate"
													value={String(options.audio.bitrate)}
													onChange={(value) =>
														setOptions((prev) => ({
															...prev,
															audio: { ...prev.audio, bitrate: Number(value) },
														}))
													}
													options={[128_000, 192_000, 256_000, 320_000].map((bps) => ({
														value: String(bps),
														label: `${bps / 1000} kbps`,
													}))}
												/>
											</div>
											{advancedOpen && (
												<div className="grid grid-cols-2 gap-2">
													<LabeledSelect
														label="Sample rate"
														value={String(options.audio.sampleRate)}
														onChange={(value) =>
															setOptions((prev) => ({
																...prev,
																audio: {
																	...prev.audio,
																	sampleRate: Number(value) as 44_100 | 48_000,
																},
															}))
														}
														options={[
															{ value: "44100", label: "44.1 kHz" },
															{ value: "48000", label: "48 kHz" },
														]}
													/>
													<LabeledSelect
														label="Canais"
														value={String(options.audio.channels)}
														onChange={(value) =>
															setOptions((prev) => ({
																...prev,
																audio: { ...prev.audio, channels: Number(value) as 1 | 2 },
															}))
														}
														options={[
															{ value: "1", label: "Mono" },
															{ value: "2", label: "Stereo" },
														]}
													/>
												</div>
											)}
										</div>
									</SectionContent>
								)}
							</Section>

							<Section showTopBorder showBottomBorder={false}>
								<SectionContent>
									<div className="border-border bg-accent/40 flex flex-col gap-1 rounded-md border p-2.5">
										{summaryParts.map((part) => (
											<p key={part} className="text-muted-foreground text-xs">
												{part}
											</p>
										))}
										<p className="text-foreground pt-1 text-xs font-medium">
											Tamanho estimado: {formatEstimatedSize(estimatedBytes)}
										</p>
									</div>

									{showSavePresetInput ? (
										<div className="mt-2 flex items-center gap-1.5">
											<Input
												size="sm"
												placeholder="Nome da predefinição"
												value={presetNameDraft}
												onChange={(e) => setPresetNameDraft(e.target.value)}
											/>
											<Button
												variant="outline"
												size="sm"
												className="h-7 shrink-0 text-xs"
												onClick={async () => {
													if (!presetNameDraft.trim()) return;
													const { filename: _f, ...settings } = options;
													await saveCustomPreset({ name: presetNameDraft.trim(), settings });
													setPresetNameDraft("");
													setShowSavePresetInput(false);
												}}
											>
												Salvar
											</Button>
										</div>
									) : (
										<button
											type="button"
											onClick={() => setShowSavePresetInput(true)}
											className="text-muted-foreground hover:text-foreground mt-2 text-xs underline underline-offset-2"
										>
											Salvar predefinição
										</button>
									)}
								</SectionContent>
							</Section>

							<div className="p-3 pt-0">
								<Button onClick={handleExport} className="w-full gap-2">
									<Download className="size-4" />
									Exportar
								</Button>
							</div>
						</div>
					)}

					{isExporting && (
						<div className="space-y-4 p-3">
							<div className="flex flex-col gap-2">
								<div className="flex items-center justify-between text-center">
									<p className="text-muted-foreground text-sm">
										{Math.round(progress * 100)}%
									</p>
									<p className="text-muted-foreground text-sm">100%</p>
								</div>
								<Progress value={progress * 100} className="w-full" />
								<div className="text-muted-foreground flex justify-between text-xs">
									<span>Tempo decorrido: {formatDuration(elapsedMs)}</span>
									<span>
										{remainingMs !== null
											? `~${formatDuration(remainingMs)} restante`
											: "Calculando…"}
									</span>
								</div>
							</div>

							<Button
								variant="outline"
								className="w-full rounded-md"
								onClick={handleCancel}
							>
								Cancelar
							</Button>
						</div>
					)}
				</>
			)}
		</PopoverContent>
	);
}

function LabeledSelect({
	label,
	value,
	onChange,
	options,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	options: { value: string; label: string }[];
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<Label className="text-xs">{label}</Label>
			<Select value={value} onValueChange={onChange}>
				<SelectTrigger className="h-7 w-full text-xs">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

function CustomResolutionFields({
	value,
	lockAspectRatio,
	onChange,
	onToggleLock,
}: {
	value: { width: number; height: number };
	lockAspectRatio: boolean;
	onChange: (size: { width: number; height: number }) => void;
	onToggleLock: (locked: boolean) => void;
}) {
	const aspect = value.width / value.height || 1;

	return (
		<div className="flex items-end gap-2">
			<div className="flex flex-col gap-1.5">
				<Label className="text-xs">Largura</Label>
				<Input
					size="sm"
					type="number"
					value={value.width}
					onChange={(e) => {
						const width = Number.parseInt(e.target.value, 10);
						if (!Number.isFinite(width) || width <= 0) return;
						onChange({
							width,
							height: lockAspectRatio ? Math.round(width / aspect) : value.height,
						});
					}}
				/>
			</div>
			<div className="flex flex-col gap-1.5">
				<Label className="text-xs">Altura</Label>
				<Input
					size="sm"
					type="number"
					value={value.height}
					onChange={(e) => {
						const height = Number.parseInt(e.target.value, 10);
						if (!Number.isFinite(height) || height <= 0) return;
						onChange({
							width: lockAspectRatio ? Math.round(height * aspect) : value.width,
							height,
						});
					}}
				/>
			</div>
			<Button
				type="button"
				variant={lockAspectRatio ? "secondary" : "outline"}
				size="icon"
				className="mb-0 size-7 shrink-0"
				title="Manter proporção"
				onClick={() => onToggleLock(!lockAspectRatio)}
			>
				🔗
			</Button>
		</div>
	);
}

function ExportComplete({
	options,
	onClose,
}: {
	options: ExportOptions;
	onClose: () => void;
}) {
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActive());
	const exportState = useEditor((e) => e.project.getExportState());
	const buffer = exportState.result?.buffer;

	const handlePlay = () => {
		if (!buffer) return;
		const blob = new Blob([buffer], { type: getExportMimeType({ container: options.container }) });
		const url = URL.createObjectURL(blob);
		window.open(url, "_blank");
	};

	return (
		<div className="flex flex-col gap-4 p-4">
			<div className="flex items-center gap-2">
				<div className="bg-constructive/15 text-constructive flex size-6 shrink-0 items-center justify-center rounded-full">
					<Check className="size-3.5" />
				</div>
				<p className="text-sm font-medium">Exportação concluída</p>
			</div>
			<p className="text-muted-foreground text-xs">
				{options.filename || activeProject.metadata.name}
				{getExportFileExtension({ container: options.container })}
			</p>
			<div className="flex gap-2">
				<Button variant="outline" size="sm" className="h-8 flex-1 gap-1.5 text-xs" onClick={handlePlay}>
					<Play className="size-3.5" />
					Reproduzir
				</Button>
				<Button size="sm" className="h-8 flex-1 text-xs" onClick={() => { editor.project.clearExportState(); onClose(); }}>
					Fechar
				</Button>
			</div>
		</div>
	);
}

function ExportError({
	error,
	onRetry,
}: {
	error: string;
	onRetry: () => void;
}) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(error);
		setCopied(true);
		setTimeout(() => setCopied(false), 1000);
	};

	return (
		<div className="space-y-4 p-3">
			<div className="flex flex-col gap-1.5">
				<p className="text-destructive text-sm font-medium">Falha na exportação</p>
				<p className="text-muted-foreground text-xs">{error}</p>
			</div>

			<div className="flex gap-2">
				<Button
					variant="outline"
					size="sm"
					className="h-8 flex-1 text-xs"
					onClick={handleCopy}
				>
					{copied ? <Check className="text-constructive" /> : <Copy />}
					Copiar
				</Button>
				<Button
					variant="outline"
					size="sm"
					className="h-8 flex-1 text-xs"
					onClick={onRetry}
				>
					<RotateCcw />
					Tentar novamente
				</Button>
			</div>
		</div>
	);
}
