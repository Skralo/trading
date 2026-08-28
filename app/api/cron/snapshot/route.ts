import { NextRequest, NextResponse } from "next/server";
import { buildSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";
export const preferredRegion = "fra1";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const snapshot = await buildSnapshot({ persist: true, includePatterns: false });
    return NextResponse.json({ ok: true, ts: snapshot.timestamp, score: snapshot.analysis.setupScore });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
