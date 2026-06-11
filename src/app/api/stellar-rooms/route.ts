import { NextResponse } from "next/server";
import { z } from "zod";
import { makeStellarRoomCode, initialPlanetaryState } from "@/lib/stellarGame";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadStellarRoomPayload, addStellarSystemMessage } from "@/lib/stellarRoomData";

const createSchema = z.object({
  displayName: z.string().trim().min(1).max(30).default("主星意志A"),
});

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await request.json().catch(() => ({})));
    const supabase = supabaseAdmin();
    const state = initialPlanetaryState();

    let room = null;
    for (let i = 0; i < 8; i += 1) {
      const roomCode = makeStellarRoomCode();
      const { data, error } = await supabase
        .from("stellar_rooms")
        .insert({
          room_code: roomCode,
          status: "setup",
          current_turn: state.turn,
          current_epoch: state.epoch,
        })
        .select("id, room_code")
        .single();

      if (!error && data) {
        room = data;
        break;
      }
    }

    if (!room) throw new Error("重粒子爆胀星盘失败，请重新建立");

    const { data: player, error: playerError } = await supabase
      .from("stellar_players")
      .insert({ room_id: room.id, display_name: body.displayName, role: "star_alpha" })
      .select("id")
      .single();
    if (playerError || !player) throw playerError || new Error("星核融合失败");

    // 写入默认的双星和初始行星属性
    const { error: stateError } = await supabase.from("stellar_game_states").insert({
      room_id: room.id,
      stellar_setup: {
        starAlpha: { name: "主恒星", type: "G-type Yellow Dwarf", color: "#fdb813", mass: 1.0 },
        starBeta: { name: "伴恒星", type: "M-type Red Dwarf", color: "#ff7c43", mass: 0.4 },
        isAnomaly: false,
        systemNotes: "初始星体核聚变正常"
      },
      planetary_state: state,
    });
    if (stateError) throw stateError;

    await addStellarSystemMessage(
      room.id,
      `星系重力坍缩完成，主恒星【${body.displayName}】的意志已于星核中央苏醒。星系码：${room.room_code}\n请指引您的【伴星意志】加入，并共同校对双恒星的天体属性。`,
    );

    const payload = await loadStellarRoomPayload(room.room_code);
    return NextResponse.json({ ok: true, playerId: player.id, payload });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "重粒子星系创建失败" },
      { status: 400 },
    );
  }
}
