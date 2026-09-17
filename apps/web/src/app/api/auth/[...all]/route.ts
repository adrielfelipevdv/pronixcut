import { auth } from "@/auth/server";
import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";

const handlers = auth ? toNextJsHandler(auth) : null;

function unavailable() {
	return NextResponse.json(
		{ error: "Recurso indisponível nesta instalação." },
		{ status: 501 },
	);
}

export async function GET(request: Request) {
	return handlers ? handlers.GET(request) : unavailable();
}

export async function POST(request: Request) {
	return handlers ? handlers.POST(request) : unavailable();
}
