import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadStellarRoomPayload } from "@/lib/stellarRoomData";

export async function POST(request: Request, context: { params: Promise<{ code: string; saveId: string }> }) {
  try {
    const params = await context.params;
    const code = params.code.trim().toUpperCase();
    const saveId = params.saveId;
    const supabase = supabaseAdmin();

    const { data: save, error: saveError } = await supabase
      .from("stellar_saves")
      .select("stellar_setup, planetary_state, room_status, current_turn, current_epoch, message_max_id")
      .eq("room_id", (await supabase.from("stellar_rooms").select("id").eq("room_code", code).single()).data?.id)
      .eq("id", saveId)
      .single();

    if (saveError || !save) {
      return NextResponse.json({ ok: false, error: "时空存档破碎" }, { status: 404 });
    }

    const roomId = (await supabase.from("stellar_rooms").select("id").eq("room_code", code).single()).data?.id;

    // 恢复房间状态
    await supabase
      .from("stellar_rooms")
      .update({
        status: save.room_status,
        current_turn: save.current_turn,
        current_epoch: save.current_epoch,
      })
      .eq("id", roomId);

    // 恢复游戏状态
    await supabase
      .from("stellar_game_states")
      .update({
        stellar_setup: save.stellar_setup,
        planetary_state: save.planetary_state,
      })
      .eq("room_id", roomId);

    // 清除当前消息
    await supabase.from("stellar_messages").delete().eq("room_id", roomId);

    // 恢复消息
    const payload = await loadStellarRoomPayload(code);
    return NextResponse.json({ ok: true, payload });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "时空穿梭失败" },
      { status: 400 },
    );
  }
}