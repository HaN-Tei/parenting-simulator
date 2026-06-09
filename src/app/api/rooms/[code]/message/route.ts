import { NextResponse } from "next/server";
import { z } from "zod";
import { callOpenRouter } from "@/lib/openrouter";
import { commandOf, nextTurnState, statusText } from "@/lib/game";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { addSystemMessage, loadRoomPayload } from "@/lib/roomData";

const messageSchema = z.object({
  playerId: z.string().uuid().optional().nullable(),
  author: z.string().trim().min(1).max(30).default("玩家"),
  content: z.string().trim().min(1).max(4000),
});

export async function POST(request: Request, context: any) {
  try {
    const params = await Promise.resolve(context.params);
    const code = String(params.code).toUpperCase();
    const body = messageSchema.parse(await request.json());
    const supabase = supabaseAdmin();
    const payload = await loadRoomPayload(code);
    const command = commandOf(body.content);

    const { error: messageError } = await supabase.from("messages").insert({
      room_id: payload.room.id,
      player_id: body.playerId || null,
      author: body.author,
      kind: command === "chat" ? "chat" : "command",
      content: body.content,
    });
    if (messageError) throw messageError;

    const latest = await loadRoomPayload(code);

    if (command === "status") {
      await addSystemMessage(latest.room.id, statusText(latest.state, latest.setup), "status");
    }

    if (command === "start") {
      const { error } = await supabase
        .from("rooms")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", latest.room.id);
      if (error) throw error;
      await addSystemMessage(
        latest.room.id,
        `游戏开始。\n当前是第 ${latest.state.turn} 回合。普通聊天不会触发随机事件；需要事件时请输入“产生随机事件”；需要推进时请输入“结束回合”。`,
        "system",
      );
    }

    if (command === "event") {
      await addSystemMessage(latest.room.id, "正在生成随机事件……", "thinking");
      const eventText = await callOpenRouter({
        kind: "event",
        setup: latest.setup,
        state: latest.state,
        recentMessages: latest.messages,
      });
      await supabase.from("events").insert({
        room_id: latest.room.id,
        turn: latest.state.turn,
        event_type: "random_event",
        content: eventText,
      });
      await addSystemMessage(latest.room.id, eventText, "event");
    }

    if (command === "end_turn") {
      await addSystemMessage(latest.room.id, "正在结算本回合……", "thinking");
      const settlement = await callOpenRouter({
        kind: "settlement",
        setup: latest.setup,
        state: latest.state,
        recentMessages: latest.messages,
      });
      const nextState = nextTurnState(latest.state);
      await supabase.from("events").insert({
        room_id: latest.room.id,
        turn: latest.state.turn,
        event_type: "settlement",
        content: settlement,
      });
      await supabase
        .from("rooms")
        .update({
          current_turn: nextState.turn,
          current_year: nextState.year,
          phase: nextState.phase,
          updated_at: new Date().toISOString(),
        })
        .eq("id", latest.room.id);
      await supabase
        .from("game_states")
        .update({ state: nextState, updated_at: new Date().toISOString() })
        .eq("room_id", latest.room.id);
      await addSystemMessage(latest.room.id, settlement, "settlement");
      await addSystemMessage(
        latest.room.id,
        `已进入第 ${nextState.turn} 回合。注意：不会自动产生随机事件；需要事件时请输入“产生随机事件”。`,
        "system",
      );
    }

    const nextPayload = await loadRoomPayload(code);
    return NextResponse.json({ ok: true, payload: nextPayload });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "发送失败" },
      { status: 400 },
    );
  }
}
