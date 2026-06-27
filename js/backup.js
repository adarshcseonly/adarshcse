/* =========================================================
   backup.js — Export / Import all app data (manual sync)
   Exports every upsc.* localStorage key into one JSON file.
   Import replaces local data with the file's snapshot, then
   refreshes the app. Tracks last export/import timestamps.
   ========================================================= */

const Backup = (() => {
  const PREFIX = "upsc.";
  const EXPORT_STAMP = "upsc.lastExport"; // stored locally (not part of synced data)
  const IMPORT_STAMP = "upsc.lastImport";
  const APP_TAG = "CSE-Tracker";
  const LEGACY_TAGS = ["UPSC-CSE-Tracker"]; // accept older backups too

  /* ---------- date format ---------- */
  function fmt(ts) {
    if (!ts) return "—";
    const d = new Date(ts);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    let h = d.getHours(); const m = String(d.getMinutes()).padStart(2,"0");
    const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
    return `${String(d.getDate()).padStart(2,"0")} ${months[d.getMonth()]} ${d.getFullYear()}, ${String(h).padStart(2,"0")}:${m} ${ap}`;
  }

  function renderStamps() {
    const ex = document.getElementById("lastExportStamp");
    const im = document.getElementById("lastImportStamp");
    if (ex) ex.textContent = fmt(parseInt(localStorage.getItem(EXPORT_STAMP), 10) || 0);
    if (im) im.textContent = fmt(parseInt(localStorage.getItem(IMPORT_STAMP), 10) || 0);
  }

  /* ---------- collect all upsc.* data ---------- */
  function collectData() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      // include all upsc.* keys EXCEPT the local-only stamps
      if (k && k.startsWith(PREFIX) && k !== EXPORT_STAMP && k !== IMPORT_STAMP) {
        data[k] = localStorage.getItem(k);
      }
    }
    return data;
  }

  /* ---------- export ---------- */
  function exportData() {
    const payload = {
      app: APP_TAG,
      version: 1,
      exportedAt: Date.now(),
      data: collectData(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}-${String(d.getHours()).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `cse-tracker-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    localStorage.setItem(EXPORT_STAMP, String(Date.now()));
    renderStamps();
    if (typeof App !== "undefined" && App.toast) App.toast("Backup exported");
  }

  /* ---------- import ---------- */
  function importFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      let parsed;
      try { parsed = JSON.parse(e.target.result); } catch {
        ConfirmDialog.open({ title: "Invalid file", message: "This file isn't a valid backup (couldn't read JSON).", confirmLabel: "OK", onConfirm: () => {} });
        return;
      }
      if (!parsed || (parsed.app !== APP_TAG && !LEGACY_TAGS.includes(parsed.app)) || !parsed.data) {
        ConfirmDialog.open({ title: "Invalid file", message: "This doesn't look like a CSE Tracker backup file.", confirmLabel: "OK", onConfirm: () => {} });
        return;
      }
      const keys = Object.keys(parsed.data);
      const whenStr = parsed.exportedAt ? fmt(parsed.exportedAt) : "unknown date";
      ConfirmDialog.open({
        title: "Import this backup?",
        message: `This will replace your current data on this device with the backup (${keys.length} items, exported ${whenStr}). This cannot be undone. Continue?`,
        confirmLabel: "⬆ Import",
        onConfirm: () => applyImport(parsed.data),
      });
    };
    reader.readAsText(file);
  }

  function applyImport(data) {
    // remove existing upsc.* data keys (keep the local stamps)
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX) && k !== EXPORT_STAMP && k !== IMPORT_STAMP) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
    // write imported keys
    Object.keys(data).forEach((k) => {
      if (k.startsWith(PREFIX)) localStorage.setItem(k, data[k]);
    });
    localStorage.setItem(IMPORT_STAMP, String(Date.now()));
    renderStamps();
    refreshUI();
    if (typeof App !== "undefined" && App.toast) App.toast("Backup imported");
  }

  /* ---------- refresh visible UI after import ---------- */
  function refreshUI() {
    try {
      // Tracker caches subjects in memory — reload from storage, not just re-render
      if (typeof Tracker !== "undefined" && Tracker.reload) Tracker.reload();
      else if (typeof Tracker !== "undefined" && Tracker.renderAll) Tracker.renderAll();
      if (typeof Prelims !== "undefined") {
        Prelims.renderRevision && Prelims.renderRevision();
        Prelims.renderMock && Prelims.renderMock();
        Prelims.renderCSAT && Prelims.renderCSAT();
      }
      if (typeof Mains !== "undefined" && Mains.onShow) Mains.onShow();
      if (typeof Menu !== "undefined" && Menu.refreshNotes) Menu.refreshNotes();
    } catch (e) { /* non-fatal */ }
  }

  /* ---------- panel open/close ---------- */
  function togglePanel(force) {
    const panel = document.getElementById("backupPanel");
    const open = force !== undefined ? force : panel.hidden;
    panel.hidden = !open;
    document.getElementById("backupWidget").classList.toggle("is-open", open);
    if (open) renderStamps();
  }

  /* ---------- init ---------- */
  function init() {
    renderStamps();
    const toggle = document.getElementById("backupToggle");
    const close = document.getElementById("backupPanelClose");
    if (toggle) toggle.addEventListener("click", () => togglePanel());
    if (close) close.addEventListener("click", () => togglePanel(false));

    const exportBtn = document.getElementById("exportBtn");
    if (exportBtn) exportBtn.addEventListener("click", exportData);

    const importBtn = document.getElementById("importBtn");
    const fileInput = document.getElementById("importFile");
    if (importBtn && fileInput) {
      importBtn.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) importFile(file);
        fileInput.value = ""; // allow re-importing same file
      });
    }
  }

  return { init, exportData, renderStamps };
})();
