import { NextResponse } from "next/server";
import { z } from "zod";
import { makeRoomCode, initialGameState } from "@/lib/game";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadRoomPayload, addSystemMessage } from "@/lib/roomData";

const createSchema = z.object({
  displayName: z.string().trim().min(1).max(30).default("玩家A"),
});

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await request.json().catch(() => ({})));
    const supabase = supabaseAdmin();
    const state = initialGameState();

    let room = null;
    for (let i = 0; i < 8; i += 1) {
      const roomCode = makeRoomCode();
      const { data, error } = await supabase
        .from("rooms")
        .insert({
          room_code: roomCode,
          status: "setup",
          current_turn: state.turn,
          current_year: state.year,
          phase: state.phase,
        })
        .select("id, room_code")
        .single();

      if (!error && data) {
        room = data;
        break;
      }
    }

    if (!room) throw new Error("创建房间失败，请重试");

    const { data: player, error: playerError } = await supabase
      .from("players")
      .insert({ room_id: room.id, display_name: body.displayName, role: "parent_a" })
      .select("id")
      .single();
    if (playerError || !player) throw playerError || new Error("创建玩家失败");

    const { error: stateError } = await supabase.from("game_states").insert({
      room_id: room.id,
      setup: {},
      state,
    });
    if (stateError) throw stateError;

    await addSystemMessage(
      room.id,
      `房间已创建。房间码：${room.room_code}\n请把房间码发给另一位玩家。开局前请填写双亲设定，然后输入“开始游戏”。`,
    );

    const payload = await loadRoomPayload(room.room_code);
    return NextResponse.json({ ok: true, playerId: player.id, payload });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "创建房间失败" },
      { status: 400 },
    );
  }
}
