/* ==========================================================================
   UniAI — Profile Studio (profile-editor.js)

   A game-style "Edit profile" experience:
     • pick a character + colour (some unlock as you level up)
     • live preview card with level ring, XP, streak and badges
     • profile "quests" that award XP the FIRST time they are completed
     • collectible badges, a recent-achievements trail, level-up celebration
     • chunky 3-D buttons, bounce / shake / confetti feedback

   Install: add as the LAST script in index.html (after settings.js / visa.js,
   and after profilepage.js if you use it):
       <script src="JS/profile-editor.js"></script>

   It takes over window.openEditModal(), so every existing
   onclick="openEditModal()" button opens the new editor. Nothing else to edit.

   Saved to the account (Supabase user_metadata):
       username, profile_type          (already used by the rest of the app)
       avatar_emoji, avatar_color, bio, dream_countries[], degree_goal
       profile_quest_rewards           NEW: { avatar, bio, destination, degree }
                                       booleans, permanent once earned

   XP is real, derived from what the user has actually done:
       roadmap milestone ×100 · guide checklist item ×40 · saved item ×25
       SOP draft started ×150 · each profile quest ×25 (once, ever)
   Streak is counted per browser (localStorage "uniai-streak").
   Quest rewards also keep a per-user local fallback copy
   (localStorage "uniai-quest-rewards:<user id>").
   ========================================================================== */

(function () {
  "use strict";

  if (window.__uniaiProfileStudio) return;
  window.__uniaiProfileStudio = true;

  /* ------------------------------------------------------------------------
     Configuration + data
     ------------------------------------------------------------------------ */

  const LEVEL_XP = 150;
  const QUEST_XP = 25;
  const NAME_MIN = 2;
  const NAME_MAX = 40;
  const BIO_MIN_QUEST = 10;
  const BIO_MAX = 80;
  const MAX_COUNTRIES = 3;
  const RING_C = 339.3; // 2 * PI * r(54)
  const CELEBRATION_MS = 2300;
  const SAVE_CLOSE_MS = 900;

  // `lvl` = level needed to unlock that character.
  const AVATARS = [
    { e: "🦊", lvl: 1, name: "Fox", desc: "Clever and quick on its feet." },
    { e: "🐼", lvl: 1, name: "Panda", desc: "Calm under deadline pressure." },
    { e: "🐸", lvl: 1, name: "Frog", desc: "Leaps at every chance." },
    { e: "🦁", lvl: 1, name: "Lion", desc: "Brave enough to apply anywhere." },
    { e: "🐨", lvl: 1, name: "Koala", desc: "Steady, relaxed, always prepared." },
    { e: "🐙", lvl: 1, name: "Octopus", desc: "Juggles every application at once." },
    { e: "🐧", lvl: 1, name: "Penguin", desc: "Cool in any climate." },
    { e: "🐱", lvl: 1, name: "Cat", desc: "Curious about every campus." },
    { e: "🐶", lvl: 1, name: "Pup", desc: "A loyal study buddy." },
    { e: "🐰", lvl: 1, name: "Rabbit", desc: "A fast learner." },
    { e: "🦉", lvl: 1, name: "Owl", desc: "Wise, and up late revising." },
    { e: "🎓", lvl: 1, name: "Scholar", desc: "Graduation-ready from day one." },
    { e: "🦄", lvl: 2, name: "Unicorn", desc: "One of a kind." },
    { e: "🐲", lvl: 2, name: "Dragon", desc: "Fiery ambition." },
    { e: "🐯", lvl: 2, name: "Tiger", desc: "Fierce focus." },
    { e: "🦋", lvl: 2, name: "Butterfly", desc: "Ready for a big transformation." },
    { e: "🚀", lvl: 2, name: "Rocket", desc: "Aiming high." },
    { e: "🧠", lvl: 2, name: "Big Brain", desc: "Pure thinking power." },
    { e: "⚡", lvl: 3, name: "Spark", desc: "Full of energy." },
    { e: "🔥", lvl: 3, name: "Blaze", desc: "Unstoppable momentum." },
    { e: "🌍", lvl: 3, name: "Globetrotter", desc: "The whole world is home." },
    { e: "🎨", lvl: 3, name: "Creator", desc: "An original thinker." },
    { e: "👑", lvl: 4, name: "Royalty", desc: "Top of the class." },
    { e: "🌟", lvl: 4, name: "Superstar", desc: "Born to shine." }
  ];

  // Colours can also be level-gated through `lvl`; today they are all open.
  const COLORS = [
    { id: "violet", name: "Violet", lvl: 1, css: "linear-gradient(135deg,#9a8bff,#5b4bff)" },
    { id: "pink", name: "Bubblegum", lvl: 1, css: "linear-gradient(135deg,#ff8ac4,#ec4899)" },
    { id: "orange", name: "Sunset", lvl: 1, css: "linear-gradient(135deg,#ffb86b,#ff6b3d)" },
    { id: "gold", name: "Gold", lvl: 1, css: "linear-gradient(135deg,#ffe066,#f5a700)" },
    { id: "green", name: "Lime", lvl: 1, css: "linear-gradient(135deg,#8be05a,#2fb344)" },
    { id: "teal", name: "Lagoon", lvl: 1, css: "linear-gradient(135deg,#5eead4,#0ea5a4)" },
    { id: "blue", name: "Ocean", lvl: 1, css: "linear-gradient(135deg,#6cc4ff,#2563eb)" },
    { id: "night", name: "Midnight", lvl: 1, css: "linear-gradient(135deg,#475569,#0f172a)" }
  ];

  const COUNTRIES = [
    { id: "USA", flag: "🇺🇸" }, { id: "UK", flag: "🇬🇧" }, { id: "Canada", flag: "🇨🇦" },
    { id: "Australia", flag: "🇦🇺" }, { id: "Germany", flag: "🇩🇪" }, { id: "Japan", flag: "🇯🇵" },
    { id: "Netherlands", flag: "🇳🇱" }, { id: "France", flag: "🇫🇷" },
    { id: "Singapore", flag: "🇸🇬" }, { id: "Ireland", flag: "🇮🇪" }
  ];

  const DEGREES = [
    { id: "bachelor", label: "Bachelor's", icon: "📘" },
    { id: "master", label: "Master's", icon: "📗" },
    { id: "phd", label: "PhD", icon: "📙" },
    { id: "unsure", label: "Not sure yet", icon: "🤔" }
  ];

  const ROLES = [
    { id: "student", label: "Student", icon: "🎓", text: "Exploring where to study abroad" },
    { id: "counselor", label: "Counselor", icon: "🧭", text: "Guiding students through admissions" }
  ];

  // The four profile quests. `id` is also the key of the permanent reward.
  const QUESTS = [
    { id: "avatar", icon: "🎭", label: "Pick your character", desc: "Choose an avatar that feels like you.",
      check: (d) => Boolean(d.emoji), hint: () => "Pick any unlocked character." },
    { id: "bio", icon: "✍️", label: "Write a short bio", desc: `At least ${BIO_MIN_QUEST} characters about you.`,
      check: (d) => d.bio.trim().length >= BIO_MIN_QUEST,
      hint: (d) => `${Math.max(0, BIO_MIN_QUEST - d.bio.trim().length)} more characters to go.` },
    { id: "destination", icon: "🌍", label: "Choose a dream destination", desc: `Pick 1–${MAX_COUNTRIES} countries.`,
      check: (d) => d.countries.length > 0, hint: () => "Tap at least one country." },
    { id: "degree", icon: "🎓", label: "Set your degree goal", desc: "Bachelor's, Master's, PhD or not sure.",
      check: (d) => Boolean(d.degree), hint: () => "Choose one degree option." }
  ];

  const colorOf = (id) => COLORS.find((c) => c.id === id) || COLORS[0];
  const gradFor = (id) => colorOf(id).css;

  /* ------------------------------------------------------------------------
     Small helpers
     ------------------------------------------------------------------------ */

  const $ = (id) => document.getElementById(id);

  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

  const reduceMotion = () =>
    Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || `${one}s`}`;

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      /* storage full or blocked: not fatal */
    }
  }

  /** Re-triggers a CSS animation class on a node. */
  function restart(node, cls) {
    if (!node || reduceMotion()) return;
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
  }

  /* ------------------------------------------------------------------------
     XP, level, streak, badges (all derived from real activity)
     ------------------------------------------------------------------------ */

  function activityStats() {
    const list = (k) => {
      const v = readJSON(k, []);
      return Array.isArray(v) ? v : [];
    };

    let sop = 0;
    try {
      const raw = localStorage.getItem("uniai-sop-studio");
      if (raw && raw.length > 20) sop = 1;
    } catch (err) {
      /* ignore */
    }

    return {
      roadmap: list("roadmapProgress").filter(Boolean).length,
      checklist: list("studyAbroadChecklist").filter(Boolean).length,
      saved: list("uniai-saved-items").length,
      sop
    };
  }

  function activityXP(stats) {
    return stats.roadmap * 100 + stats.checklist * 40 + stats.saved * 25 + stats.sop * 150;
  }

  const isoDay = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  /** Counts consecutive days the app was opened. Runs once per day. */
  function touchStreak() {
    const s = readJSON("uniai-streak", { count: 0, best: 0, last: "" });
    const today = isoDay(new Date());

    if (s.last !== today) {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      s.count = s.last === isoDay(y) ? (s.count || 0) + 1 : 1;
      s.best = Math.max(s.best || 0, s.count);
      s.last = today;
      writeJSON("uniai-streak", s);
    }
    return s;
  }

  function levelInfo(totalXP) {
    const level = Math.floor(totalXP / LEVEL_XP) + 1;
    const into = totalXP % LEVEL_XP;
    return { level, into, pct: Math.round((into / LEVEL_XP) * 100) };
  }

  /* ------------------------------------------------------------------------
     Quests + permanent quest rewards
     ------------------------------------------------------------------------ */

  /** Which quests the profile currently satisfies: { avatar: true, ... } */
  function questList(d) {
    return QUESTS.map((q) => ({ id: q.id, label: q.label, done: q.check(d) }));
  }

  const questsDone = (d) => questList(d).filter((q) => q.done).length;

  function doneMap(d) {
    const out = {};
    QUESTS.forEach((q) => {
      if (q.check(d)) out[q.id] = true;
    });
    return out;
  }

  /** Only known quest ids with a literal `true` survive. */
  function sanitizeRewards(raw) {
    const out = {};
    if (raw && typeof raw === "object") {
      QUESTS.forEach((q) => {
        if (raw[q.id] === true) out[q.id] = true;
      });
    }
    return out;
  }

  const mergeRewards = (...maps) => Object.assign({}, ...maps.map(sanitizeRewards));
  const rewardCount = (map) => Object.keys(sanitizeRewards(map)).length;

  const rewardsKey = (uid) => `uniai-quest-rewards:${uid}`;

  /**
   * Rewards earned so far = account copy ∪ this user's local copy.
   * Accounts that predate this system have no stored field; they were already
   * being credited for whatever quests their saved profile satisfied, so
   * that state is grandfathered in once instead of taking XP away.
   */
  function loadRewards(user, savedDraft) {
    const meta = user.user_metadata || {};
    const hasAccountField = meta.profile_quest_rewards && typeof meta.profile_quest_rewards === "object";

    let localRaw = null;
    try {
      localRaw = localStorage.getItem(rewardsKey(user.id));
    } catch (err) {
      /* ignore */
    }

    let rewards = mergeRewards(meta.profile_quest_rewards, localRaw ? readJSON(rewardsKey(user.id), {}) : {});
    if (!hasAccountField && localRaw === null) rewards = mergeRewards(rewards, doneMap(savedDraft));
    return rewards;
  }

  const storeRewardsLocally = (uid, rewards) => writeJSON(rewardsKey(uid), sanitizeRewards(rewards));

  /* ------------------------------------------------------------------------
     Badges + recent achievements (derived from real state only)
     ------------------------------------------------------------------------ */

  function badgeList(stats, streak, d) {
    const streakNow = streak.count || 0;
    const done = questsDone(d);

    return [
      { icon: "🔥", name: "On fire", hint: "Open UniAI 3 days in a row", prog: [Math.min(streakNow, 3), 3], on: streakNow >= 3 },
      { icon: "🗺️", name: "Pathfinder", hint: "Finish a roadmap milestone", prog: [Math.min(stats.roadmap, 1), 1], on: stats.roadmap >= 1 },
      { icon: "⭐", name: "Collector", hint: "Save 3 items", prog: [Math.min(stats.saved, 3), 3], on: stats.saved >= 3 },
      { icon: "✍️", name: "Storyteller", hint: "Start an SOP draft", prog: [Math.min(stats.sop, 1), 1], on: stats.sop >= 1 },
      { icon: "🏅", name: "All set", hint: "Complete every profile quest", prog: [done, QUESTS.length], on: done === QUESTS.length }
    ];
  }

  /** `fresh` is a Set of ids earned during the save that just happened. */
  function activityList(ctx, fresh) {
    const { stats, streak, level, rewards } = ctx;
    const list = [];
    const quests = rewardCount(rewards);
    const avatarsUnlocked = AVATARS.filter((a) => a.lvl > 1 && a.lvl <= level).length;

    if (level > 1) list.push({ id: "level", icon: "🏆", text: `Reached level ${level}` });
    if (quests >= QUESTS.length) list.push({ id: "quests", icon: "✅", text: "All profile quests completed" });
    else if (quests > 0) list.push({ id: "quests", icon: "✅", text: `${quests} of ${QUESTS.length} profile quests completed` });
    if (avatarsUnlocked > 0) list.push({ id: "avatars", icon: "🎭", text: `${plural(avatarsUnlocked, "new avatar")} unlocked` });
    if (stats.roadmap > 0) list.push({ id: "roadmap", icon: "🗺️", text: `${plural(stats.roadmap, "roadmap milestone")} completed` });
    if (stats.checklist > 0) list.push({ id: "checklist", icon: "📋", text: `${plural(stats.checklist, "guide checklist item")} checked off` });
    if (stats.saved > 0) list.push({ id: "saved", icon: "⭐", text: `${plural(stats.saved, "item")} saved${stats.saved >= 3 ? " — Collector badge earned" : ""}` });
    if (stats.sop > 0) list.push({ id: "sop", icon: "✍️", text: "SOP draft started" });
    if ((streak.count || 0) >= 2) list.push({ id: "streak", icon: "🔥", text: `${streak.count}-day streak${(streak.best || 0) > streak.count ? ` (best ${streak.best})` : ""}` });

    list.forEach((a) => {
      a.fresh = fresh.has(a.id);
    });
    list.sort((a, b) => Number(b.fresh) - Number(a.fresh));
    return list.slice(0, 5);
  }

  /* ------------------------------------------------------------------------
     Showing the chosen character everywhere else in the app
     ------------------------------------------------------------------------ */

  let identityUser = null;
  let applying = false;
  const watched = new WeakSet();

  function identityTargets() {
    const list = Array.from(
      document.querySelectorAll(".user-badge .user-avatar, .profile-main-avatar, #settings-account-avatar")
    );
    const acct = $("account-avatar-text");
    if (acct) list.push(acct);
    return list;
  }

  function paintTarget(el, emoji, css) {
    // The settings card keeps its look on a wrapper around the <span>.
    const holder = el.id === "account-avatar-text" ? el.parentElement || el : el;

    if (emoji) {
      el.textContent = emoji;
      holder.style.background = css;
      holder.style.color = "#fff";
      holder.dataset.ueApplied = "1";
    } else if (holder.dataset.ueApplied) {
      holder.style.background = "";
      holder.style.color = "";
      delete holder.dataset.ueApplied;
    }
  }

  function applyIdentity(user) {
    identityUser = user || null;

    const meta = (user && user.user_metadata) || {};
    const emoji = user ? meta.avatar_emoji || "" : "";
    const css = gradFor(meta.avatar_color);

    applying = true;
    identityTargets().forEach((el) => {
      paintTarget(el, emoji, css);

      // Other scripts rewrite these with the plain initial; put the emoji back.
      if (!watched.has(el)) {
        watched.add(el);
        new MutationObserver(() => {
          if (applying || !identityUser) return;
          const m = identityUser.user_metadata || {};
          if (m.avatar_emoji && el.textContent !== m.avatar_emoji) {
            applying = true;
            paintTarget(el, m.avatar_emoji, gradFor(m.avatar_color));
            setTimeout(() => (applying = false), 0);
          }
        }).observe(el, { childList: true, characterData: true, subtree: true });
      }
    });
    setTimeout(() => (applying = false), 0);
  }

  window.addEventListener("uniai:auth-state", (e) => {
    const user = e.detail && e.detail.session ? e.detail.session.user : null;
    setTimeout(() => applyIdentity(user), 0); // after the other scripts repaint
  });

  /* ------------------------------------------------------------------------
     Styles (injected once)
     ------------------------------------------------------------------------ */

  function injectStyles() {
    if ($("ue-styles")) return;

    const style = document.createElement("style");
    style.id = "ue-styles";
    style.textContent = `
.ue-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;
  background:rgba(18,14,48,.58);backdrop-filter:blur(8px);opacity:0;transition:opacity .22s ease;
  font-family:"Plus Jakarta Sans","Inter",system-ui,sans-serif}
