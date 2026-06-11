import { createClient } from "@supabase/supabase-js";

export type StellarSystemSetup = {
  starAlpha: {
    name: string;
    type: string;
    color: string;
    mass: number; // 太阳质量倍数
  };
  starBeta: {
    name: string;
    type: string;
    color: string;
    mass: number;
  };
  isAnomaly: boolean; // 是否是高维异常人工恒星系统
  systemNotes?: string;
};

export type PlanetaryState = {
  turn: number;
  epoch: string; // 纪元
  planet: {
    gravity: number; // 引力倍数 (G)
    temp: number; // 常温 (K)，沸点/凝固点评估核心
    atmoPressure: number; // 大气压 (atm)
    magneticField: number; // 磁场强度 (0-100)
    biodiversity: number; // 生态圈丰度 (0-100)
    habitability: number; // 适居度 (0-100)
  };
  civilization: {
    techLevel: number; // 科技指数 (0-100)
    unity: number; // 凝聚与团结度 (0-100)
    reasonRatio: number; // 理性百分比 vs 信仰百分比 (0-100)
    entropy: number; // 危机/崩溃熵值 (0-100)
  };
  solvent: string; // H2O, NH3, H2SO4, Liquid CH4 等
  baseChemistry: string; // Carbon-based, Silicon-based, Sulfur-based 等
  discoveredOrganisms: Array<{
    name: string;
    generation: number;
    description: string;
    metabolism: string;
  }>;
};

export type StellarRoomPayload = {
  room: {
    id: string;
    room_code: string;
    status: string;
    current_turn: number;
    current_epoch: string;
  };
  players: Array<{
    id: string;
    display_name: string;
    role: string;
    created_at: string;
  }>;
  setup: StellarSystemSetup;
  state: PlanetaryState;
  messages: Array<{
    id: number;
    player_id: string | null;
    author: string;
    kind: string;
    content: string;
    created_at: string;
  }>;
};

// 纪元名称中文映射
export const EPOCH_LABELS: Record<string, string> = {
  epoch_genesis: "死寂起源（创世纪元）",
  epoch_biosphere: "生命萌芽（生物纪元）",
  epoch_tribal: "灵智觉醒（部落纪元）",
  epoch_classical: "铁与农耕（古典纪元）",
  epoch_industrial: "蒸汽原子（科技工业纪元）",
  epoch_space: "向星空跃迁（高级太空文明）",
};

// 重力、光谱、溶剂等硬科幻物理常量评估
export function checkStellarAnomaly(setup: StellarSystemSetup): boolean {
  // 正常天体生物学和天体物理不应该拥有太怪诞的光谱（如绿色、霓虹粉、亮紫色、深黑等）
  // 或者是质量与恒星类型极其不对等的配对（比如一个比主恒星生命长很多的超高能星体超近距离不吞噬主星）
  const colorA = setup.starAlpha.color.toLowerCase();
  const colorB = setup.starBeta.color.toLowerCase();

  const normalColors = ["#fdb813", "#ff7c43", "#ff4500", "#ffffff", "#add8e6", "#b0c4de", "#f0f8ff", "#ffe4e1", "#ffd700"];
  
  const isColorAAnomaly = !normalColors.some(c => colorA.includes(c) || Math.abs(hexToRgbDistance(colorA, c)) < 30);
  const isColorBAnomaly = !normalColors.some(c => colorB.includes(c) || Math.abs(hexToRgbDistance(colorB, c)) < 30);

  return isColorAAnomaly || isColorBAnomaly;
}

function hexToRgbDistance(hex1: string, hex2: string): number {
  const getRgb = (hex: string) => {
    const clean = hex.replace("#", "");
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return { r, g, b };
  };
  try {
    const rgb1 = getRgb(hex1);
    const rgb2 = getRgb(hex2);
    return Math.sqrt(Math.pow(rgb1.r - rgb2.r, 2) + Math.pow(rgb1.g - rgb2.g, 2) + Math.pow(rgb1.b - rgb2.b, 2));
  } catch {
    return 999;
  }
}

export function initialPlanetaryState(): PlanetaryState {
  return {
    turn: 1,
    epoch: "epoch_genesis",
    planet: {
      gravity: 1.0,
      temp: 350, // 初始350K，地狱般的炎热但适合孕育原始大气
      atmoPressure: 1.0,
      magneticField: 40,
      biodiversity: 0,
      habitability: 0,
    },
    civilization: {
      techLevel: 0,
      unity: 0,
      reasonRatio: 50,
      entropy: 0,
    },
    solvent: "H2O",
    baseChemistry: "Carbon-based",
    discoveredOrganisms: [],
  };
}

