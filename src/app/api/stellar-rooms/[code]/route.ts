import { NextResponse } from "next/server";
import { loadStellarRoomPayload } from "@/lib/stellarRoomData";

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const params = await context.params;
    const code = params.code.trim().toUpperCase();
    const payload = await loadStellarRoomPayload(code);
    return NextResponse.json({ ok: true, payload });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "星系状态获取失败" },
      { status: 404 },
    );
  }
}