/* =========================================================
   names.js — entry management (add / edit / remove / clear)
   ========================================================= */
(function () {
  "use strict";

  const MAX = (window.Spinora && window.Spinora.storage && window.Spinora.storage.MAX_NAME_LENGTH) || 120;

  let names = [];
  let locked = false;
  let onChange = function () {};
  let onToast = function () {};

  const els = {
    panel: null,
    list: null,
    form: null,
    input: null,
    addBtn: null,
    count: null,
    pill: null,
    clearBtn: null,
  };

  const deleteIcon =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M18 6 6 18M6 6l12 12"></path></svg>';

  function init(initial, options) {
    const opts = options || {};
    names = Array.isArray(initial) ? initial.slice() : [];
    onChange = typeof opts.onChange === "function" ? opts.onChange : function () {};
    onToast = typeof opts.onToast === "function" ? opts.onToast : function () {};
  }

  function mount() {
    els.panel = document.getElementById("namesPanel");
    els.list = document.getElementById("namesList");
    els.form = document.getElementById("addForm");
    els.input = document.getElementById("nameInput");
    els.addBtn = document.getElementById("addBtn");
    els.count = document.getElementById("namesCount");
    els.pill = document.getElementById("entryPill");
    els.clearBtn = document.getElementById("clearNames");

    if (!els.list || !els.form) return;

    els.form.addEventListener("submit", handleSubmit);
    els.list.addEventListener("click", handleListClick);
    els.list.addEventListener("input", handleListInput);
    els.list.addEventListener("change", handleListChange);
    els.list.addEventListener("focusout", handleListBlur);
    els.list.addEventListener("keydown", handleListKeydown);

    if (els.clearBtn) els.clearBtn.addEventListener("click", handleClear);

    if (els.input) {
      els.input.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          handleSubmit(event);
        }
      });
    }

    render();
  }

  /* ---------------- mutation API ---------------- */

  function addMany(text) {
    const parts = String(text == null ? "" : text)
      .split(/\r?\n/)
      .map(function (line) { return line.trim(); })
      .filter(function (line) { return line.length > 0; });

    if (!parts.length) return 0;

    parts.forEach(function (line) {
      names.push(line.slice(0, MAX));
    });

    render();
    scrollToEnd();
    notify("add");
    return parts.length;
  }

  function removeAt(index) {
    if (!Number.isInteger(index) || index < 0 || index >= names.length) return null;
    const removed = names.splice(index, 1)[0];
    render();
    notify("remove");
    return removed;
  }

  function restoreAt(index, name) {
    const clean = String(name == null ? "" : name).trim().slice(0, MAX);
    if (!clean) return false;
    const at = Math.max(0, Math.min(names.length, Number(index) || 0));
    names.splice(at, 0, clean);
    render();
    notify("restore");
    return true;
  }

  function replaceAll(list) {
    names = Array.isArray(list)
      ? list
          .filter(function (n) { return typeof n === "string" && n.trim(); })
          .map(function (n) { return n.trim().slice(0, MAX); })
      : [];
    render();
    notify("replace");
  }

  function clear() {
    if (!names.length) return;
    names = [];
    render();
    notify("clear");
  }

  function getNames() {
    return names.slice();
  }

  function count() {
    return names.length;
  }

  /* ---------------- events ---------------- */

  function handleSubmit(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (locked || !els.input) return;

    const added = addMany(els.input.value);
    if (!added) {
      onToast("Enter at least one name first.");
      els.input.focus();
      return;
    }

    els.input.value = "";
    els.input.focus();
  }

  function handleClear() {
    if (locked || !names.length) return;
    if (!window.confirm("Remove all names from the wheel?")) return;
    clear();
  }

  function indexFromEvent(event) {
    const input = event.target.closest("[data-index]");
    if (!input) return -1;
    const raw = input.getAttribute("data-index");
    const index = Number(raw);
    return Number.isInteger(index) ? index : -1;
  }

  function handleListClick(event) {
    const btn = event.target.closest(".name-delete");
    if (!btn) return;
    const row = btn.closest("[data-index]");
    if (!row) return;
    if (locked) return;
    const index = Number(row.getAttribute("data-index"));
    if (!Number.isInteger(index)) return;
    removeAt(index);
  }

  function handleListInput(event) {
    if (locked) return;
    const input = event.target.closest(".name-input");
    if (!input) return;
    const index = indexFromEvent(event);
    if (index < 0 || index >= names.length) return;

    const value = input.value;
    if (!value.trim()) return;

    names[index] = value;
    notify("edit");
  }

  function commitInput(input, index) {
    if (locked) return;
    if (!input || index < 0 || index >= names.length) return;

    const trimmed = input.value.trim().slice(0, MAX);
    if (!trimmed) {
      input.value = names[index];
      return;
    }

    input.value = trimmed;
    if (names[index] !== trimmed) {
      names[index] = trimmed;
      notify("edit");
    }
  }

  function handleListChange(event) {
    const input = event.target.closest(".name-input");
    if (!input) return;
    commitInput(input, indexFromEvent(event));
  }

  function handleListBlur(event) {
    const input = event.target.closest(".name-input");
    if (!input) return;
    commitInput(input, indexFromEvent(event));
  }

  function handleListKeydown(event) {
    if (event.key === "Enter" && event.target.classList.contains("name-input")) {
      event.preventDefault();
      event.target.blur();
    }
  }

  /* ---------------- rendering ---------------- */

  function render() {
    if (!els.list) return;

    const fragment = document.createDocumentFragment();

    if (!names.length) {
      const empty = document.createElement("li");
      empty.className = "names-empty";
      empty.innerHTML =
        "<strong>No entries yet</strong><span>Add names above to build your wheel.</span>";
      fragment.appendChild(empty);
    } else {
      names.forEach(function (name, index) {
        const row = document.createElement("li");
        row.className = "name-row";
        row.setAttribute("data-index", String(index));

        const num = document.createElement("span");
        num.className = "name-index";
        num.setAttribute("aria-hidden", "true");
        num.textContent = String(index + 1);
        row.appendChild(num);

        const input = document.createElement("input");
        input.type = "text";
        input.className = "name-input";
        input.value = name;
        input.maxLength = MAX;
        input.autocomplete = "off";
        input.spellcheck = false;
        input.setAttribute("aria-label", "Entry " + (index + 1));
        input.disabled = locked;
        row.appendChild(input);

        const del = document.createElement("button");
        del.type = "button";
        del.className = "name-delete";
        del.innerHTML = deleteIcon;
        del.setAttribute("aria-label", "Remove " + name);
        del.title = "Remove " + name;
        del.disabled = locked;
        row.appendChild(del);

        fragment.appendChild(row);
      });
    }

    els.list.replaceChildren(fragment);
    updateCounts();
  }

  function scrollToEnd() {
    if (!els.list) return;
    requestAnimationFrame(function () {
      els.list.scrollTop = els.list.scrollHeight;
    });
  }

  function updateCounts() {
    const n = names.length;
    const label = n + (n === 1 ? " entry" : " entries");
    if (els.count) els.count.textContent = label;
    if (els.pill) els.pill.textContent = label;
  }

  function notify(reason) {
    updateCounts();
    try {
      onChange(reason);
    } catch (err) {
      /* keep UI resilient */
    }
  }

  function setDisabled(value) {
    locked = Boolean(value);
    if (els.panel) els.panel.classList.toggle("is-locked", locked);
    if (els.input) els.input.disabled = locked;
    if (els.addBtn) els.addBtn.disabled = locked;
    if (els.clearBtn) els.clearBtn.disabled = locked;

    if (!els.list) return;
    const fields = els.list.querySelectorAll("input, button");
    for (let i = 0; i < fields.length; i += 1) {
      fields[i].disabled = locked;
    }
  }

  function focusAddInput() {
    if (els.input && !locked) els.input.focus();
  }

  window.Spinora = window.Spinora || {};
  window.Spinora.names = {
    init: init,
    mount: mount,
    getNames: getNames,
    count: count,
    addMany: addMany,
    removeAt: removeAt,
    restoreAt: restoreAt,
    replaceAll: replaceAll,
    clear: clear,
    setDisabled: setDisabled,
    focusAddInput: focusAddInput,
  };
})();
