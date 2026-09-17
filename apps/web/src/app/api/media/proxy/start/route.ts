import { type NextRequest, NextResponse } from "next/server";
import { startProxyJob, type ProxyPurpose } from "@/server/proxy-jobs";

const MAX_BYTES = 4 * 1024 * 1024 * 1024; // 4GB safety cap for source clips

export async function POST(request: NextRequest) {
	const formData = await request.formData();
	const file = formData.get("file");
	const purposeRaw = formData.get("purpose");
	const purpose: ProxyPurpose = purposeRaw === "export" ? "export" : "preview";

	if (!(file instanceof File)) {
		return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
	}
	if (file.size > MAX_BYTES) {
		return NextResponse.json({ error: "Arquivo excede o limite de 4GB." }, { status: 413 });
	}

	const result = await startProxyJob({ file, purpose });
	if ("error" in result) {
		return NextResponse.json({ error: result.error }, { status: 501 });
	}

	return NextResponse.json(result, { status: 202 });
}