export function normalizePlanetaryState(raw: any): PlanetaryState {
  if (!raw || typeof raw !== "object") return initialPlanetaryState();
  const fallback = initialPlanetaryState();
  return {
    turn: Number(raw.turn ?? fallback.turn),
    epoch: String(raw.epoch ?? fallback.epoch),
    planet: {
      gravity: Number(raw.planet?.gravity ?? fallback.planet.gravity),
      temp: Number(raw.planet?.temp ?? fallback.planet.temp),
      atmoPressure: Number(raw.planet?.atmoPressure ?? fallback.planet.atmoPressure),
      magneticField: Number(raw.planet?.magneticField ?? fallback.planet.magneticField),
      biodiversity: Number(raw.planet?.biodiversity ?? fallback.planet.biodiversity),
      habitability: Number(raw.planet?.habitability ?? fallback.planet.habitability),
    },
    civilization: {
      techLevel: Number(raw.civilization?.techLevel ?? fallback.civilization.techLevel),
      unity: Number(raw.civilization?.unity ?? fallback.civilization.unity),
      reasonRatio: Number(raw.civilization?.reasonRatio ?? fallback.civilization.reasonRatio),
      entropy: Number(raw.civilization?.entropy ?? fallback.civilization.entropy),
    },
    solvent: String(raw.solvent ?? fallback.solvent),
    baseChemistry: String(raw.baseChemistry ?? fallback.baseChemistry),
    discoveredOrganisms: Array.isArray(raw.discoveredOrganisms) ? raw.discoveredOrganisms : [],
  };
}

export function nextEpochState(state: PlanetaryState): PlanetaryState {
  const nextTurn = state.turn + 1;
  const epochs = ["epoch_genesis", "epoch_biosphere", "epoch_tribal", "epoch_classical", "epoch_industrial", "epoch_space"];
  
  // 随回合平滑推进纪元（每个纪元平均占5个核心大型回合，智慧生物建立后步伐变快）
  let epochIndex = 0;
  if (nextTurn <= 5) epochIndex = 0;
  else if (nextTurn <= 9) epochIndex = 1;
  else if (nextTurn <= 13) epochIndex = 2;
  else if (nextTurn <= 17) epochIndex = 3;
  else if (nextTurn <= 21) epochIndex = 4;
  else epochIndex = 5;

  return {
    ...state,
    turn: nextTurn,
    epoch: epochs[epochIndex],
  };
}

export function makeStellarRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export function stellarStatusText(state: PlanetaryState, setup: StellarSystemSetup) {
  const isAnomalyText = setup.isAnomaly 
    ? "【高维约束异常双星系统】（由卡尔达肖夫协议物理力场宏宇宙工程搭建）" 
    : "【常规天体物理双星系统】";

  return [
    `主星【${setup.starAlpha.name}】：光谱类型 ${setup.starAlpha.type}，辐射颜色 ${setup.starAlpha.color}，质量 ${setup.starAlpha.mass}倍太阳质量`,
    `伴星【${setup.starBeta.name}】：光谱类型 ${setup.starBeta.type}，辐射颜色 ${setup.starBeta.color}，质量 ${setup.starBeta.mass}倍太阳质量`,
    `系统性质：${isAnomalyText}`,
    `当前演化时间：第 ${state.turn} 纪元回合 （演化深度：${EPOCH_LABELS[state.epoch]}）`,
    `行星基础物理参数：生命溶剂 [${state.solvent}]，化学基底 [${state.baseChemistry}]`,
    `星球环境常数：地表重力 ${state.planet.gravity}G，环境气温 ${state.planet.temp}K，地表大气压 ${state.planet.atmoPressure}atm，电磁偏振面护盾强度 ${state.planet.magneticField}/100`,
    `生态圈状况：生物多样性覆盖率 ${state.planet.biodiversity}/100，整体适居评级 ${state.planet.habitability}/100`,
    `智慧生命状态（进入部落后解锁）：文明科学技术指数 ${state.civilization.techLevel}/100，高维社会团结度 ${state.civilization.unity}/100，理性逻辑权值 ${state.civilization.reasonRatio}/100，灾变崩溃熵值 ${state.civilization.entropy}/100`,
    `已演本源外星物种数量：${state.discoveredOrganisms.length} 种`
  ].join("\n");
}

export function splitStellarBubbles(content: string): string[] {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  // 1. 段落拆分
  const paragraphParts = normalized
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  // 2. 依照段落拆分，如果只有一个巨段，按照物理学/突发事件等标记分割
  const parts = paragraphParts.length > 1 ? paragraphParts : normalized.split(/(?=\n(?:纪元大事件|演化突变|高维波谱播报|行星物理学异动|可选神谕方向|生存指引|A\.|B\.|C\.|D\.))/);

  const bubbles: string[] = [];
  for (const part of parts.map((item) => item.trim()).filter(Boolean)) {
    if (part.length <= 260) {
      bubbles.push(part);
      continue;
    }
    // 对过大段落实施标点拆分，维持一屏小泡
    const sentences = part.split(/(?<=[。！？；])/);
    let current = "";
    for (const sentence of sentences) {
      const next = `${current}${sentence}`.trim();
      if (next.length > 210 && current) {
        bubbles.push(current.trim());
        current = sentence.trim();
      } else {
        current = next;
      }
    }
    if (current) bubbles.push(current.trim());
  }

  return bubbles.length ? bubbles : [normalized];
}
