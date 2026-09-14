"use client";

import {
	Section,
	SectionContent,
	SectionHeader,
	SectionTitle,
} from "@/components/section";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
	usePronixEditorStore,
	type IntegrationProviderId,
} from "@/pronix-editor/store";

// Hints ported verbatim (translated) from the original PronixEditor's
// Integrations tab, so the user knows exactly where to get each key.
const INTEGRATION_LABELS: Record<
	IntegrationProviderId,
	{ label: string; hint: string }
> = {
	openai: {
		label: "OpenAI",
		hint: 'Chave de API da OpenAI / ChatGPT (platform.openai.com → API keys) — começa com "sk-". Serve para imagem e texto.',
	},
	gemini: {
		label: "Google Gemini",
		hint: "Chave de API do Google AI Studio (aistudio.google.com → Get API key). Imagem, vídeo e texto.",
	},
	anthropic: {
		label: "Anthropic (Claude)",
		hint: 'Chave de API do Claude (console.anthropic.com → API keys) — começa com "sk-ant-". Usada para corrigir texto de legendas com IA.',
	},
	tiktokSearch: {
		label: "TikTok Search",
		hint: "Chave de API do tiktokapi.store, usada pela busca de referências de B-roll na aba B-Roll IA.",
	},
};

export function IntegrationsTab() {
	const {
		integrations,
		setIntegrationApiKey,
		setIntegrationEnabled,
		requireApprovalBeforeAdding,
		setRequireApprovalBeforeAdding,
		maxGenerationsPerDay,
		setMaxGenerationsPerDay,
		eventLog,
	} = usePronixEditorStore();

	return (
		<div className="flex flex-col">
			<Section showTopBorder={false}>
				<SectionHeader>
					<SectionTitle className="flex-1">Provedores de IA</SectionTitle>
				</SectionHeader>
				<SectionContent className="flex flex-col gap-3 px-2 pb-3">
					{(Object.keys(INTEGRATION_LABELS) as IntegrationProviderId[]).map((key) => (
						<div key={key} className="border-border flex flex-col gap-1.5 rounded-md border p-2">
							<div className="flex items-center gap-2">
								<Checkbox
									id={`integration-${key}`}
									checked={integrations[key].enabled}
									onCheckedChange={(checked) =>
										setIntegrationEnabled({ provider: key, enabled: !!checked })
									}
								/>
								<Label htmlFor={`integration-${key}`} className="text-sm">
									{INTEGRATION_LABELS[key].label}
								</Label>
							</div>
							<Input
								type="password"
								placeholder="Chave de API"
								value={integrations[key].apiKey}
								onChange={(event) =>
									setIntegrationApiKey({ provider: key, apiKey: event.target.value })
								}
								disabled={!integrations[key].enabled}
							/>
							<p className="text-muted-foreground text-xs">{INTEGRATION_LABELS[key].hint}</p>
						</div>
					))}
				</SectionContent>
			</Section>

			<Section showTopBorder={false}>
				<SectionHeader>
					<SectionTitle className="flex-1">Preferências</SectionTitle>
				</SectionHeader>
				<SectionContent className="flex flex-col gap-3 px-2 pb-3">
					<div className="flex items-center gap-2">
						<Checkbox
							id="require-approval"
							checked={requireApprovalBeforeAdding}
							onCheckedChange={(checked) => setRequireApprovalBeforeAdding(!!checked)}
						/>
						<Label htmlFor="require-approval" className="text-sm">
							Exigir aprovação antes de adicionar à biblioteca
						</Label>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="max-generations" className="text-sm">
							Limite de gerações por dia
						</Label>
						<Input
							id="max-generations"
							type="number"
							min={1}
							value={maxGenerationsPerDay}
							onChange={(event) =>
								setMaxGenerationsPerDay(Math.max(1, Number(event.target.value) || 1))
							}
						/>
					</div>
				</SectionContent>
			</Section>

			{eventLog.length > 0 && (
				<Section showTopBorder={false}>
					<SectionHeader>
						<SectionTitle className="flex-1">Logs das integrações</SectionTitle>
					</SectionHeader>
					<SectionContent className="flex flex-col gap-1.5 px-2 pb-3">
						{eventLog.slice(0, 20).map((entry) => (
							<div key={entry.id} className="text-muted-foreground text-xs">
								<span className="text-foreground/70">
									{new Date(entry.timestamp).toLocaleTimeString("pt-BR")}
								</span>{" "}
								— {entry.detail}
							</div>
						))}
					</SectionContent>
				</Section>
			)}
		</div>
	);
}
