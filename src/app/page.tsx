"use client";

import { useEffect, useMemo, useState } from "react";
import type { RoomPayload } from "@/lib/types";

type ApiResponse = {
  ok: boolean;
  error?: string;
  playerId?: string;
  payload?: RoomPayload;
};

async function apiPost(path: string, body: unknown): Promise<ApiResponse> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json();
}

async function apiGet(path: string): Promise<ApiResponse> {
  const response = await fetch(path, { cache: "no-store" });
  return response.json();
}

function formatTime(value: string) {
  try {
    return new Date(value).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function Home() {
  const [displayName, setDisplayName] = useState("玩家A");
  const [joinCode, setJoinCode] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [payload, setPayload] = useState<RoomPayload | null>(null);
  const [content, setContent] = useState("");
  const [parentAName, setParentAName] = useState("");
  const [parentAJob, setParentAJob] = useState("");
  const [parentAPregnancyRole, setParentAPregnancyRole] = useState("怀孕方");
  const [parentA, setParentA] = useState("");
  const [parentBName, setParentBName] = useState("");
  const [parentBJob, setParentBJob] = useState("");
  const [parentBPregnancyRole, setParentBPregnancyRole] = useState("非怀孕方");
  const [parentB, setParentB] = useState("");
  const [world, setWorld] = useState("现实向");
  const [setupDraftDirty, setSetupDraftDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const activeCode = roomCode || payload?.room.room_code || "";

  function applySetupFromPayload(nextPayload: RoomPayload) {
    setParentAName(nextPayload.setup.parentAName || "");
    setParentAJob(nextPayload.setup.parentAJob || "");
    setParentAPregnancyRole(nextPayload.setup.parentAPregnancyRole || "怀孕方");
    setParentA(nextPayload.setup.parentA || "");
    setParentBName(nextPayload.setup.parentBName || "");
    setParentBJob(nextPayload.setup.parentBJob || "");
    setParentBPregnancyRole(nextPayload.setup.parentBPregnancyRole || "非怀孕方");
    setParentB(nextPayload.setup.parentB || "");
    setWorld(nextPayload.setup.world || "现实向");
  }

  function resetSetupDraft() {
    setParentAName("");
    setParentAJob("");
    setParentAPregnancyRole("怀孕方");
    setParentA("");
    setParentBName("");
    setParentBJob("");
    setParentBPregnancyRole("非怀孕方");
    setParentB("");
    setWorld("现实向");
    setSetupDraftDirty(false);
  }

  useEffect(() => {
    const savedCode = localStorage.getItem("parenting.roomCode") || "";
    const savedPlayerId = localStorage.getItem("parenting.playerId") || "";
    const savedName = localStorage.getItem("parenting.displayName") || "";
    window.setTimeout(() => {
      if (savedCode) setRoomCode(savedCode);
      if (savedPlayerId) setPlayerId(savedPlayerId);
      if (savedName) setDisplayName(savedName);
    }, 0);
  }, []);

  useEffect(() => {
    if (!activeCode) return;

    let cancelled = false;
    async function refresh() {
      try {
        const data = await apiGet(`/api/rooms/${activeCode}`);
        if (!cancelled && data.ok && data.payload) {
          setPayload(data.payload);
          if (!setupDraftDirty) {
            applySetupFromPayload(data.payload);
          }
        }
      } catch {
        // 轮询失败时不打扰玩家，下一轮再试。
      }
    }

    refresh();
    const timer = window.setInterval(refresh, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeCode, setupDraftDirty]);

  const statusLine = useMemo(() => {
    if (!payload) return "尚未进入房间";
    const state = payload.state;
    const age = state.year === 0 ? "孕期" : `孩子 ${state.year} 岁`;
    return `房间 ${payload.room.room_code}｜第 ${state.turn} 回合｜${age}｜状态：${payload.room.status}`;
  }, [payload]);

  async function createRoom() {
    setBusy(true);
    setError("");
    try {
      const data = await apiPost("/api/rooms", { displayName });
      if (!data.ok || !data.payload || !data.playerId) throw new Error(data.error || "创建失败");
      setPayload(data.payload);
      applySetupFromPayload(data.payload);
      setSetupDraftDirty(false);
      setRoomCode(data.payload.room.room_code);
      setPlayerId(data.playerId);
      localStorage.setItem("parenting.roomCode", data.payload.room.room_code);
      localStorage.setItem("parenting.playerId", data.playerId);
      localStorage.setItem("parenting.displayName", displayName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom() {
    setBusy(true);
    setError("");
    try {
      const data = await apiPost("/api/rooms/join", { code: joinCode, displayName });
      if (!data.ok || !data.payload || !data.playerId) throw new Error(data.error || "加入失败");
      setPayload(data.payload);
      applySetupFromPayload(data.payload);
      setSetupDraftDirty(false);
      setRoomCode(data.payload.room.room_code);
      setPlayerId(data.playerId);
      localStorage.setItem("parenting.roomCode", data.payload.room.room_code);
      localStorage.setItem("parenting.playerId", data.playerId);
      localStorage.setItem("parenting.displayName", displayName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加入失败");
    } finally {
      setBusy(false);
    }
  }

  async function saveSetup() {
    if (!activeCode) return;
    setBusy(true);
    setError("");
    try {
      const data = await apiPost(`/api/rooms/${activeCode}/setup`, {
        parentAName,
        parentAJob,
        parentAPregnancyRole,
        parentA,
        parentBName,
        parentBJob,
        parentBPregnancyRole,
        parentB,
        world,
      });
      if (!data.ok || !data.payload) throw new Error(data.error || "保存失败");
      setPayload(data.payload);
      setSetupDraftDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(text?: string) {
    const finalText = (text ?? content).trim();
    if (!activeCode || !finalText) return;
    setBusy(true);
    setError("");
    try {
      const data = await apiPost(`/api/rooms/${activeCode}/message`, {
        playerId,
        author: displayName,
        content: finalText,
      });
      if (!data.ok || !data.payload) throw new Error(data.error || "发送失败");
      setPayload(data.payload);
      if (!text) setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    } finally {
      setBusy(false);
    }
  }

  async function sendActionAndAdvance(action: string) {
    if (!activeCode || !action.trim()) return;
    setBusy(true);
    setError("");
    try {
      const actionData = await apiPost(`/api/rooms/${activeCode}/message`, {
        playerId,
        author: displayName,
        content: `行动选择：${action.trim()}`,
      });
      if (!actionData.ok || !actionData.payload) throw new Error(actionData.error || "行动提交失败");

      const advanceData = await apiPost(`/api/rooms/${activeCode}/message`, {
        playerId,
        author: displayName,
        content: "根据对话内容推进剧情",
      });
      if (!advanceData.ok || !advanceData.payload) throw new Error(advanceData.error || "推进剧情失败");
      setPayload(advanceData.payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "推进剧情失败");
    } finally {
      setBusy(false);
    }
  }

  function sendCustomAction() {
    const custom = window.prompt("请输入自定义行动，例如：我先安抚对方情绪，再一起查资料决定下一步。");
    if (custom?.trim()) {
      sendActionAndAdvance(`自定义行动：${custom.trim()}`);
    }
  }

  function leaveLocalRoom() {
    localStorage.removeItem("parenting.roomCode");
    localStorage.removeItem("parenting.playerId");
    setRoomCode("");
    setPlayerId("");
    setPayload(null);
    resetSetupDraft();
  }

  return (
    <main className="min-h-screen bg-[#f7f2e9] text-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6">
        <header className="rounded-3xl bg-white/85 p-6 shadow-sm ring-1 ring-black/5">
          <p className="text-sm font-semibold text-amber-700">双用户同步 AI 育儿模拟器</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">从怀孕开始的共同养育故事</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            普通聊天不会触发事件。只有输入「产生随机事件」才调用 AI；只有输入「结束回合」才推进回合。
          </p>
        </header>

        {!payload ? (
          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <h2 className="text-xl font-bold">创建房间</h2>
              <label className="mt-4 block text-sm font-medium">你的昵称</label>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-500"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="例如：玩家A"
              />
              <button
                className="mt-4 w-full rounded-2xl bg-amber-600 px-4 py-3 font-bold text-white disabled:opacity-50"
                disabled={busy}
                onClick={createRoom}
              >
                创建新房间
              </button>
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <h2 className="text-xl font-bold">加入房间</h2>
              <label className="mt-4 block text-sm font-medium">房间码</label>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 uppercase outline-none focus:border-amber-500"
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                placeholder="例如：ABCD12"
              />
              <label className="mt-4 block text-sm font-medium">你的昵称</label>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-500"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="例如：玩家B"
              />
              <button
                className="mt-4 w-full rounded-2xl bg-slate-900 px-4 py-3 font-bold text-white disabled:opacity-50"
                disabled={busy}
                onClick={joinRoom}
              >
                加入房间
              </button>
            </div>
          </section>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <aside className="flex flex-col gap-4">
              <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-500">当前状态</p>
                    <h2 className="mt-1 text-lg font-bold">{statusLine}</h2>
                  </div>
                  <button className="text-sm text-slate-500 underline" onClick={leaveLocalRoom}>
                    离开本机
                  </button>
                </div>
                <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm leading-6">
                  <p>玩家：{payload.players.map((p) => p.display_name).join("、") || "暂无"}</p>
                  <p>
                    孩子：健康 {payload.state.child.health}｜安全感 {payload.state.child.security}｜情绪{" "}
                    {payload.state.child.mood}
                  </p>
                  <p>
                    家庭：金钱 {payload.state.family.money}｜时间 {payload.state.family.time}｜压力{" "}
                    {payload.state.family.pressure}
                  </p>
                </div>
              </section>

              <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                <h2 className="text-lg font-bold">开局设定</h2>

                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <h3 className="font-semibold">双亲 A</h3>
                  <label className="mt-3 block text-sm font-medium">姓名</label>
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-500"
                    value={parentAName}
                    onChange={(event) => {
                      setParentAName(event.target.value);
                      setSetupDraftDirty(true);
                    }}
                    placeholder="例如：林晓"
                  />
                  <label className="mt-3 block text-sm font-medium">职业</label>
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-500"
                    value={parentAJob}
                    onChange={(event) => {
                      setParentAJob(event.target.value);
                      setSetupDraftDirty(true);
                    }}
                    placeholder="例如：小学老师 / 程序员 / 自由职业"
                  />
                  <label className="mt-3 block text-sm font-medium">身份</label>
                  <select
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-500"
                    value={parentAPregnancyRole}
                    onChange={(event) => {
                      setParentAPregnancyRole(event.target.value);
                      if (event.target.value === "怀孕方") setParentBPregnancyRole("非怀孕方");
                      setSetupDraftDirty(true);
                    }}
                  >
                    <option>怀孕方</option>
                    <option>非怀孕方</option>
                  </select>
                </div>

                <label className="mt-4 block text-sm font-medium">双亲 A 补充设定</label>
                <textarea
                  className="mt-2 h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-500"
                  value={parentA}
                  onChange={(event) => {
                    setParentA(event.target.value);
                    setSetupDraftDirty(true);
                  }}
                  placeholder="年龄、性格、育儿观、家庭背景、和另一位双亲的关系……"
                />

                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <h3 className="font-semibold">双亲 B</h3>
                  <label className="mt-3 block text-sm font-medium">姓名</label>
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-500"
                    value={parentBName}
                    onChange={(event) => {
                      setParentBName(event.target.value);
                      setSetupDraftDirty(true);
                    }}
                    placeholder="例如：周然"
                  />
                  <label className="mt-3 block text-sm font-medium">职业</label>
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-500"
                    value={parentBJob}
                    onChange={(event) => {
                      setParentBJob(event.target.value);
                      setSetupDraftDirty(true);
                    }}
                    placeholder="例如：医生 / 设计师 / 全职照护者"
                  />
                  <label className="mt-3 block text-sm font-medium">身份</label>
                  <select
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-500"
                    value={parentBPregnancyRole}
                    onChange={(event) => {
                      setParentBPregnancyRole(event.target.value);
                      if (event.target.value === "怀孕方") setParentAPregnancyRole("非怀孕方");
                      setSetupDraftDirty(true);
                    }}
                  >
                    <option>怀孕方</option>
                    <option>非怀孕方</option>
                  </select>
                </div>

                <label className="mt-4 block text-sm font-medium">双亲 B 补充设定</label>
                <textarea
                  className="mt-2 h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-500"
                  value={parentB}
                  onChange={(event) => {
                    setParentB(event.target.value);
                    setSetupDraftDirty(true);
                  }}
                  placeholder="年龄、性格、育儿观、家庭背景、和另一位双亲的关系……"
                />
                <label className="mt-4 block text-sm font-medium">世界/家庭设定</label>
                <textarea
                  className="mt-2 h-20 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-500"
                  value={world}
                  onChange={(event) => {
                    setWorld(event.target.value);
                    setSetupDraftDirty(true);
                  }}
                  placeholder="现实向、轻幻想、近未来、城市、家庭资源等……"
                />
                <button
                  className="mt-4 w-full rounded-2xl bg-amber-600 px-4 py-3 font-bold text-white disabled:opacity-50"
                  disabled={busy}
                  onClick={saveSetup}
                >
                  保存设定
                </button>
              </section>
            </aside>

            <section className="rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
              <div className="border-b border-slate-100 p-5">
                <h2 className="text-lg font-bold">房间聊天与游戏日志</h2>
                <p className="mt-1 text-sm text-slate-500">把房间码 {payload.room.room_code} 发给另一位玩家。</p>
              </div>

              <div className="flex h-[520px] flex-col gap-3 overflow-y-auto p-5">
                {payload.messages.map((message) => (
                  <article
                    key={message.id}
                    className={`rounded-2xl p-4 text-sm leading-6 ${
                      message.author === "系统" ? "bg-amber-50" : "bg-slate-50"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span>
                        {message.author} · {message.kind}
                      </span>
                      <span>{formatTime(message.created_at)}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </article>
                ))}
              </div>

              <div className="border-t border-slate-100 p-5">
                <div className="mb-3 rounded-2xl bg-amber-50 p-3">
                  <p className="mb-2 text-sm font-semibold text-amber-900">行动方向</p>
                  <div className="flex flex-wrap gap-2">
                    {["A", "B", "C", "D"].map((choice) => (
                      <button
                        key={choice}
                        className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm ring-1 ring-amber-200 hover:bg-amber-100 disabled:opacity-50"
                        disabled={busy}
                        onClick={() => sendActionAndAdvance(choice)}
                      >
                        选择 {choice}
                      </button>
                    ))}
                    <button
                      className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm ring-1 ring-amber-200 hover:bg-amber-100 disabled:opacity-50"
                      disabled={busy}
                      onClick={sendCustomAction}
                    >
                      自定义行动
                    </button>
                    <button
                      className="rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                      disabled={busy}
                      onClick={() => sendMessage("根据对话内容推进剧情")}
                    >
                      根据对话内容推进剧情
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-amber-800">
                    AI 给出 A/B/C/D 行动方向后，可直接点对应按钮；也可以输入自定义行动。
                  </p>
                </div>
                <div className="mb-3 flex flex-wrap gap-2">
                  {["开始游戏", "产生随机事件", "根据对话内容推进剧情", "结束回合", "查看状态"].map((command) => (
                    <button
                      key={command}
                      className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold hover:bg-slate-200 disabled:opacity-50"
                      disabled={busy}
                      onClick={() => sendMessage(command)}
                    >
                      {command}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <textarea
                    className="h-20 flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-500"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="输入聊天、行动，或指令：产生随机事件 / 结束回合"
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                        sendMessage();
                      }
                    }}
                  />
                  <button
                    className="w-24 rounded-2xl bg-slate-900 px-4 py-3 font-bold text-white disabled:opacity-50"
                    disabled={busy}
                    onClick={() => sendMessage()}
                  >
                    发送
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500">提示：Ctrl/⌘ + Enter 发送。AI 生成时可能需要等待十几秒。</p>
              </div>
            </section>
          </div>
        )}

        {error ? <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
        {busy ? <p className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-700">处理中，请稍等……</p> : null}
      </div>
    </main>
  );
}
