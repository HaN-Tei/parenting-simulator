"use client";

import { useEffect, useMemo, useState } from "react";
import type { RoomPayload, RoomSaveSummary } from "@/lib/types";

type ApiResponse = { ok: boolean; error?: string; playerId?: string; payload?: RoomPayload; saves?: RoomSaveSummary[] };

const defaultColors = { my: "#3b82f6", other: "#e2e8f0", system: "#fcd34d", ai: "#10b981" };
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
  return <div><div className="mb-1 flex justify-between text-xs font-semibold"><span>{label}</span><span>{v}</span></div><div className="h-2 rounded-full bg-slate-200/50"><div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${v}%` }} /></div></div>;
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
  const [pregnancyOrigin, setPregnancyOrigin] = useState("");
  const [world, setWorld] = useState("现实向");
  const [myBubbleColor, setMyBubbleColor] = useState(defaultColors.my);
  const [otherBubbleColor, setOtherBubbleColor] = useState(defaultColors.other);
  const [systemBubbleColor, setSystemBubbleColor] = useState(defaultColors.system);
  const [aiBubbleColor, setAiBubbleColor] = useState(defaultColors.ai);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [customStory, setCustomStory] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);

  useEffect(() => {
    // 宽屏/PC端默认展开，手机端默认折叠
    if (typeof window !== "undefined" && window.innerWidth >= 1280) {
      setShowSidebar(true);
    }
  }, []);

  const [fontSize, setFontSize] = useState<"small" | "base" | "large" | "huge">("base");
  const [darkMode, setDarkMode] = useState(false);

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
    const savedFontSize = localStorage.getItem("parenting.fontSize") || "base";
    const savedDarkMode = localStorage.getItem("parenting.darkMode") === "true";

    const timer = setTimeout(() => {
      if (savedCode) setRoomCode(savedCode);
      if (savedPlayerId) setPlayerId(savedPlayerId);
      if (savedName) setDisplayName(savedName);
      setMyBubbleColor(savedMyColor);
      setOtherBubbleColor(savedOtherColor);
      setSystemBubbleColor(savedSystemColor);
      setAiBubbleColor(savedAiColor);
      setFontSize(savedFontSize as any);
      setDarkMode(savedDarkMode);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem("parenting.colors.my", myBubbleColor);
    localStorage.setItem("parenting.colors.other", otherBubbleColor);
    localStorage.setItem("parenting.colors.system", systemBubbleColor);
    localStorage.setItem("parenting.colors.ai", aiBubbleColor);
    localStorage.setItem("parenting.fontSize", fontSize);
    localStorage.setItem("parenting.darkMode", String(darkMode));
  }, [myBubbleColor, otherBubbleColor, systemBubbleColor, aiBubbleColor, fontSize, darkMode]);

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

  function textContrastColor(hexBg: string) {
    try {
      const clean = hexBg.replace("#", "");
      const r = parseInt(clean.substring(0, 2), 16);
      const g = parseInt(clean.substring(2, 4), 16);
      const b = parseInt(clean.substring(4, 6), 16);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness > 140 ? "#0f172a" : "#ffffff";
    } catch {
      return "#0f172a";
    }
  }

  async function createRoom() {
    setBusy(true); setError("");
    try { 
      const data = await apiPost("/api/rooms", { displayName, pregnancyOrigin }); 
      if (!data.ok || !data.payload || !data.playerId) throw new Error(data.error || "创建失败"); 
      setPayload(data.payload); 
      applySetup(data.payload); 
      setSetupDraftDirty(false); 
      setRoomCode(data.payload.room.room_code); 
      setPlayerId(data.playerId); 
      setSaves([]); 
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
    setBusy(true); setError("");
    try { 
      const data = await apiPost("/api/rooms/join", { code: joinCode, displayName }); 
      if (!data.ok || !data.payload || !data.playerId) throw new Error(data.error || "加入失败"); 
      setPayload(data.payload); 
      applySetup(data.payload); 
      setSetupDraftDirty(false); 
      setRoomCode(data.payload.room.room_code); 
      setPlayerId(data.playerId); 
      localStorage.setItem("parenting.roomCode", data.payload.room.room_code); 
      localStorage.setItem("parenting.playerId", data.playerId); 
      localStorage.setItem("parenting.displayName", displayName); 
      refreshSaves(data.payload.room.room_code); 
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
      const data = await apiPost(`/api/rooms/${activeCode}/setup`, { parentAName, parentAJob, parentAPregnancyRole, parentA, parentBName, parentBJob, parentBPregnancyRole, parentB, world }); 
      if (!data.ok || !data.payload) throw new Error(data.error || "保存失败"); 
      setPayload(data.payload); 
      setSetupDraftDirty(false); 
    } catch (err) { 
      setError(err instanceof Error ? err.message : "保存失败"); 
    } finally { 
      setBusy(false); 
    }
  }
  
  async function createSave() {
    const name = window.prompt("请输入存档名称", `第${payload?.state.turn ?? ""}回合存档`); 
    if (!activeCode || !name?.trim()) return;
    setBusy(true); setError("");
    try { 
      const data = await apiPost(`/api/rooms/${activeCode}/saves`, { name: name.trim(), playerId, author: displayName }); 
      if (!data.ok || !data.payload) throw new Error(data.error || "保存存档失败"); 
      setPayload(data.payload); 
      await refreshSaves(activeCode); 
    } catch (err) { 
      setError(err instanceof Error ? err.message : "保存存档失败"); 
    } finally { 
      setBusy(false); 
    }
  }
  
  async function loadSave(save: RoomSaveSummary) {
    if (!activeCode || !window.confirm(`确定读取存档「${save.name}」吗？当前进度会回到第 ${save.turn} 回合，聊天记录会保留。`)) return;
    setBusy(true); setError("");
    try { 
      const data = await apiPost(`/api/rooms/${activeCode}/saves/${save.id}/load`, { playerId, author: displayName }); 
      if (!data.ok || !data.payload) throw new Error(data.error || "读取存档失败"); 
      setPayload(data.payload); 
      applySetup(data.payload); 
      setSetupDraftDirty(false); 
    } catch (err) { 
      setError(err instanceof Error ? err.message : "读取存档失败"); 
    } finally { 
      setBusy(false); 
    }
  }
  
  async function sendMessage(text?: string) {
    const finalText = (text ?? content).trim(); 
    if (!activeCode || !finalText) return;
    setBusy(true); setError("");
    try { 
      const data = await apiPost(`/api/rooms/${activeCode}/message`, { playerId, author: displayName, content: finalText }); 
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
      const actionData = await apiPost(`/api/rooms/${activeCode}/message`, { playerId, author: displayName, content: `行动选择：${action.trim()}` });
      if (!actionData.ok || !actionData.payload) throw new Error(actionData.error || "行动提交失败");
      setPayload(actionData.payload);
    } catch (err) { 
      setError(err instanceof Error ? err.message : "行动提交失败"); 
    } finally { 
      setBusy(false); 
    }
  }

  async function insertCustomStory() {
    if (!activeCode || !customStory.trim()) return;
    setBusy(true); setError("");
    try {
      const data = await apiPost(`/api/rooms/${activeCode}/message`, { 
        playerId, 
        author: displayName, 
        content: `自定义剧情：${customStory.trim()}` 
      });
      if (!data.ok || !data.payload) throw new Error(data.error || "插入失败");
      setPayload(data.payload);
      setCustomStory("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "插入失败");
    } finally {
      setBusy(false);
    }
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

  const FONT_CLASSES = {
    small: "text-xs md:text-sm",
    base: "text-sm md:text-base",
    large: "text-base md:text-lg",
    huge: "text-lg md:text-xl",
  };

  const themeBgClass = darkMode ? "bg-[#111827] text-slate-100" : "bg-[#fafaf9] text-[#1c1917]";
  const cardBgClass = darkMode ? "bg-slate-900 border border-slate-800" : "bg-white ring-1 ring-black/5";
  const selectBorderClass = darkMode ? "bg-slate-900 border border-slate-800 text-white" : "bg-white border text-[#1c1917]";
  const inputBorderClass = darkMode ? "bg-slate-950 border border-slate-800 text-white placeholder-slate-700" : "bg-white border text-slate-900 placeholder-slate-400";
  const tagBgClass = darkMode ? "bg-amber-950/40 text-amber-500 border border-amber-900" : "bg-amber-100/50 text-amber-900";
  const btnActiveBg = darkMode ? "bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700" : "bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap');
        .sans-story {
          font-family: 'Noto Sans SC', system-ui, -apple-system, sans-serif;
        }
      ` }} />

      <main className={`min-h-screen transition-colors duration-300 ${themeBgClass} sans-story`}>
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8">
          
          <header className={`rounded-3xl p-6 shadow-sm transition-colors duration-200 flex flex-col md:flex-row justify-between gap-4 items-start md:items-center ${cardBgClass}`}>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500">双用户同步 AI 育儿模拟器</p>
              <h1 className="mt-2 text-2xl md:text-3.5xl font-extrabold tracking-tight">从怀孕开始的共同养育故事</h1>
              <p className="mt-2 text-xs md:text-sm text-slate-500 dark:text-slate-400">侧边控制台：所有状态指标、指令、行动和插入选项现已完美归纳在侧栏中。</p>
            </div>
            
            <div className={`p-4 rounded-2xl flex flex-wrap gap-4 items-center ${darkMode ? 'bg-slate-950/60' : 'bg-stone-50'}`}>
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">字号大小</span>
                <div className="flex bg-slate-300/30 rounded-lg p-0.5 text-xs font-semibold">
                  {(["small", "base", "large", "huge"] as const).map((sz) => (
                    <button
                      key={sz}
                      onClick={() => setFontSize(sz)}
                      className={`px-3 py-1 rounded-md transition-all ${fontSize === sz ? "bg-amber-600 text-white shadow-xs" : "opacity-70 hover:opacity-100"}`}
                    >
                      {sz === "small" ? "小" : sz === "base" ? "中" : sz === "large" ? "大" : "特"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">界面主题</span>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800"
                >
                  {darkMode ? "☀️ 浅色日间" : "🌙 护眼深色"}
                </button>
              </div>
            </div>
          </header>

          {!payload ? (
            <section className="grid gap-6 md:grid-cols-2">
              <div className={`rounded-3xl p-6 shadow-sm ${cardBgClass}`}>
                <h2 className="text-xl font-black">创建房间</h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">创建者自动绑定为双亲A。可填写怀孕背景。</p>
                <input className={`mt-5 w-full rounded-2xl px-4 py-3.5 text-sm font-medium ${inputBorderClass}`} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="请输入您的昵称" />
                <textarea className={`mt-3 w-full rounded-2xl px-4 py-3 text-sm ${inputBorderClass}`} value={pregnancyOrigin} onChange={(e) => setPregnancyOrigin(e.target.value)} placeholder="可选：描述如何怀上孩子的背景故事（最多200字）" rows={3} />
                <button className="mt-5 w-full rounded-2xl bg-amber-600 hover:bg-amber-500 px-4 py-4 font-bold text-white transition-all disabled:opacity-50" disabled={busy} onClick={createRoom}>创建新房间</button>
              </div>
              
              <div className={`rounded-3xl p-6 shadow-sm ${cardBgClass}`}>
                <h2 className="text-xl font-black">加入房间</h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">第二位玩家自动绑定为双亲B。</p>
                <input className={`mt-5 w-full rounded-2xl px-4 py-3.5 text-sm uppercase font-mono tracking-widest ${inputBorderClass}`} value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="输入 6 位房间连接码" />
                <input className={`mt-3.5 w-full rounded-2xl px-4 py-3.5 text-sm font-medium ${inputBorderClass}`} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="您的角色昵称" />
                <button className="mt-5 w-full rounded-2xl bg-slate-900 dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 px-4 py-4 font-bold text-white transition-all disabled:opacity-50" disabled={busy} onClick={joinRoom}>加入房间</button>
              </div>
            </section>
          ) : (
            <div className="relative flex flex-col xl:flex-row gap-6 items-stretch h-[680px] md:h-[780px] overflow-hidden">
              {/* === 侧边控制面板（包括原属性栏、A/B/C/D行动选择、插入剧情、配置） === */}
              {showSidebar && (
                <aside className="absolute xl:static left-0 top-0 w-[85%] sm:w-[320px] xl:w-[390px] h-full overflow-y-auto space-y-6 flex-shrink-0 pr-2 pb-4 scrollbar-thin scrollbar-thumb-amber-600/20 z-50 bg-[#fafaf9] dark:bg-slate-900 xl:bg-transparent border-r dark:border-slate-800 xl:border-none shadow-2xl xl:shadow-none p-5 xl:p-0">
                  
                  {/* 行动与选择板块 */}
                  <section className={`rounded-3xl p-5 shadow-sm ${cardBgClass}`}>
                    <p className="mb-2 text-xs font-bold tracking-widest text-amber-500 uppercase">🎯 当前阶段：{(payload.state as any).stage || 1}/3</p>
                    <div className="flex overflow-x-auto pb-2 gap-2.5 flex-nowrap scrollbar-thin scrollbar-thumb-amber-600/40 max-w-full">
                      {["A", "B", "C", "D"].map((c) => (
                        <button
                          key={c}
                          className="rounded-full bg-stone-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 px-5 py-2.5 text-xs font-bold text-amber-500 hover:bg-amber-500/10 shadow-xs cursor-pointer flex-shrink-0"
                          disabled={busy}
                          onClick={() => sendActionAndAdvance(c)}
                        >
                          选择行动 {c}
                        </button>
                      ))}
                      <button
                        className="rounded-full bg-stone-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 px-5 py-2.5 text-xs font-bold text-amber-500 hover:bg-amber-500/10 shadow-xs cursor-pointer flex-shrink-0"
                        disabled={busy}
                        onClick={() => {
                          const custom = window.prompt("请输入双亲自定义行动描述：");
                          if (custom?.trim()) sendActionAndAdvance(`自定义行动：${custom.trim()}`);
                        }}
                      >
                        ✍️ 自定义
                      </button>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 border-t border-slate-300/10 pt-4">
                      {["开始游戏", "根据对话内容推进剧情", "查看状态"].map((cmd) => (
                        <button
                          key={cmd}
                          className={`w-full rounded-2xl py-2.5 text-xs font-bold select-none cursor-pointer transition-all ${btnActiveBg}`}
                          disabled={busy}
                          onClick={() => sendMessage(cmd)}
                        >
                          ⚙️ {cmd}
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* 剧情插入选项 */}
                  <section className={`rounded-3xl p-5 shadow-sm ${cardBgClass}`}>
                    <p className="text-xs font-bold text-purple-500 mb-2">✨ 插入自定义剧情</p>
                    <textarea 
                      className={`w-full h-16 rounded-xl px-3 py-2 text-xs ${inputBorderClass}`}
                      value={customStory} 
                      onChange={(e) => setCustomStory(e.target.value)}
                      placeholder="自定义一段剧情插入，用来补充设定（不少于50字）..."
                    />
                    <button 
                      className="mt-2 text-xs font-bold underline text-purple-500 disabled:opacity-50"
                      disabled={busy || customStory.length < 50}
                      onClick={insertCustomStory}
                    >
                      立即插入
                    </button>
                  </section>

                  {/* 状态监控 */}
                  <section className={`rounded-3xl p-5 shadow-sm ${cardBgClass}`}>
                    <div className="flex justify-between gap-4 items-start">
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">当前状态</p>
                        <h2 className="mt-1 text-sm font-black">{statusLine}</h2>
                        <p className="mt-2.5 inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold shadow-xs bg-amber-500/10 text-amber-500 border border-amber-500/20">你正在扮演：{currentRole}</p>
                      </div>
                      <button className="text-[10px] underline text-slate-400 hover:text-slate-200" onClick={leaveLocalRoom}>注销房间</button>
                    </div>
                    <div className={`mt-4 rounded-2xl p-4 text-xs font-medium space-y-1.5 ${tagBgClass}`}>{payload.players.map((p) => <p key={p.id}>🛡️ {roleLabel(p.role)}：{p.display_name}{p.id === playerId ? "（你）" : ""}</p>)}</div>
                  </section>

                  {/* 属性数据 */}
                  <section className={`rounded-3xl p-5 shadow-sm ${cardBgClass}`}>
                    <h2 className="text-sm font-black flex items-center gap-1">📊 属性指标动态反馈</h2>
                    <p className="mt-1 text-[10px] text-slate-500">数值秒级更新实时呈现。</p>
                    <h3 className="mt-4 mb-2 text-xs font-bold text-slate-400 uppercase tracking-widest border-l-2 border-amber-500 pl-2">孩子 / 孕育状态</h3>
                    <div className="space-y-3">{Object.entries(payload.state.child).map(([k, v]) => <StatBar key={k} label={statNames[k] || k} value={v} />)}</div>
                    <h3 className="mt-5 mb-2 text-xs font-bold text-slate-400 uppercase tracking-widest border-l-2 border-amber-500 pl-2">家庭 / 现实生活</h3>
                    <div className="space-y-3">{Object.entries(payload.state.family).map(([k, v]) => <StatBar key={k} label={statNames[k] || k} value={v} dangerHigh={k === "pressure"} />)}</div>
                  </section>

                  {/* 游戏存档板块 */}
                  <section className={`rounded-3xl p-5 shadow-sm ${cardBgClass}`}>
                    <div className="flex justify-between items-center"><h2 className="text-sm font-black">游戏存档</h2><button className="text-xs font-bold underline" disabled={busy} onClick={() => refreshSaves()}>刷新</button></div>
                    <button className="mt-3 w-full rounded-2xl bg-emerald-600 hover:bg-emerald-500 py-2.5 font-bold text-white text-xs shadow-sm transition-all disabled:opacity-50" disabled={busy} onClick={createSave}>保存当前进度</button>
                    <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">{saves.length ? saves.map((s) => <div key={s.id} className={`rounded-2xl p-2.5 border ${darkMode ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-100"}`}><div className="flex justify-between gap-2 items-center"><div><p className="font-bold text-xs">{s.name}</p><p className="mt-0.5 text-[9px] text-slate-500">第{s.turn}回｜{savePhaseLabel(s)}</p></div><button className="rounded-full bg-white dark:bg-slate-800 px-2.5 py-0.5 text-[9px] font-bold text-emerald-600 hover:opacity-85 ring-1 ring-emerald-600/30" disabled={busy} onClick={() => loadSave(s)}>读取</button></div></div>) : <p className="p-2.5 text-[10px] text-slate-500 text-center">空荡荡的，暂时没有备份存档。</p>}</div>
                  </section>

                  {/* 气泡偏好 */}
                  <section className={`rounded-3xl p-5 shadow-sm ${cardBgClass}`}>
                    <h2 className="text-sm font-black">自定义气泡色彩</h2>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-semibold">{["我的气泡", "对方气泡", "系统消息", "AI旁白"].map((label, i) => { const value = i === 0 ? myBubbleColor : i === 1 ? otherBubbleColor : i === 2 ? systemBubbleColor : aiBubbleColor; const setter = i === 0 ? setMyBubbleColor : i === 1 ? setOtherBubbleColor : i === 2 ? setSystemBubbleColor : setAiBubbleColor; return <label key={label} className="flex flex-col gap-1 bg-slate-400/5 p-1.5 rounded-xl border border-slate-600/5"><span>{label}</span><input className="h-5 w-full cursor-pointer rounded-lg bg-transparent" type="color" value={value} onChange={(e) => setter(e.target.value)} /></label>; })}</div>
                  </section>

                  {/* 初始设定 */}
                  <section className={`rounded-3xl p-5 shadow-sm ${cardBgClass}`}>
                    <h2 className="text-sm font-black">初始设定说明规则</h2>
                    <div className="mt-3 grid gap-2.5"><input className={`rounded-xl px-3 py-2 text-xs border ${inputBorderClass}`} value={parentAName} onChange={(e) => setDirty(setParentAName, e.target.value)} placeholder="双亲A的姓名" /><input className={`rounded-xl px-3 py-2 text-xs border ${inputBorderClass}`} value={parentAJob} onChange={(e) => setDirty(setParentAJob, e.target.value)} placeholder="双亲A的职业" /><select className={`rounded-xl px-3 py-2 text-xs border ${selectBorderClass}`} value={parentAPregnancyRole} onChange={(e) => { setDirty(setParentAPregnancyRole, e.target.value); if (e.target.value === "怀孕方") setParentBPregnancyRole("非怀孕方"); }}><option>怀孕方</option><option>非怀孕方</option></select><textarea className={`h-16 rounded-xl px-3 py-2 text-xs border ${inputBorderClass}`} value={parentA} onChange={(e) => setDirty(setParentA, e.target.value)} placeholder="对双亲A的补充描述..." /><input className={`rounded-xl px-3 py-2 text-xs border ${inputBorderClass}`} value={parentBName} onChange={(e) => setDirty(setParentBName, e.target.value)} placeholder="双亲B的姓名" /><input className={`rounded-xl px-3 py-2 text-xs border ${inputBorderClass}`} value={parentBJob} onChange={(e) => setDirty(setParentBJob, e.target.value)} placeholder="双亲B的职业" /><select className={`rounded-xl px-3 py-2 text-xs border ${selectBorderClass}`} value={parentBPregnancyRole} onChange={(e) => { setDirty(setParentBPregnancyRole, e.target.value); if (e.target.value === "怀孕方") setParentAPregnancyRole("非怀孕方"); }}><option>怀孕方</option><option>非怀孕方</option></select><textarea className={`h-16 rounded-xl px-3 py-2 text-xs border ${inputBorderClass}`} value={parentB} onChange={(e) => setDirty(setParentB, e.target.value)} placeholder="对双亲B的补充描述..." /><textarea className={`h-16 rounded-xl px-3 py-2 text-xs border ${inputBorderClass}`} value={world} onChange={(e) => setDirty(setWorld, e.target.value)} placeholder="关于家庭背景、世界环境描述..." /></div>
                    <button className="mt-3 w-full rounded-2xl bg-amber-600 py-2.5 font-semibold text-white text-xs disabled:opacity-50 hover:bg-amber-500" disabled={busy} onClick={saveSetup}>保存设定</button>
                  </section>
                </aside>
              )}

              {/* === 主页面：对话框区域（完全聚焦聊天本身） === */}
              <section className={`flex-1 h-full flex flex-col overflow-hidden rounded-3xl shadow-sm ${cardBgClass}`}>
                
                {/* 对话框头部，增加折叠/展开侧边栏的控制按钮 */}
                <div className="border-b border-slate-300/10 p-5 flex justify-between gap-3 items-center">
                  <div>
                    <h2 className="text-lg font-black flex items-center gap-1.5">📖 共同养育日记</h2>
                    <p className="mt-1 text-xs text-slate-500">连接码：<span className="font-mono font-bold text-amber-500 select-all">{payload.room.room_code}</span></p>
                  </div>
                  
                  <button 
                    onClick={() => setShowSidebar(!showSidebar)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-800 bg-stone-100 hover:bg-stone-200 dark:bg-slate-950 dark:hover:bg-slate-900 transition-colors cursor-pointer"
                  >
                    <span>{showSidebar ? "📁 折叠控制面板" : "📋 展开控制面板"}</span>
                  </button>
                </div>

                {/* 滚动气泡中心 */}
                <div className={`flex-1 overflow-y-auto p-5 space-y-4 sans-story ${FONT_CLASSES[fontSize]}`}>
                  {payload.messages.map((m) => {
                    const isMyMsg = m.player_id === playerId;
                    const bubbleBg = bg(m);
                    const bubbleText = textContrastColor(bubbleBg);
                    const bubbleAuthor = isMyMsg ? "我" : m.author;
                    return (
                      <article
                        key={m.id}
                        className={`rounded-2xl p-4.5 max-w-[88%] leading-relaxed shadow-xs transition-transform ${isMyMsg ? "ml-auto border border-blue-600/10 hover:-translate-x-0.5" : "mr-auto border border-slate-500/10 hover:translate-x-0.5"}`}
                        style={{ backgroundColor: bubbleBg, color: bubbleText }}
                      >
                        <div className="mb-1.5 flex justify-between gap-3 text-[10px] opacity-75 font-semibold">
                          <span>👤 {bubbleAuthor}</span>
                          <span>{formatTime(m.created_at)}</span>
                        </div>
                        <p className="whitespace-pre-wrap tracking-wide leading-relaxed">{m.content}</p>
                      </article>
                    );
                  })}
                </div>

                {/* 输入区域：纯文本输入，绝无杂乱选项与按钮 */}
                <div className="border-t border-slate-300/10 p-5">
                  <div className="flex gap-2.5 items-end">
                    <textarea
                      className={`h-22 flex-1 rounded-2xl px-4 py-3.5 text-xs font-medium resize-none tracking-wide focus:outline-none focus:ring-1 focus:ring-amber-500 ${inputBorderClass}`}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder={`以 ${currentRole} 身份输入您的聊天、对话和主张，按 Ctrl/⌘ + Enter 发送。`}
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendMessage(); } }}
                    />
                    <button className="h-22 w-28 rounded-2xl bg-amber-600 hover:bg-amber-500 font-bold text-xs text-white shadow-md flex items-center justify-center transition-all enabled:active:scale-95 disabled:opacity-50" disabled={busy} onClick={() => sendMessage()}>
                      🚀 发送
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] text-slate-500 select-none">提示：您现在可以尽情角色扮演交流。快捷键：Ctrl/⌘ + Enter 发送。</p>
                </div>
              </section>
            </div>
          )}
          
          {error ? <p className="rounded-2xl bg-red-900/10 border border-red-500/20 px-4 py-3.5 text-xs font-semibold text-red-500">{error}</p> : null}
          {busy ? (
            <div className="fixed bottom-6 right-6 z-50 rounded-3xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-4 text-xs font-bold flex items-center gap-3 shadow-xl border border-white/10 dark:border-slate-300/25 animate-bounce">
              <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>正在连结 AI 进行状态和剧情综合推演中……</span>
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}