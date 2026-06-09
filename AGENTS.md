# parenting-simulator

这是 M0 为用户 HaN-Tei 创建的双用户同步 AI 育儿模拟器原型。

原则：
- 默认中文。
- OpenRouter API Key 只能放在后端环境变量，不能写入前端代码或提交到 GitHub。
- Supabase service_role key 只能放在 Vercel 环境变量。
- 游戏规则：普通聊天不触发随机事件；只有“产生随机事件”调用 AI 事件；只有“结束回合”推进回合。
