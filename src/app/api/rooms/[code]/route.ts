import { NextResponse } from "next/server";
import { loadRoomPayload } from "@/lib/roomData";

export async function GET(_request: Request, context: any) {
  try {
    const params = await Promise.resolve(context.params);
    const payload = await loadRoomPayload(params.code);
    return NextResponse.json({ ok: true, payload });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "读取房间失败" },
      { status: 404 },
    );
  }
}
