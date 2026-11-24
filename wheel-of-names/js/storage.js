/* =========================================================
   storage.js — localStorage persistence
   ========================================================= */
(function () {
  "use strict";

  const KEY = "spinora.state.v1";
  const SCHEMES = ["vibrant", "pastel", "ocean", "sunset", "forest", "candy"];
  const MAX_NAME_LENGTH = 120;
  const MAX_HISTORY = 200;

  const DEFAULT_NAMES = [
    "Maya",
    "Liam",
    "Sofia",
    "Noah",
    "Ava",
    "Ethan",
    "Zoe",
    "Lucas",
  ];

  const DEFAULT_SETTINGS = {
    scheme: "vibrant",
    background: "#141a28",
    sound: true,
    confetti: true,
    duration: 5,
    autoRemove: false,
  };

  function defaults() {
    return {
      names: DEFAULT_NAMES.slice(),
      settings: Object.assign({}, DEFAULT_SETTINGS),
      history: [],
      spinCount: 0,
    };
  }

  function clampDuration(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULT_SETTINGS.duration;
    return Math.min(10, Math.max(2, Math.round(n * 2) / 2));
  }

  function sanitizeSettings(raw) {
    const s = raw && typeof raw === "object" ? raw : {};
    return {
      scheme: SCHEMES.indexOf(s.scheme) !== -1 ? s.scheme : DEFAULT_SETTINGS.scheme,
      background:
        typeof s.background === "string" && /^#[0-9a-f]{6}$/i.test(s.background)
          ? s.background.toLowerCase()
          : DEFAULT_SETTINGS.background,
      sound: typeof s.sound === "boolean" ? s.sound : DEFAULT_SETTINGS.sound,
      confetti: typeof s.confetti === "boolean" ? s.confetti : DEFAULT_SETTINGS.confetti,
      duration: clampDuration(s.duration),
      autoRemove: typeof s.autoRemove === "boolean" ? s.autoRemove : DEFAULT_SETTINGS.autoRemove,
    };
  }

  function sanitizeNames(raw) {
    if (!Array.isArray(raw)) return DEFAULT_NAMES.slice();
    const out = [];
    for (let i = 0; i < raw.length; i += 1) {
      if (typeof raw[i] !== "string") continue;
      const name = raw[i].trim();
      if (!name) continue;
      out.push(name.slice(0, MAX_NAME_LENGTH));
    }
    return out;
  }

  function sanitizeHistory(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (let i = 0; i < raw.length; i += 1) {
      const entry = raw[i];
      if (!entry || typeof entry.name !== "string") continue;
      const name = entry.name.trim();
      if (!name) continue;
      out.push({
        name: name.slice(0, MAX_NAME_LENGTH),
        spin: Number.isFinite(entry.spin) ? Math.max(1, Math.floor(entry.spin)) : 1,
        time: Number.isFinite(entry.time) ? entry.time : Date.now(),
      });
    }
    return out.slice(-MAX_HISTORY);
  }

  function load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return defaults();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return defaults();
      return {
        names: sanitizeNames(parsed.names),
        settings: sanitizeSettings(parsed.settings),
        history: sanitizeHistory(parsed.history),
        spinCount: Number.isFinite(parsed.spinCount)
          ? Math.max(0, Math.floor(parsed.spinCount))
          : 0,
      };
    } catch (err) {
      return defaults();
    }
  }

  function save(state) {
    try {
      window.localStorage.setItem(
        KEY,
        JSON.stringify({
          version: 1,
          names: state.names,
          settings: state.settings,
          history: state.history,
          spinCount: state.spinCount,
        })
      );
      return true;
    } catch (err) {
      return false;
    }
  }

  function reset() {
    try {
      window.localStorage.removeItem(KEY);
    } catch (err) {
      /* storage may be unavailable */
    }
    return defaults();
  }

  window.Spinora = window.Spinora || {};
  window.Spinora.storage = {
    load: load,
    save: save,
    reset: reset,
    defaults: defaults,
    DEFAULT_NAMES: DEFAULT_NAMES.slice(),
    DEFAULT_SETTINGS: Object.assign({}, DEFAULT_SETTINGS),
    MAX_NAME_LENGTH: MAX_NAME_LENGTH,
  };
})();
