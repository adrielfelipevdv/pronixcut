"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PropertyParamField } from "@/components/editor/panels/properties/components/property-param-field";
import { useEditor } from "@/editor/use-editor";
import {
	COLOR_GRADE_COLOR_PARAMS,
	COLOR_GRADE_DETAIL_PARAMS,
	COLOR_GRADE_LIGHT_PARAMS,
	COLOR_GRADE_NEUTRAL,
	type ColorGradeValues,
} from "../params";
import { COLOR_GRADE_EFFECT_TYPE } from "../definition";
import { presetToEffectParams } from "../presets";
import { useCustomEffectPresetsStore } from "../custom-presets-store";

export function ColorGradeEditorDialog({
	open,
	onOpenChange,
	initialValues,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialValues?: Partial<ColorGradeValues>;
}) {
	const editor = useEditor();
	const savePreset = useCustomEffectPresetsStore((s) => s.save);
	const [values, setValues] = useState<ColorGradeValues>({
		...COLOR_GRADE_NEUTRAL,
		...initialValues,
	});
	const [name, setName] = useState("");
	const [isSaving, setIsSaving] = useState(false);

	const setParam = (key: keyof ColorGradeValues) => (value: number | string | boolean) => {
		setValues((prev) => ({ ...prev, [key]: Number(value) }));
	};

	const handleApply = () => {
		const selected = editor.selection.getSelectedElements()[0];
		if (!selected) {
			toast.error("Selecione um clipe na timeline para aplicar o efeito");
			return;
		}
		editor.timeline.addClipEffect({
			trackId: selected.trackId,
			elementId: selected.elementId,
			effectType: COLOR_GRADE_EFFECT_TYPE,
			initialParams: presetToEffectParams(values),
		});
		toast.success("Efeito aplicado ao clipe selecionado");
		onOpenChange(false);
	};

	const handleSave = async () => {
		if (!name.trim()) {
			toast.error("Dê um nome para o efeito");
			return;
		}
		setIsSaving(true);
		try {
			await savePreset({ name: name.trim(), values });
			toast.success(`"${name.trim()}" salvo em Meus efeitos`);
			setName("");
			onOpenChange(false);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Criar efeito</DialogTitle>
					<DialogDescription>
						Ajuste os controles abaixo — cada um modifica a imagem de verdade.
						Aplique num clipe selecionado ou salve como um novo efeito em
						"Meus efeitos".
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-5">
					<ParamGroup title="Luz" params={COLOR_GRADE_LIGHT_PARAMS} values={values} setParam={setParam} />
					<ParamGroup title="Cor" params={COLOR_GRADE_COLOR_PARAMS} values={values} setParam={setParam} />
					<ParamGroup title="Detalhes" params={COLOR_GRADE_DETAIL_PARAMS} values={values} setParam={setParam} />
				</div>

				<DialogFooter className="flex-col gap-3 sm:flex-col sm:space-x-0">
					<div className="flex w-full flex-col gap-1.5">
						<Label htmlFor="effect-name" className="text-xs">
							Nome do efeito
						</Label>
						<div className="flex gap-2">
							<Input
								id="effect-name"
								value={name}
								onChange={(event) => setName(event.target.value)}
								placeholder="Ex: Meu efeito comercial"
								className="flex-1"
							/>
							<Button variant="outline" onClick={handleSave} disabled={isSaving}>
								Salvar efeito
							</Button>
						</div>
					</div>
					<Button onClick={handleApply} className="w-full">
						Aplicar no clipe selecionado
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function ParamGroup({
	title,
	params,
	values,
	setParam,
}: {
	title: string;
	params: { key: string; label: string; type: "number"; default: number; min: number; max?: number; step: number }[];
	values: ColorGradeValues;
	setParam: (key: keyof ColorGradeValues) => (value: number | string | boolean) => void;
}) {
	return (
		<div className="flex flex-col gap-3">
			<p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{title}</p>
			<div className="flex flex-col gap-3">
				{params.map((param) => (
					<div key={param.key} className="flex items-center justify-between gap-3">
						<Label className="w-28 shrink-0 text-xs">{param.label}</Label>
						<div className="flex-1">
							<PropertyParamField
								param={param}
								value={values[param.key as keyof ColorGradeValues]}
								onPreview={setParam(param.key as keyof ColorGradeValues)}
								onCommit={() => {}}
							/>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
