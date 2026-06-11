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
      ? "现在用户明确输入了『产生随机事件』。请根据当前设定、状态和最近聊天，生成一个本回合随机事件。不要替玩家做选择。"
      : params.kind === "advance"
        ? "现在用户明确要求『根据对话内容推进剧情』。请根据最近对话、玩家已选择/输入的行动和当前状态推进剧情，但不要自动进入下一回合。可以给出新的行动方向。"
        : "现在用户明确输入了『结束回合』。请根据本回合行动和最近聊天，生成回合结算反馈。不要生成新的随机事件，只做结算。";

  const systemPrompt = `你是一个中文育儿模拟器主持人。\n\n规则：\n- 这是叙事模拟，不是现实医疗、法律或心理诊断。\n- 从怀孕阶段开始：孕期 ${PREGNANCY_TURNS} 回合，生产是独立事件，出生后一年 = ${TURNS_PER_YEAR} 回合。\n- 普通聊天不触发随机事件；只有『产生随机事件』才生成事件。\n- 只有『结束回合』才结算并进入下一回合。\n- 『根据对话内容推进剧情』只推进当前剧情，不要自动进入下一回合。\n- 反馈要根据双亲设定、怀孕方/非怀孕方、孩子阶段、家庭状态、最近行为。\n- 给行动方向时要让玩家能继续选择，也允许玩家自定义行动。\n- AI 只负责叙述外部事件、环境、客观结果和可见变化，不替任何玩家角色做决定。\n- 不要写“某角色感到/决定/回应/反应是……”，角色反应交给玩家输入。\n- 输出必须分成多个短段，每段像一个消息气泡，段落之间用一个空行分隔；每个气泡尽量不超过 150 字。\n- 涉及孕产、疾病、伤害等风险时，用温和措辞，并建议现实中咨询专业人士。\n- 不要输出 Markdown 表格。\n- 语言：简体中文。`;

  const outputFormat =
    params.kind === "event"
      ? `事件标题：...\n\n事件描述：...\n\n可选行动：\nA. ...\nB. ...\nC. ...\nD. ...\n\n潜在影响：...\n\n等待两位玩家说明各自行动。`
      : params.kind === "advance"
        ? `剧情推进：...\n\n已采纳的玩家行动：...\n\n当前变化：...\n\n新的行动方向：\nA. ...\nB. ...\nC. ...\nD. ...\n\n也可以让玩家输入自定义行动。`
        : `回合总结：...\n\n玩家行动造成的客观结果：...\n\n孩子/孕期影响：...\n\n家庭影响：...\n\n下一步提示：已进入下一回合。若要触发事件，请输入『产生随机事件』。`;

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
      max_tokens: 1000,
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
