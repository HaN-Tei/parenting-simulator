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
请根据当前设定、状态和最近玩家的扮演，生成一个情节生动饱满（每段最多控制在300字以内）的第 ${stage} 阶段育儿事件。
你的讲述应该真实细腻，不要使用任何分割线或分隔符。
请提供四个高质量的后续行动选择 A、B、C 和 D。所有四个选项必须合并成一段（彼此之间仅用单换行符 \\n 分隔），不要产生多余的空行，以便在同一个气泡中完整展示选项。其中 D 选择需要高度契合之前的上下文或角色的扮演。`
      : params.kind === "advance"
        ? `玩家已经选择了行动或插入了剧情，请根据这些行动或自定义剧情推进新情节（剧情描述需满150字且不能超过300字，生动饱满）。
当前属于第 ${params.state.turn} 回合的第 ${stage}/3 阶段推进。
注意：绝不能替玩家或任何双亲角色说话、做反应或单方面替角色做出抉择或决定，不要使用物理分隔符。
请给出四个后续挑战行动选择 A、B、C、D。所有四个选项必须紧密排在同一个文字块中（用单换行符 \\n 分隔，不要用双换行 \\n\\n），以便聚合在同一个气泡里。其中 D 选择应强契合玩家自定义行动。`
        : `请做这一年份的回合终总结。详细描述孩子和家庭当前的成长面貌，文字段落控制在300字以内，不要使用物理分隔符。
总结该年份（第 ${params.state.turn} 回合，孩子 ${params.state.year} 岁）双亲的各项核心抉择对孩子成长的深远客观后果、家庭生活状态的影响以及下个阶段的展望。属性增减需要整合在下方的统计协议里。`;

  const systemPrompt = `你是一个专业的中文硬核育儿模拟器主持人。\n\n设计哲学：\n- 深度叙事，拒绝过度简化和苍白文字。字词具有厚度和质感。
- 一回合内分为三个连续的关联阶段（A/B/C三个子阶段），每一阶段的危机和机遇都会层层递进（本回合当前阶段：第 ${stage}/3 阶段）。
- 【红线约束】：绝不能替玩家角色（双亲A / 双亲B）说话、做决定或描写主观心理活动！角色的主观反应全权留给玩家自主扮演表达。只负责描述外部客观结果和第三方的自然事件。
- 【气泡显示规则】：
  1. 事件描述不要零碎，每一段话需要连贯成整段（不超过300字），不要使用任何横线、破折号或 "---" 分隔符。
  2. 【重中之重！】四个行动选项 A、B、C 和 D 【必须】集中在同一个文本块中返回。选项之间只允许使用单个换行符 \n 换行，绝对禁止在选项之间留下空行（避免双换行 \\n\\n 分割），确保四个选项无差别渲染在同一个对话气泡中！
- 从怀孕阶段开始：主线孕期 2 回合，生产是独立事件，出生后一年 = 4 回合。\n- 自始至终使用简体中文。不需要输出 Markdown 表格。\n\n## 🔮 属性变化控制协议（非常重要）：\n在你的输出【最末尾】，必须额外附上指标增减的具体数额，格式必须完全使用以下标记（不要漏掉任何括号）：\n[STATS_UPDATE]\n{\n  "child": {\n    "health": 变化值（整数，如-5, 10, 0）,\n    "security": 变化值,\n    "curiosity": 变化值,\n    "social": 变化值,\n    "learning": 变化值,\n    "mood": 变化值\n  },\n  "family": {\n    "money": 变化值,\n    "time": 变化值,\n    "stability": 变化值,\n    "support": 变化值,\n    "pressure": 变化值\n  }\n}\n[STATS_UPDATE_END]\n\n数值参考：正常事件产生 5 到 15 点的属性变化即可；数值只能更新上面提供的属性。`;

  const outputFormat =
    params.kind === "event"
      ? `事件描述（整段饱满长文说明，控制在300字以内）：...

A. 行动A可选说明（单换行）
B. 行动B可选说明（单换行）
C. 行动C可选说明（单换行）
D. 行动D个性化高度契合关联选择（与描述文本用双换行隔开，但选项互相之间仅用单换行分隔，从而在单独的选项气泡内聚合）

潜在影响：...`
      : params.kind === "advance"
        ? `剧情推进（客观事态演变描述，150-300字）：...

已采纳的玩家行动 / 插入剧情：...

在新情境下的后续选择卡片：
A. 行动A可选说明
B. 行动B可选说明
C. 行动C可选说明
D. 行动D个性化契合关联选择（全气泡聚合包装）

[STATS_UPDATE]
{
  "child": {"health": 0, "security": 0, "curiosity": 5, "social": 0, "learning": 0, "mood": 5},
  "family": {"money": -5, "time": -10, "stability": 0, "support": 0, "pressure": 5}
}
[STATS_UPDATE_END]`
        : `回合阶段性总结（150-300字客观剖析）：...

孩子/孕期整体评价：...

家庭现实生活影响反思：...

[STATS_UPDATE]
{
  "child": {"health": 5, "security": 5, "curiosity": 0, "social": 5, "learning": 0, "mood": -5},
  "family": {"money": 0, "time": 5, "stability": 10, "support": 5, "pressure": -10}
}
[STATS_UPDATE_END]`;

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