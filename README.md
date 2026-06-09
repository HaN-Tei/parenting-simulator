# 双用户同步 AI 育儿模拟器

这是一个新手友好的原型：两名玩家用房间码进入同一局游戏，从怀孕开始共同养育孩子。

核心规则：

- 普通聊天不会触发随机事件。
- 只有输入 `产生随机事件` 才调用 OpenRouter 生成本回合随机事件。
- 只有输入 `结束回合` 才结算并进入下一回合。
- 每 10 回合 = 1 年。
- OpenRouter API Key 只放在 Vercel 后端环境变量里，不能放进前端代码。

## 技术栈

- Next.js：网页和后端 API
- Vercel：部署网页和后端
- Supabase：数据库，保存房间、玩家、聊天、状态
- OpenRouter：AI 事件生成和回合结算

## 1. 创建 Supabase 项目

1. 打开 <https://supabase.com/>
2. 登录
3. 点 `New project`
4. Organization 选默认的个人组织
5. Project name 填：`parenting-simulator`
6. Database Password 填一个强密码，并保存好
7. Region 选离你近的，例如 Tokyo / Singapore
8. 点 `Create new project`
9. 等待项目创建完成

## 2. 创建数据库表

1. 进入 Supabase 项目
2. 左侧点 `SQL Editor`
3. 点 `New query`
4. 打开本项目的 `supabase/schema.sql`
5. 全部复制进去
6. 点 `Run`

看到成功提示就可以。

## 3. 找到 Supabase 环境变量

进入 Supabase 项目：

1. 左下或左侧点 `Project Settings`
2. 点 `API`
3. 复制 `Project URL`
4. 复制 `service_role` key

注意：`service_role` 是秘密，只能放到 Vercel 环境变量，不要公开。

你后面需要这两个值：

```text
SUPABASE_URL=你的 Project URL
SUPABASE_SERVICE_ROLE_KEY=你的 service_role key
```

## 4. OpenRouter API Key

打开 <https://openrouter.ai/>

1. 登录
2. 进入 Keys / API Keys
3. 创建 API Key
4. 保存好

后面填到 Vercel：

```text
OPENROUTER_API_KEY=你的 OpenRouter Key
OPENROUTER_MODEL=openai/gpt-4o-mini
```

也可以换成其他 OpenRouter 模型。

## 5. 本地运行，可选

如果你想在电脑本地运行：

```bash
npm install
copy .env.example .env.local
npm run dev
```

然后把 `.env.local` 里的值填好，再打开：

```text
http://localhost:3000
```

## 6. 部署到 GitHub + Vercel

### 6.1 推送到 GitHub

在 GitHub 创建一个新仓库，建议名字：

```text
parenting-simulator
```

然后把本项目上传到仓库。

### 6.2 导入 Vercel

1. 打开 <https://vercel.com/>
2. 点 `Add New...` → `Project`
3. 选择你的 GitHub 仓库 `parenting-simulator`
4. Framework Preset 应该自动识别为 Next.js
5. 在 Environment Variables 添加：

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENROUTER_API_KEY
OPENROUTER_MODEL
APP_URL
```

建议：

```text
OPENROUTER_MODEL=openai/gpt-4o-mini
APP_URL=https://你的项目名.vercel.app
```

6. 点 Deploy

## 7. 使用方法

1. 玩家 A 打开网站，输入昵称，创建房间。
2. 系统给出房间码。
3. 玩家 A 把房间码发给玩家 B。
4. 玩家 B 打开网站，输入房间码和昵称，加入房间。
5. 填写双亲 A / 双亲 B / 世界设定。
6. 点保存设定。
7. 输入或点击 `开始游戏`。
8. 平时直接聊天、描述行动。
9. 需要事件时输入 `产生随机事件`。
10. 要推进回合时输入 `结束回合`。

## 8. 重要安全提醒

不要把这些东西发到群里，也不要提交到 GitHub：

- OpenRouter API Key
- Supabase service_role key
- `.env.local`

本项目的 `.gitignore` 默认会忽略 `.env*` 文件。

## 9. 当前原型限制

- 当前同步方式是网页每 2.5 秒轮询一次后端，不是严格实时；第一版够用。
- 目前没有登录系统，拿到房间码的人就能进房间。
- 目前没有复杂数值结算，AI 会给叙事结算，程序只推进回合和年份。
- 后续可以增加：密码房间、角色权限、实时订阅、数值自动变化、存档导出。
