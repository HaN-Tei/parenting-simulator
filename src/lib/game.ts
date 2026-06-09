import type { GameSetup, GameState } from "./types";

export function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export function initialGameState(): GameState {
  return {
    turn: 1,
    year: 0,
    phase: "pregnancy",
    child: {
      health: 80,
      security: 50,
      curiosity: 50,
      social: 50,
      learning: 50,
      mood: 50,
    },
    family: {
      money: 60,
      time: 60,
      stability: 55,
      support: 40,
      pressure: 30,
    },
    flags: [],
  };
}

export function normalizeState(raw: unknown): GameState {
  if (!raw || typeof raw !== "object") return initialGameState();
  const fallback = initialGameState();
  const state = raw as Partial<GameState>;
  return {
    turn: Number(state.turn ?? fallback.turn),
    year: Number(state.year ?? fallback.year),
    phase: String(state.phase ?? fallback.phase),
    child: { ...fallback.child, ...(state.child ?? {}) },
    family: { ...fallback.family, ...(state.family ?? {}) },
    flags: Array.isArray(state.flags) ? state.flags.map(String) : [],
  };
}

export function nextTurnState(state: GameState): GameState {
  const nextTurn = state.turn + 1;
  const year = Math.floor((nextTurn - 1) / 10);
  const phase = year === 0 ? "pregnancy" : `child_age_${year}`;
  return {
    ...state,
    turn: nextTurn,
    year,
    phase,
  };
}

export function statusText(state: GameState, setup: GameSetup) {
  const parentAIdentity = [
    setup.parentAName ? `姓名：${setup.parentAName}` : "姓名未填",
    setup.parentAJob ? `职业：${setup.parentAJob}` : "职业未填",
    setup.parentAPregnancyRole || "怀孕/非怀孕方未选择",
  ].join("，");
  const parentBIdentity = [
    setup.parentBName ? `姓名：${setup.parentBName}` : "姓名未填",
    setup.parentBJob ? `职业：${setup.parentBJob}` : "职业未填",
    setup.parentBPregnancyRole || "怀孕/非怀孕方未选择",
  ].join("，");

  return [
    `当前回合：第 ${state.turn} 回合`,
    `时间：${state.year === 0 ? "孕期" : `孩子 ${state.year} 岁`}（每 10 回合 = 1 年）`,
    `阶段：${state.phase}`,
    `双亲A：${parentAIdentity}；补充设定：${setup.parentA || "未填写"}`,
    `双亲B：${parentBIdentity}；补充设定：${setup.parentB || "未填写"}`,
    `世界设定：${setup.world || "现实向"}`,
    `孩子状态：健康 ${state.child.health}，安全感 ${state.child.security}，好奇心 ${state.child.curiosity}，社交 ${state.child.social}，学习 ${state.child.learning}，情绪 ${state.child.mood}`,
    `家庭状态：金钱 ${state.family.money}，时间 ${state.family.time}，稳定度 ${state.family.stability}，支持网络 ${state.family.support}，压力 ${state.family.pressure}`,
  ].join("\n");
}

export function commandOf(content: string) {
  const text = content.trim();
  if (text === "开始游戏") return "start";
  if (text === "产生随机事件") return "event";
  if (text === "根据对话内容推进剧情") return "advance_story";
  if (text === "结束回合") return "end_turn";
  if (text === "查看状态") return "status";
  return "chat";
}
