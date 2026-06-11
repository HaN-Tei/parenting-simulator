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

  const recent = params.recentMessages
    .slice(-30)
    .map((m) => `${m.author}：${m.content}`)
    .join("\n");

  const task =
    params.kind === "event"
      ? "现在开始新的一轮。请根据当前设定、状态和最近聊天，生成一个本回合开头事件，并在本回合事件中附带一些有意义的属性改变。不要替玩家做选择。"
      : params.kind === "advance"
        ? "现在用户明确要求『根据对话内容推进剧情』。请根据最近对话、玩家已选择/输入的行动和当前状态推进剧情。并在回复中结算采纳了哪些行动，且附带属性的增加/减少。"
        : "现在用户明确输入了『结束回合』。请根据本回合行动和最近聊天，生成本期成长总结及大结局暗示。不要生成新的随机事件，只做总结，并包含属性修正。";

  const systemPrompt = `你是一个中文育儿模拟器主持人。\n\n规则：\n- 这是叙事模拟，不仅要有好的剧情，还要根据因果关系修改家庭和孩子的各项指标数值。\n- 从怀孕阶段开始：孕期 ${PREGNANCY_TURNS} 回合，生产是独立事件，出生后一年 = ${TURNS_PER_YEAR} 回合。\n- AI 只负责叙述外部事件、客观结果和数值变化，人物的主观言行和反应交给玩家输入。\n- 不要写“某角色感到/决定/回应/反应是……”，角色反应交给玩家输入。\n- 输出必须分成多个短段，每段用一个空行分隔；每个段尽量不超过 150 字。\n- 严禁输出 Markdown 表格。\n- 语言：简体中文。\n\n## 🔮 属性变化控制协议（非常重要）：\n在你的输出【最末尾】，必须额外附上指标增减的具体数额，格式必须完全使用以下标记（不要漏掉任何括号）：\n[STATS_UPDATE]\n{\n  "child": {\n    "health": 变化值（整数，如-5, 10, 0）,\n    "security": 变化值,\n    "curiosity": 变化值,\n    "social": 变化值,\n    "learning": 变化值,\n    "mood": 变化值\n  },\n  "family": {\n    "money": 变化值,\n    "time": 变化值,\n    "stability": 变化值,\n    "support": 变化值,\n    "pressure": 变化值\n  }\n}\n[STATS_UPDATE_END]\n\n数值参考：正常事件产生 5 到 15 点的属性变化即可；压力增加一般是负面影响。数值只影响上面提供的键名。`;

  const outputFormat =
    params.kind === "event"
      ? `事件标题：...\n\n事件描述：...\n\n可选行动：\nA. ...\nB. ...\nC. ...\nD. ...\n\n潜在影响：...\n\n等待两位玩家说明各自行动。`
      : params.kind === "advance"
        ? `剧情推进：...\n\n已采纳的玩家行动：...\n\n当前变化：...\n\n新的行动方向：\nA. ...\nB. ...\nC. ...\nD. ...\n\n[STATS_UPDATE]\n{\n  "child": {"health": 0, "security": 0, "curiosity": 5, "social": 0, "learning": 0, "mood": 5},\n  "family": {"money": -5, "time": -10, "stability": 0, "support": 0, "pressure": 5}\n}\n[STATS_UPDATE_END]`
        : `回合总结：...\n\n玩家行动造成的客观结果：...\n\n孩子/孕期影响：...\n\n家庭影响：...\n\n[STATS_UPDATE]\n{\n  "child": {"health": 5, "security": 5, "curiosity": 0, "social": 5, "learning": 0, "mood": -5},\n  "family": {"money": 0, "time": 5, "stability": 10, "support": 5, "pressure": -10}\n}\n[STATS_UPDATE_END]`;

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
      max_tokens: 1200,
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
