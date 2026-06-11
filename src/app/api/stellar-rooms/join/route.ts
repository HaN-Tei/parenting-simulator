import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadStellarRoomPayload, addStellarSystemMessage } from "@/lib/stellarRoomData";

const joinSchema = z.object({
  roomCode: z.string().trim().min(1).max(10).toUpperCase(),
  displayName: z.string().trim().min(1).max(30).default("伴星意志B"),
});

export async function POST(request: Request) {
  try {
    const body = joinSchema.parse(await request.json().catch(() => ({})));
    const supabase = supabaseAdmin();
    const roomCode = body.roomCode.toUpperCase();

    // 首先查找房间
    const { data: room, error: roomError } = await supabase
      .from("stellar_rooms")
      .select("id, room_code, status")
      .eq("room_code", roomCode)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ ok: false, error: "星系迷途：找不到该房间码" }, { status: 404 });
    }

    if (room.status !== "setup") {
      return NextResponse.json({ ok: false, error: "该星系已进入演化阶段，无法加入" }, { status: 400 });
    }

    // 检查是否已经有两个玩家
    const { data: existingPlayers } = await supabase
      .from("stellar_players")
      .select("id")
      .eq("room_id", room.id);

    if (existingPlayers && existingPlayers.length >= 2) {
      return NextResponse.json({ ok: false, error: "星系已满员，无法再加入" }, { status: 400 });
    }

    // 确定角色
    const role = existingPlayers && existingPlayers.length === 1 ? "star_beta" : "star_alpha";

    const { data: player, error: playerError } = await supabase
      .from("stellar_players")
      .insert({ room_id: room.id, display_name: body.displayName, role })
      .select("id")
      .single();

    if (playerError || !player) {
      return NextResponse.json({ ok: false, error: playerError?.message || "星核注入失败" }, { status: 400 });
    }

    await addStellarSystemMessage(
      room.id,
      `${body.displayName} 的[${role} ]意识已同步入场，双星协奏正式开始。`,
    );

    const payload = await loadStellarRoomPayload(room.room_code);
    return NextResponse.json({ ok: true, playerId: player.id, payload });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "星系联络失败" },
      { status: 400 },
    );
  }
}