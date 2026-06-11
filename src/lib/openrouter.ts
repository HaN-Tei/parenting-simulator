import type { GameSetup, GameState } from "./types";
import { PREGNANCY_TURNS, TURNS_PER_YEAR, statusText } from "./game";

type AiKind = "event" | "settlement" | "advance";

type Message = {
  author: string;
  kind: string;
  content: string;
  created_at: string;
};

export async function callOpenRouter(params: {
  kind: AiKind;
  setup: GameSetup;
  state: GameState;
  recentMessages: Message[];
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 OPENROUTER_API_KEY 环境变量");
  }

  const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
  const title = "Parenting Simulator";
  const referer = process.env.APP_URL || "http://localhost:3000";

  const stage = params.state.stage || 1;
  const recent = params.recentMessages
    .slice(-30)
    .map((m) => `${m.author}：${m.content}`)
    .join("\n");

  const task =
    params.kind === "event"
      ? `现在开启第 ${params.state.turn} 回合的第 ${stage}/3 阶段演化。
请根据当前设定、状态和最近玩家的扮演，生成一个情节丰富（最少150字）的第 ${stage} 阶段育儿事件。
你的讲述应该极为生动饱满，注重真实育儿细节，不要使用任何分割线、破折号或分隔符。
请提供4个高质量的深度行动选择 A、B、C 和 D（不要草率简化），其中 D 应与之前的上下文或角色的扮演有关。`
      : params.kind === "advance"
        ? `玩家已经选择了行动或插入了剧情，请根据这些行动或自定义剧情推进新情节（剧情描述需满150字，极为生动饱满）。
当前属于第 ${params.state.turn} 回合的第 ${stage}/3 阶段推进。
注意：不要替玩家单方面做出抉择或决定，不要使用任何多余的分隔符。
请给出新的深度后续行动选择 A、B、C、D。其中 D 选择需要高度契合玩家当前情境和自定义输入。`
        : `回合阶段性总结：回合全部3个阶段均已完结，请做这一年的回合终总结（文字描述也需详尽丰富，150字以上）。
总结该年份（第 ${params.state.turn} 回合，孩子 ${params.state.year} 岁）双亲的各项核心抉择对孩子成长的深远客观后果、家庭生活状态的影响以及下个阶段的展望。属性增减需要整合在下方的统计协议里。`;

  const systemPrompt = `你是一个专业的中文硬核育儿模拟器主持人。\n\n设计哲学：\n- 深度叙事，拒绝过度简化和苍白文字。字词有厚度，逻辑严密，文字优美。
- 一回合内分为三个连续的关联阶段（A/B/C三个子阶段），每一阶段的危机和机遇都会层层递进（本回合当前阶段：第 ${stage}/3 阶段）。
- 不要为玩家做任何定性决定或表达思想状态，玩家拥有100%自主的角色扮演权。
- 气泡内容不能太少。单次返回中，叙述文必须包含一个长达150-300字、饱含现实质感的整段说明，不能零碎，也不能使用任何横线、破折号或“---”分隔符。
- 选项列表（A/B/C/D）必须完整写出并提供长句解释，不要缩水。
- 从怀孕阶段开始：主线孕期 2 回合，生产是独立事件，出生后一年 = 4 回合。\n- 自始至终使用简体中文。不需要输出 Markdown 表格。\n\n## 🔮 属性变化控制协议（非常重要）：\n在你的输出【最末尾】，必须额外附上指标增减的具体数额，格式必须完全使用以下标记（不要漏掉任何括号）：\n[STATS_UPDATE]\n{\n  "child": {\n    "health": 变化值（整数，如-5, 10, 0）,\n    "security": 变化值,\n    "curiosity": 变化值,\n    "social": 变化值,\n    "learning": 变化值,\n    "mood": 变化值\n  },\n  "family": {\n    "money": 变化值,\n    "time": 变化值,\n    "stability": 变化值,\n    "support": 变化值,\n    "pressure": 变化值\n  }\n}\n[STATS_UPDATE_END]\n\n数值参考：正常事件产生 5 到 15 点的属性变化即可；数值只能更新上面提供的属性。`;

  const outputFormat =
    params.kind === "event"
      ? `事件描述（整段饱满长文说明）：...\n\nA. ...\nB. ...\nC. ...\nD. ...\n\n潜在影响：...`
      : params.kind === "advance"
        ? `剧情推进（饱满整段描述及客观结果）：...\n\n已采纳的玩家行动 / 插入剧情：...\n\n接下来的新挑战行动选择：\nA. ...\nB. ...\nC. ...\nD. ...\n\n[STATS_UPDATE]\n{\n  "child": {"health": 0, "security": 0, "curiosity": 5, "social": 0, "learning": 0, "mood": 5},\n  "family": {"money": -5, "time": -10, "stability": 0, "support": 0, "pressure": 5}\n}\n[STATS_UPDATE_END]`
        : `回合阶段性总结（整段叙述，富含深度剖析）：...\n\n孩子/孕期整体评价：...\n\n家庭现实生活影响深度反思：...\n\n[STATS_UPDATE]\n{\n  "child": {"health": 5, "security": 5, "curiosity": 0, "social": 5, "learning": 0, "mood": -5},\n  "family": {"money": 0, "time": 5, "stability": 10, "support": 5, "pressure": -10}\n}\n[STATS_UPDATE_END]`;

  const userPrompt = `任务：${task}\n\n当前状态：\n${statusText(params.state, params.setup)}\n\n最近聊天/日志：\n${recent || "暂无"}\n\n输出格式：\n${outputFormat}`;

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
      temperature: params.kind === "settlement" ? 0.5 : 0.85,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter 调用失败：${response.status} ${text}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("OpenRouter 返回内容为空");
  }
  return content.trim();
}