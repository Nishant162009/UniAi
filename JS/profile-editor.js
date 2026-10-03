/* ==========================================================================
   UniAI — Profile Studio (profile-editor.js)

   A game-style "Edit profile" experience:
     • pick a character + colour (some unlock as you level up)
     • live preview card with level ring, XP, streak and badges
     • profile "quests" that award XP as you fill them in
     • chunky 3-D buttons, bounce / shake / confetti feedback

   Install: add as the LAST script in index.html (after settings.js / visa.js,
   and after profilepage.js if you use it):
       <script src="JS/profile-editor.js"></script>

   It takes over window.openEditModal(), so every existing
   onclick="openEditModal()" button opens the new editor. Nothing else to edit.

   Saved to the account (Supabase user_metadata):
       username, profile_type          (already used by the rest of the app)
       avatar_emoji, avatar_color, bio, dream_countries[], degree_goal

   XP is real, derived from what the user has actually done:
       roadmap milestone ×100 · guide checklist item ×40 · saved item ×25
       SOP draft started ×150 · each profile quest ×25
   Streak is counted per browser (localStorage "uniai-streak").
   ========================================================================== */

(function () {
  "use strict";

  if (window.__uniaiProfileStudio) return;
  window.__uniaiProfileStudio = true;

  /* ------------------------------------------------------------------------
     Data
     ------------------------------------------------------------------------ */

  const LEVEL_XP = 150;
  const NAME_MIN = 2;
  const NAME_MAX = 40;
  const BIO_MAX = 80;
  const MAX_COUNTRIES = 3;

  // `lvl` = level needed to unlock that character.
  const AVATARS = [
    { e: "🦊", lvl: 1 }, { e: "🐼", lvl: 1 }, { e: "🐸", lvl: 1 }, { e: "🦁", lvl: 1 },
    { e: "🐨", lvl: 1 }, { e: "🐙", lvl: 1 }, { e: "🐧", lvl: 1 }, { e: "🐱", lvl: 1 },
    { e: "🐶", lvl: 1 }, { e: "🐰", lvl: 1 }, { e: "🦉", lvl: 1 }, { e: "🎓", lvl: 1 },
    { e: "🦄", lvl: 2 }, { e: "🐲", lvl: 2 }, { e: "🐯", lvl: 2 }, { e: "🦋", lvl: 2 },
    { e: "🚀", lvl: 2 }, { e: "🧠", lvl: 2 },
    { e: "⚡", lvl: 3 }, { e: "🔥", lvl: 3 }, { e: "🌍", lvl: 3 }, { e: "🎨", lvl: 3 },
    { e: "👑", lvl: 4 }, { e: "🌟", lvl: 4 }
  ];

  const COLORS = [
    { id: "violet", name: "Violet", css: "linear-gradient(135deg,#9a8bff,#5b4bff)" },
    { id: "pink", name: "Bubblegum", css: "linear-gradient(135deg,#ff8ac4,#ec4899)" },
    { id: "orange", name: "Sunset", css: "linear-gradient(135deg,#ffb86b,#ff6b3d)" },
    { id: "gold", name: "Gold", css: "linear-gradient(135deg,#ffe066,#f5a700)" },
    { id: "green", name: "Lime", css: "linear-gradient(135deg,#8be05a,#2fb344)" },
    { id: "teal", name: "Lagoon", css: "linear-gradient(135deg,#5eead4,#0ea5a4)" },
    { id: "blue", name: "Ocean", css: "linear-gradient(135deg,#6cc4ff,#2563eb)" },
    { id: "night", name: "Midnight", css: "linear-gradient(135deg,#475569,#0f172a)" }
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

  const gradFor = (id) => (COLORS.find((c) => c.id === id) || COLORS[0]).css;

  /* ------------------------------------------------------------------------
     Small helpers
     ------------------------------------------------------------------------ */

  const $ = (id) => document.getElementById(id);

  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

  const reduceMotion = () =>
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
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
      try {
        localStorage.setItem("uniai-streak", JSON.stringify(s));
      } catch (err) {
        /* ignore */
      }
    }
    return s;
  }

  function questList(d) {
    return [
      { id: "avatar", label: "Pick your character", done: Boolean(d.emoji) },
      { id: "bio", label: "Write a short bio", done: d.bio.trim().length >= 10 },
      { id: "dest", label: "Choose a dream destination", done: d.countries.length > 0 },
      { id: "degree", label: "Set your degree goal", done: Boolean(d.degree) }
    ];
  }

  const questsDone = (d) => questList(d).filter((q) => q.done).length;

  function levelInfo(totalXP) {
    const level = Math.floor(totalXP / LEVEL_XP) + 1;
    const into = totalXP % LEVEL_XP;
    return { level, into, pct: Math.round((into / LEVEL_XP) * 100) };
  }

  function badgeList(stats, streak, d) {
    return [
      { icon: "🔥", name: "On fire", hint: "3-day streak", on: (streak.count || 0) >= 3 },
      { icon: "🗺️", name: "Pathfinder", hint: "Finish a roadmap milestone", on: stats.roadmap >= 1 },
      { icon: "⭐", name: "Collector", hint: "Save 3 items", on: stats.saved >= 3 },
      { icon: "✍️", name: "Storyteller", hint: "Start an SOP draft", on: stats.sop >= 1 },
      { icon: "🏅", name: "All set", hint: "Complete every profile quest", on: questsDone(d) === 4 }
    ];
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
  --orange:#ff8a1f;--ol:#fff1e0;--red:#ef4444;--gold:#f5a700;
  position:relative;width:min(1040px,100%);max-height:min(860px,calc(100dvh - 40px));display:flex;flex-direction:column;
  background:var(--bg);color:var(--text);border-radius:28px;box-shadow:0 30px 80px rgba(20,14,70,.45);
  transform:translateY(24px) scale(.97);transition:transform .32s cubic-bezier(.2,1.2,.3,1);overflow:hidden}
.ue-open .ue-modal{transform:none}
html[data-theme="dark"] .ue-modal{--bg:#14162b;--card:#1c1f3a;--soft:#1a1d36;--line:#2c3050;--text:#f0f2ff;--muted:#9aa0c8;
  --pl:#272456;--gl:#14301f;--ol:#3a2612}

.ue-top{display:flex;align-items:center;gap:14px;padding:18px 22px;border-bottom:2px solid var(--line)}
.ue-top h2{margin:0;font-size:1.25rem;font-weight:800;letter-spacing:-.01em}
.ue-top p{margin:2px 0 0;color:var(--muted);font-size:.85rem}
.ue-x{margin-left:auto;width:42px;height:42px;border-radius:14px;border:2px solid var(--line);border-bottom-width:4px;
  background:var(--card);color:var(--muted);font-size:1.3rem;cursor:pointer;line-height:1}
.ue-x:hover{color:var(--text)}.ue-x:active{transform:translateY(2px);border-bottom-width:2px}

.ue-body{display:grid;grid-template-columns:330px 1fr;gap:0;min-height:0;flex:1}
.ue-side{padding:22px;background:var(--soft);border-right:2px solid var(--line);overflow-y:auto}
.ue-main{padding:22px 26px 26px;overflow-y:auto;min-width:0}

/* preview */
.ue-card{background:var(--card);border:2px solid var(--line);border-bottom-width:5px;border-radius:24px;padding:20px;text-align:center}
.ue-ringwrap{position:relative;width:132px;height:132px;margin:0 auto 10px}
.ue-ring{position:absolute;inset:0;transform:rotate(-90deg)}
.ue-ring circle{fill:none;stroke-width:7;stroke-linecap:round}
.ue-ring .bg{stroke:var(--line)}
.ue-ring .fg{stroke:var(--green);stroke-dasharray:339.3;transition:stroke-dashoffset .7s cubic-bezier(.3,1.3,.4,1)}
.ue-avatar{position:absolute;inset:14px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:3.2rem;color:#fff;box-shadow:inset 0 -6px 0 rgba(0,0,0,.14);transition:background .3s}
.ue-lvl{position:absolute;right:-4px;bottom:2px;background:var(--gold);color:#4a3200;font-weight:800;font-size:.72rem;
  padding:4px 9px;border-radius:999px;border:3px solid var(--card);letter-spacing:.04em}
.ue-pname{font-size:1.3rem;font-weight:800;margin:6px 0 2px;overflow-wrap:anywhere}
.ue-prole{display:inline-flex;gap:6px;align-items:center;background:var(--pl);color:var(--p);font-weight:700;font-size:.78rem;
  padding:5px 12px;border-radius:999px}
html[data-theme="dark"] .ue-prole{color:#b9b1ff}
.ue-pbio{color:var(--muted);font-size:.86rem;margin:10px 0 0;min-height:1.2em;overflow-wrap:anywhere}
.ue-pdest{margin-top:8px;font-size:1.3rem;letter-spacing:4px;min-height:1.6rem}
.ue-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
.ue-stat{border:2px solid var(--line);border-radius:16px;padding:9px 6px;background:var(--soft)}
.ue-stat b{display:block;font-size:1.15rem;font-weight:800}.ue-stat span{font-size:.7rem;color:var(--muted);font-weight:700;letter-spacing:.06em}
.ue-stat.fire b{color:var(--orange)}.ue-stat.xp b{color:var(--gd)}
html[data-theme="dark"] .ue-stat.xp b{color:#6ee787}
.ue-xpbar{height:14px;border-radius:999px;background:var(--line);margin-top:14px;overflow:hidden;position:relative}
.ue-xpbar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#58d36b,#2fb344);border-radius:999px;transition:width .6s cubic-bezier(.3,1.3,.4,1);
  box-shadow:inset 0 -3px 0 rgba(0,0,0,.12)}
.ue-xptext{display:flex;justify-content:space-between;font-size:.72rem;color:var(--muted);font-weight:700;margin-top:6px}

.ue-h{font-size:.74rem;font-weight:800;letter-spacing:.1em;color:var(--muted);margin:18px 0 8px}
.ue-badges{display:flex;gap:8px;flex-wrap:wrap}
.ue-badge{width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.35rem;
  background:var(--card);border:2px solid var(--line);border-bottom-width:4px;cursor:help}
.ue-badge.off{filter:grayscale(1);opacity:.4}
.ue-quest{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:14px;font-size:.85rem;font-weight:700;color:var(--muted);
  background:var(--card);border:2px solid var(--line);margin-bottom:6px;transition:all .25s}
.ue-quest .dot{width:22px;height:22px;border-radius:50%;border:2px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:.8rem;color:transparent;flex-shrink:0}
.ue-quest em{margin-left:auto;font-style:normal;font-size:.72rem;color:var(--muted)}
.ue-quest.done{background:var(--gl);border-color:var(--green);color:var(--gd)}
html[data-theme="dark"] .ue-quest.done{color:#6ee787}
.ue-quest.done .dot{background:var(--green);border-color:var(--green);color:#fff;animation:ue-pop .45s ease}
.ue-quest.done em{color:inherit}

/* mascot bubble */
.ue-say{display:flex;gap:12px;align-items:flex-start;margin-bottom:22px}
.ue-say .face{width:54px;height:54px;flex-shrink:0;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:1.9rem;
  background:var(--pl);border:2px solid var(--line);border-bottom-width:4px}
.ue-bubble{position:relative;background:var(--card);border:2px solid var(--line);border-radius:18px;padding:12px 16px;font-weight:700;font-size:.95rem;line-height:1.35}
.ue-bubble:before{content:"";position:absolute;left:-9px;top:18px;width:14px;height:14px;background:var(--card);
  border-left:2px solid var(--line);border-bottom:2px solid var(--line);transform:rotate(45deg)}
.ue-bubble.pop{animation:ue-bub .35s ease}

/* sections */
.ue-sec{margin-bottom:28px}
.ue-sec>h3{display:flex;align-items:center;gap:10px;margin:0 0 12px;font-size:1.05rem;font-weight:800}
.ue-sec>h3 .n{width:28px;height:28px;border-radius:10px;background:var(--p);color:#fff;font-size:.85rem;display:flex;align-items:center;justify-content:center;
  box-shadow:inset 0 -3px 0 rgba(0,0,0,.2)}
.ue-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(62px,1fr));gap:10px}
.ue-av{aspect-ratio:1;border-radius:18px;border:2px solid var(--line);border-bottom-width:5px;background:var(--card);font-size:1.9rem;cursor:pointer;
  position:relative;transition:transform .12s,border-color .12s}
.ue-av:hover{transform:translateY(-2px)}
.ue-av:active{transform:translateY(2px);border-bottom-width:2px}
.ue-av.sel{border-color:var(--p);background:var(--pl);box-shadow:0 0 0 3px rgba(109,93,251,.25)}
.ue-av.lock{opacity:.55;filter:grayscale(.7)}
.ue-av.lock:after{content:"🔒";position:absolute;right:-5px;bottom:-5px;font-size:.9rem;background:var(--card);border-radius:50%;padding:2px;border:2px solid var(--line)}
.ue-av .lv{position:absolute;left:4px;top:3px;font-size:.58rem;font-weight:800;color:var(--muted)}
.ue-colors{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
.ue-col{width:38px;height:38px;border-radius:50%;border:3px solid var(--card);cursor:pointer;box-shadow:0 0 0 2px var(--line);transition:transform .12s}
.ue-col:hover{transform:scale(1.1)}
.ue-col.sel{box-shadow:0 0 0 3px var(--p);transform:scale(1.12)}

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
  transition:transform .12s,border-color .12s}
.ue-role:active,.ue-deg:active,.ue-chip:active{transform:translateY(2px);border-bottom-width:3px}
.ue-role{border-radius:20px;padding:16px;display:flex;flex-direction:column;gap:4px}
.ue-role .i{font-size:1.9rem}.ue-role b{font-size:1rem}.ue-role small{color:var(--muted);font-weight:600;font-size:.8rem}
.ue-role.sel,.ue-deg.sel,.ue-chip.sel{border-color:var(--p);background:var(--pl)}
.ue-chips{display:flex;gap:10px;flex-wrap:wrap}
.ue-chip{border-radius:16px;padding:10px 14px;font-weight:800;font-size:.9rem}
.ue-degs{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.ue-deg{border-radius:16px;padding:12px 8px;text-align:center;font-weight:800;font-size:.85rem}
.ue-deg .i{display:block;font-size:1.4rem;margin-bottom:2px}
.ue-hint{color:var(--muted);font-size:.8rem;font-weight:600;margin:0 0 10px}

/* footer */
.ue-foot{display:flex;gap:12px;align-items:center;justify-content:flex-end;padding:16px 22px;border-top:2px solid var(--line);background:var(--bg)}
.ue-foot .msg{margin-right:auto;font-size:.85rem;font-weight:700;color:var(--muted)}
.ue-btn{font:inherit;font-weight:800;letter-spacing:.05em;text-transform:uppercase;font-size:.88rem;border-radius:16px;padding:14px 26px;cursor:pointer;
  border:2px solid transparent;border-bottom-width:5px;transition:transform .1s,filter .15s}
.ue-btn:active:not(:disabled){transform:translateY(3px);border-bottom-width:2px}
.ue-btn.ghost{background:var(--card);color:var(--muted);border-color:var(--line)}
.ue-btn.go{background:var(--green);color:#fff;border-color:var(--gd)}
.ue-btn.go:hover:not(:disabled){filter:brightness(1.06)}
.ue-btn:disabled{background:var(--line);color:var(--muted);border-color:var(--line);cursor:not-allowed}

.ue-toast{position:fixed;left:50%;bottom:28px;transform:translate(-50%,40px);z-index:10002;background:var(--green,#2fb344);color:#fff;
  padding:14px 22px;border-radius:18px;font:800 .95rem "Plus Jakarta Sans",system-ui,sans-serif;box-shadow:0 14px 40px rgba(0,0,0,.3);
  border-bottom:4px solid #23903a;opacity:0;transition:all .35s cubic-bezier(.2,1.3,.4,1)}
.ue-toast.err{background:#ef4444;border-color:#b91c1c}
.ue-toast.show{opacity:1;transform:translate(-50%,0)}

.ue-confetti{position:fixed;top:0;width:10px;height:14px;z-index:10001;pointer-events:none;border-radius:2px;
  animation:ue-fall var(--d,1.6s) cubic-bezier(.2,.6,.4,1) forwards}

@keyframes ue-pop{0%{transform:scale(1)}40%{transform:scale(1.35) rotate(-8deg)}100%{transform:scale(1)}}
@keyframes ue-bub{0%{transform:scale(.94);opacity:.5}100%{transform:none;opacity:1}}
@keyframes ue-shake{0%,100%{transform:none}20%{transform:translateX(-7px)}40%{transform:translateX(7px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}
@keyframes ue-fall{0%{transform:translate(0,-20px) rotate(0);opacity:1}100%{transform:translate(var(--x,0),105vh) rotate(var(--r,540deg));opacity:.9}}
.ue-bounce{animation:ue-pop .45s ease}
.ue-shake{animation:ue-shake .4s ease}

@media (max-width:860px){
  .ue-overlay{padding:0;align-items:flex-end}
  .ue-modal{max-height:100dvh;height:100dvh;border-radius:0}
  .ue-body{grid-template-columns:1fr;overflow-y:auto;display:block}
  .ue-side{border-right:none;border-bottom:2px solid var(--line);overflow:visible}
  .ue-main{overflow:visible}
  .ue-degs{grid-template-columns:1fr 1fr}
  .ue-roles{grid-template-columns:1fr}
  .ue-foot .msg{display:none}
  .ue-btn{flex:1}
}
@media (prefers-reduced-motion:reduce){
  .ue-overlay,.ue-modal,.ue-ring .fg,.ue-xpbar i,.ue-toast{transition:none}
  .ue-bounce,.ue-shake,.ue-bubble.pop,.ue-quest.done .dot{animation:none}
  .ue-confetti{display:none}
}`;
    document.head.appendChild(style);
  }

  /* ------------------------------------------------------------------------
     Toast + confetti
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
    toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
  }

  function confetti() {
    if (reduceMotion()) return;
    const colors = ["#6d5dfb", "#ff8a1f", "#2fb344", "#ec4899", "#f5a700", "#2563eb"];
    for (let i = 0; i < 46; i++) {
      const p = document.createElement("i");
      p.className = "ue-confetti";
      p.style.left = `${35 + Math.random() * 30}%`;
      p.style.background = colors[i % colors.length];
      p.style.setProperty("--x", `${(Math.random() - 0.5) * 520}px`);
      p.style.setProperty("--r", `${300 + Math.random() * 600}deg`);
      p.style.setProperty("--d", `${1.2 + Math.random() * 0.9}s`);
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 2400);
    }
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

  async function openEditor() {
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

    injectStyles();

    const stats = activityStats();
    const streak = touchStreak();
    const baseXP = activityXP(stats);

    const initial = draftFromUser(user);
    const draft = JSON.parse(JSON.stringify(initial));

    /* ---- markup ---- */

    const overlay = document.createElement("div");
    overlay.id = "ue-overlay";
    overlay.className = "ue-overlay";
    overlay.innerHTML = `
      <div class="ue-modal" role="dialog" aria-modal="true" aria-labelledby="ue-title">
        <div class="ue-top">
          <div>
            <h2 id="ue-title">Your profile</h2>
            <p>Make it yours — level up as you go.</p>
          </div>
          <button type="button" class="ue-x" id="ue-close" aria-label="Close">×</button>
        </div>

        <div class="ue-body">
          <aside class="ue-side" aria-label="Preview">
            <div class="ue-card">
              <div class="ue-ringwrap">
                <svg class="ue-ring" viewBox="0 0 120 120" aria-hidden="true">
                  <circle class="bg" cx="60" cy="60" r="54"></circle>
                  <circle class="fg" id="ue-ringfg" cx="60" cy="60" r="54" stroke-dashoffset="339.3"></circle>
                </svg>
                <div class="ue-avatar" id="ue-avatar"></div>
                <span class="ue-lvl" id="ue-lvl">LVL 1</span>
              </div>
              <div class="ue-pname" id="ue-pname"></div>
              <span class="ue-prole" id="ue-prole"></span>
              <p class="ue-pbio" id="ue-pbio"></p>
              <div class="ue-pdest" id="ue-pdest"></div>

              <div class="ue-xpbar"><i id="ue-xpfill"></i></div>
              <div class="ue-xptext"><span id="ue-xpleft"></span><span id="ue-xpnext"></span></div>

              <div class="ue-stats">
                <div class="ue-stat fire"><b id="ue-streak">0</b><span>🔥 DAY STREAK</span></div>
                <div class="ue-stat xp"><b id="ue-xp">0</b><span>⚡ TOTAL XP</span></div>
              </div>
            </div>

            <div class="ue-h">PROFILE QUESTS</div>
            <div id="ue-quests"></div>

            <div class="ue-h">BADGES</div>
            <div class="ue-badges" id="ue-badges"></div>
          </aside>

          <section class="ue-main">
            <div class="ue-say">
              <div class="face" aria-hidden="true">🦉</div>
              <div class="ue-bubble" id="ue-bubble" aria-live="polite"></div>
            </div>

            <div class="ue-sec">
              <h3><span class="n">1</span> Choose your character</h3>
              <div class="ue-grid" id="ue-avatars" role="listbox" aria-label="Characters"></div>
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
      </div>`;

    document.body.appendChild(overlay);

    const q = (id) => overlay.querySelector(`#${id}`);
    const el = {
      avatar: q("ue-avatar"), lvl: q("ue-lvl"), ringfg: q("ue-ringfg"), pname: q("ue-pname"), prole: q("ue-prole"),
      pbio: q("ue-pbio"), pdest: q("ue-pdest"), xpfill: q("ue-xpfill"), xpleft: q("ue-xpleft"), xpnext: q("ue-xpnext"),
      streak: q("ue-streak"), xp: q("ue-xp"), quests: q("ue-quests"), badges: q("ue-badges"), bubble: q("ue-bubble"),
      avatars: q("ue-avatars"), colors: q("ue-colors"), name: q("ue-name"), nameerr: q("ue-nameerr"),
      namecount: q("ue-namecount"), bio: q("ue-bio"), biocount: q("ue-biocount"), roles: q("ue-roles"),
      countries: q("ue-countries"), degrees: q("ue-degrees"), save: q("ue-save"), cancel: q("ue-cancel"),
      close: q("ue-close"), msg: q("ue-msg")
    };

    const levelNow = levelInfo(baseXP + questsDone(initial) * 25).level;

    /* ---- build the (static) option buttons once ---- */

    AVATARS.forEach((a) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ue-av";
      b.dataset.emoji = a.e;
      b.setAttribute("role", "option");
      b.innerHTML = `${a.e}${a.lvl > 1 ? `<span class="lv">LV${a.lvl}</span>` : ""}`;
      if (a.lvl > levelNow && a.e !== initial.emoji) b.classList.add("lock");
      el.avatars.appendChild(b);
    });

    COLORS.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ue-col";
      b.dataset.color = c.id;
      b.title = c.name;
      b.setAttribute("aria-label", c.name);
      b.setAttribute("role", "option");
      b.style.background = c.css;
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

    el.name.value = draft.username;
    el.bio.value = draft.bio;

    /* ---- render: only toggles classes / text, never rebuilds inputs ---- */

    const isDirty = () => JSON.stringify(draft) !== JSON.stringify(initial);

    function say(text, pop) {
      if (el.bubble.textContent === text) return;
      el.bubble.textContent = text;
      if (pop && !reduceMotion()) {
        el.bubble.classList.remove("pop");
        void el.bubble.offsetWidth;
        el.bubble.classList.add("pop");
      }
    }

    function mascotLine() {
      const n = cleanName(draft.username);
      const done = questsDone(draft);

      if (nameError(draft.username)) return "First things first — what should we call you?";
      if (done === 4) return `You're all set, ${n}! Hit save to lock it in. 🎉`;
      if (!draft.emoji) return `Nice to meet you, ${n}! Pick a character you like.`;
      if (draft.bio.trim().length < 10) return "Add a short bio — it earns you XP!";
      if (!draft.countries.length) return "Where do you want to study? Pick a dream destination.";
      if (!draft.degree) return "Almost there — which degree are you aiming for?";
      return `Looking good, ${n}!`;
    }

    function render(sayPop) {
      const nameErr = nameError(draft.username);
      const nm = cleanName(draft.username);
      const total = baseXP + questsDone(draft) * 25;
      const lv = levelInfo(total);
      const role = ROLES.find((r) => r.id === draft.role) || ROLES[0];

      // preview
      el.avatar.style.background = gradFor(draft.color);
      el.avatar.textContent = draft.emoji || (nm ? nm.charAt(0).toUpperCase() : "?");
      if (!draft.emoji) el.avatar.style.fontSize = "2.6rem";
      else el.avatar.style.fontSize = "";
      el.pname.textContent = nm || "Your name";
      el.prole.textContent = `${role.icon} ${role.label}`;
      el.pbio.textContent = draft.bio.trim() || "Your bio shows up here.";
      el.pdest.textContent = draft.countries
        .map((id) => (COUNTRIES.find((c) => c.id === id) || {}).flag || "")
        .join(" ");
      el.lvl.textContent = `LVL ${lv.level}`;
      el.ringfg.setAttribute("stroke-dashoffset", String(339.3 - (339.3 * lv.pct) / 100));
      el.xpfill.style.width = `${lv.pct}%`;
      el.xpleft.textContent = `${lv.into} / ${LEVEL_XP} XP`;
      el.xpnext.textContent = `${LEVEL_XP - lv.into} to LVL ${lv.level + 1}`;
      el.streak.textContent = String(streak.count || 0);
      el.xp.textContent = String(total);

      // quests + badges
      el.quests.innerHTML = questList(draft)
        .map(
          (x) =>
            `<div class="ue-quest${x.done ? " done" : ""}"><span class="dot">✓</span>${esc(x.label)}<em>+25 XP</em></div>`
        )
        .join("");

      el.badges.innerHTML = badgeList(stats, streak, draft)
        .map(
          (b) =>
            `<span class="ue-badge${b.on ? "" : " off"}" title="${esc(b.name)} — ${esc(b.hint)}">${b.icon}</span>`
        )
        .join("");

      // selections
      el.avatars.querySelectorAll(".ue-av").forEach((b) => {
        const on = b.dataset.emoji === draft.emoji;
        b.classList.toggle("sel", on);
        b.setAttribute("aria-selected", String(on));
      });
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
        b.classList.toggle("sel", draft.countries.includes(b.dataset.country));
      });
      el.degrees.querySelectorAll(".ue-deg").forEach((b) => {
        const on = b.dataset.degree === draft.degree;
        b.classList.toggle("sel", on);
        b.setAttribute("aria-checked", String(on));
      });

      // inputs
      const len = cleanName(draft.username).length;
      el.namecount.textContent = `${len}/${NAME_MAX}`;
      el.namecount.classList.toggle("bad", len > NAME_MAX);
      el.biocount.textContent = `${draft.bio.length}/${BIO_MAX}`;

      const showErr = el.name.dataset.touched === "1" && nameErr;
      el.nameerr.textContent = showErr ? nameErr : "";
      el.name.classList.toggle("bad", Boolean(showErr));

      // footer
      const dirty = isDirty();
      el.save.disabled = !dirty || Boolean(nameErr) || saving;
      el.msg.textContent = nameErr
        ? "Add a username to continue."
        : dirty
          ? "You have unsaved changes."
          : "Everything is saved.";

      say(mascotLine(), sayPop);
    }

    /* ---- interaction ---- */

    let saving = false;

    function bounce(node) {
      if (reduceMotion()) return;
      node.classList.remove("ue-bounce");
      void node.offsetWidth;
      node.classList.add("ue-bounce");
    }

    function shake(node) {
      if (reduceMotion()) return;
      node.classList.remove("ue-shake");
      void node.offsetWidth;
      node.classList.add("ue-shake");
    }

    el.avatars.addEventListener("click", (e) => {
      const b = e.target.closest(".ue-av");
      if (!b) return;

      if (b.classList.contains("lock")) {
        const need = (AVATARS.find((a) => a.e === b.dataset.emoji) || {}).lvl;
        shake(b);
        say(`That one unlocks at level ${need}. Finish roadmap steps and save items to earn XP!`, true);
        return;
      }

      draft.emoji = b.dataset.emoji;
      bounce(el.avatar);
      bounce(b);
      render(true);
    });

    el.colors.addEventListener("click", (e) => {
      const b = e.target.closest(".ue-col");
      if (!b) return;
      draft.color = b.dataset.color;
      render(false);
    });

    el.roles.addEventListener("click", (e) => {
      const b = e.target.closest(".ue-role");
      if (!b) return;
      draft.role = b.dataset.role;
      bounce(b);
      render(false);
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
      render(true);
    });

    el.degrees.addEventListener("click", (e) => {
      const b = e.target.closest(".ue-deg");
      if (!b) return;
      draft.degree = b.dataset.degree;
      bounce(b);
      render(true);
    });

    el.name.addEventListener("input", () => {
      draft.username = el.name.value;
      el.name.dataset.touched = "1";
      render(false);
    });

    el.bio.addEventListener("input", () => {
      draft.bio = el.bio.value;
      render(false);
    });

    /* ---- closing ---- */

    async function requestClose() {
      if (saving) return;

      if (isDirty()) {
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
      overlay.classList.remove("ue-open");
      document.removeEventListener("keydown", onKey, true);
      document.documentElement.style.overflow = prevOverflow;
      active = null;
      setTimeout(() => overlay.remove(), 260);
      if (opener && typeof opener.focus === "function") opener.focus();
    }

    /* ---- saving ---- */

    el.save.addEventListener("click", async () => {
      const err = nameError(draft.username);
      if (err) {
        el.name.dataset.touched = "1";
        render(false);
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

      const payload = {
        username: cleanName(draft.username),
        profile_type: draft.role,
        avatar_emoji: draft.emoji,
        avatar_color: draft.color,
        bio: draft.bio.trim().slice(0, BIO_MAX),
        dream_countries: draft.countries.slice(0, MAX_COUNTRIES),
        degree_goal: draft.degree
      };

      try {
        const { data, error } = await sb.auth.updateUser({ data: payload });
        if (error) throw error;

        const fresh = (data && data.user) || user;
        applyIdentity(fresh);

        window.dispatchEvent(new CustomEvent("uniai:profile-updated", { detail: { profile: payload } }));
        if (window.UniAIProfile && typeof window.UniAIProfile.refresh === "function") {
          window.UniAIProfile.refresh();
        }

        const gained = (questsDone(draft) - questsDone(initial)) * 25;
        const lvBefore = levelInfo(baseXP + questsDone(initial) * 25).level;
        const lvAfter = levelInfo(baseXP + questsDone(draft) * 25).level;

        confetti();
        toast(
          lvAfter > lvBefore
            ? `LEVEL UP! You're now level ${lvAfter} 🎉`
            : gained > 0
              ? `Profile saved! +${gained} XP ⚡`
              : "Profile saved! ✨"
        );

        saving = false;
        el.save.textContent = "Saved ✓";
        setTimeout(closeEditor, 900);
      } catch (error) {
        console.error("Profile Studio: save failed", error);
        saving = false;
        el.save.textContent = "Save changes";
        toast((error && error.message) || "Couldn't save your profile. Try again.", true);
        render(false);
      }
    });

    /* ---- go ---- */

    active = { close: closeEditor };
    render(false);

    requestAnimationFrame(() => {
      overlay.classList.add("ue-open");
      setTimeout(() => el.name.focus(), 150);
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