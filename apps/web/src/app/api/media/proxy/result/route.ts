import { type NextRequest, NextResponse } from "next/server";
import { completeJob, getJobSnapshot, readJobResult } from "@/server/proxy-jobs";

export async function GET(request: NextRequest) {
	const jobId = request.nextUrl.searchParams.get("jobId");
	if (!jobId) {
		return NextResponse.json({ error: "jobId ausente." }, { status: 400 });
	}

	const snapshot = getJobSnapshot(jobId);
	if (!snapshot) {
		return NextResponse.json({ error: "Job não encontrado." }, { status: 404 });
	}
	if (snapshot.status !== "ready") {
		return NextResponse.json({ error: "Proxy ainda não está pronto." }, { status: 409 });
	}

	const buffer = await readJobResult(jobId);
	if (!buffer) {
		return NextResponse.json({ error: "Arquivo de proxy não encontrado." }, { status: 404 });
	}

	completeJob(jobId);

	return new NextResponse(new Uint8Array(buffer), {
		headers: { "Content-Type": "video/mp4" },
	});
}
