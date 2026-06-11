import { NextResponse } from "next/server";
import { z } from "zod";
import { callOpenRouter } from "@/lib/openrouter";
import { commandOf, nextTurnState, splitAiBubbles, statusText } from "@/lib/game";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { addSystemMessage, loadRoomPayload } from "@/lib/roomData";

const messageSchema = z.object({
  playerId: z.string().uuid().optional().nullable(),
  author: z.string().trim().min(1).max(30).default("玩家"),
  content: z.string().trim().min(1).max(4000),
});

// 解析并应用 [STATS_UPDATE] 指标变化，然后将纯文本返回
async function applyStatsUpdateAndFilter(roomId: string, rawContent: string, currentGameState: any): Promise<string> {
  const markerStart = "[STATS_UPDATE]";
  const markerEnd = "[STATS_UPDATE_END]";
  
  const startIndex = rawContent.indexOf(markerStart);
  const endIndex = rawContent.indexOf(markerEnd);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return rawContent; // 没有检测到指标修改标记，直接返回原内容
  }

  const jsonStr = rawContent.slice(startIndex + markerStart.length, endIndex).trim();
  const cleanContent = (rawContent.slice(0, startIndex) + rawContent.slice(endIndex + markerEnd.length)).trim();

  try {
    const update = JSON.parse(jsonStr);
    const supabase = supabaseAdmin();

    const oldState = currentGameState;
    const newState = { ...oldState };

    // 1. 更新孩子属性
    if (update.child && typeof update.child === "object") {
      newState.child = { ...oldState.child };
      for (const [key, val] of Object.entries(update.child)) {
        const currentVal = Number(oldState.child[key] ?? 50);
        const change = Number(val ?? 0);
        newState.child[key] = Math.max(0, Math.min(100, currentVal + change));
      }
    }

    // 2. 更新家庭属性
    if (update.family && typeof update.family === "object") {
      newState.family = { ...oldState.family };
      for (const [key, val] of Object.entries(update.family)) {
        const currentVal = Number(oldState.family[key] ?? 50);
        const change = Number(val ?? 0);
        newState.family[key] = Math.max(0, Math.min(100, currentVal + change));
      }
    }

    // 3. 更新写入 Supabase 属性列表
    const { error: updateError } = await supabase
      .from("game_states")
      .update({ state: newState, updated_at: new Date().toISOString() })
      .eq("room_id", roomId);

    if (updateError) {
      console.error("更新属性数值失败:", updateError);
    }
  } catch (err) {
    console.error("解析或应用 [STATS_UPDATE] JSON 数据失败:", err);
  }

  return cleanContent;
}

async function addAiBubbles(roomId: string, content: string, kind: string, currentGameState: any): Promise<any> {
  // 解析并应用任何属性修改
  const cleanContent = await applyStatsUpdateAndFilter(roomId, content, currentGameState);
  
  const bubbles = splitAiBubbles(cleanContent);
  for (const bubble of bubbles) {
    await addSystemMessage(roomId, bubble, kind);
  }
}

// 自动生成并追加随机事件函数 (阶段1: 基础事件)
async function triggerAutoRandomEvent(roomId: string, latestPayload: any) {
  await addSystemMessage(roomId, `进入全新阶段 (阶段 ${latestPayload.state.stage || 1})，正在自动激活危机事件……`, "thinking");
  
  const eventText = await callOpenRouter({
    kind: "event",
    setup: latestPayload.setup,
    state: latestPayload.state,
    recentMessages: latestPayload.messages,
  });

  await supabaseAdmin().from("events").insert({
    room_id: roomId,
    turn: latestPayload.state.turn,
    event_type: "random_event",
    content: eventText,
  });

  await addAiBubbles(roomId, eventText, "event", latestPayload.state);
}

// 推进阶段行动
async function advanceStage(roomId: string, latestPayload: any, code: string) {
  const currentStage = latestPayload.state.stage || 1;
  const nextStage = currentStage + 1;
  
  await addSystemMessage(roomId, `行动已提交，正在推演第 ${currentStage}/3 阶段后续情节……`, "thinking");

  // 1. 更新阶段
  const newState = { ...latestPayload.state, stage: nextStage };
  const supabase = supabaseAdmin();
  
  await supabase
    .from("game_states")
    .update({ state: newState, updated_at: new Date().toISOString() })
    .eq("room_id", roomId);

  // 2. 推进新情节
  const payloadWithNewState = { ...latestPayload, state: newState };
  const storyText = await callOpenRouter({
    kind: "advance",
    setup: payloadWithNewState.setup,
    state: payloadWithNewState.state,
    recentMessages: payloadWithNewState.messages,
  });

  await supabase.from("events").insert({
    room_id: roomId,
    turn: payloadWithNewState.state.turn,
    event_type: "story_advance",
    content: storyText,
  });

  await addAiBubbles(roomId, storyText, "story", newState);
}

