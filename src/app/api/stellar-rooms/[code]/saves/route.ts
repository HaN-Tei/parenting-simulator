import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadStellarRoomPayload } from "@/lib/stellarRoomData";

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const params = await context.params;
    const code = params.code.trim().toUpperCase();
    const supabase = supabaseAdmin();

    const { data: room } = await supabase
      .from("stellar_rooms")
      .select("id")
      .eq("room_code", code)
      .single();

    if (!room) {
      return NextResponse.json({ ok: false, error: "房间不存在" }, { status: 404 });
    }

    const { data: saves } = await supabase
      .from("stellar_saves")
      .select("id, name, created_by, current_turn, current_epoch, created_at")
      .eq("room_id", room.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ ok: true, saves: saves ?? [] });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "存档列表获取失败" },
      { status: 400 },
    );
  }
}

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const params = await context.params;
    const code = params.code.trim().toUpperCase();
    const { name, createdBy } = await request.json();
    const supabase = supabaseAdmin();

    const payload = await loadStellarRoomPayload(code);
    const maxIdResult = await supabase
      .from("stellar_messages")
      .select("id")
      .eq("room_id", payload.room.id)
      .order("id", { ascending: false })
      .limit(1)
      .single();
    const maxId = maxIdResult.data?.id ?? 0;

    const { error } = await supabase.from("stellar_saves").insert({
      room_id: payload.room.id,
      name: name || `第${payload.room.current_turn}纪元存档`,
      created_by: createdBy || "星际存档者",
      stellar_setup: payload.setup,
      planetary_state: payload.state,
      room_status: payload.room.status,
      current_turn: payload.room.current_turn,
      current_epoch: payload.room.current_epoch,
      message_max_id: maxId,
    });

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "存档保存失败" },
      { status: 400 },
    );
  }
}