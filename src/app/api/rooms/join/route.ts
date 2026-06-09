import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadRoomPayload, addSystemMessage } from "@/lib/roomData";

const joinSchema = z.object({
  code: z.string().trim().min(4).max(12),
  displayName: z.string().trim().min(1).max(30).default("玩家B"),
});

export async function POST(request: Request) {
  try {
    const body = joinSchema.parse(await request.json());
    const code = body.code.toUpperCase();
    const supabase = supabaseAdmin();

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, room_code")
      .eq("room_code", code)
      .single();
    if (roomError || !room) throw new Error("找不到这个房间码");

    const { data: existingPlayers, error: playersError } = await supabase
      .from("players")
      .select("id")
      .eq("room_id", room.id);
    if (playersError) throw playersError;
    if ((existingPlayers?.length ?? 0) >= 2) throw new Error("这个房间已经有两名玩家了");

    const role = (existingPlayers?.length ?? 0) === 0 ? "parent_a" : "parent_b";
    const { data: player, error: playerError } = await supabase
      .from("players")
      .insert({ room_id: room.id, display_name: body.displayName, role })
      .select("id")
      .single();
    if (playerError || !player) throw playerError || new Error("加入房间失败");

    await addSystemMessage(room.id, `${body.displayName} 加入了房间。`);

    const payload = await loadRoomPayload(room.room_code);
    return NextResponse.json({ ok: true, playerId: player.id, payload });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "加入房间失败" },
      { status: 400 },
    );
  }
}
