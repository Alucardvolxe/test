/* =========================================================
   wheel.js — canvas rendering, segment math, spin animation
   ========================================================= */
(function () {
  "use strict";

  const TAU = Math.PI * 2;
  const HALF_PI = Math.PI / 2;
  const FONT_STACK = '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';

  const PALETTES = {
    vibrant: [
      "#ff5d73", "#ff8a3d", "#ffc93c", "#7ed957", "#2ec4b6", "#4d96ff",
      "#8b5cf6", "#f15bb5", "#f9a03f", "#00b8a9", "#5e60ce", "#ff6b6b",
    ],
    pastel: [
      "#ffb3c1", "#ffd6a5", "#fdf3b6", "#caffbf", "#9bf6ff", "#a0c4ff",
      "#bdb2ff", "#ffc6ff", "#ffadad", "#b5ead7", "#c7ceea", "#ffdac1",
    ],
    ocean: [
      "#0b6e99", "#0e8aa8", "#12a5b8", "#1bbfc6", "#22d3c5", "#2a9d8f",
      "#3a86ff", "#4cc9f0", "#0077b6", "#0096c7", "#48cae4", "#023e8a",
    ],
    sunset: [
      "#ff6b35", "#f7931e", "#ffb703", "#fb8500", "#e63946", "#d62828",
      "#f72585", "#b5179e", "#ff7b00", "#ff9e00", "#ff5400", "#c1121f",
    ],
    forest: [
      "#2d6a4f", "#40916c", "#52b788", "#74c69d", "#95d5b2", "#1b4332",
      "#588157", "#3a5a40", "#4f772d", "#90a955", "#31572c", "#588b8b",
    ],
    candy: [
      "#ff8fab", "#ffb3c6", "#ffc2d1", "#f9a8d4", "#e879f9", "#c084fc",
      "#a78bfa", "#818cf8", "#93c5fd", "#7dd3fc", "#5eead4", "#fda4af",
    ],
  };

  const state = {
    names: [],
    settings: {
      scheme: "vibrant",
      background: "#141a28",
    },
    rotation: 0,
    cssSize: 0,
    dpr: 1,
    spinning: false,
    rafId: 0,
    spinFrom: 0,
    spinDelta: 0,
    spinDuration: 0,
    spinStart: 0,
    onTick: null,
    onDone: null,
    lastTickIndex: -1,
    lastTickTime: 0,
    highlight: null,
    highlightStart: 0,
    highlightAnimate: true,
    highlightRaf: 0,
  };

  let canvas = null;
  let wrap = null;
  let ctx = null;
  let resizeRaf = 0;

  /* ---------------- color helpers ---------------- */

  function hexToRgb(hex) {
    const clean = String(hex || "").replace("#", "");
    const full =
      clean.length === 3
        ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
        : clean;
    const num = parseInt(full, 16);
    if (!Number.isFinite(num)) return { r: 20, g: 26, b: 40 };
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  }

  function rgbToHex(r, g, b) {
    const to = function (v) {
      const c = Math.max(0, Math.min(255, Math.round(v)));
      return (c < 16 ? "0" : "") + c.toString(16);
    };
    return "#" + to(r) + to(g) + to(b);
  }

  function shiftHex(hex, amount) {
    const c = hexToRgb(hex);
    const target = amount > 0 ? 255 : 0;
    const t = Math.abs(amount);
    return rgbToHex(
      c.r + (target - c.r) * t,
      c.g + (target - c.g) * t,
      c.b + (target - c.b) * t
    );
  }

  function relativeLuminance(rgb) {
    const channel = function (v) {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return (
      0.2126 * channel(rgb.r) +
      0.7152 * channel(rgb.g) +
      0.0722 * channel(rgb.b)
    );
  }

  function pickTextColor(hex) {
    const lum = relativeLuminance(hexToRgb(hex));
    const contrastWhite = 1.05 / (lum + 0.05);
    const contrastDark = (lum + 0.05) / 0.05;
    return contrastWhite >= contrastDark ? "#ffffff" : "#111827";
  }

  function getColor(index) {
    const scheme = state.settings.scheme;
    const palette = PALETTES[scheme] || PALETTES.vibrant;
    const base = palette[index % palette.length];
    const cycle = Math.floor(index / palette.length);
    if (!cycle) return base;
    return shiftHex(base, cycle % 2 === 1 ? 0.16 : -0.16);
  }

  /* ---------------- setup ---------------- */

  function init(canvasEl, wrapEl) {
    canvas = canvasEl;
    wrap = wrapEl;
    if (!canvas || !wrap) return;
    ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(function () {
        scheduleResize();
      });
      observer.observe(wrap);
    }

    window.addEventListener("resize", scheduleResize);
    layout();
  }

  function scheduleResize() {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(function () {
      resizeRaf = 0;
      layout();
    });
  }

  function layout() {
    if (!canvas || !wrap || !ctx) return;
    const rect = wrap.getBoundingClientRect();
    const size = Math.round(rect.width);
    if (!size || size < 40) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.cssSize = size;
    state.dpr = dpr;

    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function setNames(list) {
    state.names = Array.isArray(list) ? list.slice() : [];
    clearHighlight(false);
    updateCanvasLabel();
    draw();
  }

  function setSettings(settings) {
    state.settings = Object.assign({}, state.settings, settings || {});
    draw();
  }

  function updateCanvasLabel() {
    if (!canvas) return;
    const n = state.names.length;
    const label =
      n === 0
        ? "Spinning wheel with no entries. Add names to begin."
        : "Spinning wheel with " + n + (n === 1 ? " entry" : " entries") + ".";
    canvas.setAttribute("aria-label", label);
  }

  /* ---------------- drawing ---------------- */

  function setFont(size) {
    ctx.font = "700 " + size.toFixed(1) + "px " + FONT_STACK;
  }

  function fitText(text, maxWidth, startFont) {
    let font = Math.max(8, startFont);
    setFont(font);
    let width = ctx.measureText(text).width;

    while (width > maxWidth && font > 8) {
      font -= 1;
      setFont(font);
      width = ctx.measureText(text).width;
    }

    let out = text;
    if (width > maxWidth) {
      while (out.length > 1 && ctx.measureText(out + "\u2026").width > maxWidth) {
        out = out.slice(0, -1);
      }
      out = out.replace(/[\s,;:._-]+$/, "");
      out += "\u2026";
    }

    return { text: out, font: font };
  }

  function draw() {
    if (!ctx || !state.cssSize) return;

    const size = state.cssSize;
    const cx = size / 2;
    const cy = size / 2;
    const pad = size * 0.045;
    const R = size / 2 - pad;
    const bg = state.settings.background || "#141a28";

    ctx.clearRect(0, 0, size, size);

    // Outer ring / backdrop
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R + pad * 0.46, 0, TAU);
    ctx.fillStyle = bg;
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = size * 0.045;
    ctx.shadowOffsetY = size * 0.012;
    ctx.fill();
    ctx.restore();

    if (!state.names.length) {
      drawEmptyState(cx, cy, R);
      return;
    }

    const n = state.names.length;
    const seg = TAU / n;

    // Segments
    for (let i = 0; i < n; i += 1) {
      const start = state.rotation + i * seg;
      const end = start + seg;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, start - HALF_PI, end - HALF_PI, false);
      ctx.closePath();
      ctx.fillStyle = getColor(i);
      ctx.fill();

      ctx.lineWidth = Math.max(1, size * 0.0022);
      ctx.strokeStyle = "rgba(8, 11, 18, 0.22)";
      ctx.stroke();
    }

    // Outer rim
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.lineWidth = Math.max(2, size * 0.006);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.stroke();

    // Labels
    if (n === 1) {
      drawSingleLabel(cx, cy, R);
    } else {
      for (let i = 0; i < n; i += 1) {
        drawLabel(cx, cy, R, seg, i);
      }
    }

    // Winner highlight
    if (state.highlight !== null) {
      drawHighlight(cx, cy, R, seg);
    }

    // Hub
    drawHub(cx, cy, R, bg);
  }

  function drawLabel(cx, cy, R, seg, index) {
    const name = state.names[index];
    if (!name) return;

    const mid = state.rotation + (index + 0.5) * seg;
    const beta = normalizeSigned(mid - HALF_PI);
    const flip = Math.abs(beta) > HALF_PI;

    const maxWidth = R * 0.52;
    const startFont = Math.min(24, R * 0.115, seg * R * 0.42);
    const fitted = fitText(name, maxWidth, Math.max(8, startFont));
    const color = getColor(index);
    const textColor = pickTextColor(color);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(mid - HALF_PI + (flip ? Math.PI : 0));
    setFont(fitted.font);
    ctx.fillStyle = textColor;
    ctx.textBaseline = "middle";
    ctx.shadowColor =
      textColor === "#ffffff" ? "rgba(0, 0, 0, 0.32)" : "rgba(255, 255, 255, 0.18)";
    ctx.shadowBlur = 2.5;

    if (flip) {
      ctx.textAlign = "left";
      ctx.fillText(fitted.text, -R * 0.9, 0, maxWidth);
    } else {
      ctx.textAlign = "right";
      ctx.fillText(fitted.text, R * 0.9, 0, maxWidth);
    }
    ctx.restore();
  }

  function drawSingleLabel(cx, cy, R) {
    const name = state.names[0];
    if (!name) return;
    const maxWidth = R * 0.74;
    const startFont = Math.min(34, R * 0.155);
    const fitted = fitText(name, maxWidth, Math.max(10, startFont));
    const textColor = pickTextColor(getColor(0));

    ctx.save();
    ctx.translate(cx, cy);
    setFont(fitted.font);
    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor =
      textColor === "#ffffff" ? "rgba(0, 0, 0, 0.32)" : "rgba(255, 255, 255, 0.18)";
    ctx.shadowBlur = 3;
    ctx.fillText(fitted.text, 0, -R * 0.44, maxWidth);
    ctx.restore();
  }

  function drawHub(cx, cy, R, bg) {
    ctx.save();

    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.155, 0, TAU);
    ctx.fillStyle = bg;
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = R * 0.08;
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.lineWidth = Math.max(1.5, R * 0.008);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.stroke();

    const g = ctx.createRadialGradient(
      cx - R * 0.03,
      cy - R * 0.03,
      0.5,
      cx,
      cy,
      R * 0.085
    );
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.5, "#c4b5fd");
    g.addColorStop(1, "#7c3aed");

    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.077, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();

    ctx.restore();
  }

  function drawEmptyState(cx, cy, R) {
    ctx.save();

    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.84, 0, TAU);
    ctx.setLineDash([R * 0.03, R * 0.035]);
    ctx.lineWidth = Math.max(1.5, R * 0.01);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    setFont(Math.max(12, R * 0.085));
    ctx.fillStyle = "rgba(255, 255, 255, 0.62)";
    ctx.fillText("Add names", cx, cy - R * 0.04);

    ctx.font = "500 " + Math.max(10, R * 0.05).toFixed(1) + "px " + FONT_STACK;
    ctx.fillStyle = "rgba(255, 255, 255, 0.34)";
    ctx.fillText("to start spinning", cx, cy + R * 0.06);

    ctx.restore();
  }

  function drawHighlight(cx, cy, R, seg) {
    const index = Math.min(state.highlight, state.names.length - 1);
    if (index < 0) return;

    const start = state.rotation + index * seg;
    const end = start + seg;
    const pulse = state.highlightAnimate
      ? 0.5 + 0.5 * Math.sin((performance.now() - state.highlightStart) / 150)
      : 1;

    ctx.save();

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, start - HALF_PI, end - HALF_PI, false);
    ctx.closePath();
    ctx.fillStyle = "rgba(255, 255, 255, " + (0.07 + 0.11 * pulse).toFixed(3) + ")";
    ctx.fill();

    ctx.lineWidth = Math.max(2.5, R * 0.015);
    ctx.strokeStyle = "rgba(253, 224, 71, " + (0.55 + 0.4 * pulse).toFixed(3) + ")";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, R - R * 0.01, start - HALF_PI, end - HALF_PI, false);
    ctx.lineWidth = R * 0.05;
    ctx.strokeStyle = "rgba(250, 204, 21, " + (0.14 + 0.24 * pulse).toFixed(3) + ")";
    ctx.stroke();

    ctx.restore();
  }

  /* ---------------- highlight ---------------- */

  function highlightSegment(index, animate) {
    if (!state.names.length) return;
    clearHighlight(false);
    state.highlight = Math.max(0, Math.min(state.names.length - 1, index));
    state.highlightStart = performance.now();
    state.highlightAnimate = animate !== false;

    if (state.highlightAnimate) {
      highlightLoop();
    } else {
      draw();
    }
  }

  function highlightLoop() {
    if (state.highlight === null) return;
    draw();
    if (performance.now() - state.highlightStart < 3200) {
      state.highlightRaf = requestAnimationFrame(highlightLoop);
    } else {
      state.highlight = null;
      state.highlightRaf = 0;
      draw();
    }
  }

  function clearHighlight(redraw) {
    if (state.highlightRaf) {
      cancelAnimationFrame(state.highlightRaf);
      state.highlightRaf = 0;
    }
    const had = state.highlight !== null;
    state.highlight = null;
    if (redraw !== false && had) draw();
  }

  /* ---------------- spin ---------------- */

  // Short acceleration, long smooth deceleration. f(0)=0, f(1)=1, C1 continuous.
  const ACCEL = 0.16;
  const ACCEL_K = 2.6;
  const EASE_D = 1 - ACCEL_K * ACCEL * ACCEL;
  const EASE_C = 2 * ACCEL_K * ACCEL * (1 - ACCEL);
  const EASE_A = EASE_C - 2 * EASE_D;
  const EASE_B = 3 * EASE_D - 2 * EASE_C;
  const EASE_OFFSET = ACCEL_K * ACCEL * ACCEL;

  function easeSpin(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    if (t < ACCEL) return ACCEL_K * t * t;
    const u = (t - ACCEL) / (1 - ACCEL);
    return ((EASE_A * u + EASE_B) * u + EASE_C) * u + EASE_OFFSET;
  }

  function spinTo(index, durationMs, callbacks) {
    if (state.spinning || !state.names.length) return false;

    const n = state.names.length;
    const safeIndex = Math.max(0, Math.min(n - 1, Number(index) || 0));
    const seg = TAU / n;

    clearHighlight(true);

    const jitter = (Math.random() * 0.62 - 0.31) * seg;
    const targetLocal = (safeIndex + 0.5) * seg + jitter;
    const desiredRotation = normalize(-targetLocal);
    const currentRotation = normalize(state.rotation);
    const turns = 5 + Math.floor(Math.random() * 3);

    const delta =
      turns * TAU + (normalize(desiredRotation - currentRotation) || 0);

    const cb = callbacks || {};
    const duration = Math.max(0, Number(durationMs) || 0);

    state.spinFrom = state.rotation;
    state.spinDelta = delta;
    state.spinDuration = duration;
    state.onTick = typeof cb.onTick === "function" ? cb.onTick : null;
    state.onDone = typeof cb.onDone === "function" ? cb.onDone : null;
    state.lastTickIndex = getPointerIndex();
    state.lastTickTime = 0;

    if (duration <= 0) {
      state.rotation = normalize(state.spinFrom + state.spinDelta);
      state.spinning = false;
      draw();
      const done = state.onDone;
      state.onDone = null;
      state.onTick = null;
      if (done) done();
      return true;
    }

    state.spinStart = performance.now();
    state.spinning = true;
    state.rafId = requestAnimationFrame(stepSpin);
    return true;
  }

  function stepSpin(now) {
    const elapsed = now - state.spinStart;
    const t = Math.min(1, elapsed / state.spinDuration);
    const eased = easeSpin(t);
    state.rotation = state.spinFrom + state.spinDelta * eased;
    draw();

    const pointerIndex = getPointerIndex();
    if (pointerIndex !== state.lastTickIndex) {
      state.lastTickIndex = pointerIndex;
      if (now - state.lastTickTime > 30) {
        state.lastTickTime = now;
        if (state.onTick) {
          try {
            state.onTick();
          } catch (err) {
            /* ignore audio errors */
          }
        }
      }
    }

    if (t < 1) {
      state.rafId = requestAnimationFrame(stepSpin);
      return;
    }

    state.rotation = normalize(state.spinFrom + state.spinDelta);
    state.spinning = false;
    state.rafId = 0;
    draw();

    const done = state.onDone;
    state.onDone = null;
    state.onTick = null;
    if (done) done();
  }

  function getPointerIndex() {
    const n = state.names.length;
    if (!n) return -1;
    const seg = TAU / n;
    const local = normalize(-state.rotation);
    let index = Math.floor(local / seg);
    if (index >= n) index = n - 1;
    if (index < 0) index = 0;
    return index;
  }

  /* ---------------- angle helpers ---------------- */

  function normalize(angle) {
    const a = angle % TAU;
    return a < 0 ? a + TAU : a;
  }

  function normalizeSigned(angle) {
    const a = normalize(angle);
    return a > Math.PI ? a - TAU : a;
  }

  function isSpinning() {
    return state.spinning;
  }

  window.Spinora = window.Spinora || {};
  window.Spinora.wheel = {
    init: init,
    setNames: setNames,
    setSettings: setSettings,
    spinTo: spinTo,
    isSpinning: isSpinning,
    highlightSegment: highlightSegment,
    clearHighlight: clearHighlight,
    getColor: getColor,
    getPointerIndex: getPointerIndex,
    resize: scheduleResize,
  };
})();
