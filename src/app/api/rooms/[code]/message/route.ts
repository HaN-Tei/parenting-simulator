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
  // 首行执行：解析并应用任何属性修改
  const cleanContent = await applyStatsUpdateAndFilter(roomId, content, currentGameState);
  
  const bubbles = splitAiBubbles(cleanContent);
  for (const bubble of bubbles) {
    await addSystemMessage(roomId, bubble, kind);
  }
}

// 自动生成并追加随机事件函数
async function triggerAutoRandomEvent(roomId: string, latestPayload: any) {
  await addSystemMessage(roomId, "进入新阶段，正在自动激活随机事件……", "thinking");
  
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

  // 在生成随机事件的同时，根据其产出自动更新行星/育儿数值
  await addAiBubbles(roomId, eventText, "event", latestPayload.state);
}

// 回合强制结算和过渡到下一回合，并立刻生发一次新回合随机事件
async function executeEndAndNewTurn(roomId: string, latestPayload: any, code: string) {
  await addSystemMessage(roomId, "回合行动全部结束，正在进行阶段数值清算与复盘……", "thinking");

  const settlement = await callOpenRouter({
    kind: "settlement",
    setup: latestPayload.setup,
    state: latestPayload.state,
    recentMessages: latestPayload.messages,
  });

  const nextState = nextTurnState(latestPayload.state);
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

  // 5. 重要：新一轮自动开启，直接自发生发有且仅有一次的随机事件！
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

    // 排除特定指令，录入当前聊天或行动
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

      await addSystemMessage(
        latest.room.id,
        `游戏开始！\n当前是第 ${latest.state.turn} 回合。每回合内由双亲自由辩论并在下方点击进行行动选择，系统将自动限制度数并全自动结束回合、触发下一轮危机事件。不再需要手动索取事件或回合转换。`,
        "system",
      );

      // 开始游戏第一步：立即自动帮玩家生成开天辟地的首个随机事件！
      await triggerAutoRandomEvent(latest.room.id, latest);
      
      const payloadWithEvent = await loadRoomPayload(code);
      return NextResponse.json({ ok: true, payload: payloadWithEvent });
    }

    // 2. 指令：手动强制结算 (End Turn - 留作后备支持/兼容，但已在按钮除去)
    if (command === "end_turn") {
      await executeEndAndNewTurn(latest.room.id, latest, code);
      const payloadEnded = await loadRoomPayload(code);
      return NextResponse.json({ ok: true, payload: payloadEnded });
    }

    // 3. 指令：对话推进 (Advance Story)
    if (command === "advance_story") {
      await addSystemMessage(latest.room.id, "正在根据对话内容推进剧情……", "thinking");
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

    // ==========================================
    // 🌟 全自主动力轮次控制核心机（智囊拦截与往合结算）
    // ==========================================
    // 我们在此处检测目前本回合中玩家们已经发送了多少条行动/聊天历史：
    if (payload.room.status === "active" && command === "chat") {
      // 获取当前 turn 的所有有效的、非系统产生的、是由玩家参与的对话记录
      // （例如含有“选择”关键字、玩家聊天气泡等，或直接计算本回合开始后玩家所有的发言）
      const { data: turnMessages } = await supabase
        .from("messages")
        .select("id, author, content")
        .eq("room_id", latest.room.id)
        .neq("author", "系统")
        .neq("author", "AI主角")
        .neq("author", "高维监视核")
        .order("created_at", { ascending: false });

      const playerActionsThisTurn = turnMessages ?? [];
      const totalActions = playerActionsThisTurn.length;

      // 如果当前刚好发生了 2 次行动（即两位玩家都表达了想法，或者各自做了一次大动作）：
      if (totalActions === 2) {
        // 在当前聊天后，及时由系统提醒，告知准备限期结束
        await addSystemMessage(latest.room.id, "📢 双亲意见收集成功！下次行动后，本回合将自动关闭并进行阶段复盘总结。", "system");
      } 
      // 如果消息动作数已经 >= 3，代表玩家在得到提示后迈出了终极步伐：直接在后台全自动促成结束回合和过渡！
      else if (totalActions >= 3) {
        await executeEndAndNewTurn(latest.room.id, latest, code);
        const payloadAutoEnded = await loadRoomPayload(code);
        return NextResponse.json({ ok: true, payload: payloadAutoEnded });
      }
    }

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