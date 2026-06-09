import { supabaseAdmin } from "./supabaseAdmin";
import { normalizeState } from "./game";
import type { GameSetup, RoomPayload } from "./types";

export async function loadRoomPayload(code: string): Promise<RoomPayload> {
  const supabase = supabaseAdmin();
  const roomCode = code.trim().toUpperCase();

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, room_code, status, current_turn, current_year, phase")
    .eq("room_code", roomCode)
    .single();

  if (roomError || !room) {
    throw new Error("找不到这个房间码");
  }

  const [{ data: players }, { data: gameState }, { data: messages }] = await Promise.all([
    supabase
      .from("players")
      .select("id, display_name, role, created_at")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true }),
    supabase.from("game_states").select("setup, state").eq("room_id", room.id).single(),
    supabase
      .from("messages")
      .select("id, player_id, author, kind, content, created_at")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true })
      .limit(120),
  ]);

  return {
    room,
    players: players ?? [],
    setup: ((gameState?.setup ?? {}) as GameSetup) || {},
    state: normalizeState(gameState?.state),
    messages: messages ?? [],
  };
}

export async function addSystemMessage(roomId: string, content: string, kind = "system") {
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("messages").insert({
    room_id: roomId,
    player_id: null,
    author: "系统",
    kind,
    content,
  });
  if (error) throw error;
}
