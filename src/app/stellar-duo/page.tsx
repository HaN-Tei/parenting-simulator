"use client";

import { useState, useEffect, useRef } from "react";
import type { StellarRoomPayload } from "@/lib/stellarGame";

// 使用 HTML5 Canvas 绘制高画质 2D 互动天体
function StellarOrbitMap({ setup }: { setup: StellarRoomPayload["setup"] | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let angle = 0;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 600;
      canvas.height = canvas.parentElement?.clientHeight || 400;
    };
    resize();
    window.addEventListener("resize", resize);

    const starAColor = setup?.starAlpha?.color || "#fdb813";
    const starBColor = setup?.starBeta?.color || "#ff7c43";

    // 绘制循环
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // 1. 绘制背景星空
      ctx.fillStyle = "#030712";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 绘制随机微弱背景闪烁星子
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      for (let i = 0; i < 40; i++) {
        const x = (Math.sin(i * 999) * 0.5 + 0.5) * canvas.width;
        const y = (Math.cos(i * 123) * 0.5 + 0.5) * canvas.height;
        const r = (Math.sin(angle + i) * 0.5 + 0.5) * 1.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. 绘制星之轨道环
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 140, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
      ctx.beginPath();
      ctx.arc(cx, cy, 70, 0, Math.PI * 2);
      ctx.stroke();

      // 计算双星引力对称运动
      angle += 0.008;
      const ax = cx + Math.cos(angle) * 70;
      const ay = cy + Math.sin(angle) * 70;
      const bx = cx - Math.cos(angle) * 70;
      const by = cy - Math.sin(angle) * 70;

      // 3. 计算并绘制行星自主运转 (P-type Orbit)
      const px = cx + Math.cos(angle * 0.4 + 2) * 140;
      const py = cy + Math.sin(angle * 0.4 + 2) * 140;

      // 4. 绘制星体日冕爆发幻影效果
      const drawGlowStar = (x: number, y: number, r: number, color: string) => {
        const glow = ctx.createRadialGradient(x, y, r * 0.1, x, y, r * 2.5);
        glow.addColorStop(0, color);
        glow.addColorStop(0.2, color);
        glow.addColorStop(0.5, "rgba(255,255,255,0.1)");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(x, y, r * 0.9, 0, Math.PI * 2);
        ctx.fill();
      };

      // 绘制主星 Alpha 和伴星 Beta
      drawGlowStar(ax, ay, 20, starAColor);
      drawGlowStar(bx, by, 14, starBColor);

      // 5. 绘制行星 (Planet)
      const planetGlow = ctx.createRadialGradient(px, py, 1, px, py, 10);
      planetGlow.addColorStop(0, "#ffffff");
      planetGlow.addColorStop(0.3, "#3b82f6");
      planetGlow.addColorStop(1, "transparent");
      ctx.fillStyle = planetGlow;
      ctx.beginPath();
      ctx.arc(px, py, 10, 0, Math.PI * 2);
      ctx.fill();

      // 绘制行星核心圆
      ctx.fillStyle = "#4fa8f6";
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();

      // 高维人造防护环（若含有异常设定则显示发光网罩）
      if (setup?.isAnomaly) {
        ctx.strokeStyle = "rgba(168, 85, 247, 0.25)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, 148, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [setup]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />;
}

export default function StellarDuoPage() {
  const [payload, setPayload] = useState<StellarRoomPayload | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  const [roomName, setRoomName] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchRoom = async (code: string) => {
    const res = await fetch(`/api/stellar-rooms/${code}`);
    const data = await res.json().catch(() => null);
    if (data?.ok && data.payload) {
      setPayload(data.payload);
      const myPlayer = data.payload.players.find((p: any) => p.display_name === roomName);
      if (myPlayer) setMyPlayerId(myPlayer.id);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [payload?.messages]);

  const handleCreate = async () => {
    const res = await fetch("/api/stellar-rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: roomName }),
    });
    const data = await res.json().catch(() => null);
    if (data?.ok) {
      setPayload(data.payload);
      setMyPlayerId(data.playerId);
    }
  };

  const handleJoin = async () => {
    const res = await fetch("/api/stellar-rooms/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomCode: joinCode, displayName: joinName }),
    });
    const data = await res.json().catch(() => null);
    if (data?.ok) {
      setPayload(data.payload);
      setMyPlayerId(data.playerId);
    }
  };

  const handleSend = async () => {
    if (!message.trim() || !myPlayerId || !payload) return;
    await fetch(`/api/stellar-rooms/${payload.room.room_code}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: myPlayerId, content: message }),
    });
    setMessage("");
  };

  if (!payload) {
    return (
      <div style={{ padding: 40, fontFamily: "sans-serif" }}>
        <h1>双星之歌：高维演化协议</h1>
        <div style={{ marginBottom: 20 }}>
          <input
            placeholder="您的昵称"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            style={{ marginRight: 10, padding: "8px 12px", borderRadius: 4, border: "1px solid #ccc" }}
          />
          <button onClick={handleCreate} style={{ padding: "8px 16px", cursor: "pointer" }}>创建房间</button>
        </div>
        <div style={{ marginBottom: 20 }}>
          <input
            placeholder="房间码"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            style={{ width: 100, marginRight: 10, padding: "8px 12px", borderRadius: 4, border: "1px solid #ccc" }}
          />
          <input
            placeholder="昵称"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            style={{ width: 100, marginRight: 10, padding: "8px 12px", borderRadius: 4, border: "1px solid #ccc" }}
          />
          <button onClick={handleJoin} style={{ padding: "8px 16px", cursor: "pointer" }}>加入房间</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, position: "relative" }}>
        {/* 使用高性能无外部依赖的 Canvas 代替 react-three-fiber */}
        <StellarOrbitMap setup={payload.setup} />
        <div style={{
          position: "absolute",
          top: 20,
          left: 20,
          background: "rgba(0,0,0,0.7)",
          color: "white",
          padding: 15,
          borderRadius: 8,
          maxWidth: 300,
        }}>
          <h3>房间码: {payload.room.room_code}</h3>
          <p>纪元: {payload.room.current_epoch}</p>
          <p>回合: {payload.room.current_turn}</p>
          <p>玩家: {payload.players.map((p: any) => p.display_name).join(" & ")}</p>
        </div>
      </div>
      <div style={{
        height: 300,
        overflowY: "auto",
        padding: 15,
        background: "#111",
        color: "#eee",
        fontFamily: "sans-serif",
      }}>
        {payload.messages.map((m: any) => (
          <div key={m.id} style={{ marginBottom: 8 }}>
            <span style={{
              color: m.author === "系统" ? "#888" : m.author === "AI主角" ? "#4fc3f7" : "#fff",
              fontWeight: m.author === "系统" ? "normal" : "bold",
            }}>
              {m.author}：
            </span>
            <span>{m.content}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div style={{ padding: 15, background: "#222", display: "flex", gap: 10 }}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="输入您的神谕..."
          style={{ flex: 1, padding: 10, borderRadius: 4, border: "none" }}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button onClick={handleSend} style={{ padding: "10px 20px" }}>
          应命
        </button>
      </div>
    </div>
  );
}