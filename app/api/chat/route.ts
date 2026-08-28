import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { buildSnapshot } from "@/lib/snapshot";
import { SYSTEM_CONTEXT } from "@/lib/system-context";

export const dynamic = "force-dynamic";
export const preferredRegion = "fra1";

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });
    const { message } = await req.json();
    const userMessage = String(message || "Explain the current BTC positioning setup.").slice(0, 5000);
    const snapshot = await buildSnapshot({ persist: true, includePatterns: true });
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.4",
      instructions: `${SYSTEM_CONTEXT}\nYou are the BTC Positioning Research Copilot. Explain the live snapshot clearly. Distinguish observed data, inference and hypothesis. Never present a trade as guaranteed or instruct automatic execution.`,
      input: `LIVE SNAPSHOT:\n${JSON.stringify(snapshot, null, 2)}\n\nUSER QUESTION:\n${userMessage}`,
    });
    return NextResponse.json({ text: response.output_text, snapshotTimestamp: snapshot.timestamp });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
