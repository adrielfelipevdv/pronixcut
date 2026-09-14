import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PronixEditorProvider = "openai" | "gemini";
export type PronixEditorAspectRatio = "1:1" | "9:16" | "16:9";

// Mirrors the provider set configurable in the original PronixEditor's
// "Integrações" tab: openai/gemini power image+video generation, anthropic
// powers caption text cleanup, and tiktokSearch powers the B-Roll AI
// reference search (tiktokapi.store).
export type IntegrationProviderId = "openai" | "gemini" | "anthropic" | "tiktokSearch";

export interface PronixEditorGeneratedImage {
	id: string;
	prompt: string;
	dataUrl: string;
	createdAt: string;
	approvalStatus: "pending" | "approved" | "rejected";
}

interface IntegrationProviderConfig {
	enabled: boolean;
	apiKey: string;
}

export interface IntegrationEventLogEntry {
	id: string;
	timestamp: string;
	type: string;
	provider?: IntegrationProviderId;
	detail: string;
}

interface PronixEditorStore {
	provider: PronixEditorProvider;
	setProvider: (provider: PronixEditorProvider) => void;

	integrations: Record<IntegrationProviderId, IntegrationProviderConfig>;
	setIntegrationApiKey: (params: {
		provider: IntegrationProviderId;
		apiKey: string;
	}) => void;
	setIntegrationEnabled: (params: {
		provider: IntegrationProviderId;
		enabled: boolean;
	}) => void;

	/** Ported from the original's "IA na legenda numa passada só" preferences. */
	requireApprovalBeforeAdding: boolean;
	setRequireApprovalBeforeAdding: (value: boolean) => void;
	maxGenerationsPerDay: number;
	setMaxGenerationsPerDay: (value: number) => void;
	generationCountToday: number;
	generationCountDate: string;

	aspectRatio: PronixEditorAspectRatio;
	setAspectRatio: (aspectRatio: PronixEditorAspectRatio) => void;
	prompt: string;
	setPrompt: (prompt: string) => void;
	results: PronixEditorGeneratedImage[];
	addResults: (images: Omit<PronixEditorGeneratedImage, "approvalStatus">[]) => void;
	removeResult: (id: string) => void;
	setResultApproval: (params: {
		id: string;
		status: "approved" | "rejected";
	}) => void;

	eventLog: IntegrationEventLogEntry[];
	logEvent: (params: {
		type: string;
		provider?: IntegrationProviderId;
		detail: string;
	}) => void;

	/** Returns null if generation is allowed, or a user-facing reason if blocked. */
	checkDailyLimit: () => string | null;
	recordGeneration: (count: number) => void;
}

function todayKey(): string {
	return new Date().toISOString().slice(0, 10);
}

export const usePronixEditorStore = create<PronixEditorStore>()(
	persist(
		(set, get) => ({
			provider: "openai",
			setProvider: (provider) => set({ provider }),

			integrations: {
				openai: { enabled: true, apiKey: "" },
				gemini: { enabled: true, apiKey: "" },
				anthropic: { enabled: false, apiKey: "" },
				tiktokSearch: { enabled: false, apiKey: "" },
			},
			setIntegrationApiKey: ({ provider, apiKey }) =>
				set((state) => ({
					integrations: {
						...state.integrations,
						[provider]: { ...state.integrations[provider], apiKey },
					},
				})),
			setIntegrationEnabled: ({ provider, enabled }) =>
				set((state) => ({
					integrations: {
						...state.integrations,
						[provider]: { ...state.integrations[provider], enabled },
					},
				})),

			requireApprovalBeforeAdding: false,
			setRequireApprovalBeforeAdding: (value) =>
				set({ requireApprovalBeforeAdding: value }),
			maxGenerationsPerDay: 20,
			setMaxGenerationsPerDay: (value) => set({ maxGenerationsPerDay: value }),
			generationCountToday: 0,
			generationCountDate: todayKey(),

			aspectRatio: "16:9",
			setAspectRatio: (aspectRatio) => set({ aspectRatio }),
			prompt: "",
			setPrompt: (prompt) => set({ prompt }),
			results: [],
			addResults: (images) =>
				set((state) => ({
					results: [
						...images.map((image) => ({
							...image,
							approvalStatus: "pending" as const,
						})),
						...state.results,
					],
				})),
			removeResult: (id) =>
				set((state) => ({
					results: state.results.filter((result) => result.id !== id),
				})),
			setResultApproval: ({ id, status }) =>
				set((state) => ({
					results: state.results.map((result) =>
						result.id === id ? { ...result, approvalStatus: status } : result,
					),
				})),

			eventLog: [],
			logEvent: ({ type, provider, detail }) =>
				set((state) => ({
					eventLog: [
						{
							id: crypto.randomUUID(),
							timestamp: new Date().toISOString(),
							type,
							provider,
							detail,
						},
						...state.eventLog,
					].slice(0, 100),
				})),

			checkDailyLimit: () => {
				const state = get();
				const today = todayKey();
				const count =
					state.generationCountDate === today ? state.generationCountToday : 0;
				if (count >= state.maxGenerationsPerDay) {
					return `Limite diário de ${state.maxGenerationsPerDay} gerações atingido. Ajuste o limite nas configurações do PronixEditor ou tente novamente amanhã.`;
				}
				return null;
			},
			recordGeneration: (count) => {
				const today = todayKey();
				set((state) => ({
					generationCountDate: today,
					generationCountToday:
						(state.generationCountDate === today
							? state.generationCountToday
							: 0) + count,
				}));
			},
		}),
		{
			name: "pronix-editor",
		},
	),
);
