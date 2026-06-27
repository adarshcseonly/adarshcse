/* =========================================================
   storage.js — data persistence layer
   All reads/writes go through Store, so swapping localStorage
   for Firebase/Supabase later means editing only this file.
   ========================================================= */

const Store = (() => {
  const KEYS = {
    user: "upsc.user",
    subjects: "upsc.subjects",
    theme: "upsc.theme",
    activity: "upsc.activity", // { 'YYYY-MM-DD': count }
    seedVersion: "upsc.seedVersion",
  };

  // Bump this when DEFAULT_SUBJECTS chapter lists change so existing
  // installs re-sync chapter lists (completion status preserved by title).
  const SEED_VERSION = 2;

  let _id = 1;
  const uid = () => `c${Date.now().toString(36)}${(_id++).toString(36)}`;

  const read = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn("Store.read failed", key, e);
      return fallback;
    }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { console.warn("Store.write failed", key, e); }
  };

  /* ---- user ---- */
  const getUser = () => read(KEYS.user, null);
  const setUser = (user) => write(KEYS.user, user);
  const clearUser = () => localStorage.removeItem(KEYS.user);

  /* ---- subjects ---- */
  function seedSubjects() {
    const subjects = DEFAULT_SUBJECTS.map((s, i) => ({
      id: uid(),
      name: s.name,
      emoji: s.emoji,
      order: i,
      chapters: s.chapters.map((title) => ({
        id: uid(),
        title,
        done: false,
        createdAt: Date.now(),
      })),
    }));
    write(KEYS.subjects, subjects);
    return subjects;
  }

  const getSubjects = () => {
    const existing = read(KEYS.subjects, null);
    if (!existing) { write(KEYS.seedVersion, SEED_VERSION); return seedSubjects(); }
    const ver = read(KEYS.seedVersion, 1);
    if (ver < SEED_VERSION) {
      const migrated = migrateChapters(existing);
      write(KEYS.subjects, migrated);
      write(KEYS.seedVersion, SEED_VERSION);
      return migrated;
    }
    return existing;
  };

  // Re-sync chapter lists for seeded subjects to match DEFAULT_SUBJECTS,
  // preserving done/completedAt for chapters whose title still exists.
  function migrateChapters(existing) {
    const seedByName = {};
    DEFAULT_SUBJECTS.forEach((s) => { seedByName[s.name] = s; });
    return existing.map((subj) => {
      const seed = seedByName[subj.name];
      if (!seed) return subj; // not a seeded subject → leave untouched
      const oldByTitle = {};
      (subj.chapters || []).forEach((c) => { oldByTitle[c.title] = c; });
      const newChapters = seed.chapters.map((title) => {
        const prev = oldByTitle[title];
        if (prev) {
          return { id: prev.id, title, done: !!prev.done,
            completedAt: prev.completedAt || null, createdAt: prev.createdAt || Date.now() };
        }
        return { id: uid(), title, done: false, completedAt: null, createdAt: Date.now() };
      });
      return { ...subj, chapters: newChapters };
    });
  }
  const setSubjects = (subjects) => write(KEYS.subjects, subjects);

  /* ---- theme ---- */
  const getTheme = () => read(KEYS.theme, "dark");
  const setTheme = (t) => write(KEYS.theme, t);

  /* ---- activity (for streak + today/week/month) ---- */
  const todayKey = () => new Date().toISOString().slice(0, 10);
  const getActivity = () => read(KEYS.activity, {});
  const bumpActivity = (delta = 1) => {
    const a = getActivity();
    const k = todayKey();
    a[k] = Math.max(0, (a[k] || 0) + delta);
    write(KEYS.activity, a);
    return a;
  };

  /* ---- export / import ---- */
  const exportAll = () => ({
    user: getUser(),
    subjects: getSubjects(),
    activity: getActivity(),
    exportedAt: new Date().toISOString(),
  });
  const importAll = (data) => {
    if (data.subjects) setSubjects(data.subjects);
    if (data.activity) write(KEYS.activity, data.activity);
    if (data.user) setUser(data.user);
  };

  return {
    uid, getUser, setUser, clearUser,
    getSubjects, setSubjects,
    getTheme, setTheme,
    getActivity, bumpActivity, todayKey,
    exportAll, importAll,
  };
})();
