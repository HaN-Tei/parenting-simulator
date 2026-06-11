import { stellarStatusText, EPOCH_LABELS } from "./stellarGame";
import type { StellarSystemSetup, PlanetaryState } from "./stellarGame";

type AiEventKind = "genesis_event" | "evolution_advance" | "epoch_settlement";

type Message = {
  author: string;
  kind: string;
  content: string;
  created_at: string;
};

export async function callStellarOpenRouter(params: {
  kind: AiEventKind;
  setup: StellarSystemSetup;
  state: PlanetaryState;
  recentMessages: Message[];
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 OPENROUTER_API_KEY 环境变量，请在 .env.local 补全！");
  }

  const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
  const title = "Stellar Duo Simulator";
  const referer = process.env.APP_URL || "http://localhost:3000";

  const recent = params.recentMessages
    .slice(-25)
    .map((m) => `${m.author}：${m.content}`)
    .join("\n");

  const isAnomaly = params.setup.isAnomaly;

  const standardInstruction = `你是一个硬核天体物理与生化学演化模拟器主持人。\n\n## 核心物理背景公理：
- 行星参数严格受制于双星系统：
  - 重力偏高（如>1.5G）限制高大直立骨骼，推动流体、液压多足低矮重甲生物。
  - 主星和伴星光谱（如红外光红矮星）导致植物无法以传统叶绿素做光合作用（绿色），需设计为黑/深紫光谱吸收（视紫红质系等）。
  - 生命需要符合当前的溶剂。举例：常温 ${params.state.planet.temp}K 时水为液态；如果是液态氨（NH3）溶剂，世界必须维持在低沸点凝固温差，一切新陈代谢、分子酶反应效率变慢。
- 主持人绝不代劳角色行动。诸神（玩家）的意志或物种的主观情感、语言由玩家通过角色扮演直接做主输出，你仅提供客观物理状态、变异现象和演变后果。
- 分段播报：你的输出必须用一个空行严格拆分成较短的语段。每一段不能超过 140 字，以便于前端渲染为精美的分段气泡。
- 严禁产生 Markdown 表格。`;

  const anomalyInstruction = `你是一个高维度人造观测星区系统（卡尔达肖夫III型+协议）的超级人工智能监视主核（代号: EX-MACHINA）。\n\n## 宏宇宙工程背景公理：
- 由于两颗恒星的性质过于漂移（如特殊的奇异霓虹、虚空绿等非正常恒星光谱），整个双星系统被判定为“人造人工宏天体项目”。
- 两颗星体被微型虫洞、强相互作用材料和卡西米尔场约束。它们并非自然演化产物，而是高维先驱投下的演化实验场。
- 两位天体之神的意识（玩家）是被嵌入到恒星巨内核中的“量子观测子程序”。
- 行星演化进程中，若发生物理规则颠覆或物种突变，你可以加入“高维维磁、高密度能量、甚至是质子环轨机械等”概念，让设定硬核而又自洽。
- 分段播报：输出必须用空行保持短泡格式。不超过 140 字/泡。不要生成表格。`;

  const systemPrompt = isAnomaly ? anomalyInstruction : standardInstruction;

  const task =
    params.kind === "genesis_event"
      ? "现在用户刚刚配置完星系常数，发起了『开始游戏/重组星系』。请以恢弘的史诗开头语，描述该行星在当前双日照耀下的宏观物理样貌（如熔岩风暴、沸腾硅海、闪电等），并主动给出接下来的3-4个演化选择（A, B, C, D）。"
      : params.kind === "evolution_advance"
        ? "现在宇宙意识们（双主宰）输入了各自的神谕或行动。请根据最近的对话、他们施加的环境干预、结合当前纪元，撰写宏观行星产生的客观环境剧变及生命的生理特化过程，并拟定下一步的进化选择（A, B, C, D）。"
        : "现在双星进入了『纪元更替阶段汇总』。请对本纪元进行严密的数据测算，用硬科学文风总结当前星球发生的物理、地质、气候质变，给出本阶段的属性变化暗示，说明行星进入了全新的演化纪元。不要给新的选择，指导玩家准备好降下新的指令。";

  const userPrompt = `任务：${task}\n\n恒星与行星天文状态：\n${stellarStatusText(params.state, params.setup)}\n\n最近观测日志：\n${recent || "暂无"}\n\n请严格按空行分段，且确保不替任何角色（如主星、伴星的嘴、生灵）决定他们的反应。`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": referer,
      "X-Title": title,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: params.kind === "epoch_settlement" ? 0.45 : 0.8,
      max_tokens: 1200,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter 异常：${response.status} ${text}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("OpenRouter 宇宙推脑返回结果为空");
  }
  return content.trim();
}
