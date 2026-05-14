"use client";

import { useEffect, useRef } from "react";

type Layer = {
  glyph: string;
  planet: string;
  german: string;
  meaning: string;
  ringRatio: number;
  color: [number, number, number];
  angle: number;
};

const LAYERS: Layer[] = (
  [
    ["☽", "LUNA", "IDENTITÄT", "DAS UNTEILBARE", 1.0, [220, 195, 110]],
    ["☿", "MERCURIUS", "ZUGEHÖRIGKEIT", "BE PART OF", 1.35, [200, 170, 90]],
    ["♀", "VENUS", "KOMMUNIKATION", "TARS · MARVIN · EDDIE", 1.75, [180, 150, 80]],
    ["♂", "MARS", "MANIFOLDS", "SEMANTIC ANCHORING", 2.2, [160, 125, 65]],
    ["♃", "IUPITER", "KOMPLEXITÄT", "CYNEFIN · SNOWDEN", 2.7, [140, 105, 55]],
    ["♄", "SATURNUS", "KOGNITIVE SPHÄRE", "VON DER SPHÄRE ZUM VEKTOR", 3.3, [120, 90, 50]],
  ] as const
).map(([glyph, planet, german, meaning, ringRatio, color], i) => ({
  glyph,
  planet,
  german,
  meaning,
  ringRatio,
  color: color as [number, number, number],
  angle: -Math.PI / 2 + (i * 2 * Math.PI) / 6,
}));

const TRAIL_LIFETIME = 0.25;
const PARTICLE_COUNT = 200;

