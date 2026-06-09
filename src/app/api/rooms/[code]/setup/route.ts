import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadRoomPayload, addSystemMessage } from "@/lib/roomData";

const setupSchema = z.object({
  parentAName: z.string().trim().max(60).default(""),
  parentAJob: z.string().trim().max(80).default(""),
  parentAPregnancyRole: z.string().trim().max(20).default(""),
  parentA: z.string().trim().max(2000).default(""),
  parentBName: z.string().trim().max(60).default(""),
  parentBJob: z.string().trim().max(80).default(""),
  parentBPregnancyRole: z.string().trim().max(20).default(""),
  parentB: z.string().trim().max(2000).default(""),
  world: z.string().trim().max(2000).default("现实向"),
});

type RouteContext = {
  params: Promise<{ code: string }> | { code: string };
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const params = await Promise.resolve(context.params);
    const code = String(params.code).toUpperCase();
    const setup = setupSchema.parse(await request.json());
    const supabase = supabaseAdmin();
    const payload = await loadRoomPayload(code);

    const { error } = await supabase
      .from("game_states")
      .update({ setup, updated_at: new Date().toISOString() })
      .eq("room_id", payload.room.id);
    if (error) throw error;

    await addSystemMessage(payload.room.id, "开局设定已保存。确认无误后输入“开始游戏”。");
    const nextPayload = await loadRoomPayload(code);
    return NextResponse.json({ ok: true, payload: nextPayload });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "保存设定失败" },
      { status: 400 },
    );
  }
}
