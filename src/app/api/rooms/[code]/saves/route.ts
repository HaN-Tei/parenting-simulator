import { NextResponse } from "next/server";
import { z } from "zod";
import { loadRoomPayload, addSystemMessage } from "@/lib/roomData";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { RoomSaveSnapshot, RoomSaveSummary } from "@/lib/types";

const saveSchema = z.object({
  name: z.string().trim().min(1).max(60).default("手动存档"),
  playerId: z.string().uuid().optional().nullable(),
  author: z.string().trim().min(1).max(30).default("玩家"),
});

type RouteContext = {
  params: Promise<{ code: string }> | { code: string };
};

function summarizeSave(id: number, content: string): RoomSaveSummary | null {
  try {
    const snapshot = JSON.parse(content) as RoomSaveSnapshot;
    if (snapshot.version !== 1) return null;
    return {
      id,
      name: snapshot.name || "未命名存档",
      createdAt: snapshot.createdAt,
      createdBy: snapshot.createdBy || "玩家",
      turn: snapshot.state.turn,
      year: snapshot.state.year,
      phase: snapshot.state.phase,
      messageMaxId: snapshot.messageMaxId || 0,
    };
  } catch {
    return null;
  }
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const params = await Promise.resolve(context.params);
    const code = String(params.code).toUpperCase();
    const supabase = supabaseAdmin();
    const payload = await loadRoomPayload(code);

    const { data, error } = await supabase
      .from("events")
      .select("id, content, created_at")
      .eq("room_id", payload.room.id)
      .eq("event_type", "save_snapshot")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw error;

    const saves = (data ?? [])
      .map((item) => summarizeSave(Number(item.id), String(item.content)))
      .filter((item): item is RoomSaveSummary => Boolean(item));

    return NextResponse.json({ ok: true, saves });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "读取存档失败" },
      { status: 400 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const params = await Promise.resolve(context.params);
    const code = String(params.code).toUpperCase();
    const body = saveSchema.parse(await request.json().catch(() => ({})));
    const supabase = supabaseAdmin();
    const payload = await loadRoomPayload(code);

    const player = body.playerId ? payload.players.find((item) => item.id === body.playerId) : null;
    const createdBy = player?.display_name || body.author;

    const { data: latestMessage } = await supabase
      .from("messages")
      .select("id")
      .eq("room_id", payload.room.id)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    const snapshot: RoomSaveSnapshot = {
      version: 1,
      name: body.name,
      createdAt: new Date().toISOString(),
      createdBy,
      room: {
        status: payload.room.status,
        current_turn: payload.room.current_turn,
        current_year: payload.room.current_year,
        phase: payload.room.phase,
      },
      setup: payload.setup,
      state: payload.state,
      messageMaxId: Number(latestMessage?.id ?? 0),
    };

    const { error } = await supabase.from("events").insert({
      room_id: payload.room.id,
      turn: payload.state.turn,
      event_type: "save_snapshot",
      content: JSON.stringify(snapshot),
    });
    if (error) throw error;

    await addSystemMessage(payload.room.id, `${createdBy} 保存了存档「${body.name}」。`, "save");
    const nextPayload = await loadRoomPayload(code);
    return NextResponse.json({ ok: true, payload: nextPayload });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "保存存档失败" },
      { status: 400 },
    );
  }
}