.ue-overlay.ue-open{opacity:1}

.ue-modal{--bg:#fff;--card:#fff;--soft:#f4f5fb;--line:#e3e5f1;--text:#1d2142;--muted:#6a6f92;
  --p:#6d5dfb;--pd:#4a3bd6;--pl:#eeebff;--green:#2fb344;--gd:#23903a;--gl:#e6f8ea;
  --orange:#ff8a1f;--ol:#fff1e0;--red:#ef4444;--gold:#f5a700;--goldl:#fff6d6;
  position:relative;width:min(1080px,100%);max-height:min(880px,calc(100dvh - 40px));display:flex;flex-direction:column;
  background:var(--bg);color:var(--text);border-radius:28px;box-shadow:0 30px 80px rgba(20,14,70,.45);
  transform:translateY(24px) scale(.97);transition:transform .32s cubic-bezier(.2,1.2,.3,1);overflow:hidden}
.ue-open .ue-modal{transform:none}
html[data-theme="dark"] .ue-modal{--bg:#14162b;--card:#1c1f3a;--soft:#1a1d36;--line:#2c3050;--text:#f0f2ff;--muted:#9aa0c8;
  --pl:#272456;--gl:#14301f;--ol:#3a2612;--goldl:#3b2f0d}
.ue-notrans{transition:none!important}
.ue-finishing .ue-body{pointer-events:none}

/* ---- progression header ---- */
.ue-top{display:grid;grid-template-columns:auto 1fr auto;grid-template-areas:"t p x";align-items:center;gap:12px 22px;
  padding:16px 22px;border-bottom:2px solid var(--line);background:linear-gradient(180deg,var(--pl),var(--bg) 160%)}
.ue-tt{grid-area:t;min-width:0}
.ue-top h2{margin:0;font-size:1.25rem;font-weight:800;letter-spacing:-.01em}
.ue-top p{margin:2px 0 0;color:var(--muted);font-size:.85rem}
.ue-x{grid-area:x;width:44px;height:44px;border-radius:14px;border:2px solid var(--line);border-bottom-width:4px;
  background:var(--card);color:var(--muted);font-size:1.3rem;cursor:pointer;line-height:1}
.ue-x:hover{color:var(--text)}.ue-x:active{transform:translateY(2px);border-bottom-width:2px}
.ue-prog{grid-area:p;display:flex;gap:10px;align-items:stretch;min-width:0;justify-content:flex-end}
.ue-pg{background:var(--card);border:2px solid var(--line);border-bottom-width:4px;border-radius:14px;padding:6px 12px;
  display:flex;flex-direction:column;justify-content:center;min-width:0}
.ue-pg .k{font-size:.62rem;font-weight:800;letter-spacing:.1em;color:var(--muted);white-space:nowrap}
.ue-pg b{font-size:1.05rem;font-weight:800;line-height:1.15;white-space:nowrap}
.ue-pg.lvl{background:var(--goldl);border-color:var(--gold);align-items:center}
.ue-pg.lvl b{font-size:1.35rem;color:#8a5a00}
html[data-theme="dark"] .ue-pg.lvl b{color:#ffd45a}
.ue-pg.xpg{flex:1 1 150px;max-width:260px}
.ue-pg.xpg .row{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
.ue-pg.xpg .row span:last-child{font-size:.78rem;font-weight:800}
.ue-pg.fire b{color:var(--orange)}
.ue-pg.cmp b{color:var(--p)}
html[data-theme="dark"] .ue-pg.cmp b{color:#b9b1ff}
.ue-pg.bump{animation:ue-bump .5s ease}

.ue-body{display:grid;grid-template-columns:340px 1fr;grid-template-rows:minmax(0,1fr);gap:0;min-height:0;flex:1}
.ue-side{padding:22px;background:var(--soft);border-right:2px solid var(--line);overflow-y:auto;overscroll-behavior:contain}
.ue-main{padding:22px 26px 26px;overflow-y:auto;min-width:0;overscroll-behavior:contain}

/* ---- live preview ---- */
.ue-card{position:relative;background:var(--card);border:2px solid var(--line);border-bottom-width:5px;border-radius:24px;
  padding:0 20px 20px;text-align:center;overflow:hidden;transition:box-shadow .3s ease,transform .3s ease}
.ue-card.ue-emph{animation:ue-emph 1s ease}
.ue-banner{position:relative;height:78px;margin:0 -20px;overflow:hidden;background:#6d5dfb}
.ue-fade{position:absolute;inset:0;opacity:0}
.ue-ringwrap{position:relative;width:132px;height:132px;margin:-46px auto 10px}
.ue-ringwrap:before{content:"";position:absolute;inset:-5px;border-radius:50%;background:var(--card)}
.ue-glow{position:absolute;inset:-2px;border-radius:50%;pointer-events:none;opacity:0;
  box-shadow:0 0 0 4px rgba(245,167,0,.55),0 0 28px 8px rgba(245,167,0,.55)}
.ue-glow.ue-pulse{animation:ue-ringpulse .9s ease-out}
.ue-ring{position:absolute;inset:0;transform:rotate(-90deg)}
.ue-ring circle{fill:none;stroke-width:7;stroke-linecap:round}
.ue-ring .bg{stroke:var(--line)}
.ue-ring .fg{stroke:var(--green);stroke-dasharray:339.3;stroke-dashoffset:339.3;transition:stroke-dashoffset .8s cubic-bezier(.3,1.2,.4,1)}
.ue-avatar{position:absolute;inset:14px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;
  color:#fff;box-shadow:inset 0 -6px 0 rgba(0,0,0,.14)}
.ue-glyph{position:relative;z-index:3;font-size:3.2rem;line-height:1;display:block}
.ue-glyph.letter{font-size:2.6rem;font-weight:800}
.ue-avatar.ue-avpop .ue-glyph{animation:ue-avpop .7s cubic-bezier(.3,1.4,.4,1)}
.ue-lvl{position:absolute;right:-4px;bottom:2px;background:var(--gold);color:#4a3200;font-weight:800;font-size:.72rem;
  padding:4px 9px;border-radius:999px;border:3px solid var(--card);letter-spacing:.04em;z-index:4}
.ue-pname{font-size:1.3rem;font-weight:800;margin:6px 0 4px;overflow-wrap:anywhere}
.ue-tags{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
.ue-prole,.ue-pdeg{display:inline-flex;gap:6px;align-items:center;background:var(--pl);color:var(--p);font-weight:700;font-size:.78rem;
  padding:5px 12px;border-radius:999px}
.ue-pdeg{background:var(--soft);color:var(--muted);border:1px solid var(--line)}
.ue-pdeg[hidden]{display:none}
html[data-theme="dark"] .ue-prole{color:#b9b1ff}
.ue-pbio{color:var(--muted);font-size:.86rem;margin:10px 0 0;min-height:1.2em;overflow-wrap:anywhere}
.ue-pdest{margin-top:8px;font-size:1.3rem;letter-spacing:4px;min-height:1.6rem}
.ue-tick{animation:ue-tick .35s ease}
.ue-pending{margin:12px 0 0;padding:7px 10px;border-radius:12px;background:var(--goldl);color:#8a5a00;font-size:.76rem;font-weight:800;
  border:2px dashed var(--gold)}
html[data-theme="dark"] .ue-pending{color:#ffd45a}
.ue-pending[hidden]{display:none}
.ue-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
.ue-stat{border:2px solid var(--line);border-radius:16px;padding:9px 6px;background:var(--soft)}
.ue-stat b{display:block;font-size:1.15rem;font-weight:800}.ue-stat span{font-size:.7rem;color:var(--muted);font-weight:700;letter-spacing:.06em}
.ue-stat.fire b{color:var(--orange)}.ue-stat.xp b{color:var(--gd)}
html[data-theme="dark"] .ue-stat.xp b{color:#6ee787}
.ue-bump{animation:ue-bump .5s ease}
.ue-xpbar{height:14px;border-radius:999px;background:var(--line);margin-top:14px;overflow:hidden;position:relative}
.ue-xpbar.mini{height:8px;margin-top:5px}
.ue-xpbar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#58d36b,#2fb344);border-radius:999px;
  transition:width .8s cubic-bezier(.3,1.2,.4,1);box-shadow:inset 0 -3px 0 rgba(0,0,0,.12)}
.ue-xptext{display:flex;justify-content:space-between;font-size:.72rem;color:var(--muted);font-weight:700;margin-top:6px}

.ue-h{font-size:.74rem;font-weight:800;letter-spacing:.1em;color:var(--muted);margin:20px 0 8px}
.ue-side>.ue-h:first-child,.ue-preview+.ue-questsec>.ue-h:first-child{margin-top:20px}

/* ---- quests ---- */
.ue-quests{display:flex;flex-direction:column;gap:8px}
.ue-quest{position:relative;display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:16px;background:var(--card);
  border:2px solid var(--line);border-bottom-width:4px;transition:background .3s,border-color .3s}
.ue-quest .qi{width:34px;height:34px;flex-shrink:0;border-radius:11px;background:var(--soft);display:flex;align-items:center;justify-content:center;font-size:1.1rem}
.ue-quest .qt{min-width:0;flex:1}
.ue-quest .qt b{display:block;font-size:.84rem;font-weight:800;line-height:1.2}
.ue-quest .qt small{display:block;color:var(--muted);font-size:.72rem;font-weight:600;margin-top:2px;line-height:1.25}
.ue-quest .qx{font-size:.7rem;font-weight:800;color:var(--muted);white-space:nowrap}
.ue-quest .qc{width:24px;height:24px;flex-shrink:0;border-radius:50%;border:2px solid var(--line);display:flex;align-items:center;justify-content:center}
.ue-quest .qc svg{width:15px;height:15px;fill:none;stroke:#fff;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;
  stroke-dasharray:24;stroke-dashoffset:24}
.ue-quest.done{background:var(--gl);border-color:var(--green)}
.ue-quest.done .qt b,.ue-quest.done .qx{color:var(--gd)}
html[data-theme="dark"] .ue-quest.done .qt b,html[data-theme="dark"] .ue-quest.done .qx{color:#6ee787}
.ue-quest.done .qc{background:var(--green);border-color:var(--green)}
.ue-quest.done .qc svg{stroke-dashoffset:0}
.ue-quest.just{animation:ue-qhi 1.3s ease}
.ue-quest.just .qc{animation:ue-pop .5s ease}
.ue-quest.just .qc svg{animation:ue-check .45s ease .1s both}
.ue-floatxp{position:absolute;right:46px;top:2px;font-weight:800;font-size:.9rem;color:var(--gd);pointer-events:none;z-index:5;
  animation:ue-floatxp 1.2s ease-out forwards}
html[data-theme="dark"] .ue-floatxp{color:#6ee787}

/* ---- completion ---- */
.ue-complete{background:var(--soft);border:2px solid var(--line);border-radius:18px;padding:12px 14px;margin-bottom:20px}
.ue-complete .ch{display:flex;justify-content:space-between;align-items:baseline;font-size:.74rem;font-weight:800;letter-spacing:.1em;color:var(--muted)}
.ue-complete .ch #ue-cpct{font-size:1.05rem;letter-spacing:0;color:var(--p)}
html[data-theme="dark"] .ue-complete .ch #ue-cpct{color:#b9b1ff}
.ue-segs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px}
.ue-segs i{height:12px;border-radius:6px;background:var(--line);transition:background .35s,transform .35s}
.ue-segs i.on{background:linear-gradient(90deg,#58d36b,#2fb344);transform:scaleY(1.15)}

/* ---- badges ---- */
.ue-badges{display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:8px}
.ue-badge{position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 4px 8px;min-height:68px;
  border-radius:16px;background:var(--card);border:2px solid var(--line);border-bottom-width:4px;color:var(--text);font:inherit;cursor:pointer;
  transition:transform .15s,border-color .2s}
.ue-badge:hover,.ue-badge:focus-visible{transform:translateY(-2px)}
.ue-badge:active{transform:translateY(1px)}
.ue-badge .bi{font-size:1.5rem;line-height:1}
.ue-badge .bn{font-size:.62rem;font-weight:800;color:var(--muted);line-height:1.1;text-align:center}
.ue-badge .bl{position:absolute;right:5px;top:3px;font-size:.62rem}
.ue-badge:not(.off){border-color:var(--gold);background:var(--goldl)}
.ue-badge:not(.off) .bn{color:#8a5a00}
html[data-theme="dark"] .ue-badge:not(.off) .bn{color:#ffd45a}
.ue-badge:not(.off):after{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.65) 50%,transparent 65%);
  transform:translateX(-120%);transition:transform .7s ease}
.ue-badge:not(.off):hover:after,.ue-badge:not(.off):focus-visible:after,.ue-badge.pop:after{transform:translateX(120%)}
.ue-badge.off .bi{filter:grayscale(1);opacity:.4}
.ue-badge.off .bn{opacity:.75}
.ue-badge.pop{animation:ue-pop .4s ease}
.ue-bdetail{margin-top:8px;min-height:2.6em;font-size:.78rem;font-weight:700;color:var(--muted);line-height:1.35}
.ue-bdetail b{color:var(--text)}

/* ---- activity ---- */
.ue-act{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.ue-act li{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:14px;background:var(--card);border:2px solid var(--line);
  font-size:.8rem;font-weight:700;line-height:1.25}
.ue-act .ai{width:26px;height:26px;border-radius:9px;background:var(--soft);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:.9rem}
.ue-act .new{margin-left:auto;font-size:.6rem;font-weight:800;letter-spacing:.08em;color:#fff;background:var(--green);padding:2px 7px;border-radius:999px}
.ue-act.empty{padding:12px;border:2px dashed var(--line);border-radius:14px;color:var(--muted);font-size:.8rem;font-weight:600;line-height:1.4}

/* ---- mascot bubble ---- */
.ue-say{display:flex;gap:12px;align-items:flex-start;margin-bottom:18px}
.ue-say .face{width:54px;height:54px;flex-shrink:0;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:1.9rem;
  background:var(--pl);border:2px solid var(--line);border-bottom-width:4px}
.ue-bubble{position:relative;background:var(--card);border:2px solid var(--line);border-radius:18px;padding:12px 16px;font-weight:700;font-size:.95rem;line-height:1.35}
.ue-bubble:before{content:"";position:absolute;left:-9px;top:18px;width:14px;height:14px;background:var(--card);
  border-left:2px solid var(--line);border-bottom:2px solid var(--line);transform:rotate(45deg)}
.ue-bubble.pop{animation:ue-bub .35s ease}

/* ---- sections ---- */
.ue-sec{margin-bottom:28px}
.ue-sec>h3{display:flex;align-items:center;gap:10px;margin:0 0 12px;font-size:1.05rem;font-weight:800}
.ue-sec>h3 .n{width:28px;height:28px;border-radius:10px;background:var(--p);color:#fff;font-size:.85rem;display:flex;align-items:center;justify-content:center;
  box-shadow:inset 0 -3px 0 rgba(0,0,0,.2)}

/* avatar cards */
.ue-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px}
.ue-av{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:108px;padding:10px 4px 8px;
  border-radius:18px;border:2px solid var(--line);border-bottom-width:5px;background:var(--card);color:var(--text);font:inherit;cursor:pointer;
  transition:transform .15s,border-color .15s,background .2s}
.ue-av .g{font-size:2.1rem;line-height:1.1;display:block;animation:ue-float 4s ease-in-out infinite;animation-delay:calc(var(--i,0) * -.37s)}
.ue-av .n{font-size:.76rem;font-weight:800;line-height:1.15}
.ue-av .s{font-size:.62rem;font-weight:800;letter-spacing:.04em;color:var(--muted)}
.ue-av:hover{transform:translateY(-3px) scale(1.04)}
.ue-av:active{transform:translateY(2px) scale(.97);border-bottom-width:3px}
.ue-av.sel{border-color:var(--p);background:var(--pl);box-shadow:0 0 0 3px rgba(109,93,251,.25)}
.ue-av.sel .g{animation:ue-breathe 2.4s ease-in-out infinite}
.ue-av.sel .s{color:var(--p)}
html[data-theme="dark"] .ue-av.sel .s{color:#b9b1ff}
.ue-av.sel:before{content:"";position:absolute;inset:-3px;border-radius:20px;border:2px solid var(--p);pointer-events:none;animation:ue-selring 2.4s ease-out infinite}
.ue-av.pick{animation:ue-pop .5s cubic-bezier(.3,1.4,.4,1)}
.ue-av.lock{background:var(--soft);cursor:pointer}
.ue-av.lock .g{animation:none;filter:grayscale(.85);opacity:.5}
.ue-av.lock .n{color:var(--muted)}
.ue-av.lock:after{content:"🔒";position:absolute;right:5px;top:4px;font-size:.8rem}
.ue-av.ue-new{border-color:var(--gold)}
.ue-av.ue-new:after{content:"NEW";position:absolute;right:5px;top:5px;font-size:.55rem;font-weight:800;letter-spacing:.06em;color:#4a3200;
  background:var(--gold);padding:2px 6px;border-radius:999px;animation:ue-sparkle 1.1s ease-in-out 3}
.ue-avcap{margin:12px 2px 0;min-height:1.3em;font-size:.82rem;font-weight:600;color:var(--muted)}
.ue-avcap b{color:var(--text)}

.ue-colors{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}
.ue-col{position:relative;width:44px;height:44px;border-radius:50%;border:0;padding:0;background:transparent;cursor:pointer}
.ue-col i{position:absolute;inset:3px;border-radius:50%;border:3px solid var(--card);box-shadow:0 0 0 2px var(--line);transition:transform .15s,box-shadow .15s}
.ue-col:hover i{transform:scale(1.1)}
.ue-col.sel i{box-shadow:0 0 0 3px var(--p);transform:scale(1.12)}
.ue-col.lock i{filter:grayscale(.8);opacity:.5}
.ue-col.lock:after{content:"🔒";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:.9rem}

.ue-field{margin-bottom:14px}
.ue-field label{display:flex;justify-content:space-between;font-size:.78rem;font-weight:800;letter-spacing:.06em;color:var(--muted);margin-bottom:6px}
.ue-field label span{font-weight:700;letter-spacing:0}
.ue-field label span.bad{color:var(--red)}
.ue-in{width:100%;box-sizing:border-box;padding:14px 16px;border-radius:16px;border:2px solid var(--line);border-bottom-width:4px;background:var(--card);
  color:var(--text);font:inherit;font-weight:700;font-size:1rem;outline:none;transition:border-color .15s}
.ue-in:focus{border-color:var(--p)}
.ue-in.bad{border-color:var(--red)}
.ue-in::placeholder{color:var(--muted);font-weight:600}
textarea.ue-in{resize:none;min-height:70px}
.ue-err{color:var(--red);font-size:.8rem;font-weight:700;min-height:1.1em;margin-top:4px}

.ue-roles{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ue-role,.ue-deg,.ue-chip{cursor:pointer;background:var(--card);border:2px solid var(--line);border-bottom-width:5px;color:var(--text);font:inherit;text-align:left;
  transition:transform .12s,border-color .12s,background .2s}
.ue-role:active,.ue-deg:active,.ue-chip:active{transform:translateY(2px);border-bottom-width:3px}
.ue-role{border-radius:20px;padding:16px;display:flex;flex-direction:column;gap:4px;min-height:44px}
.ue-role .i{font-size:1.9rem}.ue-role b{font-size:1rem}.ue-role small{color:var(--muted);font-weight:600;font-size:.8rem}
.ue-role.sel,.ue-deg.sel,.ue-chip.sel{border-color:var(--p);background:var(--pl)}
.ue-chips{display:flex;gap:10px;flex-wrap:wrap}
.ue-chip{border-radius:16px;padding:10px 14px;min-height:44px;font-weight:800;font-size:.9rem}
.ue-degs{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.ue-deg{border-radius:16px;padding:12px 8px;min-height:64px;text-align:center;font-weight:800;font-size:.85rem}
.ue-deg .i{display:block;font-size:1.4rem;margin-bottom:2px}
.ue-hint{color:var(--muted);font-size:.8rem;font-weight:600;margin:0 0 10px}

/* ---- footer ---- */
.ue-foot{display:flex;gap:12px;align-items:center;justify-content:flex-end;padding:16px 22px;border-top:2px solid var(--line);background:var(--bg)}
.ue-foot .msg{margin-right:auto;font-size:.85rem;font-weight:700;color:var(--muted)}
.ue-btn{font:inherit;font-weight:800;letter-spacing:.05em;text-transform:uppercase;font-size:.88rem;border-radius:16px;padding:14px 26px;min-height:48px;cursor:pointer;
  border:2px solid transparent;border-bottom-width:5px;transition:transform .1s,filter .15s}
.ue-btn:active:not(:disabled){transform:translateY(3px);border-bottom-width:2px}
.ue-btn.ghost{background:var(--card);color:var(--muted);border-color:var(--line)}
.ue-btn.go{background:var(--green);color:#fff;border-color:var(--gd)}
.ue-btn.go:hover:not(:disabled){filter:brightness(1.06)}
.ue-btn:disabled{background:var(--line);color:var(--muted);border-color:var(--line);cursor:not-allowed}
.ue-modal :focus-visible{outline:3px solid var(--p);outline-offset:2px}

/* ---- level-up celebration ---- */
.ue-celebrate{position:absolute;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;padding:16px;
  background:rgba(20,16,60,.4);opacity:0;pointer-events:none;transition:opacity .25s ease}
.ue-celebrate.show{opacity:1}
.ue-cbox{width:min(400px,100%);box-sizing:border-box;text-align:center;background:var(--card);border:2px solid var(--gold);border-bottom-width:6px;
  border-radius:26px;padding:22px 24px;box-shadow:0 20px 60px rgba(0,0,0,.35)}
.ue-celebrate.show .ue-cbox{animation:ue-celin .65s cubic-bezier(.2,1.4,.3,1)}
.ue-cbig{font-size:2.3rem;font-weight:900;letter-spacing:.03em;line-height:1.05;background:linear-gradient(100deg,#ffb300,#ff6b3d,#ec4899);
  -webkit-background-clip:text;background-clip:text;color:transparent}
.ue-ctrans{margin-top:8px;font-size:1.05rem;font-weight:800}
.ue-ctrans em{font-style:normal;color:var(--gold);padding:0 4px}
.ue-clabel{margin-top:14px;font-size:.72rem;font-weight:800;letter-spacing:.1em;color:var(--muted)}
.ue-crewards{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:10px}
.ue-rw{min-width:84px;padding:10px 12px;border-radius:16px;background:var(--goldl);border:2px solid var(--gold);display:flex;flex-direction:column;align-items:center;gap:2px}
.ue-celebrate.show .ue-rw{animation:ue-rwin .6s cubic-bezier(.2,1.4,.3,1) both}
.ue-rw .rg{font-size:2.2rem;line-height:1.1;width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  background:var(--card);box-shadow:0 0 0 3px rgba(245,167,0,.4),0 0 18px rgba(245,167,0,.5)}
.ue-rw .rn{font-size:.78rem;font-weight:800}
.ue-rw small{font-size:.62rem;font-weight:800;color:var(--muted);letter-spacing:.04em}

.ue-toast{position:fixed;left:50%;bottom:28px;transform:translate(-50%,40px);z-index:10002;background:var(--green,#2fb344);color:#fff;
  padding:14px 22px;border-radius:18px;font:800 .95rem "Plus Jakarta Sans",system-ui,sans-serif;box-shadow:0 14px 40px rgba(0,0,0,.3);
  border-bottom:4px solid #23903a;opacity:0;transition:all .35s cubic-bezier(.2,1.3,.4,1);max-width:calc(100vw - 32px);text-align:center}
.ue-toast.err{background:#ef4444;border-color:#b91c1c}
.ue-toast.show{opacity:1;transform:translate(-50%,0)}

.ue-confetti{position:fixed;top:0;width:10px;height:14px;z-index:10001;pointer-events:none;border-radius:2px;
  animation:ue-fall var(--d,1.6s) cubic-bezier(.2,.6,.4,1) forwards}
.ue-spark{position:fixed;width:8px;height:8px;margin:-4px 0 0 -4px;z-index:10001;pointer-events:none;border-radius:50%;
  animation:ue-burst var(--d,.9s) cubic-bezier(.15,.7,.3,1) forwards}

@keyframes ue-pop{0%{transform:scale(1)}40%{transform:scale(1.35) rotate(-8deg)}100%{transform:scale(1)}}
@keyframes ue-bub{0%{transform:scale(.94);opacity:.5}100%{transform:none;opacity:1}}
@keyframes ue-shake{0%,100%{transform:none}20%{transform:translateX(-7px)}40%{transform:translateX(7px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}
@keyframes ue-fall{0%{transform:translate(0,-20px) rotate(0);opacity:1}100%{transform:translate(var(--x,0),105vh) rotate(var(--r,540deg));opacity:.9}}
@keyframes ue-burst{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(.3);opacity:0}}
@keyframes ue-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes ue-breathe{0%,100%{transform:scale(1.05)}50%{transform:scale(1.16)}}
@keyframes ue-selring{0%{transform:scale(.97);opacity:.7}100%{transform:scale(1.1);opacity:0}}
@keyframes ue-avpop{0%{transform:scale(1) rotate(0)}30%{transform:scale(.7) rotate(-14deg)}65%{transform:scale(1.22) rotate(8deg)}100%{transform:scale(1) rotate(0)}}
@keyframes ue-ringpulse{0%{opacity:0;transform:scale(.92)}30%{opacity:1}100%{opacity:0;transform:scale(1.22)}}
@keyframes ue-bump{0%{transform:scale(1)}40%{transform:scale(1.18)}100%{transform:scale(1)}}
@keyframes ue-tick{0%{opacity:.35;transform:translateY(3px)}100%{opacity:1;transform:none}}
@keyframes ue-qhi{0%{box-shadow:0 0 0 0 rgba(47,179,68,.6)}35%{box-shadow:0 0 0 6px rgba(47,179,68,.3)}100%{box-shadow:0 0 0 0 rgba(47,179,68,0)}}
@keyframes ue-check{from{stroke-dashoffset:24}to{stroke-dashoffset:0}}
@keyframes ue-floatxp{0%{opacity:0;transform:translateY(8px) scale(.8)}20%{opacity:1;transform:translateY(-6px) scale(1.1)}100%{opacity:0;transform:translateY(-34px) scale(1)}}
@keyframes ue-emph{0%{transform:scale(1)}25%{transform:scale(1.035);box-shadow:0 0 0 4px rgba(245,167,0,.5),0 12px 40px rgba(245,167,0,.35)}100%{transform:scale(1);box-shadow:none}}
@keyframes ue-celin{0%{opacity:0;transform:scale(.7) translateY(14px)}60%{opacity:1;transform:scale(1.06)}100%{transform:scale(1)}}
@keyframes ue-rwin{0%{opacity:0;transform:scale(.5)}100%{opacity:1;transform:scale(1)}}
@keyframes ue-sparkle{0%,100%{transform:scale(1)}50%{transform:scale(1.25)}}
.ue-bounce{animation:ue-pop .45s ease}
.ue-shake{animation:ue-shake .4s ease}

/* ---- mobile ---- */
@media (max-width:860px){
  .ue-overlay{padding:0;align-items:flex-end}
  .ue-modal{max-height:100dvh;height:100dvh;border-radius:0}
  .ue-top{grid-template-columns:1fr auto;grid-template-areas:"t x" "p p";gap:10px;padding:12px 14px}
  .ue-top p{display:none}
  .ue-prog{gap:6px;justify-content:stretch}
  .ue-pg{padding:5px 8px;border-radius:12px}
  .ue-pg.xpg{flex:1 1 auto;max-width:none}
  .ue-pg .k{font-size:.55rem}.ue-pg b{font-size:.92rem}.ue-pg.lvl b{font-size:1.1rem}
  .ue-body{display:flex;flex-direction:column;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
  .ue-side{display:contents}
  .ue-preview{order:1;padding:14px 14px 4px;background:var(--soft)}
  .ue-questsec{order:2;padding:0 14px 14px;background:var(--soft);border-bottom:2px solid var(--line)}
  .ue-main{order:3;overflow:visible;padding:18px 14px 22px}
  .ue-extras{order:4;padding:0 14px 24px;background:var(--soft);border-top:2px solid var(--line)}
  .ue-quests{flex-direction:row;overflow-x:auto;scroll-snap-type:x proximity;padding:2px 2px 8px;-webkit-overflow-scrolling:touch}
  .ue-quest{flex:0 0 78%;max-width:300px;scroll-snap-align:start}
  .ue-grid{grid-template-columns:repeat(3,1fr)}
  .ue-av{min-height:112px}
  .ue-degs{grid-template-columns:1fr 1fr}
  .ue-roles{grid-template-columns:1fr}
  .ue-foot{padding:12px 14px calc(12px + env(safe-area-inset-bottom,0px))}
  .ue-foot .msg{display:none}
  .ue-btn{flex:1}
  .ue-cbig{font-size:2rem}
}
@media (max-width:420px){
  .ue-pg.fire .k,.ue-pg.cmp .k{display:none}
}
@media (prefers-reduced-motion:reduce){
  .ue-overlay,.ue-modal,.ue-ring .fg,.ue-xpbar i,.ue-toast,.ue-av,.ue-badge,.ue-segs i,.ue-quest,.ue-card{transition:none}
  .ue-bounce,.ue-shake,.ue-bubble.pop,.ue-quest.just,.ue-quest.just .qc,.ue-quest.just .qc svg,.ue-av .g,.ue-av.sel .g,.ue-av.sel:before,.ue-av.pick,
  .ue-avatar.ue-avpop .ue-glyph,.ue-glow.ue-pulse,.ue-bump,.ue-pg.bump,.ue-tick,.ue-card.ue-emph,.ue-celebrate.show .ue-cbox,.ue-celebrate.show .ue-rw,
  .ue-badge.pop,.ue-av.ue-new:after{animation:none}
  .ue-floatxp{animation:none;opacity:1}
  .ue-confetti,.ue-spark{display:none}
  .ue-av:hover,.ue-badge:hover{transform:none}
  .ue-badge:not(.off):after{display:none}
  .ue-fade{transition:none!important}
}`;
    document.head.appendChild(style);
  }

  /* ------------------------------------------------------------------------
     Toast + confetti + bursts
     ------------------------------------------------------------------------ */

  let toastTimer = null;

  function toast(message, isError) {
    let el = $("ue-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "ue-toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.className = `ue-toast${isError ? " err" : ""}`;
    el.textContent = message;
    requestAnimationFrame(() => el.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3600);
  }

  /** Short-lived DOM node: removed on animationend, with a timer as a safety net. */
  function ephemeral(node, ms) {
    document.body.appendChild(node);
    const remove = () => node.remove();
    node.addEventListener("animationend", remove, { once: true });
    setTimeout(remove, ms);
  }

  function confetti() {
    if (reduceMotion()) return;
    const colors = ["#6d5dfb", "#ff8a1f", "#2fb344", "#ec4899", "#f5a700", "#2563eb"];
    for (let i = 0; i < 40; i++) {
      const p = document.createElement("i");
      p.className = "ue-confetti";
      p.style.left = `${35 + Math.random() * 30}%`;
      p.style.background = colors[i % colors.length];
      p.style.setProperty("--x", `${(Math.random() - 0.5) * 520}px`);
      p.style.setProperty("--r", `${300 + Math.random() * 600}deg`);
      p.style.setProperty("--d", `${1.2 + Math.random() * 0.9}s`);
      ephemeral(p, 2400);
    }
  }

  /** A small radial burst of coloured dots from a point. */
  function burst(x, y, count, spread) {
    if (reduceMotion()) return;
    const colors = ["#6d5dfb", "#ff8a1f", "#2fb344", "#ec4899", "#f5a700", "#2563eb"];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const dist = spread * (0.55 + Math.random() * 0.6);
      const s = document.createElement("i");
      s.className = "ue-spark";
      s.style.left = `${x}px`;
      s.style.top = `${y}px`;
      s.style.background = colors[i % colors.length];
      s.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
      s.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
      s.style.setProperty("--d", `${0.7 + Math.random() * 0.4}s`);
      ephemeral(s, 1400);
    }
  }

  function centerOf(node) {
    const r = node.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, visible: r.bottom > 0 && r.top < window.innerHeight && r.width > 0 };
  }

  /** Two stacked layers so a gradient change cross-fades instead of snapping. */
  function createFader(host) {
    const layers = [document.createElement("span"), document.createElement("span")];
    layers.forEach((l) => {
      l.className = "ue-fade";
      host.appendChild(l);
    });
    let front = -1;
    let current = "";

    return function setBackground(css, animate) {
      if (css === current) return;
      current = css;

      const next = layers[front === 0 ? 1 : 0];
      const prev = layers[front === 0 ? 0 : 1];
      const fade = animate && !reduceMotion();

      next.style.transition = "none";
      next.style.opacity = "0";
      next.style.background = css;
      next.style.zIndex = "2";
      if (front !== -1) prev.style.zIndex = "1";
      void next.offsetWidth;
      next.style.transition = fade ? "opacity .55s ease" : "none";
      next.style.opacity = "1";
      front = front === 0 ? 1 : 0;
    };
  }

  /* ------------------------------------------------------------------------
     The editor
     ------------------------------------------------------------------------ */

  function normRole(r) {
    return String(r || "").toLowerCase() === "counselor" ? "counselor" : "student";
  }

  function draftFromUser(user) {
    const m = user.user_metadata || {};
    return {
      username: String(m.username || (user.email ? user.email.split("@")[0] : "") || "").trim(),
      role: normRole(m.profile_type),
      emoji: m.avatar_emoji || "",
      color: COLORS.some((c) => c.id === m.avatar_color) ? m.avatar_color : "violet",
      bio: String(m.bio || ""),
      countries: Array.isArray(m.dream_countries)
        ? m.dream_countries.filter((c) => COUNTRIES.some((x) => x.id === c)).slice(0, MAX_COUNTRIES)
        : [],
      degree: DEGREES.some((d) => d.id === m.degree_goal) ? m.degree_goal : ""
    };
  }

  const cleanName = (s) => String(s || "").replace(/\s+/g, " ").trim();

  function nameError(name) {
    const n = cleanName(name);
    if (n.length < NAME_MIN) return `At least ${NAME_MIN} characters, please.`;
    if (n.length > NAME_MAX) return `Keep it under ${NAME_MAX} characters.`;
    return "";
  }

  let active = null; // the open editor, if any
  let opening = false; // guards double-clicks while the session loads

  async function openEditor() {
    if (active || opening) return;
    opening = true;

    try {
      const sb = window.supabaseApp;
      let user = null;

      if (sb && sb.auth) {
        try {
          const { data } = await sb.auth.getSession();
          user = data && data.session ? data.session.user : null;
        } catch (err) {
          console.warn("Profile Studio: could not read the session.", err);
        }
      }

      if (!user) {
        if (typeof window.openAuthOverlay === "function") {
          window.openAuthOverlay(false, "Sign in to edit your profile");
        } else {
          alert("Please sign in to edit your profile.");
        }
        return;
      }

      if (active) return;
      buildEditor(user);
    } finally {
      opening = false;
    }
  }

  function buildEditor(user) {
    injectStyles();

    /* ---- per-editor lifecycle: every timer / animation frame is tracked ---- */

    const timers = new Set();
    const cancels = new Set();

    const scope = {
      later(fn, ms) {
        const id = setTimeout(() => {
          timers.delete(id);
          fn();
        }, ms);
        timers.add(id);
        return id;
      },
      clear(id) {
        clearTimeout(id);
        timers.delete(id);
      },
      tween(from, to, ms, step) {
        if (reduceMotion() || from === to || ms <= 0) {
          step(to);
          return () => {};
        }
        const t0 = performance.now();
        let raf = 0;
        const cancel = () => {
          cancelAnimationFrame(raf);
          cancels.delete(cancel);
        };
        const loop = (now) => {
          const p = Math.min(1, (now - t0) / ms);
          step(from + (to - from) * easeOutCubic(p));
          if (p < 1) raf = requestAnimationFrame(loop);
          else cancels.delete(cancel);
        };
        cancels.add(cancel);
        raf = requestAnimationFrame(loop);
        return cancel;
      },
      dispose() {
        timers.forEach((id) => clearTimeout(id));
        timers.clear();
        cancels.forEach((c) => c());
        cancels.clear();
      }
    };

    /* ---- state ---- */

    const stats = activityStats();
    const streak = touchStreak();
    const baseXP = activityXP(stats);

    let initial = draftFromUser(user);
    const draft = JSON.parse(JSON.stringify(initial));

    const committed = { rewards: loadRewards(user, initial) };
    committed.xp = baseXP + rewardCount(committed.rewards) * QUEST_XP;
    committed.level = levelInfo(committed.xp).level;

    const previewRewards = () => mergeRewards(committed.rewards, doneMap(draft));
    const previewXP = () => baseXP + rewardCount(previewRewards()) * QUEST_XP;
    const pendingGain = () => previewXP() - committed.xp;

    let saving = false;
    let finishing = false;
    let firstRender = true;
    let freshActivity = new Set();
    let newUnlocks = new Set();
    let selectedBadge = -1;
    let progressTimer = null;
    const prev = { xp: 0, level: 1, color: null, glyph: null, quests: {}, role: "", dest: "", deg: "" };
    const numbers = {}; // running number tweens by key

    /* ---- markup ---- */

    const overlay = document.createElement("div");
    overlay.id = "ue-overlay";
    overlay.className = "ue-overlay";
    overlay.innerHTML = `
      <div class="ue-modal" role="dialog" aria-modal="true" aria-labelledby="ue-title">
        <div class="ue-top">
          <div class="ue-tt">
            <h2 id="ue-title">Your profile</h2>
            <p>Make it yours — level up as you go.</p>
          </div>
          <div class="ue-prog" aria-label="Progress">
            <div class="ue-pg lvl" id="ue-hlvlbox"><span class="k">LEVEL</span><b id="ue-hlvl">1</b></div>
            <div class="ue-pg xpg">
              <div class="row"><span class="k">XP</span><span id="ue-hxp">0 / ${LEVEL_XP}</span></div>
              <div class="ue-xpbar mini"><i id="ue-hxpfill"></i></div>
            </div>
            <div class="ue-pg fire"><b>🔥 <span id="ue-hstreak">0</span></b><span class="k">DAY STREAK</span></div>
            <div class="ue-pg cmp"><b id="ue-hcmp">0%</b><span class="k">COMPLETE</span></div>
          </div>
          <button type="button" class="ue-x" id="ue-close" aria-label="Close">×</button>
        </div>

        <div class="ue-body">
          <aside class="ue-side" aria-label="Preview">
            <div class="ue-preview">
              <div class="ue-card" id="ue-card">
                <div class="ue-banner" id="ue-banner"></div>
                <div class="ue-ringwrap" id="ue-ringwrap">
                  <svg class="ue-ring" viewBox="0 0 120 120" aria-hidden="true">
                    <circle class="bg" cx="60" cy="60" r="54"></circle>
                    <circle class="fg" id="ue-ringfg" cx="60" cy="60" r="54"></circle>
                  </svg>
                  <span class="ue-glow" id="ue-glow"></span>
                  <div class="ue-avatar" id="ue-avatar"><span class="ue-glyph" id="ue-glyph"></span></div>
                  <span class="ue-lvl" id="ue-lvl">LVL 1</span>
                </div>
                <div class="ue-pname" id="ue-pname"></div>
                <div class="ue-tags"><span class="ue-prole" id="ue-prole"></span><span class="ue-pdeg" id="ue-pdeg" hidden></span></div>
                <p class="ue-pbio" id="ue-pbio"></p>
                <div class="ue-pdest" id="ue-pdest"></div>

                <div class="ue-pending" id="ue-pending" hidden></div>

                <div class="ue-xpbar"><i id="ue-xpfill"></i></div>
                <div class="ue-xptext"><span id="ue-xpleft"></span><span id="ue-xpnext"></span></div>

                <div class="ue-stats">
                  <div class="ue-stat fire"><b id="ue-streak">0</b><span>🔥 DAY STREAK</span></div>
                  <div class="ue-stat xp"><b id="ue-xp">0</b><span>⚡ TOTAL XP</span></div>
                </div>
              </div>
            </div>

            <div class="ue-questsec">
              <div class="ue-h">PROFILE QUESTS</div>
              <div class="ue-quests" id="ue-quests"></div>
            </div>

            <div class="ue-extras">
              <div class="ue-h">BADGES</div>
              <div class="ue-badges" id="ue-badges"></div>
              <div class="ue-bdetail" id="ue-bdetail" aria-live="polite"></div>

              <div class="ue-h">RECENT ACHIEVEMENTS</div>
              <ul class="ue-act" id="ue-act"></ul>
            </div>
          </aside>

          <section class="ue-main">
            <div class="ue-say">
              <div class="face" aria-hidden="true">🦉</div>
              <div class="ue-bubble" id="ue-bubble" aria-live="polite"></div>
            </div>

            <div class="ue-complete">
              <div class="ch"><span>PROFILE COMPLETION</span><span id="ue-cpct">0%</span></div>
              <div class="ue-segs" id="ue-segs"><i></i><i></i><i></i><i></i></div>
            </div>

            <div class="ue-sec">
              <h3><span class="n">1</span> Choose your character</h3>
              <div class="ue-grid" id="ue-avatars" role="listbox" aria-label="Characters"></div>
              <div class="ue-avcap" id="ue-avcap" aria-live="polite"></div>
              <div class="ue-colors" id="ue-colors" role="listbox" aria-label="Colours"></div>
            </div>

            <div class="ue-sec">
              <h3><span class="n">2</span> What should we call you?</h3>
              <div class="ue-field">
                <label for="ue-name">USERNAME <span id="ue-namecount">0/${NAME_MAX}</span></label>
                <input id="ue-name" class="ue-in" type="text" maxlength="${NAME_MAX + 10}" autocomplete="nickname" placeholder="e.g. Aarav">
                <div class="ue-err" id="ue-nameerr"></div>
              </div>
              <div class="ue-field">
                <label for="ue-bio">ABOUT YOU <span id="ue-biocount">0/${BIO_MAX}</span></label>
                <textarea id="ue-bio" class="ue-in" maxlength="${BIO_MAX}" placeholder="Dreaming of a CS masters in Berlin…"></textarea>
              </div>
            </div>

            <div class="ue-sec">
              <h3><span class="n">3</span> I'm a…</h3>
              <div class="ue-roles" id="ue-roles" role="radiogroup" aria-label="Profile type"></div>
            </div>

            <div class="ue-sec">
              <h3><span class="n">4</span> Where are you headed?</h3>
              <p class="ue-hint">Pick up to ${MAX_COUNTRIES} dream destinations.</p>
              <div class="ue-chips" id="ue-countries"></div>
              <p class="ue-hint" style="margin-top:16px">Degree you're aiming for</p>
              <div class="ue-degs" id="ue-degrees" role="radiogroup" aria-label="Degree goal"></div>
            </div>
          </section>
        </div>

        <div class="ue-foot">
          <span class="msg" id="ue-msg"></span>
          <button type="button" class="ue-btn ghost" id="ue-cancel">Cancel</button>
          <button type="button" class="ue-btn go" id="ue-save" disabled>Save changes</button>
        </div>

        <div class="ue-celebrate" id="ue-celebrate" role="status" aria-live="assertive">
          <div class="ue-cbox">
            <div class="ue-cbig">LEVEL UP!</div>
            <div class="ue-ctrans" id="ue-ctrans"></div>
            <div class="ue-clabel" id="ue-clabel" hidden></div>
            <div class="ue-crewards" id="ue-crewards"></div>
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const q = (id) => overlay.querySelector(`#${id}`);
    const el = {
      modal: overlay.querySelector(".ue-modal"), card: q("ue-card"), banner: q("ue-banner"), ringwrap: q("ue-ringwrap"),
      glow: q("ue-glow"), avatar: q("ue-avatar"), glyph: q("ue-glyph"), lvl: q("ue-lvl"), ringfg: q("ue-ringfg"),
      pname: q("ue-pname"), prole: q("ue-prole"), pdeg: q("ue-pdeg"), pbio: q("ue-pbio"), pdest: q("ue-pdest"),
      pending: q("ue-pending"), xpfill: q("ue-xpfill"), xpleft: q("ue-xpleft"), xpnext: q("ue-xpnext"),
      streak: q("ue-streak"), xp: q("ue-xp"), quests: q("ue-quests"), badges: q("ue-badges"), bdetail: q("ue-bdetail"),
      act: q("ue-act"), bubble: q("ue-bubble"), avatars: q("ue-avatars"), avcap: q("ue-avcap"), colors: q("ue-colors"),
      name: q("ue-name"), nameerr: q("ue-nameerr"), namecount: q("ue-namecount"), bio: q("ue-bio"), biocount: q("ue-biocount"),
      roles: q("ue-roles"), countries: q("ue-countries"), degrees: q("ue-degrees"), save: q("ue-save"), cancel: q("ue-cancel"),
      close: q("ue-close"), msg: q("ue-msg"), hlvlbox: q("ue-hlvlbox"), hlvl: q("ue-hlvl"), hxp: q("ue-hxp"),
      hxpfill: q("ue-hxpfill"), hstreak: q("ue-hstreak"), hcmp: q("ue-hcmp"), cpct: q("ue-cpct"), segs: q("ue-segs"),
      celebrate: q("ue-celebrate"), ctrans: q("ue-ctrans"), clabel: q("ue-clabel"), crewards: q("ue-crewards")
    };

    const setBannerBg = createFader(el.banner);
    const setAvatarBg = createFader(el.avatar);

    /* ---- build the (static) option controls once ---- */

    AVATARS.forEach((a, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ue-av";
      b.dataset.emoji = a.e;
      b.style.setProperty("--i", String(i % 12));
      b.setAttribute("role", "option");
      b.title = a.desc;
      b.innerHTML = `<span class="g" aria-hidden="true">${a.e}</span><span class="n">${esc(a.name)}</span><span class="s"></span>`;
      el.avatars.appendChild(b);
    });

    COLORS.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ue-col";
      b.dataset.color = c.id;
      b.setAttribute("role", "option");
      b.innerHTML = `<i style="background:${c.css}"></i>`;
      el.colors.appendChild(b);
    });

    ROLES.forEach((r) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ue-role";
      b.dataset.role = r.id;
      b.setAttribute("role", "radio");
      b.innerHTML = `<span class="i">${r.icon}</span><b>${r.label}</b><small>${r.text}</small>`;
      el.roles.appendChild(b);
    });

    COUNTRIES.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ue-chip";
      b.dataset.country = c.id;
      b.textContent = `${c.flag} ${c.id}`;
      el.countries.appendChild(b);
    });

    DEGREES.forEach((d) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ue-deg";
      b.dataset.degree = d.id;
      b.setAttribute("role", "radio");
      b.innerHTML = `<span class="i">${d.icon}</span>${d.label}`;
      el.degrees.appendChild(b);
    });

    const questNodes = {};
    el.quests.innerHTML = QUESTS.map(
      (qs) => `<div class="ue-quest" data-q="${qs.id}">
        <span class="qi" aria-hidden="true">${qs.icon}</span>
        <div class="qt"><b>${esc(qs.label)}</b><small></small></div>
        <span class="qx">+${QUEST_XP} XP</span>
        <span class="qc" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg></span>
      </div>`
    ).join("");
    QUESTS.forEach((qs) => {
      const root = el.quests.querySelector(`[data-q="${qs.id}"]`);
      questNodes[qs.id] = { root, desc: root.querySelector("small"), xp: root.querySelector(".qx") };
    });

    const badgeDefs = badgeList(stats, streak, draft);
    el.badges.innerHTML = badgeDefs
      .map(
        (b, i) => `<button type="button" class="ue-badge off" data-i="${i}">
          <span class="bl" aria-hidden="true">🔒</span><span class="bi" aria-hidden="true">${b.icon}</span><span class="bn">${esc(b.name)}</span>
        </button>`
      )
      .join("");
    const badgeNodes = Array.from(el.badges.querySelectorAll(".ue-badge"));

    el.name.value = draft.username;
    el.bio.value = draft.bio;

    /* ---- unlock state ---- */

    const isAvatarLocked = (a) => a.lvl > committed.level && a.e !== initial.emoji;
    const isColorLocked = (c) => c.lvl > committed.level && c.id !== initial.color;
    const xpToLevel = (lvl) => Math.max(0, (lvl - 1) * LEVEL_XP - committed.xp);

    function refreshLocks() {
      el.avatars.querySelectorAll(".ue-av").forEach((b) => {
        const a = AVATARS.find((x) => x.e === b.dataset.emoji);
        const locked = isAvatarLocked(a);
        b.classList.toggle("lock", locked);
        b.classList.toggle("ue-new", newUnlocks.has(`a:${a.e}`));
        b.setAttribute("aria-label", `${a.name}. ${locked ? `Locked, unlocks at level ${a.lvl}` : "Unlocked"}. ${a.desc}`);
        const s = b.querySelector(".s");
        const selected = a.e === draft.emoji;
        s.textContent = locked ? `LEVEL ${a.lvl}` : selected ? "SELECTED" : a.lvl > 1 ? `UNLOCKED` : "READY";
      });
      el.colors.querySelectorAll(".ue-col").forEach((b) => {
        const c = colorOf(b.dataset.color);
        const locked = isColorLocked(c);
        b.classList.toggle("lock", locked);
        b.title = locked ? `${c.name} — unlocks at level ${c.lvl}` : c.name;
        b.setAttribute("aria-label", b.title);
      });
    }

    /* ---- render: only toggles classes / text, never rebuilds inputs ---- */

    const isDirty = () => JSON.stringify(draft) !== JSON.stringify(initial);

    function say(text, pop) {
      if (el.bubble.textContent === text) return;
      el.bubble.textContent = text;
      if (pop) restart(el.bubble, "pop");
    }

    function mascotLine() {
      const n = cleanName(draft.username);
      const done = questsDone(draft);

      if (nameError(draft.username)) return "First things first — what should we call you?";
      if (done === QUESTS.length) return `You're all set, ${n}! Hit save to lock it in. 🎉`;
      if (!draft.emoji) return `Nice to meet you, ${n}! Pick a character you like.`;
      if (draft.bio.trim().length < BIO_MIN_QUEST) return "Add a short bio — it earns you XP!";
      if (!draft.countries.length) return "Where do you want to study? Pick a dream destination.";
      if (!draft.degree) return "Almost there — which degree are you aiming for?";
      return `Looking good, ${n}!`;
    }

    /** Counts a number up/down with easing and remembers where it is. */
    function animateNumber(key, nodes, to, ms) {
      if (numbers[key] && numbers[key].cancel) numbers[key].cancel();
      const from = numbers[key] ? numbers[key].value : 0;
      const state = { value: from, cancel: null };
      numbers[key] = state;
      state.cancel = scope.tween(from, to, ms, (v) => {
        state.value = v;
        const text = String(Math.round(v));
        nodes.forEach((n) => (n.textContent = text));
      });
    }

    /** XP bar + ring. On a level-up the bar fills to the end, then restarts. */
    function paintProgress(lv, prevLevel, animate) {
      const fills = [el.xpfill, el.hxpfill, el.ringfg];
      const apply = (pct) => {
        el.xpfill.style.width = `${pct}%`;
        el.hxpfill.style.width = `${pct}%`;
        el.ringfg.style.strokeDashoffset = String(RING_C - (RING_C * pct) / 100);
      };

      scope.clear(progressTimer);

      if (animate && lv.level > prevLevel && !reduceMotion()) {
        apply(100);
        progressTimer = scope.later(() => {
          fills.forEach((n) => n.classList.add("ue-notrans"));
          apply(0);
          void el.xpfill.offsetWidth;
          fills.forEach((n) => n.classList.remove("ue-notrans"));
          apply(lv.pct);
        }, 450);
      } else {
        apply(lv.pct);
      }
    }

    function flashTick(node) {
      restart(node, "ue-tick");
    }

    function render(opts) {
      opts = opts || {};
      const animate = !firstRender;

      const nameErr = nameError(draft.username);
      const nm = cleanName(draft.username);
      const rewards = previewRewards();
      const total = baseXP + rewardCount(rewards) * QUEST_XP;
      const lv = levelInfo(total);
      const role = ROLES.find((r) => r.id === draft.role) || ROLES[0];
      const degree = DEGREES.find((d) => d.id === draft.degree);
      const done = questsDone(draft);
      const completion = Math.round((done / QUESTS.length) * 100);
      const levelChanged = lv.level !== prev.level;

      /* preview card */
      setBannerBg(gradFor(draft.color), animate);
      setAvatarBg(gradFor(draft.color), animate);

      const glyph = draft.emoji || (nm ? nm.charAt(0).toUpperCase() : "?");
      el.glyph.textContent = glyph;
      el.glyph.classList.toggle("letter", !draft.emoji);
      if (opts.popAvatar) restart(el.avatar, "ue-avpop");

      el.pname.textContent = nm || "Your name";
      el.pbio.textContent = draft.bio.trim() || "Your bio shows up here.";

      const roleText = `${role.icon} ${role.label}`;
      if (el.prole.textContent !== roleText) {
        el.prole.textContent = roleText;
        if (animate) flashTick(el.prole);
      }

      const degText = degree ? `${degree.icon} ${degree.label}` : "";
      el.pdeg.hidden = !degree;
      if (el.pdeg.textContent !== degText) {
        el.pdeg.textContent = degText;
        if (animate && degText) flashTick(el.pdeg);
      }

      const destText = draft.countries.map((id) => (COUNTRIES.find((c) => c.id === id) || {}).flag || "").join(" ");
      if (el.pdest.textContent !== destText) {
        el.pdest.textContent = destText;
        if (animate && destText) flashTick(el.pdest);
      }

      /* level, XP, ring, header */
      el.lvl.textContent = `LVL ${lv.level}`;
      el.hlvl.textContent = String(lv.level);
      el.xpleft.textContent = `${lv.into} / ${LEVEL_XP} XP`;
      el.xpnext.textContent = `${LEVEL_XP - lv.into} to LVL ${lv.level + 1}`;
      el.hxp.textContent = `${lv.into} / ${LEVEL_XP}`;
      el.streak.textContent = String(streak.count || 0);
      el.hstreak.textContent = String(streak.count || 0);
      el.hcmp.textContent = `${completion}%`;
      el.cpct.textContent = `${completion}%`;
      Array.from(el.segs.children).forEach((seg, i) => seg.classList.toggle("on", i < done));

      paintProgress(lv, prev.level, animate);

      if (total !== prev.xp || firstRender) {
        animateNumber("xp", [el.xp], total, firstRender ? 900 : 650);
        if (animate) {
          restart(el.xp, "ue-bump");
          restart(el.hlvlbox, "bump");
        }
      }

      if (animate && levelChanged) {
        restart(el.glow, "ue-pulse");
        restart(el.hlvlbox, "bump");
        restart(el.lvl, "ue-bounce");
      }

      const gain = pendingGain();
      const pendingLevel = lv.level > committed.level;
      el.pending.hidden = !(gain > 0);
      el.pending.textContent = pendingLevel
        ? `⬆ Save to reach level ${lv.level}!`
        : gain > 0
          ? `+${gain} XP waiting — save to claim it`
          : "";

      /* quests */
      QUESTS.forEach((qs) => {
        const node = questNodes[qs.id];
        const isDone = qs.check(draft);
        const earned = Boolean(committed.rewards[qs.id]);
        const wasDone = prev.quests[qs.id];

        node.root.classList.toggle("done", isDone);
        node.desc.textContent = isDone
          ? earned ? "Complete · XP earned" : "Complete"
          : qs.hint(draft);
        node.xp.textContent = earned ? "EARNED" : `+${QUEST_XP} XP`;

        if (animate && isDone && wasDone === false) {
          restart(node.root, "just");
          if (!earned && !reduceMotion()) {
            const f = document.createElement("span");
            f.className = "ue-floatxp";
            f.textContent = `+${QUEST_XP} XP`;
            node.root.appendChild(f);
            const drop = () => f.remove();
            f.addEventListener("animationend", drop, { once: true });
            scope.later(drop, 1400);
          }
        }
        prev.quests[qs.id] = isDone;
      });

      /* badges (live: "All set" follows the draft) */
      const defs = badgeList(stats, streak, draft);
      defs.forEach((b, i) => {
        const node = badgeNodes[i];
        const wasOn = node.dataset.on === "1";
        node.classList.toggle("off", !b.on);
        node.dataset.on = b.on ? "1" : "0";
        node.querySelector(".bl").hidden = b.on;
        node.setAttribute("aria-label", `${b.name}. ${b.on ? "Unlocked" : `Locked. ${b.hint} (${b.prog[0]} of ${b.prog[1]})`}`);
        node.title = b.on ? `${b.name} — ${b.hint}` : `Locked: ${b.hint}`;
        if (animate && b.on && !wasOn) restart(node, "pop");
      });
      paintBadgeDetail(defs);

      /* selections */
      el.avatars.querySelectorAll(".ue-av").forEach((b) => {
        const on = b.dataset.emoji === draft.emoji;
        b.classList.toggle("sel", on);
        b.setAttribute("aria-selected", String(on));
      });
      refreshLocks();
      paintAvatarCaption();

      el.colors.querySelectorAll(".ue-col").forEach((b) => {
        const on = b.dataset.color === draft.color;
        b.classList.toggle("sel", on);
        b.setAttribute("aria-selected", String(on));
      });
      el.roles.querySelectorAll(".ue-role").forEach((b) => {
        const on = b.dataset.role === draft.role;
        b.classList.toggle("sel", on);
        b.setAttribute("aria-checked", String(on));
      });
      el.countries.querySelectorAll(".ue-chip").forEach((b) => {
        const on = draft.countries.includes(b.dataset.country);
        b.classList.toggle("sel", on);
        b.setAttribute("aria-pressed", String(on));
      });
      el.degrees.querySelectorAll(".ue-deg").forEach((b) => {
        const on = b.dataset.degree === draft.degree;
        b.classList.toggle("sel", on);
        b.setAttribute("aria-checked", String(on));
      });

      /* inputs */
      const len = cleanName(draft.username).length;
      el.namecount.textContent = `${len}/${NAME_MAX}`;
      el.namecount.classList.toggle("bad", len > NAME_MAX);
      el.biocount.textContent = `${draft.bio.length}/${BIO_MAX}`;

      const showErr = el.name.dataset.touched === "1" && nameErr;
      el.nameerr.textContent = showErr ? nameErr : "";
      el.name.classList.toggle("bad", Boolean(showErr));

      /* footer */
      const dirty = isDirty();
      el.save.disabled = !dirty || Boolean(nameErr) || saving;
      el.msg.textContent = nameErr
        ? "Add a username to continue."
        : dirty
          ? gain > 0 ? `Unsaved changes · +${gain} XP waiting` : "You have unsaved changes."
          : "Everything is saved.";

      if (opts.line) say(opts.line, true);
      else say(mascotLine(), opts.sayPop);

      prev.xp = total;
      prev.level = lv.level;
      firstRender = false;
    }

    function paintAvatarCaption() {
      const a = AVATARS.find((x) => x.e === draft.emoji);
      el.avcap.innerHTML = a
        ? `<b>${a.e} ${esc(a.name)}</b> — ${esc(a.desc)}`
        : "Pick a character to represent you.";
    }

    function paintBadgeDetail(defs) {
      const b = defs[selectedBadge];
      if (!b) {
        el.bdetail.textContent = "Tap a badge to see how to earn it.";
        return;
      }
      el.bdetail.innerHTML = b.on
        ? `<b>${b.icon} ${esc(b.name)}</b> — earned. ${esc(b.hint)}.`
        : `<b>${b.icon} ${esc(b.name)}</b> — locked. ${esc(b.hint)} (${b.prog[0]}/${b.prog[1]}).`;
    }

    function renderActivity() {
      const items = activityList(
        { stats, streak, level: committed.level, rewards: committed.rewards },
        freshActivity
      );

      if (!items.length) {
        el.act.className = "ue-act empty";
        el.act.textContent = "Nothing here yet. Complete a profile quest or roadmap step to start your trail.";
        return;
      }

      el.act.className = "ue-act";
      el.act.innerHTML = items
        .map((a) => `<li><span class="ai" aria-hidden="true">${a.icon}</span><span>${esc(a.text)}</span>${a.fresh ? '<span class="new">NEW</span>' : ""}</li>`)
        .join("");
    }

    /* ---- interaction ---- */

    function bounce(node) {
      restart(node, "ue-bounce");
    }

    function shake(node) {
      restart(node, "ue-shake");
    }

    el.avatars.addEventListener("click", (e) => {
      const b = e.target.closest(".ue-av");
      if (!b) return;
      const a = AVATARS.find((x) => x.e === b.dataset.emoji);

      if (b.classList.contains("lock")) {
        shake(b);
        const need = xpToLevel(a.lvl);
        say(`${a.name} unlocks at level ${a.lvl} — ${need} more XP. Finish roadmap steps and save items to earn it!`, true);
        return;
      }

      const changed = draft.emoji !== a.e;
      draft.emoji = a.e;
      restart(b, "pick");
      if (changed) {
        const c = centerOf(b);
        if (c.visible) burst(c.x, c.y, 10, 54);
      }
      render({ popAvatar: changed, sayPop: true });
    });

    el.colors.addEventListener("click", (e) => {
      const b = e.target.closest(".ue-col");
      if (!b) return;
      const c = colorOf(b.dataset.color);

      if (b.classList.contains("lock")) {
        shake(b);
        say(`${c.name} unlocks at level ${c.lvl}.`, true);
        return;
      }
      draft.color = c.id;
      render({});
    });

    el.roles.addEventListener("click", (e) => {
      const b = e.target.closest(".ue-role");
      if (!b) return;
      draft.role = b.dataset.role;
      bounce(b);
      render({});
    });

    el.countries.addEventListener("click", (e) => {
      const b = e.target.closest(".ue-chip");
      if (!b) return;

      const id = b.dataset.country;
      const at = draft.countries.indexOf(id);

      if (at >= 0) {
        draft.countries.splice(at, 1);
      } else if (draft.countries.length >= MAX_COUNTRIES) {
        shake(b);
        say(`Max ${MAX_COUNTRIES} destinations — tap one to swap it out.`, true);
        return;
      } else {
        draft.countries.push(id);
        bounce(b);
      }
      render({ sayPop: true });
    });

    el.degrees.addEventListener("click", (e) => {
      const b = e.target.closest(".ue-deg");
      if (!b) return;
      draft.degree = b.dataset.degree;
      bounce(b);
      render({ sayPop: true });
    });

    el.badges.addEventListener("click", (e) => {
      const b = e.target.closest(".ue-badge");
      if (!b) return;
      selectedBadge = Number(b.dataset.i);
      restart(b, "pop");
      paintBadgeDetail(badgeList(stats, streak, draft));
    });

    const previewBadge = (e) => {
      const b = e.target.closest && e.target.closest(".ue-badge");
      if (!b) return;
      selectedBadge = Number(b.dataset.i);
      paintBadgeDetail(badgeList(stats, streak, draft));
    };
    el.badges.addEventListener("mouseover", previewBadge);
    el.badges.addEventListener("focusin", previewBadge);

    el.name.addEventListener("input", () => {
      draft.username = el.name.value;
      el.name.dataset.touched = "1";
      render({});
    });

    el.bio.addEventListener("input", () => {
      draft.bio = el.bio.value;
      render({});
    });

    /* ---- celebration ---- */

    function celebrate(from, to, unlocks) {
      el.ctrans.innerHTML = `Level ${from} <em>→</em> Level ${to}`;

      const avatars = unlocks.filter((u) => u.kind === "avatar").length;
      const colors = unlocks.length - avatars;
      el.clabel.hidden = !unlocks.length;
      el.clabel.textContent = unlocks.length
        ? avatars && colors
          ? "NEW REWARDS UNLOCKED"
          : avatars
            ? avatars > 1 ? "NEW AVATARS UNLOCKED" : "NEW AVATAR UNLOCKED"
            : colors > 1 ? "NEW COLOURS UNLOCKED" : "NEW COLOUR UNLOCKED"
        : "";

      el.crewards.innerHTML = unlocks
        .slice(0, 6)
        .map(
          (u, i) => `<div class="ue-rw" style="animation-delay:${0.25 + i * 0.12}s">
            <span class="rg"${u.css ? ` style="background:${u.css}"` : ""}>${u.glyph}</span>
            <span class="rn">${esc(u.name)}</span><small>LEVEL ${u.lvl}</small></div>`
        )
        .join("");

      restart(el.card, "ue-emph");
      restart(el.glow, "ue-pulse");
      el.celebrate.classList.remove("show");
      void el.celebrate.offsetWidth;
      el.celebrate.classList.add("show");

      scope.later(() => {
        const c = centerOf(el.card);
        const box = centerOf(el.celebrate.querySelector(".ue-cbox"));
        const origin = c.visible ? c : box;
        burst(origin.x, origin.y, 26, 150);
      }, 220);

      scope.later(() => el.celebrate.classList.remove("show"), CELEBRATION_MS);
    }

    /* ---- closing ---- */

    async function requestClose() {
      if (saving) return;

      if (isDirty() && !finishing) {
        const msg = "You have unsaved changes. Leave without saving?";
        const ok =
          typeof window.showConfirmCard === "function"
            ? await window.showConfirmCard(msg, {
                title: "Discard changes?",
                confirmText: "Discard",
                cancelText: "Keep editing"
              })
            : window.confirm(msg);
        if (!ok) return;
      }
      closeEditor();
    }

    el.close.addEventListener("click", requestClose);
    el.cancel.addEventListener("click", requestClose);
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) requestClose();
    });

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        requestClose();
        return;
      }

      // keep Tab inside the dialog
      if (e.key === "Tab") {
        const f = Array.from(
          overlay.querySelectorAll("button:not(:disabled), input, textarea, [tabindex]:not([tabindex='-1'])")
        ).filter((n) => n.offsetParent !== null);
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);

    const prevOverflow = document.documentElement.style.overflow;
    const opener = document.activeElement;
    document.documentElement.style.overflow = "hidden";

    function closeEditor() {
      scope.dispose();
      overlay.classList.remove("ue-open");
      document.removeEventListener("keydown", onKey, true);
      document.documentElement.style.overflow = prevOverflow;
      active = null;
      setTimeout(() => overlay.remove(), 260);
      if (opener && typeof opener.focus === "function") opener.focus();
    }

    /* ---- saving ---- */

    function unlocksBetween(fromLevel, toLevel) {
      const list = [];
      AVATARS.forEach((a) => {
        if (a.lvl > fromLevel && a.lvl <= toLevel) list.push({ kind: "avatar", key: `a:${a.e}`, glyph: a.e, name: a.name, lvl: a.lvl });
      });
      COLORS.forEach((c) => {
        if (c.lvl > fromLevel && c.lvl <= toLevel) list.push({ kind: "color", key: `c:${c.id}`, glyph: "🎨", css: c.css, name: c.name, lvl: c.lvl });
      });
      return list;
    }

    el.save.addEventListener("click", async () => {
      if (saving || finishing) return;

      const err = nameError(draft.username);
      if (err) {
        el.name.dataset.touched = "1";
        render({});
        shake(el.name);
        el.name.focus();
        return;
      }

      const sb = window.supabaseApp;
      if (!sb || !sb.auth) {
        toast("Profile service is unavailable right now.", true);
        return;
      }

      saving = true;
      el.save.disabled = true;
      el.save.textContent = "Saving…";

      try {
        // Pick up rewards earned on another device/tab so they are never dropped or double-counted.
        let serverRewards = {};
        try {
          const res = await sb.auth.getUser();
          const meta = res && res.data && res.data.user && res.data.user.user_metadata;
          serverRewards = sanitizeRewards(meta && meta.profile_quest_rewards);
        } catch (e) {
          /* fall back to what we already know */
        }

        const knownRewards = mergeRewards(committed.rewards, serverRewards);
        const nextRewards = mergeRewards(knownRewards, doneMap(draft));

        const payload = {
          username: cleanName(draft.username),
          profile_type: draft.role,
          avatar_emoji: draft.emoji,
          avatar_color: draft.color,
          bio: draft.bio.trim().slice(0, BIO_MAX),
          dream_countries: draft.countries.slice(0, MAX_COUNTRIES),
          degree_goal: draft.degree,
          profile_quest_rewards: nextRewards
        };

        const { data, error } = await sb.auth.updateUser({ data: payload });
        if (error) throw error;

        /* what actually changed, measured against what was already earned */
        const beforeXP = baseXP + rewardCount(knownRewards) * QUEST_XP;
        const afterXP = baseXP + rewardCount(nextRewards) * QUEST_XP;
        const beforeLevel = levelInfo(beforeXP).level;
        const afterLevel = levelInfo(afterXP).level;
        const gained = afterXP - beforeXP;
        const leveledUp = afterLevel > beforeLevel;
        const unlocks = leveledUp ? unlocksBetween(beforeLevel, afterLevel) : [];

        /* commit */
        committed.rewards = nextRewards;
        committed.xp = afterXP;
        committed.level = afterLevel;
        storeRewardsLocally(user.id, nextRewards);
        initial = JSON.parse(JSON.stringify(draft));

        freshActivity = new Set();
        if (leveledUp) freshActivity.add("level");
        if (gained > 0) freshActivity.add("quests");
        if (unlocks.some((u) => u.kind === "avatar")) freshActivity.add("avatars");
        newUnlocks = new Set(unlocks.map((u) => u.key));

        const fresh = (data && data.user) || user;
        applyIdentity(fresh);

        window.dispatchEvent(new CustomEvent("uniai:profile-updated", { detail: { profile: payload, xp: afterXP, level: afterLevel } }));
        if (window.UniAIProfile && typeof window.UniAIProfile.refresh === "function") {
          window.UniAIProfile.refresh();
        }

        saving = false;
        render({});
        renderActivity();
        el.save.textContent = "Saved ✓";

        /* one honest message for what really happened */
        let message = "Profile saved";
        if (leveledUp) message += unlocks.length ? " · LEVEL UP! New reward unlocked!" : " · LEVEL UP!";
        else if (gained > 0) message += ` · +${gained} XP`;
        toast(message);

        confetti();

        finishing = true;
        el.modal.classList.add("ue-finishing");
        if (leveledUp) celebrate(beforeLevel, afterLevel, unlocks);
        scope.later(closeEditor, leveledUp ? CELEBRATION_MS + 150 : SAVE_CLOSE_MS);
      } catch (error) {
        console.error("Profile Studio: save failed", error);
        saving = false;
        el.save.textContent = "Save changes";
        toast((error && error.message) || "Couldn't save your profile. Try again.", true);
        render({});
      }
    });

    /* ---- go ---- */

    active = { close: closeEditor };
    renderActivity();
    render({});

    requestAnimationFrame(() => {
      overlay.classList.add("ue-open");
      // On touch screens an auto-focused field would raise the keyboard over the preview.
      const touch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
      if (!touch) scope.later(() => el.name.focus({ preventScroll: true }), 150);
    });
  }

  function closeEditorPublic() {
    if (active) active.close();
  }

  /* ------------------------------------------------------------------------
     Public API — replaces the old basic editor everywhere
     ------------------------------------------------------------------------ */

  window.openEditModal = openEditor;
  window.closeEditModal = closeEditorPublic;
  window.UniAIProfileStudio = { open: openEditor, close: closeEditorPublic };

  if (window.UniAIProfile) {
    window.UniAIProfile.openEditor = openEditor;
    window.UniAIProfile.closeEditor = closeEditorPublic;
  }

  // The old edit dialog should never appear alongside the new one.
  const legacy = $("edit-profile-overlay");
  if (legacy) legacy.style.display = "none";

  // Paint the saved character on the page once the auth client is ready.
  let tries = 0;
  (function bootIdentity() {
    const sb = window.supabaseApp;
    if (!sb || !sb.auth) {
      if (tries++ < 40) setTimeout(bootIdentity, 250);
      return;
    }
    sb.auth
      .getSession()
      .then(({ data }) => applyIdentity(data && data.session ? data.session.user : null))
      .catch(() => {});
  })();

  touchStreak();
})();