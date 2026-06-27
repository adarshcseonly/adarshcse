/* =========================================================
   app.js — application controller
   Wires modules together, handles view routing + niceties.
   ========================================================= */

const App = (() => {
  let toastTimer = null;

  /* ---------- view routing ---------- */
  const views = ["intro", "menu", "tracker", "pattern", "mains"];
  function show(view) {
    views.forEach((v) =>
      document.getElementById(`view-${v}`).classList.toggle("is-active", v === view));
    window.scrollTo({ top: 0 });
  }

  /* ---------- name propagation ---------- */
  function setName(name) {
    const display = name || "Adarsh";
    // introName is fixed to "Adarsh" on the welcome screen; only menu/tracker update
    ["menuName", "trackerName"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = display;
    });
  }

  /* ---------- toast ---------- */
  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("is-visible"), 2600);
  }

  /* ---------- auth flow ---------- */
  function onLogin(user) {
    sessionStorage.setItem("upsc.authenticated", "1");
    setName(user.name);
    Tracker.renderAll();
    show("menu");
    toast(`Welcome, ${user.name.split(" ")[0]} 👋`);
  }
  function logout() {
    sessionStorage.removeItem("upsc.authenticated");
    Store.clearUser();
    show("intro");
  }

  /* ---------- scroll to top ---------- */
  function initScrollTop() {
    const btn = document.getElementById("scrollTop");
    window.addEventListener("scroll", () => {
      btn.classList.toggle("is-visible", window.scrollY > 400);
    });
    btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  /* ---------- keyboard shortcuts ---------- */
  function initShortcuts() {
    document.addEventListener("keydown", (e) => {
      // ignore while typing
      const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
      if (e.key === "Escape") {
        if (document.getElementById("modalBackdrop").classList.contains("is-open")) Popup.close();
      }
      if (typing) return;
      if (e.key === "t" || e.key === "T") Theme.toggle();
      if (e.key === "/") {
        const search = document.getElementById("subjectSearch");
        if (document.getElementById("view-tracker").classList.contains("is-active")) {
          e.preventDefault(); search.focus();
        }
      }
    });
  }

  /* ---------- menu module cards ---------- */
  function initMenu() {
    document.getElementById("menuGrid").addEventListener("click", (e) => {
      const card = e.target.closest(".module-card");
      if (!card || card.classList.contains("module-card--soon")) return;
      const mod = card.dataset.module;
      if (mod === "tracker") {
        Tracker.renderAll();
        show("tracker");
        return;
      }
      // Syllabus / About / Mains / Interview open as popups
      Menu.handleCard(mod);
    });
    document.getElementById("logoutBtn").addEventListener("click", logout);
    document.getElementById("backToMenu").addEventListener("click", () => show("menu"));
  }

  /* ---------- boot ---------- */
  let _booted = false;
  function init() {
    if (_booted) return;
    _booted = true;
    Theme.init();
    ConfirmDialog.init();

    Tracker.init();
    Popup.init();
    Login.init();
    Menu.init();
    Pattern.init();
    Prelims.init();
    Mains.init();
    if (typeof Subtopics !== "undefined") Subtopics.init();
    if (typeof Backup !== "undefined") Backup.init();
    initMenu();
    initScrollTop();
    initShortcuts();

    // resume session if remembered
    const user = Store.getUser();
    const authenticated = sessionStorage.getItem("upsc.authenticated") === "1";
    if (user && user.remember && authenticated) {
      setName(user.name);
      Tracker.renderAll();
      show("menu");
    } else {
      if (user) setName(user.name);
      show("intro");
    }
  }

  return { init, show, toast, onLogin, setName };
})();

document.addEventListener("DOMContentLoaded", App.init);