export default function MonadField() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const planetRef = useRef<HTMLDivElement>(null);
  const meaningRef = useRef<HTMLDivElement>(null);
  const layerNameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cormorantFamily =
      getComputedStyle(container).getPropertyValue("--font-cormorant").trim() ||
      "Georgia, serif";

    let W = 0;
    let H = 0;
    let cx = 0;
    let cy = 0;
    let baseRadius = 120;
    let raf = 0;
    let stopped = false;

    const mouse = { x: 0, y: 0, active: false, lastMoveAt: 0 };
    const trail: { x: number; y: number; t: number }[] = [];
    const drift = { x: 0, y: 0, vx: 0, vy: 0 };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = container.clientWidth;
      H = container.clientHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W / 2;
      cy = H / 2;
      baseRadius = Math.min(W, H) * 0.1;
    };
    resize();

    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      angle: Math.random() * Math.PI * 2,
      dist: baseRadius * (1.5 + Math.random() * 3),
      speed: 0.0003 + Math.random() * 0.001,
      size: 0.4 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
      brightness: 0.2 + Math.random() * 0.5,
      orbitEcc: 0.8 + Math.random() * 0.4,
    }));

    const updateMouseFromClient = (cx_: number, cy_: number) => {
      const rect = container.getBoundingClientRect();
      mouse.x = cx_ - rect.left;
      mouse.y = cy_ - rect.top;
      mouse.active = true;
      mouse.lastMoveAt = performance.now() / 1000;
    };
    const onMouseMove = (e: MouseEvent) => updateMouseFromClient(e.clientX, e.clientY);
    const onMouseLeave = () => {
      mouse.active = false;
    };
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) updateMouseFromClient(t.clientX, t.clientY);
    };

    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("mouseleave", onMouseLeave);
    container.addEventListener("touchmove", onTouch, { passive: true });
    container.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("resize", resize);

    const setLabel = (
      planet: string | null,
      german: string | null,
      meaning: string | null,
      colorCSS: string | null,
    ) => {
      if (planetRef.current) {
        planetRef.current.textContent = planet ?? "";
        planetRef.current.style.opacity = planet ? "0.65" : "0";
        if (colorCSS) planetRef.current.style.color = colorCSS;
      }
      if (meaningRef.current) {
        meaningRef.current.textContent = meaning ?? "";
        meaningRef.current.style.opacity = meaning ? "0.45" : "0";
      }
      if (layerNameRef.current) {
        layerNameRef.current.textContent = german ?? "";
        layerNameRef.current.style.opacity = german ? "0.6" : "0";
        if (colorCSS) layerNameRef.current.style.color = colorCSS;
      }
    };

    const frame = (ts: number) => {
      if (stopped) return;
      const t = ts / 1000;

      drift.vx = (drift.vx + (Math.random() - 0.5) * 0.02) * 0.96;
      drift.vy = (drift.vy + (Math.random() - 0.5) * 0.02) * 0.96;
      drift.x = Math.max(-baseRadius * 0.05, Math.min(baseRadius * 0.05, drift.x + drift.vx));
      drift.y = Math.max(-baseRadius * 0.05, Math.min(baseRadius * 0.05, drift.y + drift.vy));
      const ox = cx + drift.x;
      const oy = cy + drift.y;

      ctx.fillStyle = "rgba(7, 7, 12, 0.15)";
      ctx.fillRect(0, 0, W, H);
      if (Math.floor(t * 60) % 120 === 0) {
        ctx.fillStyle = "#07070c";
        ctx.fillRect(0, 0, W, H);
      }

      const breath = Math.sin(t * 0.8) * 0.03 + Math.sin(t * 1.3) * 0.015;
      const R = baseRadius * (1 + breath);

      const dx = mouse.active ? mouse.x - ox : 0;
      const dy = mouse.active ? mouse.y - oy : 0;
      const mouseDist = mouse.active ? Math.sqrt(dx * dx + dy * dy) : Infinity;

      let active: Layer | null = null;
      const glyphR = R * 1.15;
      if (mouse.active) {
        for (let i = 0; i < LAYERS.length; i++) {
          const a = LAYERS[i].angle + Math.sin(t * 0.3 + i) * 0.02;
          const gx = ox + Math.cos(a) * glyphR;
          const gy = oy + Math.sin(a) * glyphR;
          const ddx = mouse.x - gx;
          const ddy = mouse.y - gy;
          if (Math.sqrt(ddx * ddx + ddy * ddy) < baseRadius * 0.3) {
            active = LAYERS[i];
            break;
          }
        }
      }
      if (!active && mouse.active) {
        for (const layer of LAYERS) {
          if (Math.abs(mouseDist - R * layer.ringRatio) < baseRadius * 0.2) {
            active = layer;
            break;
          }
        }
      }
      const centerHover = mouse.active && mouseDist < R * 0.5;

      if (centerHover) {
        setLabel("SOL", null, "THE MONAD", "rgb(230, 200, 120)");
      } else if (active) {
        const [r, g, b] = active.color;
        setLabel(active.planet, active.german, active.meaning, `rgb(${r}, ${g}, ${b})`);
      } else {
        setLabel(null, null, null, null);
      }

      for (let i = LAYERS.length - 1; i >= 0; i--) {
        const layer = LAYERS[i];
        const lr = R * layer.ringRatio;
        const [cr, cg, cb] = layer.color;
        const isActive = active === layer;
        const ringDist = Math.abs(mouseDist - lr);
        const ringAlpha = isActive
          ? 0.3 + 0.2 * (1 - Math.min(1, ringDist / (baseRadius * 0.4)))
          : 0.04 + 0.02 * Math.sin(t * 0.5 + i);
        const pulse = Math.sin(t * 0.6 + i * 0.7) * 0.005 * lr;
        ctx.beginPath();
        ctx.arc(ox, oy, lr + pulse, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${ringAlpha})`;
        ctx.lineWidth = isActive ? 1.5 : 0.5;
        ctx.stroke();
      }

      const glowGrad = ctx.createRadialGradient(ox, oy, R * 0.8, ox, oy, R * 1.6);
      glowGrad.addColorStop(0, "rgba(200, 160, 80, 0.06)");
      glowGrad.addColorStop(0.5, "rgba(200, 160, 80, 0.02)");
      glowGrad.addColorStop(1, "rgba(200, 160, 80, 0)");
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, W, H);

      ctx.beginPath();
      ctx.arc(ox, oy, R, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(200, 160, 80, ${0.5 + breath * 3})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const innerGrad = ctx.createRadialGradient(ox, oy, 0, ox, oy, R);
      innerGrad.addColorStop(0, "rgba(200, 160, 80, 0.03)");
      innerGrad.addColorStop(0.7, "rgba(200, 160, 80, 0.01)");
      innerGrad.addColorStop(1, "rgba(200, 160, 80, 0)");
      ctx.fillStyle = innerGrad;
      ctx.fill();

      const pointPull = mouse.active ? Math.max(0, 1 - mouseDist / (baseRadius * 2)) : 0;
      const pointGlow = 3 + pointPull * 4 + Math.sin(t * 1.5) * 0.5;
      const ptGrad = ctx.createRadialGradient(ox, oy, 0, ox, oy, pointGlow * 5);
      ptGrad.addColorStop(0, `rgba(220, 185, 100, ${0.4 + pointPull * 0.3})`);
      ptGrad.addColorStop(0.3, `rgba(200, 160, 80, ${0.15 + pointPull * 0.1})`);
      ptGrad.addColorStop(1, "rgba(200, 160, 80, 0)");
      ctx.fillStyle = ptGrad;
      ctx.beginPath();
      ctx.arc(ox, oy, pointGlow * 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ox, oy, pointGlow, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(230, 200, 120, ${0.8 + pointPull * 0.2})`;
      ctx.fill();

      for (const p of particles) {
        p.angle += p.speed;
        const wobble = Math.sin(t * 0.4 + p.phase) * 15;
        const d = p.dist + wobble;
        const pull = pointPull * 0.3;
        const ed = d * (1 - pull * 0.5);
        const px = ox + Math.cos(p.angle) * ed * p.orbitEcc;
        const py = oy + Math.sin(p.angle) * ed;
        const fade = Math.max(0, Math.min(1, ed / (baseRadius * 4)));
        const alpha = p.brightness * (1 - fade * 0.7) * (0.7 + 0.3 * Math.sin(t * 2 + p.phase));
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 170, 100, ${alpha})`;
        ctx.fill();
        if (ed < R * 2 && alpha > 0.3) {
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(px, py);
          ctx.strokeStyle = `rgba(200, 160, 80, ${alpha * 0.04})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }

      ctx.font = `300 14px ${cormorantFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let i = 0; i < LAYERS.length; i++) {
        const layer = LAYERS[i];
        const a = layer.angle + Math.sin(t * 0.3 + i) * 0.02;
        const gx = ox + Math.cos(a) * glyphR;
        const gy = oy + Math.sin(a) * glyphR;
        const isActive = active === layer;
        const [cr, cg, cb] = layer.color;
        const alpha = isActive ? 0.85 : 0.12 + 0.05 * Math.sin(t * 0.7 + i * 1.5);
        ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha})`;
        ctx.fillText(layer.glyph, gx, gy);
      }

      const nowSec = performance.now() / 1000;
      if (mouse.active && nowSec - mouse.lastMoveAt < 0.5) {
        trail.push({ x: mouse.x, y: mouse.y, t: nowSec });
      }
      while (trail.length && nowSec - trail[0].t > TRAIL_LIFETIME) trail.shift();
      for (const point of trail) {
        const age = (nowSec - point.t) / TRAIL_LIFETIME;
        const alpha = (1 - age) * 0.35;
        const radius = 6 * (1 - age * 0.5);
        const grad = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
        grad.addColorStop(0, `rgba(220, 185, 100, ${alpha})`);
        grad.addColorStop(1, "rgba(220, 185, 100, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mouseleave", onMouseLeave);
      container.removeEventListener("touchmove", onTouch);
      container.removeEventListener("touchstart", onTouch);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-screen w-full overflow-hidden bg-[#07070c] text-[#d4cfc6]"
      style={{ fontFamily: "var(--font-cormorant), Georgia, serif" }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 block h-full w-full"
      />
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-7">
        <div className="text-center">
          <h1 className="text-[1.1em] font-light uppercase tracking-[0.25em] opacity-35">
            KHAOS · Id
          </h1>
        </div>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="text-[4em] font-light tracking-[0.1em] opacity-[0.08]">⊙</div>
          <div
            ref={planetRef}
            className="mt-1.5 font-light opacity-0"
            style={{
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: "0.62em",
              letterSpacing: "0.14em",
              transition: "opacity 1.2s ease, color 0.6s ease",
            }}
          />
          <div
            ref={meaningRef}
            className="mt-1 font-light opacity-0"
            style={{
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: "0.6em",
              letterSpacing: "0.12em",
              color: "#c8a050",
              transition: "opacity 1.5s ease",
            }}
          />
        </div>
        <div
          ref={layerNameRef}
          className="absolute bottom-1/2 left-1/2 -translate-x-1/2 translate-y-[140px] whitespace-nowrap text-center font-light uppercase opacity-0"
          style={{
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: "0.6em",
            letterSpacing: "0.18em",
            transition: "opacity 0.8s ease, color 0.6s ease",
          }}
        />
        <div className="flex items-end justify-between">
          <div
            style={{ fontFamily: "var(--font-jetbrains), monospace" }}
            className="text-[0.55em] font-light leading-[1.8] tracking-[0.06em] opacity-20"
          >
            be-part-of.net
            <br />
            circumpunct · ⊙ · monas
          </div>
          <div
            style={{ fontFamily: "var(--font-jetbrains), monospace" }}
            className="text-right text-[0.55em] font-light leading-[1.8] tracking-[0.06em] opacity-20"
          >
            Πυθαγόρας · Sol · Aurum
            <br />
            das Unteilbare
          </div>
        </div>
      </div>
    </div>
  );
}
