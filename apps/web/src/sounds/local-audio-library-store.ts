import { create } from "zustand";
import { toast } from "sonner";
import { EditorCore } from "@/core";
import { buildLibraryAudioElement } from "@/timeline/element-utils";
import { mediaTimeFromSeconds } from "@/wasm";

export interface AudioLibraryItem {
	id: string;
	name: string;
	storedFilename: string;
	mimeType: string;
	size: number;
	duration: number | null;
	importedAt: string;
}

interface LocalAudioLibraryStore {
	items: AudioLibraryItem[];
	isLoaded: boolean;
	isLoading: boolean;
	isImporting: boolean;
	load: () => Promise<void>;
	importFiles: (files: File[]) => Promise<void>;
	remove: (id: string) => Promise<void>;
	addToTimeline: (item: AudioLibraryItem) => Promise<boolean>;
}

export const useLocalAudioLibraryStore = create<LocalAudioLibraryStore>((set, get) => ({
	items: [],
	isLoaded: false,
	isLoading: false,
	isImporting: false,

	load: async () => {
		if (get().isLoaded || get().isLoading) return;
		set({ isLoading: true });
		try {
			const response = await fetch("/api/media-library/audio");
			const data = await response.json();
			set({ items: data.items ?? [], isLoaded: true });
		} catch (error) {
			console.error("Failed to load audio library:", error);
			toast.error("Falha ao carregar a biblioteca de áudio");
		} finally {
			set({ isLoading: false });
		}
	},

	importFiles: async (files) => {
		set({ isImporting: true });
		try {
			for (const file of files) {
				try {
					const formData = new FormData();
					formData.append("file", file);
					const response = await fetch("/api/media-library/audio", {
						method: "POST",
						body: formData,
					});
					const data = await response.json();
					if (!response.ok) {
						toast.error(`Falha ao importar "${file.name}"`, {
							description: data.error,
						});
						continue;
					}
					set((state) => ({ items: [data.item, ...state.items] }));
				} catch (error) {
					console.error("Failed to import library audio:", error);
					toast.error(`Falha ao importar "${file.name}"`, {
						description:
							error instanceof Error ? error.message : "Erro desconhecido",
					});
				}
			}
		} finally {
			set({ isImporting: false });
		}
	},

	remove: async (id) => {
		const previous = get().items;
		set({ items: previous.filter((item) => item.id !== id) });
		try {
			const response = await fetch(`/api/media-library/audio/${id}`, { method: "DELETE" });
			if (!response.ok) throw new Error("Falha ao remover");
		} catch (error) {
			set({ items: previous });
			toast.error("Falha ao remover áudio da biblioteca");
			console.error("Failed to remove library audio:", error);
		}
	},

	addToTimeline: async (item) => {
		try {
			const editor = EditorCore.getInstance();
			const currentTime = editor.playback.getCurrentTime();
			const sourceUrl = `/api/media-library/audio/file/${item.id}`;

			const response = await fetch(sourceUrl);
			if (!response.ok) throw new Error(`Failed to load audio: ${response.statusText}`);
			const arrayBuffer = await response.arrayBuffer();
			const audioContext = new AudioContext();
			const buffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

			const element = buildLibraryAudioElement({
				sourceUrl,
				name: item.name,
				duration: item.duration
					? mediaTimeFromSeconds({ seconds: item.duration })
					: mediaTimeFromSeconds({ seconds: buffer.duration }),
				startTime: currentTime,
				buffer,
			});

			editor.timeline.insertElement({
				placement: { mode: "auto", trackType: "audio" },
				element,
			});
			return true;
		} catch (error) {
			console.error("Failed to add library audio to timeline:", error);
			toast.error(
				error instanceof Error ? error.message : "Falha ao adicionar áudio à linha do tempo",
			);
			return false;
		}
	},
}));
