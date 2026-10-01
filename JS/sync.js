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

   Load order — put it right after the Supabase CDN tag, BEFORE script.js:
     <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
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
  const RELOAD_COOLDOWN = 15000; // never reload twice within 15 s

  // Look and feel: follows the account, but stays on this device after sign-out.
  const SHARED_KEYS = ["uniai_settings_v2", "uniai-theme", "theme"];

  // Personal progress/data: removed from the browser on sign-out so the next
  // person on a shared computer doesn't see it.
  const PERSONAL_KEYS = [
    "roadmapProgress", // road.js
    "studyAbroadChecklist", // guide.js
    "uniAIConversation", // script.js chat
    "uniai-sop-studio" // sop.js drafts
  ];

  const SYNC_KEYS = new Set(SHARED_KEYS.concat(PERSONAL_KEYS));

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
  let booting = true;
  setTimeout(() => (booting = false), 6000); // fail-safe
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

    // Ignore start-up writes and writes that don't change anything.
    if (watched && !booting && before !== String(value)) markDirty(key);
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
      writeMeta(meta);
    } finally {
      applying = false;
    }
  }

  /**
   * Compare this browser with the account, key by key:
   *   identical                          -> nothing
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

    const meta = readMeta();
    const toApply = [];
    const toPush = [];

    SYNC_KEYS.forEach((key) => {
      const remote = cloud.get(key);
      const local = ls.getItem(key);
      const localTs = meta[key] || 0;

      if (remote && local === remote.value) {
        meta[key] = remote.ts;
      } else if (remote && (local === null || localTs <= remote.ts)) {
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
    status: () => ({ signedIn: Boolean(userId), synced: syncedFor === userId && Boolean(userId), pending: Array.from(dirty) })
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();