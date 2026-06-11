import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeState } from "@/lib/game";
import { loadRoomPayload, addSystemMessage } from "@/lib/roomData";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { GameSetup, RoomSaveSnapshot } from "@/lib/types";

const loadSchema = z.object({
  playerId: z.string().uuid().optional().nullable(),
  author: z.string().trim().min(1).max(30).default("玩家"),
});

type RouteContext = {
  params: Promise<{ code: string; saveId: string }> | { code: string; saveId: string };
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const params = await Promise.resolve(context.params);
    const code = String(params.code).toUpperCase();
    const saveId = Number(params.saveId);
    if (!Number.isFinite(saveId)) throw new Error("存档编号无效");

    const body = loadSchema.parse(await request.json().catch(() => ({})));
    const supabase = supabaseAdmin();
    const payload = await loadRoomPayload(code);

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, room_id, event_type, content")
      .eq("id", saveId)
      .eq("room_id", payload.room.id)
      .eq("event_type", "save_snapshot")
      .single();
    if (eventError || !event) throw new Error("找不到这个存档");

    const snapshot = JSON.parse(String(event.content)) as RoomSaveSnapshot;
    if (snapshot.version !== 1) throw new Error("存档版本不兼容");

    const state = normalizeState(snapshot.state);
    const setup = (snapshot.setup ?? {}) as GameSetup;
    const now = new Date().toISOString();

    const { error: roomError } = await supabase
      .from("rooms")
      .update({
        status: snapshot.room.status,
        current_turn: state.turn,
        current_year: state.year,
        phase: state.phase,
        updated_at: now,
      })
      .eq("id", payload.room.id);
    if (roomError) throw roomError;

    const { error: stateError } = await supabase
      .from("game_states")
      .update({ setup, state, updated_at: now })
      .eq("room_id", payload.room.id);
    if (stateError) throw stateError;

    const player = body.playerId ? payload.players.find((item) => item.id === body.playerId) : null;
    const createdBy = player?.display_name || body.author;
    await addSystemMessage(payload.room.id, `${createdBy} 读取了存档「${snapshot.name}」。`, "save");

    const nextPayload = await loadRoomPayload(code);
    return NextResponse.json({ ok: true, payload: nextPayload });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "读取存档失败" },
      { status: 400 },
    );
  }
}
