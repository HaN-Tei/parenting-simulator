"use client";

import { useEffect, useMemo, useState } from "react";
import type { RoomPayload, RoomSaveSummary } from "@/lib/types";

type ApiResponse = { ok: boolean; error?: string; playerId?: string; payload?: RoomPayload; saves?: RoomSaveSummary[] };

const defaultColors = { my: "#dbeafe", other: "#f1f5f9", system: "#fef3c7", ai: "#dcfce7" };
const statNames: Record<string, string> = {
  health: "健康", security: "安全感", curiosity: "好奇心", social: "社交", learning: "学习", mood: "情绪",
  money: "金钱", time: "时间", stability: "稳定度", support: "支持网络", pressure: "压力",
};

async function apiPost(path: string, body: unknown): Promise<ApiResponse> {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return response.json();
}
async function apiGet(path: string): Promise<ApiResponse> {
  const response = await fetch(path, { cache: "no-store" });
  return response.json();
}
function formatTime(value: string) {
  try { return new Date(value).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}
function formatDateTime(value: string) {
  try { return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}
function roleLabel(role?: string) { return role === "parent_a" ? "双亲A" : role === "parent_b" ? "双亲B" : role || "未绑定角色"; }
function phaseLabel(state: RoomPayload["state"]) {
  if (state.phase === "pregnancy") return `孕期第 ${Math.min(state.turn, 2)} / 2 回合`;
  if (state.phase === "birth") return "生产事件";
  if (state.phase.startsWith("child_age_")) return `孩子 ${state.year} 岁`;
  return state.phase;
}
function savePhaseLabel(save: RoomSaveSummary) {
  if (save.phase === "pregnancy") return "孕期";
  if (save.phase === "birth") return "生产事件";
  if (save.phase.startsWith("child_age_")) return `孩子 ${save.year} 岁`;
  return save.phase;
}
function StatBar({ label, value, dangerHigh = false }: { label: string; value: number; dangerHigh?: boolean }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const color = dangerHigh ? (v >= 70 ? "bg-red-500" : v >= 40 ? "bg-amber-500" : "bg-emerald-500") : (v >= 70 ? "bg-emerald-500" : v >= 40 ? "bg-amber-500" : "bg-red-500");
  return <div><div className="mb-1 flex justify-between text-xs"><span>{label}</span><span>{v}</span></div><div className="h-2 rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${v}%` }} /></div></div>;
}

export default function Home() {
  const [displayName, setDisplayName] = useState("玩家A");
  const [joinCode, setJoinCode] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [payload, setPayload] = useState<RoomPayload | null>(null);
  const [saves, setSaves] = useState<RoomSaveSummary[]>([]);
  const [content, setContent] = useState("");
  const [setupDraftDirty, setSetupDraftDirty] = useState(false);
  const [parentAName, setParentAName] = useState("");
  const [parentAJob, setParentAJob] = useState("");
  const [parentAPregnancyRole, setParentAPregnancyRole] = useState("怀孕方");
  const [parentA, setParentA] = useState("");
  const [parentBName, setParentBName] = useState("");
  const [parentBJob, setParentBJob] = useState("");
  const [parentBPregnancyRole, setParentBPregnancyRole] = useState("非怀孕方");
  const [parentB, setParentB] = useState("");
  const [world, setWorld] = useState("现实向");
  const [myBubbleColor, setMyBubbleColor] = useState(defaultColors.my);
  const [otherBubbleColor, setOtherBubbleColor] = useState(defaultColors.other);
  const [systemBubbleColor, setSystemBubbleColor] = useState(defaultColors.system);
  const [aiBubbleColor, setAiBubbleColor] = useState(defaultColors.ai);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const activeCode = roomCode || payload?.room.room_code || "";
  const currentPlayer = useMemo(() => payload?.players.find((p) => p.id === playerId) ?? null, [payload, playerId]);
  const currentRole = roleLabel(currentPlayer?.role);
  const statusLine = payload ? `房间 ${payload.room.room_code}｜第 ${payload.state.turn} 回合｜${phaseLabel(payload.state)}｜${payload.room.status}` : "尚未进入房间";

  function applySetup(next: RoomPayload) {
    setParentAName(next.setup.parentAName || ""); setParentAJob(next.setup.parentAJob || ""); setParentAPregnancyRole(next.setup.parentAPregnancyRole || "怀孕方"); setParentA(next.setup.parentA || "");
    setParentBName(next.setup.parentBName || ""); setParentBJob(next.setup.parentBJob || ""); setParentBPregnancyRole(next.setup.parentBPregnancyRole || "非怀孕方"); setParentB(next.setup.parentB || ""); setWorld(next.setup.world || "现实向");
  }
  function setDirty<T>(setter: (v: T) => void, value: T) { setter(value); setSetupDraftDirty(true); }
  const refreshSaves = useMemo(() => async (code = activeCode) => { if (!code) return; const data = await apiGet(`/api/rooms/${code}/saves`).catch(() => null); if (data?.ok && data.saves) setSaves(data.saves); }, [activeCode]);

  useEffect(() => {
    const savedCode = localStorage.getItem("parenting.roomCode") || "";
    const savedPlayerId = localStorage.getItem("parenting.playerId") || "";
    const savedName = localStorage.getItem("parenting.displayName") || "";
    const savedMyColor = localStorage.getItem("parenting.colors.my") || defaultColors.my;
    const savedOtherColor = localStorage.getItem("parenting.colors.other") || defaultColors.other;
    const savedSystemColor = localStorage.getItem("parenting.colors.system") || defaultColors.system;
    const savedAiColor = localStorage.getItem("parenting.colors.ai") || defaultColors.ai;
    const timer = setTimeout(() => {
      if (savedCode) setRoomCode(savedCode);
      if (savedPlayerId) setPlayerId(savedPlayerId);
      if (savedName) setDisplayName(savedName);
      setMyBubbleColor(savedMyColor);
      setOtherBubbleColor(savedOtherColor);
      setSystemBubbleColor(savedSystemColor);
      setAiBubbleColor(savedAiColor);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem("parenting.colors.my", myBubbleColor);
    localStorage.setItem("parenting.colors.other", otherBubbleColor);
    localStorage.setItem("parenting.colors.system", systemBubbleColor);
    localStorage.setItem("parenting.colors.ai", aiBubbleColor);
  }, [myBubbleColor, otherBubbleColor, systemBubbleColor, aiBubbleColor]);

  useEffect(() => {
    if (!activeCode) return;

    let cancelled = false;
    async function refresh() {
      const data = await apiGet(`/api/rooms/${activeCode}`).catch(() => null);
      if (!cancelled && data?.ok && data.payload) {
        setPayload(data.payload);
        if (!setupDraftDirty) {
          applySetup(data.payload);
        }
      }
    }

    refresh();
    const initTimer = setTimeout(() => refreshSaves(activeCode), 0);
    const timer = window.setInterval(refresh, 2500);
    const saveTimer = window.setInterval(() => refreshSaves(activeCode), 15000);
    return () => {
      cancelled = true;
      clearTimeout(initTimer);
      window.clearInterval(timer);
      window.clearInterval(saveTimer);
    };
  }, [activeCode, setupDraftDirty, refreshSaves]);

  function bg(message: RoomPayload["messages"][number]) {
    if (["event", "story", "settlement"].includes(message.kind)) return aiBubbleColor;
    if (message.author === "系统" || message.player_id === null) return systemBubbleColor;
    return message.player_id === playerId ? myBubbleColor : otherBubbleColor;
  }
  async function createRoom() {
    setBusy(true); setError("");
    try { const data = await apiPost("/api/rooms", { displayName }); if (!data.ok || !data.payload || !data.playerId) throw new Error(data.error || "创建失败"); setPayload(data.payload); applySetup(data.payload); setSetupDraftDirty(false); setRoomCode(data.payload.room.room_code); setPlayerId(data.playerId); setSaves([]); localStorage.setItem("parenting.roomCode", data.payload.room.room_code); localStorage.setItem("parenting.playerId", data.playerId); localStorage.setItem("parenting.displayName", displayName); } catch (err) { setError(err instanceof Error ? err.message : "创建失败"); } finally { setBusy(false); }
  }
  async function joinRoom() {
    setBusy(true); setError("");
    try { const data = await apiPost("/api/rooms/join", { code: joinCode, displayName }); if (!data.ok || !data.payload || !data.playerId) throw new Error(data.error || "加入失败"); setPayload(data.payload); applySetup(data.payload); setSetupDraftDirty(false); setRoomCode(data.payload.room.room_code); setPlayerId(data.playerId); localStorage.setItem("parenting.roomCode", data.payload.room.room_code); localStorage.setItem("parenting.playerId", data.playerId); localStorage.setItem("parenting.displayName", displayName); refreshSaves(data.payload.room.room_code); } catch (err) { setError(err instanceof Error ? err.message : "加入失败"); } finally { setBusy(false); }
  }
  async function saveSetup() {
    if (!activeCode) return; setBusy(true); setError("");
    try { const data = await apiPost(`/api/rooms/${activeCode}/setup`, { parentAName, parentAJob, parentAPregnancyRole, parentA, parentBName, parentBJob, parentBPregnancyRole, parentB, world }); if (!data.ok || !data.payload) throw new Error(data.error || "保存失败"); setPayload(data.payload); setSetupDraftDirty(false); } catch (err) { setError(err instanceof Error ? err.message : "保存失败"); } finally { setBusy(false); }
  }
  async function createSave() {
    const name = window.prompt("请输入存档名称", `第${payload?.state.turn ?? ""}回合存档`); if (!activeCode || !name?.trim()) return;
    setBusy(true); setError("");
    try { const data = await apiPost(`/api/rooms/${activeCode}/saves`, { name: name.trim(), playerId, author: displayName }); if (!data.ok || !data.payload) throw new Error(data.error || "保存存档失败"); setPayload(data.payload); await refreshSaves(activeCode); } catch (err) { setError(err instanceof Error ? err.message : "保存存档失败"); } finally { setBusy(false); }
  }
  async function loadSave(save: RoomSaveSummary) {
    if (!activeCode || !window.confirm(`确定读取存档「${save.name}」吗？当前状态会回到第 ${save.turn} 回合，聊天记录会保留。`)) return;
    setBusy(true); setError("");
    try { const data = await apiPost(`/api/rooms/${activeCode}/saves/${save.id}/load`, { playerId, author: displayName }); if (!data.ok || !data.payload) throw new Error(data.error || "读取存档失败"); setPayload(data.payload); applySetup(data.payload); setSetupDraftDirty(false); } catch (err) { setError(err instanceof Error ? err.message : "读取存档失败"); } finally { setBusy(false); }
  }
  async function sendMessage(text?: string) {
    const finalText = (text ?? content).trim(); if (!activeCode || !finalText) return;
    setBusy(true); setError("");
    try { const data = await apiPost(`/api/rooms/${activeCode}/message`, { playerId, author: displayName, content: finalText }); if (!data.ok || !data.payload) throw new Error(data.error || "发送失败"); setPayload(data.payload); if (!text) setContent(""); } catch (err) { setError(err instanceof Error ? err.message : "发送失败"); } finally { setBusy(false); }
  }
  async function sendActionAndAdvance(action: string) {
    if (!activeCode || !action.trim()) return; setBusy(true); setError("");
    try {
      const actionData = await apiPost(`/api/rooms/${activeCode}/message`, { playerId, author: displayName, content: `行动选择：${action.trim()}` });
      if (!actionData.ok || !actionData.payload) throw new Error(actionData.error || "行动提交失败");
      const advanceData = await apiPost(`/api/rooms/${activeCode}/message`, { playerId, author: displayName, content: "根据对话内容推进剧情" });
      if (!advanceData.ok || !advanceData.payload) throw new Error(advanceData.error || "推进剧情失败"); setPayload(advanceData.payload);
    } catch (err) { setError(err instanceof Error ? err.message : "推进剧情失败"); } finally { setBusy(false); }
  }
  function leaveLocalRoom() {
    localStorage.removeItem("parenting.roomCode");
    localStorage.removeItem("parenting.playerId");
    setRoomCode("");
    setPlayerId("");
    setPayload(null);
    setSaves([]);
    resetSetupDraft();
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

  return <main className="min-h-screen bg-[#f7f2e9] text-slate-900"><div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6">
    <header className="rounded-3xl bg-white/85 p-6 shadow-sm ring-1 ring-black/5"><p className="text-sm font-semibold text-amber-700">双用户同步 AI 育儿模拟器</p><h1 className="mt-2 text-3xl font-bold">从怀孕开始的共同养育故事</h1><p className="mt-3 text-sm text-slate-600">玩家绑定双亲A/B；孕期2回合，生产独立事件，出生后1年=4回合。AI事件分气泡输出，角色反应由玩家处理。</p></header>
    {!payload ? <section className="grid gap-4 md:grid-cols-2">
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5"><h2 className="text-xl font-bold">创建房间</h2><p className="mt-2 text-sm text-slate-500">创建者自动绑定为双亲A。</p><input className="mt-4 w-full rounded-2xl border px-4 py-3" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="昵称" /><button className="mt-4 w-full rounded-2xl bg-amber-600 px-4 py-3 font-bold text-white disabled:opacity-50" disabled={busy} onClick={createRoom}>创建新房间</button></div>
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5"><h2 className="text-xl font-bold">加入房间</h2><p className="mt-2 text-sm text-slate-500">第二位玩家自动绑定为双亲B。</p><input className="mt-4 w-full rounded-2xl border px-4 py-3 uppercase" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="房间码" /><input className="mt-3 w-full rounded-2xl border px-4 py-3" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="昵称" /><button className="mt-4 w-full rounded-2xl bg-slate-900 px-4 py-3 font-bold text-white disabled:opacity-50" disabled={busy} onClick={joinRoom}>加入房间</button></div>
    </section> : <div className="grid gap-5 xl:grid-cols-[390px_1fr]">
      <aside className="flex flex-col gap-4">
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5"><div className="flex justify-between gap-3"><div><p className="text-sm text-slate-500">当前状态</p><h2 className="mt-1 text-lg font-bold">{statusLine}</h2><p className="mt-2 text-sm text-amber-700">你正在扮演：{currentRole}</p></div><button className="text-sm underline" onClick={leaveLocalRoom}>离开本机</button></div><div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm">{payload.players.map((p) => <p key={p.id}>{roleLabel(p.role)}：{p.display_name}{p.id === playerId ? "（你）" : ""}</p>)}</div></section>
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5"><h2 className="text-lg font-bold">属性面板</h2><p className="mt-1 text-xs text-slate-500">0-100；压力越高越危险。</p><h3 className="mt-4 mb-2 text-sm font-semibold">孩子 / 孕期</h3><div className="space-y-3">{Object.entries(payload.state.child).map(([k, v]) => <StatBar key={k} label={statNames[k] || k} value={v} />)}</div><h3 className="mt-4 mb-2 text-sm font-semibold">家庭</h3><div className="space-y-3">{Object.entries(payload.state.family).map(([k, v]) => <StatBar key={k} label={statNames[k] || k} value={v} dangerHigh={k === "pressure"} />)}</div></section>
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5"><div className="flex justify-between"><h2 className="text-lg font-bold">存档 / 读档</h2><button className="text-sm underline" disabled={busy} onClick={() => refreshSaves()}>刷新</button></div><button className="mt-4 w-full rounded-2xl bg-emerald-600 px-4 py-3 font-bold text-white disabled:opacity-50" disabled={busy} onClick={createSave}>保存当前进度</button><div className="mt-4 space-y-2">{saves.length ? saves.map((s) => <div key={s.id} className="rounded-2xl bg-slate-50 p-3 text-sm"><div className="flex justify-between gap-3"><div><p className="font-semibold">{s.name}</p><p className="mt-1 text-xs text-slate-500">第{s.turn}回合｜{savePhaseLabel(s)}｜{formatDateTime(s.createdAt)}｜{s.createdBy}</p></div><button className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200" disabled={busy} onClick={() => loadSave(s)}>读取</button></div></div>) : <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">暂无存档。</p>}</div></section>
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5"><h2 className="text-lg font-bold">气泡颜色</h2><div className="mt-4 grid grid-cols-2 gap-3 text-sm">{[["我的消息", myBubbleColor, setMyBubbleColor], ["对方消息", otherBubbleColor, setOtherBubbleColor], ["系统消息", systemBubbleColor, setSystemBubbleColor], ["AI叙述", aiBubbleColor, setAiBubbleColor]].map(([label, value, setter]) => <label key={String(label)} className="space-y-2"><span>{String(label)}</span><input className="h-10 w-full" type="color" value={String(value)} onChange={(e) => (setter as (v: string) => void)(e.target.value)} /></label>)}</div></section>
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5"><h2 className="text-lg font-bold">开局设定</h2><p className="mt-1 text-xs text-slate-500">双亲A/B与玩家绑定一致。</p><div className="mt-4 grid gap-3"><input className="rounded-2xl border px-4 py-3 text-sm" value={parentAName} onChange={(e) => setDirty(setParentAName, e.target.value)} placeholder="双亲A姓名" /><input className="rounded-2xl border px-4 py-3 text-sm" value={parentAJob} onChange={(e) => setDirty(setParentAJob, e.target.value)} placeholder="双亲A职业" /><select className="rounded-2xl border px-4 py-3 text-sm" value={parentAPregnancyRole} onChange={(e) => { setDirty(setParentAPregnancyRole, e.target.value); if (e.target.value === "怀孕方") setParentBPregnancyRole("非怀孕方"); }}><option>怀孕方</option><option>非怀孕方</option></select><textarea className="h-20 rounded-2xl border px-4 py-3 text-sm" value={parentA} onChange={(e) => setDirty(setParentA, e.target.value)} placeholder="双亲A补充设定" /><input className="rounded-2xl border px-4 py-3 text-sm" value={parentBName} onChange={(e) => setDirty(setParentBName, e.target.value)} placeholder="双亲B姓名" /><input className="rounded-2xl border px-4 py-3 text-sm" value={parentBJob} onChange={(e) => setDirty(setParentBJob, e.target.value)} placeholder="双亲B职业" /><select className="rounded-2xl border px-4 py-3 text-sm" value={parentBPregnancyRole} onChange={(e) => { setDirty(setParentBPregnancyRole, e.target.value); if (e.target.value === "怀孕方") setParentAPregnancyRole("非怀孕方"); }}><option>怀孕方</option><option>非怀孕方</option></select><textarea className="h-20 rounded-2xl border px-4 py-3 text-sm" value={parentB} onChange={(e) => setDirty(setParentB, e.target.value)} placeholder="双亲B补充设定" /><textarea className="h-20 rounded-2xl border px-4 py-3 text-sm" value={world} onChange={(e) => setDirty(setWorld, e.target.value)} placeholder="世界/家庭设定" /></div><button className="mt-4 w-full rounded-2xl bg-amber-600 px-4 py-3 font-bold text-white disabled:opacity-50" disabled={busy} onClick={saveSetup}>保存设定</button></section>
      </aside>
      <section className="rounded-3xl bg-white shadow-sm ring-1 ring-black/5"><div className="border-b p-5"><h2 className="text-lg font-bold">房间聊天与游戏日志</h2><p className="mt-1 text-sm text-slate-500">房间码 {payload.room.room_code}。AI内容会拆为多个气泡。</p></div><div className="flex h-[640px] flex-col gap-3 overflow-y-auto p-5">{payload.messages.map((m) => <article key={m.id} className={`rounded-2xl p-4 text-sm leading-6 shadow-sm ring-1 ring-black/5 ${m.player_id === playerId ? "ml-auto max-w-[85%]" : "mr-auto max-w-[92%]"}`} style={{ backgroundColor: bg(m) }}><div className="mb-1 flex justify-between gap-2 text-xs text-slate-500"><span>{m.author} · {m.kind}</span><span>{formatTime(m.created_at)}</span></div><p className="whitespace-pre-wrap">{m.content}</p></article>)}</div><div className="border-t p-5"><div className="mb-3 rounded-2xl bg-amber-50 p-3"><p className="mb-2 text-sm font-semibold text-amber-900">行动方向</p><div className="flex flex-wrap gap-2">{["A", "B", "C", "D"].map((c) => <button key={c} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-amber-800 ring-1 ring-amber-200 disabled:opacity-50" disabled={busy} onClick={() => sendActionAndAdvance(c)}>选择 {c}</button>)}<button className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-amber-800 ring-1 ring-amber-200 disabled:opacity-50" disabled={busy} onClick={() => { const custom = window.prompt("请输入自定义行动"); if (custom?.trim()) sendActionAndAdvance(`自定义行动：${custom.trim()}`); }}>自定义行动</button><button className="rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy} onClick={() => sendMessage("根据对话内容推进剧情")}>推进剧情</button></div><p className="mt-2 text-xs text-amber-800">角色反应由玩家输入，不由 AI 代写。</p></div><div className="mb-3 flex flex-wrap gap-2">{["开始游戏", "产生随机事件", "根据对话内容推进剧情", "结束回合", "查看状态"].map((cmd) => <button key={cmd} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold disabled:opacity-50" disabled={busy} onClick={() => sendMessage(cmd)}>{cmd}</button>)}</div><div className="flex gap-2"><textarea className="h-20 flex-1 rounded-2xl border px-4 py-3 text-sm" value={content} onChange={(e) => setContent(e.target.value)} placeholder={`以${currentRole}身份输入聊天、行动或指令`} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendMessage(); }} /><button className="w-24 rounded-2xl bg-slate-900 px-4 py-3 font-bold text-white disabled:opacity-50" disabled={busy} onClick={() => sendMessage()}>发送</button></div><p className="mt-2 text-xs text-slate-500">Ctrl/⌘ + Enter 发送。</p></div></section>
    </div>}
    {error ? <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}{busy ? <p className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-700">处理中，请稍等……</p> : null}
  </div></main>;
}