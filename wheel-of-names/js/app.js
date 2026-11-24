/* =========================================================
   app.js — initialization, coordination, settings, winner flow
   ========================================================= */
(function () {
  "use strict";

  const storage = window.Spinora.storage;
  const names = window.Spinora.names;
  const wheel = window.Spinora.wheel;
  const history = window.Spinora.history;

  const state = storage.load();
  let settings = state.settings;
  let spinCount = state.spinCount || 0;

  let spinning = false;
  let modalOpen = false;
  let modalTimer = 0;
  let pendingWinner = null;
  let saveTimer = 0;
  let saveWarned = false;
  let toastTimer = 0;
  let toastHideTimer = 0;
  let audioCtx = null;

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  let els = {};

  /* ---------------- boot ---------------- */

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function init() {
    cacheElements();

    names.init(state.names, {
      onChange: handleNamesChange,
      onToast: toast,
    });
    names.mount();

    history.init(state.history, {
      onChange: handleHistoryChange,
      onToast: toast,
    });
    history.mount();

    wheel.init(els.wheel, els.wheelWrap);
    wheel.setNames(names.getNames());
    wheel.setSettings(settings);

    applySettingsToUI();
    bindSettings();
    bindSpin();
    bindWinnerModal();
    bindGlobal();

    updateSpinState();
    updateCounterPill();
    updateLastWinner();
    updateRangeVisual();

    window.addEventListener("beforeunload", persist);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") persist();
    });

    persist();
  }

  function cacheElements() {
    els = {
      namesPanel: document.getElementById("namesPanel"),
      nameInput: document.getElementById("nameInput"),
      entryPill: document.getElementById("entryPill"),
      spinCounterPill: document.getElementById("spinCounterPill"),

      wheelWrap: document.getElementById("wheelWrap"),
      wheel: document.getElementById("wheel"),
      spinBtn: document.getElementById("spinBtn"),
      spinBtnLabel: document.getElementById("spinBtnLabel"),
      spinHint: document.getElementById("spinHint"),
      lastWinner: document.getElementById("lastWinner"),
      lastWinnerName: document.getElementById("lastWinnerName"),

      soundQuickBtn: document.getElementById("soundQuickBtn"),
      schemeSelect: document.getElementById("schemeSelect"),
      schemePreview: document.getElementById("schemePreview"),
      bgColor: document.getElementById("bgColor"),
      bgColorValue: document.getElementById("bgColorValue"),
      durationRange: document.getElementById("durationRange"),
      durationValue: document.getElementById("durationValue"),
      soundToggle: document.getElementById("soundToggle"),
      confettiToggle: document.getElementById("confettiToggle"),
      autoRemoveToggle: document.getElementById("autoRemoveToggle"),
      resetBtn: document.getElementById("resetBtn"),

      winnerModal: document.getElementById("winnerModal"),
      winnerSpin: document.getElementById("winnerSpin"),
      winnerTitle: document.getElementById("winnerTitle"),
      winnerNote: document.getElementById("winnerNote"),
      spinAgainBtn: document.getElementById("spinAgainBtn"),
      removeWinnerBtn: document.getElementById("removeWinnerBtn"),
      keepWinnerBtn: document.getElementById("keepWinnerBtn"),

      confetti: document.getElementById("confetti"),
      toast: document.getElementById("toast"),
    };
  }

  /* ---------------- names / history wiring ---------------- */

  function handleNamesChange() {
    const list = names.getNames();
    state.names = list;
    wheel.setNames(list);
    updateSpinState();
    scheduleSave();
  }

  function handleHistoryChange() {
    state.history = history.getAll();
    updateCounterPill();
    updateLastWinner();
    scheduleSave();
  }

  /* ---------------- settings ---------------- */

  function bindSettings() {
    if (els.schemeSelect) {
      els.schemeSelect.addEventListener("change", function (event) {
        settings.scheme = event.target.value;
        wheel.setSettings(settings);
        updateSchemePreview();
        scheduleSave();
      });
    }

    if (els.soundQuickBtn) {
      els.soundQuickBtn.addEventListener("click", function () {
        settings.sound = !settings.sound;
        if (settings.sound) ensureAudio();
        if (els.soundToggle) els.soundToggle.checked = settings.sound;
        updateSoundQuickButton();
        scheduleSave();
      });
    }

    if (els.bgColor) {
      els.bgColor.addEventListener("input", function (event) {
        const value = event.target.value;
        settings.background = value;
        if (els.bgColorValue) els.bgColorValue.textContent = value;
        wheel.setSettings(settings);
        scheduleSave();
      });
    }

    if (els.durationRange) {
      els.durationRange.addEventListener("input", function (event) {
        settings.duration = Number(event.target.value);
        if (els.durationValue) {
          els.durationValue.textContent = settings.duration.toFixed(1) + "s";
        }
        updateRangeVisual();
        scheduleSave();
      });
    }

    if (els.soundToggle) {
      els.soundToggle.addEventListener("change", function (event) {
        settings.sound = event.target.checked;
        if (settings.sound) ensureAudio();
        updateSoundQuickButton();
        scheduleSave();
      });
    }

    if (els.confettiToggle) {
      els.confettiToggle.addEventListener("change", function (event) {
        settings.confetti = event.target.checked;
        scheduleSave();
      });
    }

    if (els.autoRemoveToggle) {
      els.autoRemoveToggle.addEventListener("change", function (event) {
        settings.autoRemove = event.target.checked;
        scheduleSave();
      });
    }

    if (els.resetBtn) {
      els.resetBtn.addEventListener("click", resetApp);
    }
  }

  function applySettingsToUI() {
    if (els.schemeSelect) els.schemeSelect.value = settings.scheme;
    if (els.bgColor) els.bgColor.value = settings.background;
    if (els.bgColorValue) els.bgColorValue.textContent = settings.background;
    if (els.durationRange) els.durationRange.value = String(settings.duration);
    if (els.durationValue) {
      els.durationValue.textContent = Number(settings.duration).toFixed(1) + "s";
    }
    if (els.soundToggle) els.soundToggle.checked = settings.sound;
    if (els.confettiToggle) els.confettiToggle.checked = settings.confetti;
    if (els.autoRemoveToggle) els.autoRemoveToggle.checked = settings.autoRemove;
    updateSoundQuickButton();
    updateSchemePreview();
  }

  function updateSoundQuickButton() {
    if (!els.soundQuickBtn) return;
    const on = Boolean(settings.sound);
    els.soundQuickBtn.setAttribute("aria-pressed", on ? "true" : "false");
    els.soundQuickBtn.title = on ? "Mute sound effects" : "Enable sound effects";
  }

  function updateSchemePreview() {
    if (!els.schemePreview) return;
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 8; i += 1) {
      const dot = document.createElement("span");
      dot.className = "scheme-dot";
      dot.style.background = wheel.getColor(i);
      fragment.appendChild(dot);
    }
    els.schemePreview.replaceChildren(fragment);
  }

  function updateRangeVisual() {
    if (!els.durationRange) return;
    const min = Number(els.durationRange.min) || 0;
    const max = Number(els.durationRange.max) || 100;
    const value = Number(els.durationRange.value) || min;
    const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
    els.durationRange.style.background =
      "linear-gradient(90deg, rgba(34,211,238,.85) 0%, rgba(139,92,246,.9) " +
      pct +
      "%, rgba(255,255,255,.12) " +
      pct +
      "%, rgba(255,255,255,.12) 100%)";
  }

  function lockSettings(locked) {
    const controls = [
      els.schemeSelect,
      els.bgColor,
      els.durationRange,
      els.soundToggle,
      els.confettiToggle,
      els.autoRemoveToggle,
      els.resetBtn,
    ];
    controls.forEach(function (control) {
      if (control) control.disabled = locked;
    });
  }

  function resetApp() {
    if (spinning) return;
    const ok = window.confirm(
      "Reset all names, settings, and history back to the defaults?"
    );
    if (!ok) return;

    if (modalOpen) closeWinner({ restoreFocus: false });

    const defaults = storage.reset();
    settings = defaults.settings;
    state.settings = defaults.settings;
    spinCount = 0;

    stopConfetti();
    names.replaceAll(defaults.names);
    history.setAll(defaults.history);
    wheel.setSettings(settings);
    wheel.clearHighlight();
    applySettingsToUI();
    updateRangeVisual();
    updateCounterPill();
    updateLastWinner();
    updateSpinState();

    toast("Everything has been reset to defaults.");
    persist();
  }

  /* ---------------- spin flow ---------------- */

  function bindSpin() {
    if (els.spinBtn) {
      els.spinBtn.addEventListener("click", startSpin);
    }
  }

  function startSpin() {
    if (spinning) return;
    if (modalOpen) closeWinner();

    const list = names.getNames();
    if (!list.length) {
      toast("Add at least one name before spinning.");
      names.focusAddInput();
      return;
    }

    spinning = true;
    names.setDisabled(true);
    lockSettings(true);
    updateSpinState();

    const index = Math.floor(Math.random() * list.length);
    const winner = list[index];
    const reduce = reducedMotionQuery.matches;
    const duration = reduce ? 0 : Math.max(200, settings.duration * 1000);

    ensureAudio();

    const started = wheel.spinTo(index, duration, {
      onTick: playTick,
      onDone: function () {
        finishSpin(index, winner);
      },
    });

    if (!started) {
      spinning = false;
      names.setDisabled(false);
      lockSettings(false);
      updateSpinState();
    }
  }

  function finishSpin(index, winnerName) {
    spinning = false;
    names.setDisabled(false);
    lockSettings(false);

    spinCount += 1;

    const record = {
      name: winnerName,
      spin: spinCount,
      time: Date.now(),
    };
    history.add(record);

    let removed = false;
    let originalIndex = index;

    if (settings.autoRemove) {
      const list = names.getNames();
      let actual = index;
      if (list[actual] !== winnerName) actual = list.indexOf(winnerName);
      if (actual >= 0) {
        originalIndex = actual;
        names.removeAt(actual);
        removed = true;
      }
    }

    pendingWinner = {
      record: record,
      index: originalIndex,
      removed: removed,
    };

    updateSpinState();

    if (!removed) {
      wheel.highlightSegment(originalIndex, !reducedMotionQuery.matches);
    }

    openWinner(pendingWinner);

    if (settings.sound) playWin();
    if (settings.confetti) launchConfetti();

    scheduleSave();
  }

  /* ---------------- winner modal ---------------- */

  function bindWinnerModal() {
    if (els.winnerModal) {
      els.winnerModal.addEventListener("click", function (event) {
        if (event.target === els.winnerModal) closeWinner();
      });
    }

    if (els.spinAgainBtn) {
      els.spinAgainBtn.addEventListener("click", function () {
        closeWinner({ restoreFocus: false });
        window.setTimeout(startSpin, 220);
      });
    }

    if (els.removeWinnerBtn) {
      els.removeWinnerBtn.addEventListener("click", function () {
        const removed = removePendingWinner();
        if (removed) toast("Removed " + removed + " from the wheel.");
        closeWinner();
      });
    }

    if (els.keepWinnerBtn) {
      els.keepWinnerBtn.addEventListener("click", function () {
        const restored = keepPendingWinner();
        if (restored) toast("Kept " + restored + " on the wheel.");
        closeWinner();
      });
    }
  }

  function bindGlobal() {
    document.addEventListener("keydown", function (event) {
      if (!modalOpen) return;

      if (event.key === "Escape") {
        event.preventDefault();
        closeWinner();
        return;
      }

      if (event.key !== "Tab") return;

      const focusables = Array.prototype.slice
        .call(els.winnerModal.querySelectorAll("button"))
        .filter(function (btn) {
          return !btn.hidden && !btn.disabled;
        });

      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const inside = els.winnerModal.contains(active);

      if (event.shiftKey) {
        if (!inside || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!inside || active === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  function openWinner(pending) {
    if (!els.winnerModal) return;

    pendingWinner = pending;

    if (modalTimer) {
      window.clearTimeout(modalTimer);
      modalTimer = 0;
    }

    const record = pending.record;
    const remaining = names.count();

    if (els.winnerSpin) els.winnerSpin.textContent = "Spin #" + record.spin;
    if (els.winnerTitle) els.winnerTitle.textContent = record.name;

    let note = "";
    if (pending.removed) {
      note = remaining
        ? "Removed from the wheel automatically."
        : "Removed automatically \u2014 the wheel is empty now.";
    } else if (remaining === 1) {
      note = "That was the only entry on the wheel.";
    } else if (settings.autoRemove) {
      note = "Auto-remove is on.";
    }

    if (els.winnerNote) els.winnerNote.textContent = note;

    if (els.removeWinnerBtn) els.removeWinnerBtn.hidden = pending.removed;
    if (els.keepWinnerBtn) {
      els.keepWinnerBtn.hidden = false;
      els.keepWinnerBtn.textContent = pending.removed ? "Keep on wheel" : "Keep winner";
      els.keepWinnerBtn.classList.toggle("btn-wide", pending.removed);
    }

    els.winnerModal.hidden = false;
    modalOpen = true;

    // Force reflow so the opening transition runs.
    void els.winnerModal.offsetWidth;
    els.winnerModal.classList.add("is-open");

    if (els.spinAgainBtn) {
      els.spinAgainBtn.focus({ preventScroll: true });
    }
  }

  function closeWinner(options) {
    if (!modalOpen) return;
    const opts = options || {};

    modalOpen = false;
    pendingWinner = null;

    if (els.winnerModal) els.winnerModal.classList.remove("is-open");

    if (modalTimer) window.clearTimeout(modalTimer);
    modalTimer = window.setTimeout(function () {
      if (!modalOpen && els.winnerModal) els.winnerModal.hidden = true;
      modalTimer = 0;
    }, 240);

    if (opts.restoreFocus !== false && els.spinBtn) {
      els.spinBtn.focus({ preventScroll: true });
    }
  }

  function removePendingWinner() {
    if (!pendingWinner || pendingWinner.removed) return null;

    const name = pendingWinner.record.name;
    const list = names.getNames();
    let index = pendingWinner.index;

    if (list[index] !== name) index = list.indexOf(name);
    if (index < 0) return null;

    pendingWinner.removed = true;
    return names.removeAt(index);
  }

  function keepPendingWinner() {
    if (!pendingWinner || !pendingWinner.removed) return null;

    const name = pendingWinner.record.name;
    const index = pendingWinner.index;
    pendingWinner.removed = false;
    const ok = names.restoreAt(index, name);
    return ok ? name : null;
  }

  /* ---------------- state display ---------------- */

  function updateSpinState() {
    const count = names.count();

    if (els.spinBtn) {
      els.spinBtn.disabled = spinning || count === 0;
      els.spinBtn.setAttribute("aria-busy", spinning ? "true" : "false");
      els.spinBtn.classList.toggle("is-spinning", spinning);
    }
    if (els.spinBtnLabel) {
      els.spinBtnLabel.textContent = spinning ? "Spinning\u2026" : "SPIN";
    }
    if (els.spinHint) {
      if (spinning) {
        els.spinHint.textContent = "Spinning the wheel\u2026";
      } else if (count === 0) {
        els.spinHint.textContent = "Add at least one name to start.";
      } else if (count === 1) {
        els.spinHint.textContent = "One entry \u2014 it always wins!";
      } else {
        els.spinHint.textContent = "Press spin to pick a random winner.";
      }
    }
  }

  function updateCounterPill() {
    if (!els.spinCounterPill) return;
    els.spinCounterPill.textContent =
      spinCount + (spinCount === 1 ? " spin" : " spins");
  }

  function updateLastWinner() {
    if (!els.lastWinner) return;
    const latest = history.getLatest();
    if (latest) {
      els.lastWinner.hidden = false;
      if (els.lastWinnerName) {
        els.lastWinnerName.textContent = latest.name;
        els.lastWinnerName.title = latest.name;
      }
    } else {
      els.lastWinner.hidden = true;
      if (els.lastWinnerName) {
        els.lastWinnerName.textContent = "";
        els.lastWinnerName.title = "";
      }
    }
  }

  /* ---------------- persistence ---------------- */

  function scheduleSave() {
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(persist, 160);
  }

  function persist() {
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = 0;
    }

    state.names = names.getNames();
    state.history = history.getAll();
    state.spinCount = spinCount;
    state.settings = settings;

    const ok = storage.save(state);
    if (!ok && !saveWarned) {
      saveWarned = true;
      toast("This browser blocked local storage. Changes may not persist.");
    }
  }

  /* ---------------- toast ---------------- */

  function toast(message, duration) {
    if (!els.toast) return;
    if (toastTimer) window.clearTimeout(toastTimer);
    if (toastHideTimer) window.clearTimeout(toastHideTimer);

    els.toast.hidden = false;
    els.toast.textContent = message;

    requestAnimationFrame(function () {
      els.toast.classList.add("is-visible");
    });

    toastTimer = window.setTimeout(function () {
      els.toast.classList.remove("is-visible");
      toastHideTimer = window.setTimeout(function () {
        els.toast.hidden = true;
      }, 260);
    }, duration || 2600);
  }

  /* ---------------- sound (Web Audio, no assets needed) ---------------- */

  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      try {
        audioCtx = new Ctx();
      } catch (err) {
        return null;
      }
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(function () {});
    }
    return audioCtx;
  }

  function playTick() {
    if (!settings.sound) return;
    const ac = ensureAudio();
    if (!ac) return;
    try {
      const now = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(1080, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.02, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
      osc.connect(gain).connect(ac.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch (err) {
      /* ignore audio failures */
    }
  }

  function playWin() {
    if (!settings.sound) return;
    const ac = ensureAudio();
    if (!ac) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      const now = ac.currentTime;
      notes.forEach(function (freq, i) {
        const start = now + i * 0.085;
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.075, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
        osc.connect(gain).connect(ac.destination);
        osc.start(start);
        osc.stop(start + 0.6);
      });
    } catch (err) {
      /* ignore audio failures */
    }
  }

  /* ---------------- confetti ---------------- */

  let confettiRaf = 0;
  let confettiParticles = [];
  let confettiCtx = null;
  let confettiW = 0;
  let confettiH = 0;

  function stopConfetti() {
    if (confettiRaf) {
      cancelAnimationFrame(confettiRaf);
      confettiRaf = 0;
    }
    if (confettiCtx && confettiW && confettiH) {
      confettiCtx.clearRect(0, 0, confettiW, confettiH);
    }
    confettiParticles = [];
  }

  function launchConfetti() {
    if (reducedMotionQuery.matches || !settings.confetti) return;
    const canvas = els.confetti;
    if (!canvas) return;

    confettiCtx = canvas.getContext("2d");
    if (!confettiCtx) return;

    confettiW = window.innerWidth;
    confettiH = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(confettiW * dpr);
    canvas.height = Math.round(confettiH * dpr);
    confettiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (confettiRaf) {
      cancelAnimationFrame(confettiRaf);
      confettiRaf = 0;
    }

    const palette = [];
    for (let i = 0; i < 6; i += 1) palette.push(wheel.getColor(i));

    const count = Math.max(
      80,
      Math.min(180, Math.round((confettiW * confettiH) / 14000))
    );
    confettiParticles = [];

    for (let i = 0; i < count; i += 1) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.7;
      const speed = 6 + Math.random() * 11;
      confettiParticles.push({
        x: confettiW / 2 + (Math.random() - 0.5) * 180,
        y: confettiH * 0.32 + (Math.random() - 0.5) * 50,
        vx: Math.cos(angle) * speed * (0.55 + Math.random() * 0.9),
        vy: Math.sin(angle) * speed - Math.random() * 4,
        size: 5 + Math.random() * 7,
        color: palette[Math.floor(Math.random() * palette.length)],
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        life: 140 + Math.random() * 90,
        maxLife: 230,
        circle: Math.random() < 0.3,
      });
    }

    const start = performance.now();
    let last = start;

    function frame(now) {
      if (!confettiCtx) return;
      const dt = Math.min(2.6, (now - last) / 16.67 || 1);
      last = now;

      confettiCtx.clearRect(0, 0, confettiW, confettiH);

      let alive = false;
      for (let i = 0; i < confettiParticles.length; i += 1) {
        const p = confettiParticles[i];
        if (p.life <= 0) continue;

        p.vy += 0.34 * dt;
        p.vx *= Math.pow(0.993, dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.life -= dt;

        if (p.y > confettiH + 40 || p.x < -60 || p.x > confettiW + 60) {
          p.life = 0;
          continue;
        }
        if (p.life <= 0) continue;

        alive = true;
        confettiCtx.save();
        confettiCtx.globalAlpha = Math.min(1, p.life / 45);
        confettiCtx.translate(p.x, p.y);
        confettiCtx.rotate(p.rot);
        confettiCtx.fillStyle = p.color;
        if (p.circle) {
          confettiCtx.beginPath();
          confettiCtx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          confettiCtx.fill();
        } else {
          confettiCtx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        }
        confettiCtx.restore();
      }

      const elapsed = now - start;
      if (alive && elapsed < 4200) {
        confettiRaf = requestAnimationFrame(frame);
      } else {
        confettiCtx.clearRect(0, 0, confettiW, confettiH);
        confettiRaf = 0;
      }
    }

    confettiRaf = requestAnimationFrame(frame);
  }
})();
