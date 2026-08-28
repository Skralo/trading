import { NextResponse } from "next/server";
import { buildSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";
export const preferredRegion = "fra1";

export async function GET() {
  try {
    const snapshot = await buildSnapshot({ persist: true, includePatterns: true });
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
