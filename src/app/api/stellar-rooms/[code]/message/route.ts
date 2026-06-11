import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadStellarRoomPayload, addStellarSystemMessage } from "@/lib/stellarRoomData";
import {
  nextEpochState,
  splitStellarBubbles,
  EPOCH_LABELS,
  normalizePlanetaryState,
} from "@/lib/stellarGame";
import { callStellarOpenRouter } from "@/lib/stellarOpenRouter";

const messageSchema = z.object({
  playerId: z.string().min(1),
  content: z.string().trim().min(1),
});

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const params = await context.params;
    const code = params.code.trim().toUpperCase();
    const body = messageSchema.parse(await request.json().catch(() => ({})));
    const supabase = supabaseAdmin();

    // 加载房间
    const { data: room, error: roomError } = await supabase
      .from("stellar_rooms")
      .select("id, status, current_turn, current_epoch")
      .eq("room_code", code)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ ok: false, error: "星系迷途" }, { status: 404 });
    }

    // 加载玩家昵称
    const { data: player } = await supabase
      .from("stellar_players")
      .select("display_name")
      .eq("id", body.playerId)
      .single();

    const playerName = player?.display_name || "星际信使";

    // 存储玩家消息
    await supabase.from("stellar_messages").insert({
      room_id: room.id,
      player_id: body.playerId,
      author: playerName,
      kind: "chat",
      content: body.content.trim(),
    });

    // 特殊指令：结束回合
    if (body.content.trim() === "结束回合" || body.content.trim() === "结束" || body.content.trim() === "next") {
      const newTurn = room.current_turn + 1;
      const newState = nextEpochState(normalizePlanetaryState({ turn: newTurn, epoch: room.current_epoch } as any));

      const { error: updateError } = await supabase
        .from("stellar_rooms")
        .update({
          current_turn: newTurn,
          current_epoch: newState.epoch,
        })
        .eq("id", room.id);

      if (updateError) throw updateError;

      await supabase
        .from("stellar_game_states")
        .update({ planetary_state: { ...newState, turn: newTurn, epoch: newState.epoch } })
        .eq("room_id", room.id);

      await addStellarSystemMessage(room.id, `纪元更迭：进入${EPOCH_LABELS[newState.epoch]}`, "narrative");

      const payload = await loadStellarRoomPayload(code);
      return NextResponse.json({ ok: true, payload, turnAdvanced: true });
    }

    // 加载当前状态，调用 AI
    const payload = await loadStellarRoomPayload(code);
    const state = payload.state;

    // 识别是否为“产生随机事件”指令
    const isRandomEvent = /随机|随机事件|事件|探索/i.test(body.content);

    const aiContent = await callStellarOpenRouter({
      kind: isRandomEvent ? "genesis_event" : "evolution_advance",
      setup: payload.setup,
      state,
      recentMessages: payload.messages.slice(-15),
    });

    const aiBubbles = splitStellarBubbles(aiContent);
    for (const bubble of aiBubbles) {
      await supabase.from("stellar_messages").insert({
        room_id: room.id,
        player_id: null,
        author: "AI主角",
        kind: "narrative",
        content: bubble,
      });
    }

    const newPayload = await loadStellarRoomPayload(code);
    return NextResponse.json({ ok: true, payload: newPayload });
  } catch (error) {
    console.error("消息处理失败:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "讯号传输失败" },
      { status: 400 },
    );
  }
}
