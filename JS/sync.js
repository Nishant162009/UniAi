/* ==========================================================================
   UniAI — Account sync (sync.js)

   Problem this solves
   -------------------
   localStorage is per browser AND per origin. 127.0.0.1:5500 (Live Server),
   localhost:5000 (Node) and Chrome vs Edge are all separate stores, so the same
   account showed a different theme, roadmap, checklist, saved jobs, chat, etc.

   What it does
   ------------
   Mirrors a fixed list of localStorage keys to the signed-in user's row set in
   Supabase (table `user_data`, one row per key, protected by RLS) and pulls
   them on sign-in. No other file needs editing: it watches localStorage writes
   for those keys automatically.

   Changes in this version
   -----------------------
   1. Guest -> account MERGE. Guests now get free chat / roadmap previews. If a
      guest used them and then signs in to an account that already has data,
      the old "newest copy wins" rule would silently overwrite the account's
      chats and progress with the guest's. On the first sign-in of a browser
      that has no owner yet, chats are merged by chat id and roadmap /
      checklist ticks are OR-ed together instead.
   2. Edits made in the first seconds after page load are no longer dropped.
      The start-up guard (which exists to ignore other scripts re-saving the
      theme) now stops as soon as the person actually interacts.
   3. LOCAL_ONLY_KEYS: financial inputs (cost / currency insights), activity
      and quest rewards are never uploaded, but ARE removed on sign-out so
      the next person on a shared computer does not see them.
   4. Streak / daily quest state (profile-editor.js) now follow the account.

   Load order — put it right after the Supabase CDN tag, BEFORE script.js:
     <script src="https://unpkg.com/@supabase/supabase-js@2.117.2/dist/umd/supabase.js" ...></script>
     <script src="JS/sync.js"></script>
     <script src="JS/script.js"></script>
     ...

   Not handled here (they already sync themselves elsewhere):
     uniai-preferences    -> preferences.js  (Supabase user_metadata)
     uniai-saved-items    -> save.js         (Supabase table saved_items)
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------------
     Config
     ------------------------------------------------------------------------ */

  const TABLE = "user_data";

  const META_KEY = "uniai-sync-meta"; // { key: lastChangedMs }
  const OWNER_KEY = "uniai-sync-owner"; // account the local copy belongs to
  const RELOAD_FLAG = "uniai-sync-reloaded"; // sessionStorage loop guard

  const PUSH_DELAY = 1500; // ms to batch rapid changes (e.g. chat messages)
  const MAX_VALUE_CHARS = 900 * 1024; // skip absurdly large values
  const MERGED_CHAT_CHARS = 850 * 1024; // merged chat store is trimmed to this
  const MAX_CHATS = 60; // same cap as script.js CHAT_LIMITS.chats
  const RELOAD_COOLDOWN = 15000; // never reload twice within 15 s

  // Look and feel: follows the account, but stays on this device after sign-out.
  const SHARED_KEYS = ["uniai_settings_v2", "uniai-theme", "theme"];

  // Personal progress/data: synced to the account AND removed from the browser
  // on sign-out so the next person on a shared computer doesn't see it.
  const PERSONAL_KEYS = [
    "roadmapProgress", // road.js
    "studyAbroadChecklist", // guide.js
    "uniAIChats", // script.js chat history (all saved chats)
    "uniAIConversation", // legacy single chat, imported once into uniAIChats
    "uniai-sop-studio", // sop.js drafts
    "uniai-streak", // profile-editor.js
    "uniai-daily" // profile-editor.js
  ];

  // Never uploaded, but removed on sign-out (exact keys and key prefixes).
  const LOCAL_ONLY_KEYS = [
    "uniai-cost-insights", // cost-insights.js (savings, income...)
    "uniai-fx-insights", // currency-insights.js
    "uniai-activity", // workspace recent activity
    "uniai-shortlist", // legacy shortlist mirror
    "aiSavedJobs", // legacy AI Free job saves (aifree.js)
    "uniai-last-active" // idle timer stamp (security.js)
  ];
  const LOCAL_ONLY_PREFIXES = ["uniai-quest-rewards:"];

  const SYNC_KEYS = new Set(SHARED_KEYS.concat(PERSONAL_KEYS));

  /* ------------------------------------------------------------------------
     Merge rules (used only for the first sign-in of a browser with no owner)
     ------------------------------------------------------------------------ */

  function parse(text) {
    try {
      return JSON.parse(text);
    } catch (err) {
      return null;
    }
  }

  const isPlainObject = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

  /** Roadmap / checklist ticks: a box is ticked if it is ticked on either side. */
  function mergeFlags(localText, remoteText) {
    const a = parse(localText);
    const b = parse(remoteText);

    if (Array.isArray(a) && Array.isArray(b)) {
      const n = Math.max(a.length, b.length);
      return JSON.stringify(Array.from({ length: n }, (_, i) => Boolean(a[i] || b[i])));
    }

    if (isPlainObject(a) && isPlainObject(b)) {
      const out = {};
      new Set(Object.keys(a).concat(Object.keys(b))).forEach((k) => {
        out[k] = Boolean(a[k] || b[k]);
      });
      return JSON.stringify(out);
    }

    return null; // shapes differ: caller falls back to newest-wins
  }

  /** Chats: union by id; for the same id keep the side that was updated last. */
  function mergeChats(localText, remoteText) {
    const a = parse(localText);
    const b = parse(remoteText);

    if (!isPlainObject(a) || !isPlainObject(b) || !Array.isArray(a.chats) || !Array.isArray(b.chats)) {
      return null;
    }

    const byId = new Map();

    b.chats.concat(a.chats).forEach((chat) => {
      if (!chat || typeof chat.id !== "string") return;
      const have = byId.get(chat.id);
      const newer = (Number(chat.updatedAt) || 0) >= (Number(have && have.updatedAt) || 0);
      if (!have || newer) byId.set(chat.id, chat);
    });

    let chats = Array.from(byId.values()).sort(
      (x, y) => (Number(y.updatedAt) || 0) - (Number(x.updatedAt) || 0)
    );
    chats = chats.slice(0, MAX_CHATS);

    const ids = new Set(chats.map((c) => c.id));
    const activeId = ids.has(a.activeId) ? a.activeId : ids.has(b.activeId) ? b.activeId : null;

    const build = () =>
      JSON.stringify({
        version: 1,
        activeId,
        legacyMigrated: Boolean(a.legacyMigrated || b.legacyMigrated),
        chats
      });

    let json = build();
    while (json.length > MERGED_CHAT_CHARS && chats.length > 1) {
      chats.pop(); // drop the oldest
      json = build();
    }

    return json;
  }

  const MERGE = {
    uniAIChats: mergeChats,
    roadmapProgress: mergeFlags,
    studyAbroadChecklist: mergeFlags
  };

  /* ------------------------------------------------------------------------
     Storage access (bail out quietly if storage is blocked)
     ------------------------------------------------------------------------ */

  let ls = null;
  try {
    ls = window.localStorage;
    ls.getItem("uniai-sync-probe");
  } catch (err) {
    return;
  }

  const nativeSet = Storage.prototype.setItem;
  const nativeRemove = Storage.prototype.removeItem;

  let applying = false; // true while WE write, so we don't echo our own writes

  // Other scripts write to storage while the page starts up (e.g. settings.js
  // re-saves the current theme on every load). Those are not user changes, and
  // must not be stamped "new" or they would overwrite the account's copy.
  // The guard ends after a few seconds OR the moment the person interacts, so a
  // real edit made right after load is never ignored.
  let booting = true;
  let userActive = false;
  setTimeout(() => (booting = false), 6000); // fail-safe

  ["pointerdown", "keydown", "change", "input"].forEach((name) =>
    window.addEventListener(
      name,
      () => {
        userActive = true;
      },
      { capture: true, passive: true, once: true }
    )
  );

  let userId = null;
  let syncedFor = null;
  let timer = null;
  const dirty = new Set();

  function readMeta() {
    try {
      return JSON.parse(ls.getItem(META_KEY) || "{}") || {};
    } catch (err) {
      return {};
    }
  }

  function writeMeta(meta) {
    try {
      nativeSet.call(ls, META_KEY, JSON.stringify(meta));
    } catch (err) {
      /* ignore */
    }
  }

  function readOwner() {
    try {
      return ls.getItem(OWNER_KEY);
    } catch (err) {
      return null;
    }
  }

  function writeOwner(uid) {
    try {
      if (uid) nativeSet.call(ls, OWNER_KEY, uid);
      else nativeRemove.call(ls, OWNER_KEY);
    } catch (err) {
      /* ignore */
    }
  }

  /* ------------------------------------------------------------------------
     Watch writes to the synced keys (no changes needed in other files)
     ------------------------------------------------------------------------ */

  Storage.prototype.setItem = function (key, value) {
    const watched = this === ls && !applying && SYNC_KEYS.has(key);
    const before = watched ? ls.getItem(key) : null;

    nativeSet.call(this, key, value);

    // Ignore start-up writes (until the person interacts) and no-op writes.
    if (watched && (!booting || userActive) && before !== String(value)) markDirty(key);
  };

  // removeItem is deliberately NOT mirrored. Settings → "Clear local data"
  // says it only clears this browser; it must never delete the account copy.

  function markDirty(key) {
    const meta = readMeta();
    meta[key] = Date.now();
    writeMeta(meta);

    dirty.add(key);
    schedulePush();
  }

  function schedulePush() {
    if (!userId) return; // guest: reconciled at the next sign-in
    clearTimeout(timer);
    timer = setTimeout(() => pushKeys(Array.from(dirty)), PUSH_DELAY);
  }

  /* ------------------------------------------------------------------------
     Cloud helpers
     ------------------------------------------------------------------------ */

  const client = () => window.supabaseApp || null;

  async function pushKeys(keys) {
    const db = client();
    if (!db || !userId || !keys.length) return;

    const meta = readMeta();
    const rows = [];

    keys.forEach((key) => {
      const value = ls.getItem(key);

      if (value === null) {
        dirty.delete(key);
        return;
      }

      if (value.length > MAX_VALUE_CHARS) {
        console.warn(`UniAI sync: "${key}" is too large to sync, skipping.`);
        dirty.delete(key);
        return;
      }

      rows.push({
        user_id: userId,
        key,
        value, // stored as a JSON string
        updated_at: new Date(meta[key] || Date.now()).toISOString()
      });
    });

    if (!rows.length) return;

    try {
      const { error } = await db
        .from(TABLE)
        .upsert(rows, { onConflict: "user_id,key" });
      if (error) throw error;

      rows.forEach((r) => dirty.delete(r.key));
    } catch (err) {
      // Stays in `dirty`; retried on the next change, sync or tab hide.
      console.warn("UniAI sync: could not save to your account yet.", err);
    }
  }

  function reloadOnce() {
    try {
      const last = Number(sessionStorage.getItem(RELOAD_FLAG) || 0);
      if (Date.now() - last < RELOAD_COOLDOWN) return;
      sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
    } catch (err) {
      return; // can't guard against a loop, so don't risk one
    }
    window.location.reload();
  }

  function wipePersonal() {
    applying = true;
    try {
      const meta = readMeta();

      PERSONAL_KEYS.forEach((key) => {
        nativeRemove.call(ls, key);
        delete meta[key];
        dirty.delete(key);
      });

      LOCAL_ONLY_KEYS.forEach((key) => nativeRemove.call(ls, key));

      Object.keys(ls)
        .filter((key) => LOCAL_ONLY_PREFIXES.some((p) => key.indexOf(p) === 0))
        .forEach((key) => nativeRemove.call(ls, key));

      writeMeta(meta);
    } finally {
      applying = false;
    }
  }

  /**
   * Compare this browser with the account, key by key:
   *   identical                            -> nothing
   *   first sign-in of an owner-less browser and the key is mergeable
   *                                        -> merge both sides, keep and upload the result
   *   account newer, or never touched here -> take the account's value
   *   this browser newer, or account has none -> upload this browser's value
   */
  async function reconcile(uid) {
    const db = client();
    if (!db) return;

    const { data, error } = await db
      .from(TABLE)
      .select("key, value, updated_at")
      .eq("user_id", uid);

    if (error) throw error;
    if (uid !== userId) return; // account changed while loading

    const cloud = new Map();
    (data || []).forEach((row) => {
      if (SYNC_KEYS.has(row.key) && typeof row.value === "string") {
        cloud.set(row.key, { value: row.value, ts: Date.parse(row.updated_at) || 0 });
      }
    });

    // A browser with no owner is a guest browser (or pre-sync). Its local data
    // belongs to whoever signs in now, so combine it with the account's data.
    const firstClaim = !readOwner();

    const meta = readMeta();
    const toApply = [];
    const toPush = [];
    const toMerge = new Map();

    SYNC_KEYS.forEach((key) => {
      const remote = cloud.get(key);
      const local = ls.getItem(key);
      const localTs = meta[key] || 0;

      if (remote && local === remote.value) {
        meta[key] = remote.ts;
        return;
      }

      if (remote && local !== null && firstClaim && MERGE[key]) {
        const merged = MERGE[key](local, remote.value);
        if (merged !== null) {
          toMerge.set(key, merged);
          return;
        }
      }

      if (remote && (local === null || localTs <= remote.ts)) {
        toApply.push(key);
      } else if (local !== null) {
        if (!meta[key]) meta[key] = Date.now();
        toPush.push(key);
      }
    });

    applying = true;
    try {
      toApply.forEach((key) => {
        const remote = cloud.get(key);
        nativeSet.call(ls, key, remote.value);
        meta[key] = remote.ts;
      });

      toMerge.forEach((merged, key) => {
        nativeSet.call(ls, key, merged);
        meta[key] = Date.now();
        toApply.push(key); // the page must reload to show the merged copy
        toPush.push(key); // and the account must receive it
      });
    } finally {
      applying = false;
    }

    writeMeta(meta);
    writeOwner(uid);
    syncedFor = uid;
    booting = false;

    if (toPush.length) {
      toPush.forEach((key) => dirty.add(key));
      await pushKeys(toPush);
    }

    window.dispatchEvent(
      new CustomEvent("uniai:sync", { detail: { applied: toApply, pushed: toPush } })
    );

    // Every module reads localStorage once at startup, so one refresh is the
    // reliable way to make them all show the account's data.
    if (toApply.length) reloadOnce();
  }

  /* ------------------------------------------------------------------------
     Auth
     ------------------------------------------------------------------------ */

  function handleSession(session) {
    const uid = session && session.user ? session.user.id : null;

    if (!uid) {
      userId = null;
      syncedFor = null;
      booting = false;

      // Was signed in on this browser before -> clear personal data and reset.
      if (readOwner()) {
        wipePersonal();
        writeOwner(null);
        reloadOnce();
      }
      return;
    }

    if (uid === userId && syncedFor === uid) return; // duplicate token events

    const owner = readOwner();

    // The local copy belongs to a different account: don't mix the two.
    if (owner && owner !== uid) wipePersonal();

    userId = uid;

    reconcile(uid).catch((err) => {
      console.warn(
        "UniAI sync: could not sync with your account. " +
          "Did you create the `user_data` table? Your data stays on this browser for now.",
        err
      );
    });
  }

  let attempts = 0;

  function start() {
    const db = client();

    if (!db) {
      // script.js creates window.supabaseApp a moment after page load.
      if (attempts++ < 40) setTimeout(start, 250);
      return;
    }

    db.auth.onAuthStateChange((_event, session) => {
      // Never call Supabase from inside this callback directly.
      setTimeout(() => handleSession(session), 0);
    });

    db.auth
      .getSession()
      .then(({ data }) => handleSession(data && data.session))
      .catch(() => {});
  }

  function flushNow() {
    if (!dirty.size) return;
    clearTimeout(timer);
    pushKeys(Array.from(dirty));
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushNow();
  });
  window.addEventListener("pagehide", flushNow);

  /* ------------------------------------------------------------------------
     Public API
     ------------------------------------------------------------------------ */

  window.UniAISync = {
    keys: Array.from(SYNC_KEYS),
    syncNow: () => (userId ? reconcile(userId) : Promise.resolve()),
    status: () => ({
      signedIn: Boolean(userId),
      synced: syncedFor === userId && Boolean(userId),
      pending: Array.from(dirty)
    }),
    // exposed for tests
    _merge: { chats: mergeChats, flags: mergeFlags }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();