/* =========================================================
   history.js — winner history recording and rendering
   ========================================================= */
(function () {
  "use strict";

  const MAX_HISTORY = 200;

  let records = [];
  let onChange = function () {};
  let onToast = function () {};

  const els = {
    list: null,
    sub: null,
    clearBtn: null,
  };

  function init(initial, options) {
    const opts = options || {};
    records = Array.isArray(initial) ? initial.slice(-MAX_HISTORY) : [];
    onChange = typeof opts.onChange === "function" ? opts.onChange : function () {};
    onToast = typeof opts.onToast === "function" ? opts.onToast : function () {};
  }

  function mount() {
    els.list = document.getElementById("historyList");
    els.sub = document.getElementById("historySub");
    els.clearBtn = document.getElementById("clearHistory");

    if (els.clearBtn) {
      els.clearBtn.addEventListener("click", handleClear);
    }

    render();
  }

  function add(record) {
    if (!record || !record.name) return;
    records.push({
      name: String(record.name),
      spin: Number.isFinite(record.spin) ? record.spin : records.length + 1,
      time: Number.isFinite(record.time) ? record.time : Date.now(),
    });
    if (records.length > MAX_HISTORY) {
      records = records.slice(-MAX_HISTORY);
    }
    render();
    notify("add");
  }

  function setAll(list) {
    records = Array.isArray(list) ? list.slice(-MAX_HISTORY) : [];
    render();
    notify("replace");
  }

  function getAll() {
    return records.map(function (entry) {
      return { name: entry.name, spin: entry.spin, time: entry.time };
    });
  }

  function clear(options) {
    const opts = options || {};
    if (!records.length) return;
    records = [];
    render();
    if (!opts.silent) notify("clear");
  }

  function getLatest() {
    return records.length ? records[records.length - 1] : null;
  }

  function handleClear() {
    if (!records.length) return;
    if (!window.confirm("Clear the entire spin history?")) return;
    onToast("Spin history cleared.");
    clear();
  }

  function notify(reason) {
    try {
      onChange(reason);
    } catch (err) {
      /* keep UI resilient */
    }
  }

  function render() {
    if (!els.list) return;

    const total = records.length;
    if (els.sub) {
      els.sub.textContent = total
        ? total + (total === 1 ? " spin recorded" : " spins recorded")
        : "No spins yet";
    }
    if (els.clearBtn) els.clearBtn.disabled = total === 0;

    if (!total) {
      const empty = document.createElement("li");
      empty.className = "history-empty";
      empty.innerHTML =
        "<strong>Nothing here yet</strong><span>Your winners will appear here after each spin.</span>";
      els.list.replaceChildren(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (let i = total - 1; i >= 0; i -= 1) {
      const entry = records[i];
      const isLatest = i === total - 1;

      const item = document.createElement("li");
      item.className = "history-item" + (isLatest ? " is-latest" : "");

      const badge = document.createElement("span");
      badge.className = "history-spin";
      badge.textContent = "#" + entry.spin;
      item.appendChild(badge);

      const name = document.createElement("span");
      name.className = "history-name";
      name.textContent = entry.name;
      name.title = entry.name;
      item.appendChild(name);

      const time = document.createElement("time");
      time.className = "history-time";
      const date = new Date(entry.time);
      time.dateTime = date.toISOString();
      time.textContent = formatTime(date);
      time.title = date.toLocaleString();
      item.appendChild(time);

      fragment.appendChild(item);
    }

    els.list.replaceChildren(fragment);
  }

  function formatTime(date) {
    const now = new Date();
    const time = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    if (date.toDateString() === now.toDateString()) return time;
    return (
      date.toLocaleDateString([], { month: "short", day: "numeric" }) + " \u00b7 " + time
    );
  }

  window.Spinora = window.Spinora || {};
  window.Spinora.history = {
    init: init,
    mount: mount,
    add: add,
    setAll: setAll,
    getAll: getAll,
    clear: clear,
    getLatest: getLatest,
  };
})();
