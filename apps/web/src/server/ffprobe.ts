import { spawn } from "node:child_process";
import { getFfprobePath } from "./ffmpeg-paths";

export interface ProbedMediaInfo {
	container: string | null;
	videoCodec: string | null;
	videoCodecLongName: string | null;
	width: number | null;
	height: number | null;
	fps: number | null;
	pixFmt: string | null;
	duration: number | null;
	audioCodec: string | null;
}

interface FfprobeStream {
	codec_type?: string;
	codec_name?: string;
	codec_long_name?: string;
	width?: number;
	height?: number;
	pix_fmt?: string;
	r_frame_rate?: string;
	avg_frame_rate?: string;
	duration?: string;
}

interface FfprobeOutput {
	format?: { format_name?: string; duration?: string };
	streams?: FfprobeStream[];
}

function parseFrameRate(value: string | undefined): number | null {
	if (!value) return null;
	const [num, den] = value.split("/").map(Number);
	if (!Number.isFinite(num)) return null;
	if (!den) return num;
	return num / den;
}

export function probeMediaFile(filePath: string): Promise<ProbedMediaInfo> {
	return new Promise((resolve, reject) => {
		const child = spawn(getFfprobePath(), [
			"-v",
			"error",
			"-print_format",
			"json",
			"-show_format",
			"-show_streams",
			filePath,
		]);

		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString();
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		child.on("error", (error) => reject(error));
		child.on("close", (code) => {
			if (code !== 0) {
				reject(new Error(`ffprobe saiu com código ${code}: ${stderr.slice(-1000)}`));
				return;
			}

			try {
				const parsed: FfprobeOutput = JSON.parse(stdout);
				const videoStream = parsed.streams?.find((s) => s.codec_type === "video");
				const audioStream = parsed.streams?.find((s) => s.codec_type === "audio");

				resolve({
					container: parsed.format?.format_name ?? null,
					videoCodec: videoStream?.codec_name ?? null,
					videoCodecLongName: videoStream?.codec_long_name ?? null,
					width: videoStream?.width ?? null,
					height: videoStream?.height ?? null,
					fps:
						parseFrameRate(videoStream?.avg_frame_rate) ??
						parseFrameRate(videoStream?.r_frame_rate),
					pixFmt: videoStream?.pix_fmt ?? null,
					duration: parsed.format?.duration
						? Number.parseFloat(parsed.format.duration)
						: videoStream?.duration
							? Number.parseFloat(videoStream.duration)
							: null,
					audioCodec: audioStream?.codec_name ?? null,
				});
			} catch (error) {
				reject(error instanceof Error ? error : new Error("Falha ao interpretar a saída do ffprobe"));
			}
		});
	});
}

export function isHevcCodec(codec: string | null | undefined): boolean {
	if (!codec) return false;
	const normalized = codec.toLowerCase();
	return normalized === "hevc" || normalized === "h265";
}