// 回合强制结算和过渡到下一回合，并立刻激发下回合事件
async function executeEndAndNewTurn(roomId: string, latestPayload: any, code: string) {
  await addSystemMessage(roomId, "本回合所有关联阶段行动全部完结，正在进行年度指标总结与复盘……", "thinking");

  const settlement = await callOpenRouter({
    kind: "settlement",
    setup: latestPayload.setup,
    state: latestPayload.state,
    recentMessages: latestPayload.messages,
  });

  // 推进回合, stage 重置为 1
  let nextState = nextTurnState(latestPayload.state);
  nextState.stage = 1;
  
  const supabase = supabaseAdmin();

  // 1. 存储结算记录
  await supabase.from("events").insert({
    room_id: roomId,
    turn: latestPayload.state.turn,
    event_type: "settlement",
    content: settlement,
  });

  // 2. 推进 rooms 里的回合年份指针
  await supabase
    .from("rooms")
    .update({
      current_turn: nextState.turn,
      current_year: nextState.year,
      phase: nextState.phase,
      updated_at: new Date().toISOString(),
    })
    .eq("id", roomId);

  // 3. 将其应用并持久化进 game_states
  await supabase
    .from("game_states")
    .update({ state: nextState, updated_at: new Date().toISOString() })
    .eq("room_id", roomId);

  // 4. 展示本期清算气泡，并刷新数值
  await addAiBubbles(roomId, settlement, "settlement", latestPayload.state);

  // 5. 新一轮自动开启，激发新年度阶段1危机！
  const updatedPayload = await loadRoomPayload(code);
  await triggerAutoRandomEvent(roomId, updatedPayload);
}

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const params = await context.params;
    const code = params.code.toUpperCase();
    const body = messageSchema.parse(await request.json());
    const supabase = supabaseAdmin();
    const payload = await loadRoomPayload(code);
    const command = commandOf(body.content);
    const player = body.playerId ? payload.players.find((item) => item.id === body.playerId) : null;
    const author = player ? `${player.display_name}（${player.role === "parent_a" ? "双亲A" : player.role === "parent_b" ? "双亲B" : player.role}）` : body.author;

    // 录入当前聊天、指令或行动
    const { error: messageError } = await supabase.from("messages").insert({
      room_id: payload.room.id,
      player_id: body.playerId || null,
      author,
      kind: command === "chat" ? "chat" : "command",
      content: body.content,
    });
    if (messageError) throw messageError;

    let latest = await loadRoomPayload(code);

    // 1. 指令：开始游戏 (Start)
    if (command === "start") {
      const { error } = await supabase
        .from("rooms")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", latest.room.id);
      if (error) throw error;

      // 阶段重置为 1
      const resetState = { ...latest.state, stage: 1 };
      await supabase
        .from("game_states")
        .update({ state: resetState, updated_at: new Date().toISOString() })
        .eq("room_id", latest.room.id);

      await addSystemMessage(
        latest.room.id,
        "游戏开始！\n每回合为一个年度，划分为3个关联的发展阶段。在此期间玩家可以进行任意角色扮演，只有点击行动选项才算提交行动并推进阶段。第三阶段行动后将自动结算当前年份指标。",
        "system",
      );

      // 开始首个阶段的第一案
      latest.state = resetState;
      await triggerAutoRandomEvent(latest.room.id, latest);
      
      const payloadWithEvent = await loadRoomPayload(code);
      return NextResponse.json({ ok: true, payload: payloadWithEvent });
    }

    // 2. 指令：手动强制结算 (End Turn)
    if (command === "end_turn") {
      await executeEndAndNewTurn(latest.room.id, latest, code);
      const payloadEnded = await loadRoomPayload(code);
      return NextResponse.json({ ok: true, payload: payloadEnded });
    }

    // 3. 指令：对话推进 (Advance Story)
    if (command === "advance_story") {
      await addSystemMessage(latest.room.id, "正在根据最近的扮演讨论提炼剧情……", "thinking");
      const storyText = await callOpenRouter({
        kind: "advance",
        setup: latest.setup,
        state: latest.state,
        recentMessages: latest.messages,
      });
      await supabase.from("events").insert({
        room_id: latest.room.id,
        turn: latest.state.turn,
        event_type: "story_advance",
        content: storyText,
      });
      await addAiBubbles(latest.room.id, storyText, "story", latest.state);
      
      const nextPayload = await loadRoomPayload(code);
      return NextResponse.json({ ok: true, payload: nextPayload });
    }

    // 4. 指令：查看状态 (Status)
    if (command === "status") {
      await addSystemMessage(latest.room.id, statusText(latest.state, latest.setup), "status");
      const nextPayload = await loadRoomPayload(code);
      return NextResponse.json({ ok: true, payload: nextPayload });
    }

    // 5. 🌟 行动触发推进核心逻辑（A/B/C选择 或 自定义行动D 或 自定义剧情插入）
    if (latest.room.status === "active" && command === "action") {
      const currentStage = latest.state.stage || 1;
      
      if (currentStage >= 3) {
        // 如果第三演化阶段行动已提交，进行终末结算并过年度
        await executeEndAndNewTurn(latest.room.id, latest, code);
      } else {
        // 否则仅推进对应内部阶段 (1 -> 2, 2 -> 3)
        await advanceStage(latest.room.id, latest, code);
      }
      
      const payloadAdvanced = await loadRoomPayload(code);
      return NextResponse.json({ ok: true, payload: payloadAdvanced });
    }

    // 正常聊天 (command === "chat") 仅作为角色扮演展示，不促成阶段/回合推进
    const finalPayload = await loadRoomPayload(code);
    return NextResponse.json({ ok: true, payload: finalPayload });
  } catch (error) {
    console.error("处理生育模拟器对话逻辑异常:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "发送失败" },
      { status: 400 },
    );
  }
}