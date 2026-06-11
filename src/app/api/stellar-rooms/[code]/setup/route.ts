import { NextResponse } from "next/server";
import { z } from "zod";
import { checkStellarAnomaly } from "@/lib/stellarGame";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadStellarRoomPayload } from "@/lib/stellarRoomData";
import type { StellarSystemSetup } from "@/lib/stellarGame";

const setupSchema = z.object({
  starAlpha: z.object({
    name: z.string().trim().min(1).max(20),
    type: z.string().trim().min(1).max(30),
    color: z.string().trim().min(4).max(10),
    mass: z.number().min(0.1).max(50),
  }),
  starBeta: z.object({
    name: z.string().trim().min(1).max(20),
    type: z.string().trim().min(1).max(30),
    color: z.string().trim().min(4).max(10),
    mass: z.number().min(0.1).max(50),
  }),
});

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const params = await context.params;
    const code = params.code.trim().toUpperCase();
    const body = setupSchema.parse(await request.json().catch(() => ({})));
    const supabase = supabaseAdmin();

    // 查找房间
    const { data: room, error: roomError } = await supabase
      .from("stellar_rooms")
      .select("id")
      .eq("room_code", code)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ ok: false, error: "星系迷途：找不到该房间" }, { status: 404 });
    }

    const isAnomaly = checkStellarAnomaly(body as StellarSystemSetup);
    
    const setupData: StellarSystemSetup = {
      ...body,
      isAnomaly,
      systemNotes: isAnomaly
        ? "【高维异常】此星系被判定为卡尔达肖夫III型人造天体，物理常数已进入变异模式"
        : "天体核聚变参数正常，物理常数稳定",
    };

    const { error: updateError } = await supabase
      .from("stellar_game_states")
      .update({ stellar_setup: setupData })
      .eq("room_id", room.id);

    if (updateError) throw updateError;

    const payload = await loadStellarRoomPayload(code);
    return NextResponse.json({ ok: true, payload });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "双星参数校正失败" },
      { status: 400 },
    );
  }
}