import { type NextRequest, NextResponse } from "next/server";
import { getJobSnapshot } from "@/server/proxy-jobs";

export async function GET(request: NextRequest) {
	const jobId = request.nextUrl.searchParams.get("jobId");
	if (!jobId) {
		return NextResponse.json({ error: "jobId ausente." }, { status: 400 });
	}

	const snapshot = getJobSnapshot(jobId);
	if (!snapshot) {
		return NextResponse.json({ error: "Job não encontrado." }, { status: 404 });
	}

	return NextResponse.json(snapshot);
}
