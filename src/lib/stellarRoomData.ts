import { supabaseAdmin } from "./supabaseAdmin";
import { normalizePlanetaryState } from "./stellarGame";
import type { StellarSystemSetup, StellarRoomPayload } from "./stellarGame";

export async function loadStellarRoomPayload(code: string): Promise<StellarRoomPayload> {
  const supabase = supabaseAdmin();
  const roomCode = code.trim().toUpperCase();

  const { data: room, error: roomError } = await supabase
    .from("stellar_rooms")
    .select("id, room_code, status, current_turn, current_epoch")
    .eq("room_code", roomCode)
    .single();

  if (roomError || !room) {
    throw new Error("找不到这个双核心星系房间码");
  }

  const [{ data: players }, { data: gameState }, { data: messages }] = await Promise.all([
    supabase
      .from("stellar_players")
      .select("id, display_name, role, created_at")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true }),
    supabase.from("stellar_game_states").select("stellar_setup, planetary_state").eq("room_id", room.id).single(),
    supabase
      .from("stellar_messages")
      .select("id, player_id, author, kind, content, created_at")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true })
      .limit(150),
  ]);

  return {
    room,
    players: (players ?? []) as any,
    setup: ((gameState?.stellar_setup ?? {}) as StellarSystemSetup) || {},
    state: normalizePlanetaryState(gameState?.planetary_state),
    messages: (messages ?? []) as any,
  };
}

export async function addStellarSystemMessage(roomId: string, content: string, kind = "system") {
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("stellar_messages").insert({
    room_id: roomId,
    player_id: null,
    author: kind === "anomaly_broadcast" ? "高维监视核" : "系统",
    kind,
    content,
  });
  if (error) throw error;
}
