/* ==========================================================================
   UniAI — main client script
   Plan Smarter. Go Farther.

   Structure
   ---------
   00. Config & state
   01. Supabase client
   02. Auth (sign in / sign up / sign out / session sync)
   03. Profile page + edit modal
   04. Page navigation
   05. Theme
   06. University finder
   07. University details modal
   08. Shortlist
   09. Living cost calculator
   10. Currency converter
   11. SOP studio
   12. AI chat
   13. Particles / scroll-to-top / boot sequence
   14. Global exports + single init
   ========================================================================== */

"use strict";

/* ==========================================================================
   00. CONFIG & STATE
   ========================================================================== */

const CONFIG = {
  SUPABASE_URL: "https://fmphoudjslmwsebqttlf.supabase.co",
  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtcGhvdWRqc2xtd3NlYnF0dGxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NjAxNTQsImV4cCI6MjA5OTQzNjE1NH0.w10MlWop_go_qp7eIyYYFIy3ts38ReYmZJjQJqKZKmM",

  // Point this at your backend. Empty string = same origin.
  API_BASE: "http://localhost:5000",

  // Chat endpoint (relative = served by whatever host serves the page).
  CHAT_ENDPOINT: "/ai/chat",

  // Where a university card sends you.
  //   "route" -> /university/<slug>        (needs the server to serve that path)
  //   "file"  -> university.html?slug=...  (works on plain static hosting)
  UNI_DETAIL_MODE: "route",
  UNI_DETAIL_ROUTE: "/university",
  UNI_DETAIL_FILE: "university.html",

  // Pages that require a signed-in user. Guide pages (guides/*.html) are
  // locked separately — see setupGuideLocks() and guides/guard.js.
  PROTECTED_PAGES: ["ai-chat", "workspace", "visaGuide", "sopStudio", "roadmap"],

  STORAGE: {
    theme: "uniai-theme",
    chat: "uniAIConversation",
    shortlist: "uniai-shortlist"
  }
};

// Sign-in modal title shown when a locked page/link is opened while signed out.
const LOCK_TITLES = {
  "ai-chat": "Unlock the AI Chat Assistant",
  workspace: "Unlock your Workspace",
  visaGuide: "Sign in to open the Visa Guide",
  sopStudio: "Sign in to use SOP & LOR Tools",
  roadmap: "Sign in to open your Roadmap",
  guide: "Sign in to read the guides"
};

const state = {
  session: null,
  universities: [],
  shortlist: [],
  conversation: [],
  isSending: false,
  isSignUpMode: false,
  pendingAction: null
};

/* Small DOM helpers ------------------------------------------------------- */

const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function setText(target, value) {
  const els = typeof target === "string" ? $$(target) : [target];
  els.forEach((el) => {
    if (el) el.textContent = value;
  });
}

function show(el, display = "block") {
  if (el) el.style.display = display;
}

function hide(el) {
  if (el) el.style.display = "none";
}

function titleCase(str) {
  const s = String(str || "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function api(path) {
  return `${CONFIG.API_BASE}${path}`;
}

/**
 * Backends don't always send a slug, so derive one from the name as a fallback.
 * "University of Toronto" -> "university-of-toronto"
 */
function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getUniSlug(uni) {
  return uni.slug || slugify(uni.name || uni.displayName);
}

function uniDetailUrl(uni) {
  const slug = getUniSlug(uni);
  if (!slug) return null;

  return CONFIG.UNI_DETAIL_MODE === "file"
    ? `${CONFIG.UNI_DETAIL_FILE}?slug=${encodeURIComponent(slug)}`
    : `${CONFIG.UNI_DETAIL_ROUTE}/${encodeURIComponent(slug)}`;
}

function openUniDetailPage(uni, newTab = false) {
  const url = uniDetailUrl(uni);

  if (!url) {
    showUniDetails(uni); // nothing to link to — fall back to the modal
    return;
  }

  // Stash the record so the detail page can render instantly instead of
  // waiting on a second fetch. Read it there with:
  //   JSON.parse(sessionStorage.getItem("uniai-selected-university"))
  try {
    sessionStorage.setItem("uniai-selected-university", JSON.stringify(uni));
  } catch (err) {
    /* private mode — the detail page will just fetch by slug instead */
  }

  if (newTab) window.open(url, "_blank", "noopener");
  else window.location.href = url;
}

function readStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.warn("Storage read failed:", key, err);
    return fallback;
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn("Storage write failed:", key, err);
  }
}

/* ==========================================================================
   01. SUPABASE CLIENT
   ========================================================================== */

let supabaseApp = null;

function initSupabase() {
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.warn(
      "UniAI: Supabase SDK not loaded. Auth features will be disabled. " +
        "Add the CDN script tag before this file."
    );
    return null;
  }

  supabaseApp = window.supabase.createClient(
    CONFIG.SUPABASE_URL,
    CONFIG.SUPABASE_ANON_KEY
  );

  window.supabaseApp = supabaseApp;
  return supabaseApp;
}

/* ==========================================================================
   02. AUTH
   ========================================================================== */

function getProfileFromSession(session) {
  if (!session || !session.user) return null;

  const meta = session.user.user_metadata || {};
  const email = session.user.email || "";
  const username = meta.username || email.split("@")[0] || "member";

  return {
    email,
    username,
    displayName: titleCase(username),
    role: meta.profile_type || "student",
    initial: (username.charAt(0) || "U").toUpperCase()
  };
}

/**
 * True if there is a signed-in user. Fails CLOSED: if the Supabase client
 * isn't available or the check errors, the user is treated as signed out.
 */
async function hasSession() {
  if (state.session) return true;
  if (!supabaseApp) return false;

  try {
    const { data } = await supabaseApp.auth.getSession();
    return Boolean(data && data.session);
  } catch (err) {
    console.error("Auth check failed:", err);
    return false;
  }
}

/**
 * After a successful sign-in, continue to whatever the user was trying to open
 * (a locked page or a guide link).
 */
function runPendingAction() {
  const action = state.pendingAction;
  if (!action) return;
  state.pendingAction = null;

  if (action.type === "page") showPage(action.page);
  else if (action.type === "url") window.location.href = action.url;
}

/**
 * Single place where every piece of session-driven UI is updated.
 * Called on every auth state change, so nav + profile page never drift apart.
 */
function syncSessionUI(session) {
  state.session = session || null;

  window.dispatchEvent(
    new CustomEvent("uniai:auth-state", {
      detail: { session: state.session }
    })
  );

  const profileBadge = $("user-profile-badge");
  const promoBanner = $("auth-promo-banner");
  const signInBtn = $("auth-nav-trigger");
  const logoutBtn = $("logout-btn");
  const editOverlay = $("edit-profile-overlay");

  hide(editOverlay);

  // Account card elements
  const accountAvatarText = $("account-avatar-text");
  const accountStatusText = $("account-status-text");
  const accountTitle = $("account-title");
  const settingsSignInBtn = $("settings-signin-btn");
  const aiChatLockPill = $("ai-chat-lock-pill");
  const aiChatLockNotice = $("ai-chat-lock-notice");
  const settingsAccountActions = $("settings-account-actions");
  const settingsSignoutBtn = $("settings-signout-btn");
  const settingsDeleteBtn = $("settings-delete-btn");

  // Session elements
  const sessionAccountName = $("session-account-name");
  const sessionType = $("session-type");
  const sessionStorageType = $("session-storage-type");

  if (!session) {
    // --- SIGNED OUT STATE ---
    hide(profileBadge);
    show(promoBanner, "flex");
    show(signInBtn, "inline-flex");
    hide(logoutBtn);

    // Reset Avatar to "?"
    if (accountAvatarText) accountAvatarText.textContent = "?";

    // Reset Account Panel
    if (accountStatusText) accountStatusText.textContent = "Signed out";
    if (accountTitle) accountTitle.textContent = "Guest account";
    if (settingsSignInBtn) show(settingsSignInBtn, "inline-flex");
    if (settingsAccountActions) hide(settingsAccountActions);
    if (settingsSignoutBtn) hide(settingsSignoutBtn);
    if (settingsDeleteBtn) hide(settingsDeleteBtn);
    if (aiChatLockPill) {
      aiChatLockPill.textContent = "Locked";
      aiChatLockPill.classList.add("locked");
    }
    if (aiChatLockNotice) show(aiChatLockNotice);

    // Reset Session Panel
    if (sessionAccountName) sessionAccountName.textContent = "Guest";
    if (sessionType) sessionType.textContent = "Local";
    if (sessionStorageType) sessionStorageType.textContent = "Browser";

    renderProfilePage(null);
    return;
  }

  // --- SIGNED IN STATE ---
  hide(promoBanner);
  hide(signInBtn);
  show(logoutBtn, "inline-flex");
  show(profileBadge, "flex");

  const profile = getProfileFromSession(session);

  // Header Nav Updates
  setText($("user-display-name"), profile.displayName);
  setText($("nav-username"), profile.displayName);
  setText($("nav-profile-type"), profile.role);

  // Update Avatar with first letter of display name (e.g. "N" for "Nishant")
  if (accountAvatarText) {
    const initial = profile.displayName ? profile.displayName.charAt(0).toUpperCase() : "U";
    accountAvatarText.textContent = initial;
  }

  // Update Account Panel
  if (accountStatusText) accountStatusText.textContent = "Signed in";
  if (accountTitle) accountTitle.textContent = profile.displayName;
  if (settingsSignInBtn) hide(settingsSignInBtn);
  if (settingsAccountActions) {
    show(settingsAccountActions, "flex");
  }
  if (settingsSignoutBtn) {
    show(settingsSignoutBtn, "inline-flex");
  }
  if (settingsDeleteBtn) {
    show(settingsDeleteBtn, "inline-flex");
  }
  if (aiChatLockPill) {
    aiChatLockPill.textContent = "Unlocked";
    aiChatLockPill.classList.remove("locked");
  }
  if (aiChatLockNotice) hide(aiChatLockNotice);

  // Update Session Panel
  if (sessionAccountName) sessionAccountName.textContent = profile.displayName;
  if (sessionType) sessionType.textContent = "Authenticated";
  if (sessionStorageType) sessionStorageType.textContent = "Cloud Sync";

  renderProfilePage(profile);

  // Continue to the locked page / guide the user originally tried to open.
  runPendingAction();
}

function watchAuthState() {
  if (!supabaseApp) {
    syncSessionUI(null);
    return;
  }

  supabaseApp.auth.onAuthStateChange((_event, session) => {
    syncSessionUI(session);
  });

  // Covers the case where the SDK resolves the stored session late.
  supabaseApp.auth
    .getSession()
    .then(({ data }) => syncSessionUI(data ? data.session : null))
    .catch((err) => console.warn("getSession failed:", err));
}

function setAuthMode(signUp) {
  state.isSignUpMode = signUp;

  const authTitle = $("auth-title");
  const authSubtitle = $("auth-subtitle");
  const submitBtn = $("auth-submit-btn");
  const toggleText = $("auth-toggle-text");

  if (signUp) {
    setText(authTitle, "Create Account");
    setText(
      authSubtitle,
      "🚀 Create an account to unlock your AI Chat Assistant and set up your admissions tracker."
    );
    setText(submitBtn, "Sign Up & Unlock");
    if (toggleText) {
      toggleText.innerHTML =
        'Already have an account? <span id="auth-toggle-link" class="auth-link">Sign In</span>';
    }
  } else {
    setText(authTitle, "Unlock UniAI");
    setText(
      authSubtitle,
      "✨ Sign in to unlock your AI university assistant and start tracking your study abroad plans."
    );
    setText(submitBtn, "Sign In");
    if (toggleText) {
      toggleText.innerHTML =
        "Don't have an account? <span id=\"auth-toggle-link\" class=\"auth-link\">Sign Up for Free</span>";
    }
  }

  $$(".signup-only-field").forEach((el) => {
    el.style.display = signUp ? "block" : "none";
  });
}

function setupAuthForm() {
  const authForm = $("auth-form");

  // Delegated so it survives the innerHTML swap in setAuthMode().
  document.addEventListener("click", (e) => {
    const link = e.target.closest("#auth-toggle-link");
    if (!link) return;
    e.preventDefault();
    setAuthMode(!state.isSignUpMode);
  });

  $$("[data-open-auth]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openAuthOverlay(btn.dataset.openAuth === "signup");
    });
  });

  const navTrigger = $("auth-nav-trigger");
  if (navTrigger && !navTrigger.dataset.bound) {
    navTrigger.dataset.bound = "1";
    navTrigger.addEventListener("click", (e) => {
      e.preventDefault();
      openAuthOverlay(false);
    });
  }

  if (!authForm) return;

  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const errorMsg = $("auth-error-msg");
    const submitBtn = $("auth-submit-btn");
    const email = $("auth-email") ? $("auth-email").value.trim() : "";
    const password = $("auth-password") ? $("auth-password").value : "";

    if (errorMsg) errorMsg.textContent = "";

    if (!supabaseApp) {
      if (errorMsg) {
        errorMsg.textContent =
          "Auth service unavailable — the Supabase client failed to load.";
      }
      return;
    }

    if (!email || !password) {
      if (errorMsg) errorMsg.textContent = "Email and password are required.";
      return;
    }

    if (submitBtn) submitBtn.disabled = true;

    try {
      if (state.isSignUpMode) {
        const usernameEl = $("auth-username");
        const roleEl = $("auth-profile-type");
        const username = usernameEl ? usernameEl.value.trim() : "";

        const { error } = await supabaseApp.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username || email.split("@")[0],
              profile_type: roleEl ? roleEl.value : "student"
            }
          }
        });

        if (error) throw error;

        if (errorMsg) {
          errorMsg.style.color = "#10b981";
          errorMsg.textContent =
            "Account created. Check your inbox if email verification is on.";
        }
      } else {
        const { error } = await supabaseApp.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
      }

      authForm.reset();
      hide($("auth-overlay"));
    } catch (err) {
      if (errorMsg) {
        errorMsg.style.color = "";
        errorMsg.textContent = err.message || "Authentication failed.";
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

/**
 * @param {boolean} signUp   open in sign-up mode
 * @param {string}  title    optional modal title
 * @param {object}  pending  optional action to run after sign-in:
 *                           { type: "page", page } | { type: "url", url }
 *                           Any call without it clears a previous pending action.
 */
function openAuthOverlay(signUp = false, title, pending = null) {
  setAuthMode(signUp);
  state.pendingAction = pending;
  if (title) setText($("auth-title"), title);
  show($("auth-overlay"), "flex");
}

/**
 * Locks every link that points into guides/ (Study Abroad Guide cards,
 * footer directory, footer destination chips) while signed out.
 * The guide pages themselves are guarded by guides/guard.js.
 */
function setupGuideLocks() {
  document.addEventListener("click", async (e) => {
    const link = e.target.closest('a[href^="guides/"]');
    if (!link || state.session) return;

    e.preventDefault();
    const href = link.getAttribute("href");

    if (await hasSession()) {
      window.location.href = href;
      return;
    }

    openAuthOverlay(false, LOCK_TITLES.guide, { type: "url", url: href });
  });
}

/**
 * Guide pages send signed-out visitors here as
 *   index.html?login=required&next=guides/usa.html
 * Open the sign-in modal and continue to that guide after login.
 */
async function handleLoginRedirect() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("login") !== "required") return;

  // Clean the URL so a refresh doesn't re-trigger this.
  history.replaceState(null, "", window.location.pathname);

  // Already signed in? Don't bounce back to the guide (avoids a redirect loop).
  if (await hasSession()) return;

  const next = params.get("next");
  const safe = next && /^guides\/[a-z0-9-]+\.html$/i.test(next) ? next : null;

  openAuthOverlay(
    false,
    LOCK_TITLES.guide,
    safe ? { type: "url", url: safe } : null
  );
}

/**
 * Shows the styled #confirm-overlay card and resolves true/false based on
 * the user's choice. Falls back to the native window.confirm() only if the
 * overlay markup is missing from the page, so callers never hang.
 *
 * @param {string} message  body text shown in the card
 * @param {object} [opts]
 * @param {string} [opts.title]        defaults to "Are you sure?"
 * @param {string} [opts.confirmText]  defaults to "Confirm"
 * @param {string} [opts.cancelText]   defaults to "Cancel"
 * @returns {Promise<boolean>}
 */
function showConfirmCard(message, opts = {}) {
  const { title = "Are you sure?", confirmText = "Confirm", cancelText = "Cancel" } = opts;

  return new Promise((resolve) => {
    const overlay = $("confirm-overlay");

    if (!overlay) {
      resolve(window.confirm(message));
      return;
    }

    const titleEl = $("confirm-modal-title");
    const messageEl = $("confirm-modal-message");
    const confirmBtn = $("confirm-modal-confirm");
    const cancelBtn = $("confirm-modal-cancel");

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (confirmBtn) confirmBtn.textContent = confirmText;
    if (cancelBtn) cancelBtn.textContent = cancelText;

    const cleanup = (result) => {
      hide(overlay);
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKeydown);
      resolve(result);
    };

    const onConfirm = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onBackdrop = (e) => {
      if (e.target === overlay) cleanup(false);
    };
    const onKeydown = (e) => {
      if (e.key === "Escape") cleanup(false);
    };

    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    overlay.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKeydown);

    show(overlay, "flex");
  });
}

function setupLogout() {
  const logoutBtn = $("logout-btn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", async () => {
    // Respect the "Confirm destructive actions" preference from Settings.
    // Default to confirming if settings.js hasn't loaded yet, so the very
    // first click of the session is still safe.
    const confirmEnabled =
      !window.UniAISettings || window.UniAISettings.is("confirmActions");

    if (confirmEnabled) {
      const confirmed = await showConfirmCard(
        "You'll need to sign back in to access your saved data and AI features.",
        {
          title: "Sign out of UniAI?",
          confirmText: "Sign out",
          cancelText: "Stay signed in"
        }
      );
      if (!confirmed) return;
    }

    try {
      if (supabaseApp) await supabaseApp.auth.signOut();
      syncSessionUI(null);
      showPage("home");
    } catch (err) {
      console.error("Sign out failed:", err.message);
    }
  });
}

/* ==========================================================================
   03. PROFILE PAGE + EDIT MODAL
   ========================================================================== */

/**
 * Fills the markup in the profile section. Previously none of this was wired,
 * so the page always showed placeholder copy.
 */
function renderProfilePage(profile) {
  const page = $("profilePage");
  if (!page) return;

  if (!profile) {
    setText(".profile-name-echo", "You're not signed in");
    setText(".profile-email-echo", "Sign in to load your UniAI identity");
    setText(".profile-username-echo", "—");
    setText(".profile-role-echo", "Guest");
    setText(".profile-role-stat", "Guest");
    setText(".profile-role-info", "Guest");

    const avatar = page.querySelector(".profile-main-avatar");
    if (avatar) avatar.textContent = "?";

    const dot = page.querySelector(".avatar-online-dot");
    if (dot) dot.style.background = "#94a3b8";
    return;
  }

  setText(".profile-name-echo", profile.displayName);
  setText(".profile-email-echo", profile.email);
  setText(".profile-username-echo", profile.username);
  setText(".profile-role-echo", titleCase(profile.role));
  setText(".profile-role-stat", titleCase(profile.role));
  setText(".profile-role-info", titleCase(profile.role));

  const avatar = page.querySelector(".profile-main-avatar");
  if (avatar) avatar.textContent = profile.initial;

  const dot = page.querySelector(".avatar-online-dot");
  if (dot) dot.style.background = "#10b981";
}

/**
 * Reads from the session, not from navbar text nodes.
 */
function openEditModal() {
  if (!state.session) {
    openAuthOverlay(false, "Sign in to edit your profile");
    return;
  }

  const profile = getProfileFromSession(state.session);
  const usernameInput = $("edit-username");
  const roleSelect = $("edit-profile-type");

  if (usernameInput) usernameInput.value = profile.username;
  if (roleSelect) roleSelect.value = profile.role;

  const errorMsg = $("edit-error-msg");
  if (errorMsg) errorMsg.textContent = "";

  show($("edit-profile-overlay"), "flex");
}

function closeEditModal() {
  hide($("edit-profile-overlay"));
}

function setupEditProfileForm() {
  const editForm = $("edit-profile-form");
  if (!editForm) return;

  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const errorMsg = $("edit-error-msg");
    if (errorMsg) errorMsg.textContent = "";

    const newUsername = $("edit-username")
      ? $("edit-username").value.trim()
      : "";
    const newRole = $("edit-profile-type")
      ? $("edit-profile-type").value
      : "student";

    if (!supabaseApp) {
      if (errorMsg) errorMsg.textContent = "Auth service unavailable.";
      return;
    }

    if (!newUsername) {
      if (errorMsg) errorMsg.textContent = "Username cannot be empty.";
      return;
    }

    try {
      const { data, error } = await supabaseApp.auth.updateUser({
        data: { username: newUsername, profile_type: newRole }
      });

      if (error) throw error;

      // updateUser returns the fresh user; rebuild a session-shaped object
      // so every dependent surface refreshes through one code path.
      const refreshed = {
        ...(state.session || {}),
        user: data.user
      };

      syncSessionUI(refreshed);
      closeEditModal();
    } catch (err) {
      if (errorMsg) {
        errorMsg.textContent = err.message || "Failed to update profile.";
      }
    }
  });

  $$("[data-close-edit]").forEach((btn) =>
    btn.addEventListener("click", closeEditModal)
  );
}

/* ==========================================================================
   04. PAGE NAVIGATION
   ========================================================================== */

async function showPage(page, event) {
  if (event) event.preventDefault();

  if (CONFIG.PROTECTED_PAGES.includes(page)) {
    if (!(await hasSession())) {
      openAuthOverlay(
        false,
        LOCK_TITLES[page] || "Sign in to continue",
        { type: "page", page }
      );
      return;
    }
  }

  $$(".page-section").forEach((section) => {
    section.style.display = "";
    section.classList.remove("active-page");
    section.classList.add("hidden");
  });

  const target = $(page + "Page") || $(page);

  if (target) {
    // Lazy-load the SOP studio markup the first time it's opened.
    if (
      (page === "sopStudio" || page === "sopStudioPage") &&
      target.innerHTML.trim() === ""
    ) {
      try {
        const response = await fetch("sop.html");
        if (response.ok) target.innerHTML = await response.text();
      } catch (err) {
        console.error("Failed to load sop.html:", err);
      }
    }

    target.classList.remove("hidden");
    target.classList.add("active-page");
  } else {
    console.warn(`UniAI: no page element found for "${page}".`);
  }

  $$(".nav-btn").forEach((b) => b.classList.remove("active"));
  if (event && event.target && event.target.closest) {
    const navBtn = event.target.closest(".nav-btn");
    if (navBtn) navBtn.classList.add("active");
  }

  document.body.classList.remove("nav-open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ==========================================================================
   05. THEME
   ========================================================================== */

/**
 * Applies the theme to <html> whether or not the toggle button exists.
 */
function applyTheme(theme, save = true) {
  const isDark = theme === "dark";
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");

  const btn = $("theme-toggle");
  if (btn) {
    btn.classList.toggle("dark", isDark);
    btn.setAttribute("aria-pressed", String(isDark));
    btn.setAttribute(
      "aria-label",
      isDark ? "Switch to light mode" : "Switch to dark mode"
    );
  }

  if (save) {
    try {
      localStorage.setItem(CONFIG.STORAGE.theme, theme);
    } catch (err) {
      console.warn("Could not persist theme:", err);
    }
  }
}

function toggleDarkMode() {
  const isDark =
    document.documentElement.getAttribute("data-theme") === "dark";

  const btn = $("theme-toggle");
  if (btn) {
    btn.classList.remove("animating");
    void btn.offsetWidth; // restart the CSS animation
    btn.classList.add("animating");
    setTimeout(() => btn.classList.remove("animating"), 800);
  }

  applyTheme(isDark ? "light" : "dark", true);
}

function setupTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(CONFIG.STORAGE.theme);
  } catch (err) {
    /* private mode — ignore */
  }

  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  applyTheme(saved || (prefersDark ? "dark" : "light"), false);

  const btn = $("theme-toggle");
  if (!btn) return;

  // Call through window.toggleDarkMode (not the local function reference)
  // so settings.js can wrap it later and actually intercept clicks.
  btn.addEventListener("click", () => window.toggleDarkMode());

  btn.addEventListener("pointermove", (event) => {
    const knob = btn.querySelector(".knob");
    if (!knob) return;
    const rect = btn.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    knob.style.setProperty("--mx", `${x * 3}px`);
    knob.style.setProperty("--my", `${y * 3}px`);
  });

  btn.addEventListener("pointerleave", () => {
    const knob = btn.querySelector(".knob");
    if (!knob) return;
    knob.style.setProperty("--mx", "0px");
    knob.style.setProperty("--my", "0px");
  });
}

/* ==========================================================================
   06. UNIVERSITY FINDER
   ========================================================================== */

/**
 * Offline sample set so the Finder still demos when the backend is down.
 */
const SAMPLE_UNIVERSITIES = [
  { name: "University of Toronto", country: "Canada", qs_rank: 25, tuition_fee: 42000, ielts: 6.5, avg_gpa: 3.5, website: "https://www.utoronto.ca" },
  { name: "University of Melbourne", country: "Australia", qs_rank: 13, tuition_fee: 38000, ielts: 6.5, avg_gpa: 3.4, website: "https://www.unimelb.edu.au" },
  { name: "Technical University of Munich", country: "Germany", qs_rank: 28, tuition_fee: 3000, ielts: 6.5, avg_gpa: 3.3, website: "https://www.tum.de" },
  { name: "National University of Singapore", country: "Singapore", qs_rank: 8, tuition_fee: 29000, ielts: 6.5, avg_gpa: 3.7, website: "https://www.nus.edu.sg" },
  { name: "University of Manchester", country: "United Kingdom", qs_rank: 34, tuition_fee: 31000, ielts: 6.5, avg_gpa: 3.2, website: "https://www.manchester.ac.uk" },
  { name: "Arizona State University", country: "United States", qs_rank: 179, tuition_fee: 33000, ielts: 6.0, avg_gpa: 3.0, website: "https://www.asu.edu" },
  { name: "University of Tokyo", country: "Japan", qs_rank: 32, tuition_fee: 5000, ielts: 6.5, avg_gpa: 3.6, website: "https://www.u-tokyo.ac.jp" },
  { name: "Trinity College Dublin", country: "Ireland", qs_rank: 87, tuition_fee: 26000, ielts: 6.5, avg_gpa: 3.2, website: "https://www.tcd.ie" }
];

async function loadUniversities() {
  try {
    const response = await fetch(api("/universities"));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state.universities = Array.isArray(data) ? data : [];
    console.log(`UniAI: loaded ${state.universities.length} universities.`);
  } catch (err) {
    state.universities = SAMPLE_UNIVERSITIES.slice();
    console.warn(
      `UniAI: backend unreachable at ${CONFIG.API_BASE} — using the offline sample set.`
    );
  }
}

async function loadCountries() {
  const select = $("country");
  if (!select) return;

  let countries = [];

  try {
    const res = await fetch(api("/universities/countries"));
    if (res.ok) countries = await res.json();
  } catch (err) {
    /* fall through */
  }

  if (!countries.length) {
    try {
      const fallback = await fetch("https://restcountries.com/v3.1/all?fields=name");
      if (fallback.ok) {
        const data = await fallback.json();
        countries = data
          .map((c) => c.name && c.name.common)
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));
      }
    } catch (err) {
      console.warn("Country API unavailable, using the built-in list.");
    }
  }

  if (!countries.length) {
    countries = [...new Set(SAMPLE_UNIVERSITIES.map((u) => u.country))].sort();
  }

  select.innerHTML = '<option value="">🌍 All Countries</option>';
  countries.forEach((country) => {
    const option = document.createElement("option");
    option.value = country;
    option.textContent = country;
    select.appendChild(option);
  });
}

function getCategory(userGPA, uniGPA) {
  if (!userGPA) return "Target";
  if (userGPA >= uniGPA + 0.3) return "Safe";
  if (userGPA >= uniGPA - 0.2) return "Target";
  return "Dream";
}

function getColor(tag) {
  if (tag === "Safe") return "#00c853";
  if (tag === "Target") return "#ffab00";
  return "#ff5252";
}

/**
 * Deterministic match score — the original used Math.random(), so a card's
 * score changed on every re-render.
 */
function getMatchScore(gpa, uni) {
  const target = Number(uni.avg_gpa) || 3.2;
  const gap = (Number(gpa) || target) - target;
  const rankBonus = uni.qs_rank ? Math.max(0, 12 - Number(uni.qs_rank) / 40) : 4;
  return Math.max(55, Math.min(98, Math.round(78 + gap * 18 + rankBonus)));
}

function filterLocally({ country, searchQuery, budget }) {
  return state.universities.filter((u) => {
    const name = String(u.name || "");
    const uniCountry = String(u.country || "");

    if (country && uniCountry.toLowerCase() !== country.toLowerCase()) {
      return false;
    }
    if (
      searchQuery &&
      !name.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    if (budget && Number(u.tuition_fee || 0) > Number(budget)) {
      return false;
    }
    return true;
  });
}

async function findUniversities() {
  const results = $("results");
  if (!results) return;

  const country = $("country") ? $("country").value : "";
  const searchQuery = $("uni-search") ? $("uni-search").value.trim() : "";
  const gpa = parseFloat($("gpa") ? $("gpa").value : "") || 0;
  const budget = $("budget") ? $("budget").value : "";

  results.innerHTML = `
    <div class="finder-loading" style="grid-column:1/-1;padding:40px;text-align:center;background:rgba(0,0,0,.03);border-radius:20px;border:1px dashed rgba(109,93,251,.3);">
      <div style="font-size:2rem;margin-bottom:12px;">⚡</div>
      <div style="font-family:var(--font-display,sans-serif);font-size:1.2rem;font-weight:700;color:var(--primary,#6d5dfb);">Matching your profile</div>
      <p style="color:var(--text-muted,#94a3b8);margin-top:6px;font-size:.9rem;">Scanning institution data…</p>
    </div>
  `;

  let matches = [];

  try {
    let url = `${api("/universities")}?country=${encodeURIComponent(country)}`;
    if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
    if (budget) url += `&budget=${encodeURIComponent(budget)}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    matches = await response.json();
  } catch (err) {
    // Graceful degradation instead of the old hard error state.
    if (!state.universities.length) state.universities = SAMPLE_UNIVERSITIES.slice();
    matches = filterLocally({ country, searchQuery, budget });
    console.warn("Finder: backend unavailable, filtered locally.");
  }

  if (!Array.isArray(matches) || !matches.length) {
    results.innerHTML = `
      <div style="grid-column:1/-1;padding:32px;text-align:center;background:rgba(0,0,0,.02);border-radius:20px;border:1px solid var(--border,#e2e8f0);">
        <div style="font-size:2.2rem;margin-bottom:8px;">🔍</div>
        <h3 style="font-size:1.2rem;margin-bottom:4px;">No matches found</h3>
        <p style="color:var(--text-muted,#94a3b8);font-size:.9rem;">Try widening your budget, clearing the country filter, or checking the spelling.</p>
      </div>
    `;
    updateAISummaryBar(null);
    return;
  }

  const processed = matches
    .map((u) => ({
      ...u,
      displayName: u.name || "University",
      displayTuition: Number(u.tuition_fee || u.Tuition_Fee || 25000),
      displayIelts: u.ielts || u.Ielts || 6.5,
      displayLogo: u.logo || "https://placehold.co/100x100?text=UNI",
      tag: getCategory(gpa, Number(u.avg_gpa) || 3.2),
      matchScore: getMatchScore(gpa, u)
    }))
    .sort((a, b) => {
      const order = { Safe: 1, Target: 2, Dream: 3 };
      return (order[a.tag] || 2) - (order[b.tag] || 2) || b.matchScore - a.matchScore;
    });

  // Keep the raw objects so the details modal can read them by index.
  window.__uniResults = processed;

  updateAISummaryBar({
    bestMatch: (processed.find((u) => u.tag === "Target") || processed[0]).displayName,
    safestChoice: (processed.find((u) => u.tag === "Safe") || processed[0]).displayName,
    dreamTarget: (processed.find((u) => u.tag === "Dream") || processed[0]).displayName,
    budgetFriendly: `$${Math.min(...processed.map((u) => u.displayTuition)).toLocaleString()}/yr`
  });

  // Card layout: each card is a flex column at full grid-row height, so the
  // footer buttons always sit on the same baseline, and long names / four
  // buttons can no longer push content past the card edge.
  results.innerHTML = processed
    .map((u, index) => {
      const matchColor = getColor(u.tag);
      const saved = state.shortlist.includes(u.displayName);

      return `
        <div class="uni-card-enhanced uni-card bento-card" data-index="${index}" style="cursor:pointer;display:flex;flex-direction:column;height:100%;min-width:0;box-sizing:border-box;">
          <div class="uni-header-row" style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
            <div style="display:flex;gap:14px;align-items:center;min-width:0;flex:1;">
              <img src="${u.displayLogo}" class="uni-logo" alt="${escapeHTML(u.displayName)}"
                   style="width:48px;height:48px;flex-shrink:0;border-radius:12px;object-fit:cover;background:var(--bg,#fff);border:1px solid var(--border,#e2e8f0);"
                   onerror="this.src='https://placehold.co/100x100?text=UNI'">
              <div style="min-width:0;">
                <div class="uni-name" style="font-weight:700;overflow-wrap:anywhere;">${escapeHTML(u.displayName)}</div>
                <div class="uni-location">📍 ${escapeHTML(u.country || "Global")}</div>
                <div style="font-size:12px;color:var(--text-muted,#8a8aa3);margin-top:2px;">IELTS ${u.displayIelts}</div>
              </div>
            </div>
            <span class="rank-badge" style="flex-shrink:0;white-space:nowrap;">🏆 #${u.qs_rank || "N/A"}</span>
          </div>

          <div class="uni-meta-pills" style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;">
            <span class="uni-pill">🎯 ${u.matchScore}% Match</span>
            <span class="uni-pill">💰 $${u.displayTuition.toLocaleString()}</span>
            <span class="uni-pill" style="border-color:${matchColor};color:${matchColor};">${u.tag}</span>
          </div>

          <div class="confidence-bar-wrapper">
            <div class="confidence-header" style="display:flex;justify-content:space-between;font-size:.8rem;">
              <strong>Admission probability</strong><span>${u.tag}</span>
            </div>
            <div class="confidence-track" style="height:8px;background:var(--border,#e2e8f0);border-radius:6px;overflow:hidden;margin-top:6px;">
              <div class="confidence-fill" style="height:100%;width:${u.matchScore}%;background:${matchColor};"></div>
            </div>
          </div>

          <div class="uni-footer" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:auto;padding-top:14px;">
            <button class="secondary-btn" data-action="save" data-name="${escapeHTML(u.displayName)}" style="width:100%;margin:0;box-sizing:border-box;justify-content:center;">
              ${saved ? "★ Saved" : "☆ Save"}
            </button>
            <button class="secondary-btn" data-action="website" data-url="${escapeHTML(u.website || "")}" style="width:100%;margin:0;box-sizing:border-box;justify-content:center;">Website</button>
            <button class="secondary-btn" data-action="peek" style="width:100%;margin:0;box-sizing:border-box;justify-content:center;">Quick view</button>
            <a class="profile-btn glow-btn" data-action="details"
               href="${escapeHTML(uniDetailUrl(u) || "#")}"
               style="width:100%;margin:0;box-sizing:border-box;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;">Explore →</a>
          </div>
        </div>
      `;
    })
    .join("");

  window.scrollTo({ top: results.offsetTop - 80, behavior: "smooth" });
}

/**
 * One delegated listener for every card — replaces the inline onclick that
 * pointed at the dead /university/:slug route.
 */
function setupFinderDelegation() {
  const results = $("results");
  if (!results || results.dataset.bound) return;
  results.dataset.bound = "1";

  results.addEventListener("click", (e) => {
    const card = e.target.closest(".uni-card");
    if (!card) return;

    const list = window.__uniResults || [];
    const uni = list[Number(card.dataset.index)];
    if (!uni) return;

    const actionBtn = e.target.closest("[data-action]");
    const action = actionBtn ? actionBtn.dataset.action : "details";

    if (action === "website") {
      const url = actionBtn.dataset.url;
      if (url) window.open(url, "_blank", "noopener");
      return;
    }

    if (action === "save") {
      toggleShortlist(uni.displayName);
      actionBtn.textContent = state.shortlist.includes(uni.displayName)
        ? "★ Saved"
        : "☆ Save";
      return;
    }

    if (action === "peek") {
      showUniDetails(uni);
      return;
    }

    // "details", or a click anywhere else on the card -> the detail page.
    // The Explore button is a real <a>, so middle-click and ctrl+click still
    // open a new tab natively; only intercept the plain left click.
    const isLink = actionBtn && actionBtn.tagName === "A";
    if (isLink && (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1)) return;

    e.preventDefault();
    openUniDetailPage(uni, e.ctrlKey || e.metaKey);
  });
}

function updateAISummaryBar(data) {
  const resultsArea = $("results");
  if (!resultsArea) return;

  let panel = $("aiInsightsPanel");

  if (!data) {
    if (panel) panel.remove();
    return;
  }

  if (!panel) {
    panel = document.createElement("div");
    panel.id = "aiInsightsPanel";
    panel.className = "ai-insights-panel bento-card";
    resultsArea.parentNode.insertBefore(panel, resultsArea);
  }

  panel.innerHTML = `
    <div class="insight-card"><div class="insight-label">🎯 TARGET MATCH</div><div class="insight-value">${escapeHTML(data.bestMatch)}</div></div>
    <div class="insight-card"><div class="insight-label">🛡️ SAFEST CHOICE</div><div class="insight-value">${escapeHTML(data.safestChoice)}</div></div>
    <div class="insight-card"><div class="insight-label">✨ DREAM TARGET</div><div class="insight-value">${escapeHTML(data.dreamTarget)}</div></div>
    <div class="insight-card"><div class="insight-label">💳 MIN TUITION</div><div class="insight-value" style="color:var(--accent,#6d5dfb);">${escapeHTML(data.budgetFriendly)}</div></div>
  `;
}

function openDestination(country) {
  const select = $("country");
  if (select) {
    const exists = Array.from(select.options).some(
      (o) => o.value === country || o.textContent === country
    );
    if (!exists) {
      const option = document.createElement("option");
      option.value = country;
      option.textContent = country;
      select.appendChild(option);
    }
    select.value = country;
  }
  showPage("universityFinder").then(findUniversities);
}

function presetFinder(country, gpa, budget) {
  const countryEl = $("country");
  if (countryEl) {
    const exists = Array.from(countryEl.options).some((o) => o.value === country);
    if (!exists) {
      const option = document.createElement("option");
      option.value = country;
      option.textContent = country;
      countryEl.appendChild(option);
    }
    countryEl.value = country;
  }
  if ($("gpa")) $("gpa").value = gpa;
  if ($("budget")) $("budget").value = budget;
  findUniversities();
}

/* ==========================================================================
   07. UNIVERSITY DETAILS MODAL
   ========================================================================== */

function showUniDetails(uni) {
  if (!uni) return;

  let modal = $("details-modal");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "details-modal";
    modal.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(10px);display:flex;justify-content:center;align-items:center;z-index:9999;padding:20px;";
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal || e.target.closest("[data-close-details]")) {
        modal.style.display = "none";
      }
    });
  }

  const row = (label, value) =>
    `<div><strong>${label}</strong><p>${escapeHTML(String(value ?? "N/A"))}</p></div>`;

  modal.style.display = "flex";
  modal.innerHTML = `
    <div class="bento-card" style="width:100%;max-width:750px;max-height:90vh;overflow-y:auto;position:relative;padding:35px;background:var(--card,#fff);border-radius:24px;">
      <button data-close-details style="position:absolute;top:15px;right:15px;border:none;background:none;font-size:28px;cursor:pointer;line-height:1;">✕</button>
      <div style="text-align:center;">
        <img src="${uni.logo || uni.displayLogo || "https://placehold.co/120x120?text=UNI"}"
             style="width:110px;height:110px;object-fit:contain;background:#fff;padding:10px;border-radius:20px;"
             onerror="this.src='https://placehold.co/120x120?text=UNI'">
        <h1 style="margin-top:20px;">${escapeHTML(uni.name || uni.displayName || "University")}</h1>
        <p>🌍 ${escapeHTML(uni.country || "Global")}</p>
      </div>
      <hr>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:20px;margin-top:25px;">
        ${row("QS Rank", uni.qs_rank ? `#${uni.qs_rank}` : "N/A")}
        ${row("Overall Score", uni.overall_score)}
        ${row("Academic Reputation", uni.academic_score)}
        ${row("Employer Reputation", uni.employer_score)}
        ${row("Citations", uni.citations_score)}
        ${row("International Score", uni.international_score)}
        ${row("Sustainability", uni.sustainability_score)}
        ${row("Estimated Tuition", `$${Number(uni.tuition_fee || uni.displayTuition || 25000).toLocaleString()}`)}
        ${row("IELTS", uni.ielts || uni.displayIelts)}
        ${row("TOEFL", uni.toefl)}
      </div>
      <hr style="margin:30px 0;">
      <p>${escapeHTML(uni.description || "A detailed profile for this institution is coming soon.")}</p>
      <div style="display:flex;gap:12px;margin-top:25px;flex-wrap:wrap;">
        <button class="secondary-btn" style="flex:1;" onclick="toggleShortlist('${escapeHTML(uni.name || uni.displayName)}')">★ Save to shortlist</button>
        <a href="${escapeHTML(uniDetailUrl(uni) || "#")}" class="secondary-btn" style="flex:1;text-align:center;text-decoration:none;padding:12px;">Full profile →</a>
        <a href="${escapeHTML(uni.website || "#")}" target="_blank" rel="noopener" class="glow-btn" style="flex:1;text-align:center;text-decoration:none;padding:12px;">Official website →</a>
      </div>
    </div>
  `;
}

/* ==========================================================================
   08. SHORTLIST
   ========================================================================== */

function toggleShortlist(uniName) {
  if (!uniName) return;

  if (state.shortlist.includes(uniName)) {
    state.shortlist = state.shortlist.filter((n) => n !== uniName);
  } else {
    state.shortlist.push(uniName);
  }

  writeStore(CONFIG.STORAGE.shortlist, state.shortlist);
  updateShortlistUI();
}

function updateShortlistUI() {
  const container = $("shortlist-items");
  if (!container) return;

  container.innerHTML = state.shortlist.length
    ? state.shortlist
        .map(
          (name) =>
            `<li>⭐ ${escapeHTML(name)} <button class="link-btn" onclick="toggleShortlist('${escapeHTML(name)}')">remove</button></li>`
        )
        .join("")
    : `<li class="muted">Nothing saved yet. Star a university in Finder to keep it here.</li>`;

  const count = $("shortlist-count");
  if (count) count.textContent = String(state.shortlist.length);
}

/* ==========================================================================
   09. LIVING COST CALCULATOR
   ========================================================================== */

function calculateLivingCost() {
  const rentVal = parseFloat($("rent") ? $("rent").value : "") || 0;
  const foodVal = parseFloat($("food") ? $("food").value : "") || 0;
  const transportVal = parseFloat($("transport") ? $("transport").value : "") || 0;

  const monthlyTotal = rentVal + foodVal + transportVal;
  const annualTotal = monthlyTotal * 12;
  const degreeTotal = annualTotal * 4;

  const averageStudentMonthly = 1200;
  const monthlyDifference = averageStudentMonthly - monthlyTotal;

  let healthScore = 100;
  if (monthlyTotal === 0) healthScore = 0;
  else if (monthlyTotal > 1500) healthScore = 55;
  else if (monthlyTotal > 1100) healthScore = 75;
  else if (monthlyTotal > 800) healthScore = 88;

  const resultContainer = $("costResult");
  if (!resultContainer) return;

  const pct = (part) => (monthlyTotal ? Math.round((part / monthlyTotal) * 100) : 0);

  resultContainer.innerHTML = `
    <div class="calc-dashboard-results">
      <div class="calc-metric-card">
        <div class="calc-metric-title">Monthly budget</div>
        <div class="calc-metric-value highlight" id="count-monthly">$0</div>
      </div>
      <div class="calc-metric-card">
        <div class="calc-metric-title">Annual estimate</div>
        <div class="calc-metric-value" id="count-annual">$0</div>
      </div>
      <div class="calc-metric-card">
        <div class="calc-metric-title">4-year total</div>
        <div class="calc-metric-value" id="count-degree">$0</div>
      </div>

      <div class="calc-metric-card calc-score-card">
        <div class="calc-metric-title">Budget health index</div>
        <div class="score-ring-container">
          <svg class="score-ring-svg" viewBox="0 0 100 100">
            <circle class="score-ring-bg" cx="50" cy="50" r="45"></circle>
            <circle class="score-ring-fill" id="score-ring" cx="50" cy="50" r="45"></circle>
          </svg>
          <div class="score-number" id="count-score">0</div>
        </div>
        <div style="font-size:12px;font-weight:600;color:${getScoreColor(healthScore)};">${getScoreLabel(healthScore)}</div>
      </div>

      <div class="calc-metric-card calc-breakdown-card">
        <div class="calc-metric-title">Spending distribution</div>
        ${breakdownBar("🏠 Rent", rentVal, pct(rentVal), "bar-rent", "linear-gradient(90deg,#6d5dfb,#00f2fe)")}
        ${breakdownBar("🍔 Food", foodVal, pct(foodVal), "bar-food", "linear-gradient(90deg,#7c5cff,#ffb86b)")}
        ${transportVal ? breakdownBar("🚌 Transport", transportVal, pct(transportVal), "bar-transport", "linear-gradient(90deg,#10b981,#00f2fe)") : ""}
      </div>

      <div class="calc-comparison-card">
        <div class="comp-item">
          <div class="comp-item-label">YOUR MONTHLY</div>
          <div class="comp-item-val" style="color:var(--primary,#6d5dfb);">$${monthlyTotal.toLocaleString()}</div>
        </div>
        <div class="comp-item">
          <div class="comp-item-label">AVERAGE STUDENT</div>
          <div class="comp-item-val">$${averageStudentMonthly.toLocaleString()}</div>
        </div>
        <div class="comp-item">
          <div class="comp-item-label">DIFFERENCE</div>
          <div class="comp-item-val" style="color:${monthlyDifference >= 0 ? "#10b981" : "#ef4444"};">
            ${monthlyDifference >= 0 ? "-$" : "+$"}${Math.abs(monthlyDifference).toLocaleString()}/mo
          </div>
        </div>
      </div>

      <div class="insight-pill">
        <span>💡</span>
        <span>${getRecommendationText(rentVal, foodVal, monthlyTotal)}</span>
      </div>
    </div>
  `;

  animateValue("count-monthly", 0, monthlyTotal, 800, "$");
  animateValue("count-annual", 0, annualTotal, 900, "$");
  animateValue("count-degree", 0, degreeTotal, 1000, "$");
  animateValue("count-score", 0, healthScore, 800, "");

  requestAnimationFrame(() => {
    setBarWidth("bar-rent", pct(rentVal));
    setBarWidth("bar-food", pct(foodVal));
    setBarWidth("bar-transport", pct(transportVal));

    const ring = $("score-ring");
    if (ring) {
      ring.style.strokeDashoffset = String(283 - (283 * healthScore) / 100);
      ring.style.stroke = getScoreColor(healthScore);
    }
  });
}

function breakdownBar(label, value, percent, id, gradient) {
  return `
    <div class="progress-bar-wrapper">
      <div class="progress-bar-header">
        <span>${label}</span>
        <span>$${value.toLocaleString()} (${percent}%)</span>
      </div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill" id="${id}" style="width:0%;background:${gradient};"></div>
      </div>
    </div>
  `;
}

function setBarWidth(id, percent) {
  const bar = $(id);
  if (bar) bar.style.width = `${percent}%`;
}

function animateValue(id, start, end, duration, prefix = "") {
  const obj = $(id);
  if (!obj) return;

  let startTimestamp = null;

  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const eased = 1 - (1 - progress) * (1 - progress);
    const current = Math.floor(eased * (end - start) + start);
    obj.textContent = prefix + current.toLocaleString();
    if (progress < 1) requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}

function getScoreColor(score) {
  if (score >= 85) return "#10b981";
  if (score >= 70) return "#00f2fe";
  if (score >= 50) return "#ffb86b";
  return "#ef4444";
}

function getScoreLabel(score) {
  if (score >= 85) return "Optimal efficiency";
  if (score >= 70) return "Balanced budget";
  if (score >= 50) return "Above average";
  return "High expenditure";
}

function getRecommendationText(rent, food, total) {
  if (total === 0) return "Enter your estimated monthly costs to see projections.";
  if (rent > 1000)
    return "Housing is eating most of your budget. Shared housing or campus dorms typically cut this by around 30%.";
  if (food > 500)
    return "Your food estimate is above average. Meal prep usually saves $200–250 a month.";
  return "Your projected budget sits comfortably below the standard student average.";
}

/* ==========================================================================
   10. CURRENCY CONVERTER
   ========================================================================== */

const CURRENCY_MAP = {
  USD: { flag: "🇺🇸", name: "United States Dollar", symbol: "$" },
  EUR: { flag: "🇪🇺", name: "Euro", symbol: "€" },
  GBP: { flag: "🇬🇧", name: "British Pound Sterling", symbol: "£" },
  INR: { flag: "🇮🇳", name: "Indian Rupee", symbol: "₹" },
  AUD: { flag: "🇦🇺", name: "Australian Dollar", symbol: "A$" },
  CAD: { flag: "🇨🇦", name: "Canadian Dollar", symbol: "C$" },
  SGD: { flag: "🇸🇬", name: "Singapore Dollar", symbol: "S$" },
  NZD: { flag: "🇳🇿", name: "New Zealand Dollar", symbol: "NZ$" },
  JPY: { flag: "🇯🇵", name: "Japanese Yen", symbol: "¥" },
  CNY: { flag: "🇨🇳", name: "Chinese Yuan", symbol: "¥" },
  CHF: { flag: "🇨🇭", name: "Swiss Franc", symbol: "CHF" },
  AED: { flag: "🇦🇪", name: "UAE Dirham", symbol: "AED" },
  KRW: { flag: "🇰🇷", name: "South Korean Won", symbol: "₩" }
};

const rateCache = new Map();

async function fetchRates(base) {
  const cached = rateCache.get(base);
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached.rates;

  const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${base}`);
  if (!res.ok) throw new Error(`Rate API returned ${res.status}`);

  const data = await res.json();
  rateCache.set(base, { rates: data.rates, at: Date.now() });
  return data.rates;
}

function setCurrencyPreset(from, to) {
  const fromSelect = $("fromCurrency");
  const toSelect = $("toCurrency");
  if (!fromSelect || !toSelect) return;
  fromSelect.value = from;
  toSelect.value = to;
  convertCurrency();
}

async function convertCurrency() {
  const amountInput = $("amount");
  const fromSelect = $("fromCurrency");
  const toSelect = $("toCurrency");
  const resultContainer = $("currencyResult");
  if (!amountInput || !fromSelect || !toSelect || !resultContainer) return;

  const amount = parseFloat(amountInput.value) || 1;
  const from = fromSelect.value;
  const to = toSelect.value;

  try {
    const rates = await fetchRates(from);
    const rate = rates[to] || 1;
    const total = amount * rate;

    const fromInfo = CURRENCY_MAP[from] || { flag: "🌐", symbol: "", name: from };
    const toInfo = CURRENCY_MAP[to] || { flag: "🌐", symbol: "", name: to };

    const travelCell = (code, flag, label) => {
      const info = CURRENCY_MAP[code] || { symbol: "" };
      const value = amount * (rates[code] || (code === from ? 1 : 0));
      return `
        <div class="travel-item">
          <div class="travel-flag">${flag}</div>
          <div class="travel-val">${info.symbol}${value.toFixed(0)}</div>
          <div style="font-size:11px;color:var(--text-muted,#94a3b8);">${label}</div>
        </div>
      `;
    };

    resultContainer.innerHTML = `
      <div class="currency-results-dashboard">
        <div class="result-primary-card">
          <div style="font-size:13px;font-weight:700;color:var(--text-muted,#94a3b8);letter-spacing:.05em;margin-bottom:8px;">
            ${fromInfo.flag} ${amount.toLocaleString()} ${from} =
          </div>
          <div class="converted-large-text" id="converted-counter">${toInfo.symbol}0.00</div>
          <div class="conversion-rate-formula">
            <span>1 ${from} = ${rate.toFixed(4)} ${to}</span>
            <span style="color:#10b981;font-size:12px;font-weight:700;">● Live rate</span>
          </div>
          <div class="timestamp-pill"><span>🕒 Updated ${new Date().toLocaleTimeString()}</span></div>
        </div>

        <div class="travel-estimator-card">
          <div style="font-size:13px;font-weight:700;color:var(--text-muted,#94a3b8);letter-spacing:.05em;">
            🌍 PURCHASING POWER (${amount.toLocaleString()} ${from})
          </div>
          <div class="travel-grid">
            ${travelCell("USD", "🇺🇸", "United States")}
            ${travelCell("EUR", "🇪🇺", "Eurozone")}
            ${travelCell("GBP", "🇬🇧", "United Kingdom")}
            ${travelCell("AUD", "🇦🇺", "Australia")}
          </div>
        </div>

        <div class="currency-insight-pill">
          <span>⚡</span>
          <span><b>Tip:</b> convert in larger blocks to reduce per-transaction fees, and compare your bank's markup against the mid-market rate shown here.</span>
        </div>
      </div>
    `;

    animateCurrencyValue("converted-counter", total, toInfo.symbol);
  } catch (err) {
    resultContainer.innerHTML = `
      <div style="padding:20px;border-radius:16px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);color:#ef4444;margin-top:16px;">
        ⚠️ Couldn't fetch the live exchange rate. Check your connection and try again.
      </div>
    `;
  }
}

function animateCurrencyValue(id, finalValue, symbol) {
  const element = $(id);
  if (!element) return;

  const duration = 800;
  let startTimestamp = null;

  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = eased * finalValue;

    element.textContent = `${symbol}${current.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;

    if (progress < 1) requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}

/* ==========================================================================
   11. SOP STUDIO
   ========================================================================== */

function switchSopTab(tabName) {
  const genTab = $("sopGeneratorTab");
  const evalTab = $("sopEvaluatorTab");
  const buttons = $$(".sop-tab-btn");

  buttons.forEach((btn) => btn.classList.remove("active"));

  const generator = tabName === "generator";
  if (genTab) genTab.classList.toggle("hidden", !generator);
  if (evalTab) evalTab.classList.toggle("hidden", generator);
  if (buttons[generator ? 0 : 1]) buttons[generator ? 0 : 1].classList.add("active");
}

function addExperienceEntry() {
  const container = $("experienceContainer");
  if (!container) return;

  const entry = document.createElement("div");
  entry.className = "dynamic-entry";
  entry.innerHTML = `
    <select class="exp-type">
      <option value="Project">Project</option>
      <option value="Internship">Internship</option>
      <option value="Work Experience">Work Experience</option>
      <option value="Research">Research</option>
      <option value="Certification">Certification</option>
      <option value="Publication">Publication</option>
      <option value="Extracurricular">Extracurricular</option>
      <option value="Volunteering">Volunteering</option>
    </select>
    <input type="text" class="exp-title" placeholder="Title / role">
    <textarea class="exp-desc" rows="2" placeholder="What you did and what changed because of it…"></textarea>
    <button type="button" class="btn-remove" onclick="removeEntry(this)">✕</button>
  `;

  container.appendChild(entry);
}

function removeEntry(button) {
  if (button && button.parentElement) button.parentElement.remove();
}

function generateSOP() {
  const outputContainer = $("generatedSopContainer");
  const editor = $("sopTextEditor");

  const val = (id, fallback) => {
    const el = $(id);
    const v = el ? el.value.trim() : "";
    return v || fallback;
  };

  const fullName = val("sop-name", "the applicant");
  const program = val("sop-program", "the intended graduate program");
  const university = val("sop-university", "the target university");
  const motivation = $("sop-motivation") ? $("sop-motivation").value.trim() : "";

  const experiences = $("#experienceContainer .dynamic-entry")
    .map((el) => {
      const type = el.querySelector(".exp-type") ? el.querySelector(".exp-type").value : "Experience";
      const titleEl = el.querySelector(".exp-title");
      const descEl = el.querySelector(".exp-desc");
      const title = titleEl ? titleEl.value.trim() : "";
      const desc = descEl ? descEl.value.trim() : "";

      if (!title) return "";

      return `<p><strong>${escapeHTML(type)} — ${escapeHTML(title)}.</strong> ${escapeHTML(
        desc || "This work sharpened my academic direction and my ability to finish under pressure."
      )}</p>`;
    })
    .filter(Boolean)
    .join("");

  if (editor) {
    editor.innerHTML = `
      <p><strong>Statement of Purpose — draft</strong></p>
      <p>My name is ${escapeHTML(fullName)}, and I am applying to ${escapeHTML(program)} at ${escapeHTML(university)}.</p>
      ${motivation ? `<p>${escapeHTML(motivation)}</p>` : "<p>Across coursework, internships, and independent projects, I have learned to turn curiosity into structured inquiry — the habit this program is built on.</p>"}
      ${experiences || "<p>My record so far forms one consistent story: I finish what I start, I learn in public, and I collaborate under pressure.</p>"}
      <p>${escapeHTML(university)} stands out for its labs, faculty, and industry links in this field. Name a specific professor or lab here — reviewers notice when you do.</p>
      <p>Thank you for considering my application.</p>
      <hr>
      <p><em>This is a scaffold, not a finished SOP. Replace every generic sentence with a specific one: a named lab, a measurable result, a moment that actually changed your direction.</em></p>
    `;
  }

  if (outputContainer) {
    outputContainer.classList.remove("hidden");
    outputContainer.scrollIntoView({ behavior: "smooth" });
  }
}

function evaluateSOP() {
  const results = $("evaluationResults");
  const input = $("sop-eval-input");
  const text = input ? input.value.trim() : "";

  if (!text) {
    if (results) {
      results.classList.remove("hidden");
      results.innerHTML = `<p class="muted">Paste your draft above to get a structural read on it.</p>`;
    }
    return;
  }

  const lower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean).length;

  const clarity = Math.min(96, 62 + Math.min(words, 400) / 20);
  const structure =
    (lower.includes("university") || lower.includes("program") ? 20 : 0) +
    (lower.includes("research") || lower.includes("lab") ? 20 : 0) +
    (/\d/.test(text) ? 15 : 0) +
    50;
  const voice = words > 250 ? 84 : 68;
  const overall = Math.round((clarity + Math.min(structure, 96) + voice) / 3);

  if (!results) return;

  results.classList.remove("hidden");
  results.innerHTML = `
    <div class="eval-grid">
      <div class="eval-score"><strong>${overall}</strong><span>Overall</span></div>
      <div class="eval-metric"><span>Clarity</span><b>${Math.round(clarity)}</b></div>
      <div class="eval-metric"><span>Structure</span><b>${Math.min(structure, 96)}</b></div>
      <div class="eval-metric"><span>Voice</span><b>${voice}</b></div>
      <div class="eval-metric"><span>Words</span><b>${words}</b></div>
    </div>
    <ul class="eval-notes">
      <li>${words < 300 ? "Too short. Expand toward 700–1000 words so a reviewer can see progression, not just intent." : "Length is competitive. Tighten repetition in the middle third."}</li>
      <li>${structure >= 80 ? "Program fit is visible. Add one faculty or lab name to make it concrete." : "Name the program, the university, and one specific research or career outcome."}</li>
      <li>${/\d/.test(text) ? "Good — you're using specifics." : "Add at least one number: a cohort size, a result, a duration. Numbers read as evidence."}</li>
      <li>Close on what you will contribute to the cohort, not only what you hope to receive.</li>
    </ul>
    <p class="muted" style="margin-top:12px;font-size:.85rem;">This is a structural check, not an admissions verdict. Get a human read before you submit.</p>
  `;

  results.scrollIntoView({ behavior: "smooth" });
}

/* ==========================================================================
   12. AI CHAT
   ========================================================================== */

function escapeHTML(text) {
  const div = document.createElement("div");
  div.textContent = String(text ?? "");
  return div.innerHTML;
}

function formatAIResponse(text) {
  if (text == null) return "";

  let out = escapeHTML(String(text));

  out = out.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
  out = out.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\n/g, "<br>");

  return out;
}

function addAIMessage(role, text, temporary = false) {
  const messages = $("ai-messages");
  if (!messages) return null;

  const messageId = `uni-ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const wrapper = document.createElement("div");
  wrapper.className =
    role === "user" ? "ai-message ai-user-message" : "ai-message ai-assistant-message";
  wrapper.dataset.messageId = messageId;
  if (temporary) wrapper.classList.add("ai-thinking-message");

  wrapper.innerHTML = `
    <div class="ai-message-avatar">${role === "user" ? "👤" : "✦"}</div>
    <div class="ai-message-content">
      <div class="ai-message-role">${role === "user" ? "You" : "UniAI"}</div>
      <div class="ai-message-text">${role === "user" ? escapeHTML(text) : formatAIResponse(text)}</div>
    </div>
  `;

  messages.appendChild(wrapper);
  scrollChatToBottom();

  return messageId;
}

function updateAIMessage(messageId, text) {
  if (!messageId) return;

  const message = document.querySelector(`[data-message-id="${messageId}"]`);
  if (!message) return;

  const textContainer = message.querySelector(".ai-message-text");
  if (textContainer) textContainer.innerHTML = formatAIResponse(text);

  message.classList.remove("ai-thinking-message");
}

function scrollChatToBottom() {
  const conversation = $("ai-conversation");
  const messages = $("ai-messages");
  if (!messages) return;

  setTimeout(() => {
    if (conversation) conversation.scrollTop = conversation.scrollHeight;
    messages.scrollTop = messages.scrollHeight;
  }, 30);
}

async function askUniAI(customMessage = null) {
  const input = $("ai-input");
  if (!input || state.isSending) return;

  const message = customMessage !== null ? String(customMessage) : input.value;
  if (!message.trim()) return;

  const welcome = $("ai-welcome");
  const conversation = $("ai-conversation");
  const sendBtn = $("ai-send-btn");

  if (welcome) welcome.classList.add("hidden");
  if (conversation) conversation.classList.remove("hidden");

  addAIMessage("user", message);
  state.conversation.push({
    role: "user",
    content: message,
    timestamp: new Date().toISOString()
  });
  saveConversation();

  input.value = "";
  input.style.height = "auto";

  state.isSending = true;
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.classList.add("loading");
  }

  const thinkingId = addAIMessage("assistant", "Thinking…", true);

  try {
    const res = await fetch(CONFIG.CHAT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        message,
        conversation: state.conversation.map(({ role, content }) => ({ role, content })),
        profile: window.UniAIPreferences ? window.UniAIPreferences.get() : null
      })
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const data = await res.json();

    const reply =
      data?.reply ??
      data?.message ??
      data?.response ??
      data?.answer ??
      data?.data?.reply ??
      data?.data?.message ??
      "";

    if (!reply) throw new Error("The backend returned an empty response.");

    updateAIMessage(thinkingId, String(reply));
    state.conversation.push({
      role: "assistant",
      content: String(reply),
      timestamp: new Date().toISOString()
    });
    saveConversation();
  } catch (error) {
    console.error("UniAI chat error:", error);

    const errorMessage =
      "⚠️ I couldn't reach UniAI. Check that your server is running and that " +
      `\`${CONFIG.CHAT_ENDPOINT}\` is available.`;

    updateAIMessage(thinkingId, errorMessage);
    state.conversation.push({
      role: "assistant",
      content: errorMessage,
      timestamp: new Date().toISOString()
    });
    saveConversation();
  } finally {
    state.isSending = false;
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.classList.remove("loading");
    }
    scrollChatToBottom();
    input.focus();
  }
}

function startNewUniAIChat() {
  state.conversation = [];
  state.isSending = false;

  const messages = $("ai-messages");
  if (messages) messages.innerHTML = "";

  const conversation = $("ai-conversation");
  if (conversation) conversation.classList.add("hidden");

  const welcome = $("ai-welcome");
  if (welcome) welcome.classList.remove("hidden");

  const input = $("ai-input");
  if (input) {
    input.value = "";
    input.style.height = "auto";
    input.focus();
  }

  try {
    localStorage.removeItem(CONFIG.STORAGE.chat);
  } catch (err) {
    /* ignore */
  }
}

function saveConversation() {
  writeStore(CONFIG.STORAGE.chat, state.conversation);
}

function loadConversation() {
  const saved = readStore(CONFIG.STORAGE.chat, []);
  if (!Array.isArray(saved) || !saved.length) return;

  state.conversation = saved.filter(
    (item) =>
      item &&
      (item.role === "user" || item.role === "assistant") &&
      typeof item.content === "string"
  );

  if (!state.conversation.length) return;

  const welcome = $("ai-welcome");
  const conversation = $("ai-conversation");
  const messages = $("ai-messages");

  if (welcome) welcome.classList.add("hidden");
  if (conversation) conversation.classList.remove("hidden");
  if (messages) messages.innerHTML = "";

  state.conversation.forEach((item) => addAIMessage(item.role, item.content));
  scrollChatToBottom();
}

function showUniAIHistory() {
  const saved = readStore(CONFIG.STORAGE.chat, []);

  if (!Array.isArray(saved) || !saved.length) {
    alert("No previous UniAI conversation found.");
    return;
  }

  const userMessages = saved.filter((item) => item.role === "user");
  if (!userMessages.length) {
    alert("No previous UniAI messages found.");
    return;
  }

  const latest = userMessages[userMessages.length - 1];
  const ok = confirm(
    `Previous chat found.\n\nLast question:\n${latest.content}\n\nLoad this conversation?`
  );

  if (ok) loadConversation();
}

function setUniAIInput(text) {
  const input = $("ai-input");
  if (!input) return;

  input.value = String(text);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.focus();

  try {
    input.setSelectionRange(input.value.length, input.value.length);
  } catch (err) {
    /* not a text input — ignore */
  }
}

function setupChatComposer() {
  const input = $("ai-input");
  if (!input || input.dataset.bound) return;
  input.dataset.bound = "1";

  // Stop global shortcut handlers from swallowing the space key.
  input.addEventListener(
    "keydown",
    (event) => {
      if (event.key === " ") event.stopPropagation();
    },
    true
  );

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      askUniAI();
    }
  });

  input.addEventListener("input", function autoResize() {
    this.style.height = "auto";
    this.style.height = `${Math.min(this.scrollHeight, 140)}px`;
  });

  $$(".ai-suggestion").forEach((button) => {
    button.addEventListener("click", () => {
      const prompt = button.dataset.prompt;
      if (!prompt) return;
      setUniAIInput(prompt);
      askUniAI();
    });
  });

  const newChatBtn = $("new-chat-btn");
  if (newChatBtn) newChatBtn.addEventListener("click", startNewUniAIChat);

  const historyBtn = $("chat-history-btn");
  if (historyBtn) historyBtn.addEventListener("click", showUniAIHistory);

  const tools = {
    "university-tool":
      "Help me find universities based on my GPA, budget, country, course and academic profile.",
    "scholarship-tool":
      "Help me find scholarships that match my application profile.",
    "sop-tool":
      "Help me plan and improve my Statement of Purpose for university admission."
  };

  Object.entries(tools).forEach(([id, prompt]) => {
    const el = $(id);
    if (el) el.addEventListener("click", () => setUniAIInput(prompt));
  });

  setupAttachment();
  setupVoice();
  loadConversation();
}

function setupAttachment() {
  const attachBtn = $("ai-attach-btn");
  if (!attachBtn) return;

  let fileInput = $("uni-ai-file-input");
  if (!fileInput) {
    fileInput = document.createElement("input");
    fileInput.id = "uni-ai-file-input";
    fileInput.type = "file";
    fileInput.accept = ".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg";
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);
  }

  attachBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    const input = $("ai-input");
    if (input) {
      const note = `[Attached file: ${file.name}]`;
      input.value = input.value.length ? `${input.value}\n\n${note}` : note;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    }

    fileInput.value = ""; // allow re-selecting the same file
  });
}

function setupVoice() {
  const voiceBtn = $("ai-voice-btn");
  const input = $("ai-input");
  if (!voiceBtn || !input) return;

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    voiceBtn.title = "Voice input isn't supported in this browser";
    voiceBtn.addEventListener("click", () =>
      alert("Voice input isn't supported in this browser.")
    );
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;

  let listening = false;
  let baseText = "";

  voiceBtn.addEventListener("click", () => {
    if (listening) {
      recognition.stop();
      return;
    }
    baseText = input.value;
    try {
      recognition.start();
    } catch (err) {
      console.warn("Voice recognition error:", err);
    }
  });

  recognition.onstart = () => {
    listening = true;
    voiceBtn.classList.add("recording");
    voiceBtn.setAttribute("aria-label", "Stop voice input");
  };

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    input.value = baseText
      ? `${baseText}${baseText.endsWith(" ") ? "" : " "}${transcript}`
      : transcript;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  recognition.onend = () => {
    listening = false;
    voiceBtn.classList.remove("recording");
    voiceBtn.setAttribute("aria-label", "Voice input");
  };

  recognition.onerror = (err) => {
    console.warn("Speech recognition error:", err);
    listening = false;
    voiceBtn.classList.remove("recording");
  };
}

async function quickAsk(text) {
  const value = String(text || "").replace(/^[^\w]+/, "").trim();
  if (!value) return;

  await showPage("ai-chat");

  // Only fires if the auth guard let us through.
  if (!$("ai-chat") && !$("ai-chatPage")) return;

  setupChatComposer();
  setUniAIInput(value);
  askUniAI();
}

/* ==========================================================================
   13. PARTICLES / SCROLL-TO-TOP / MISC UI
   ========================================================================== */

function setupParticles() {
  const canvas = $("particles");
  if (!canvas || !canvas.getContext) return;

  const ctx = canvas.getContext("2d");
  let particles = [];

  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };

  class Particle {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 3;
      this.speedX = (Math.random() - 0.5) * 1;
      this.speedY = (Math.random() - 0.5) * 1;
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      this.size -= 0.01;
      if (this.size <= 0.2) this.reset();
    }
    draw() {
      ctx.fillStyle = "rgba(109,93,251,0.35)";
      ctx.beginPath();
      ctx.arc(this.x, this.y, Math.max(this.size, 0.2), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  resize();
  window.addEventListener("resize", resize);

  particles = Array.from({ length: 60 }, () => new Particle());

  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      p.update();
      p.draw();
    });
    requestAnimationFrame(animate);
  };

  animate();
}

function setupScrollToTop() {
  if ($("uniai-top-btn")) return;

  const topBtn = document.createElement("button");
  topBtn.id = "uniai-top-btn";
  topBtn.type = "button";
  topBtn.innerHTML = "↑";
  topBtn.className = "top-scroll-btn";
  topBtn.setAttribute("aria-label", "Back to top");
  topBtn.style.display = "none";
  document.body.appendChild(topBtn);

  // addEventListener, not window.onscroll — nothing else gets clobbered.
  window.addEventListener("scroll", () => {
    const y = window.scrollY || document.documentElement.scrollTop;
    topBtn.style.display = y > 500 ? "block" : "none";
  });

  topBtn.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: "smooth" })
  );
}

function filterScholarships() {
  const q = ($("scholarship-filter") ? $("scholarship-filter").value : "").toLowerCase();

  $$(".scholarship-card").forEach((card) => {
    const hay = `${card.innerText} ${card.dataset.tags || ""}`.toLowerCase();
    card.style.display = hay.includes(q) ? "" : "none";
  });
}

function toggleNotifPanel() {
  const panel = $("notif-panel");
  if (panel) panel.classList.toggle("hidden");
}

function setupGlobalShortcuts() {
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      const search = $("uni-search");
      if (search) search.focus();
    }
    if (e.key === "Escape") {
      hide($("details-modal"));
      hide($("edit-profile-overlay"));
      hide($("auth-overlay"));
    }
  });

  document.addEventListener("click", (e) => {
    const panel = $("notif-panel");
    if (!panel || panel.classList.contains("hidden")) return;
    if (!e.target.closest(".notif-btn") && !e.target.closest("#notif-panel")) {
      panel.classList.add("hidden");
    }
  });
}

function setupSopButtonFeedback() {
  $$(".btn-ai-generate").forEach((btn) => {
    btn.addEventListener("click", function onGenerate() {
      const btnText = this.querySelector(".btn-text");
      if (!btnText) return;

      const original = btnText.textContent;
      btnText.textContent = "⏳ Working…";
      this.style.opacity = "0.85";
      this.style.pointerEvents = "none";

      setTimeout(() => {
        btnText.textContent = original;
        this.style.opacity = "1";
        this.style.pointerEvents = "auto";
      }, 1200);
    });
  });
}

function runBootSequence() {
  const status = $("system-status-text");
  const world = document.querySelector(".world-system");

  const sequence = [
    [0, "INITIALIZING"],
    [2200, "CONNECTING TO GLOBAL INDEX"],
    [4500, "SCANNING THE WORLD"],
    [6800, "MAPPING UNIVERSITIES"],
    [8900, "INDEXING SCHOLARSHIPS"],
    [10800, "ANALYZING POSSIBILITIES"],
    [12800, "FINDING YOUR PATH"],
    [15000, "INTELLIGENCE ONLINE"]
  ];

  if (status) {
    sequence.forEach(([time, text]) => {
      setTimeout(() => {
        status.style.transition = "opacity .35s ease, transform .35s ease";
        status.style.opacity = "0";
        status.style.transform = "translateY(4px)";
        setTimeout(() => {
          status.textContent = text;
          status.style.opacity = "1";
          status.style.transform = "translateY(0)";
        }, 350);
      }, time);
    });
  }

  if (world) {
    world.style.opacity = "0";
    world.style.transform = "translate(-50%, -50%) scale(.72)";
    world.style.transition =
      "opacity 2.5s ease, transform 3s cubic-bezier(.16,1,.3,1)";

    setTimeout(() => {
      world.style.opacity = ".75";
      world.style.transform = "translate(-50%, -50%) scale(1)";
    }, 1200);

    if (window.innerWidth > 700) {
      document.addEventListener("mousemove", (e) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 14;
        const y = (e.clientY / window.innerHeight - 0.5) * 14;
        world.style.marginLeft = `${x}px`;
        world.style.marginTop = `${y}px`;
      });
    }
  }

  const explore = $("explore-system");
  if (explore) {
    explore.addEventListener("click", () => {
      const target = document.querySelector("#explore");
      if (target) target.scrollIntoView({ behavior: "smooth" });
    });
  }
}

/* ==========================================================================
   14. GLOBAL EXPORTS + SINGLE INIT
   ========================================================================== */

// Everything the inline onclick attributes in your HTML call.
Object.assign(window, {
  showPage,
  showpage: showPage,
  toggleDarkMode,
  openEditModal,
  closeEditModal,
  openAuthOverlay,
  showConfirmCard,
  findUniversities,
  showUniDetails,
  openUniDetailPage,
  uniDetailUrl,
  slugify,
  toggleShortlist,
  openDestination,
  presetFinder,
  calculateLivingCost,
  convertCurrency,
  setCurrencyPreset,
  switchSopTab,
  addExperienceEntry,
  removeEntry,
  generateSOP,
  evaluateSOP,
  askUniAI,
  quickAsk,
  startNewUniAIChat,
  filterScholarships,
  toggleNotifPanel
});

let booted = false;

function init() {
  if (booted) return;
  booted = true;

  setupTheme();

  initSupabase();
  watchAuthState();
  setupAuthForm();
  setupGuideLocks();
  handleLoginRedirect();
  setupEditProfileForm();
  setupLogout();
  setupSettingsAccountActions();

  state.shortlist = readStore(CONFIG.STORAGE.shortlist, []);
  updateShortlistUI();

  setupFinderDelegation();
  setupChatComposer();
  setupGlobalShortcuts();
  setupScrollToTop();
  setupSopButtonFeedback();
  runBootSequence();

  // Network-dependent work runs after the UI is interactive.
  loadCountries();
  loadUniversities();

  setupParticles();

  setTimeout(() => hide($("intro")), 1600);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}


/* ==========================================================================
   SETTINGS ACCOUNT ACTIONS — SIGN OUT + DELETE ACCOUNT
   ========================================================================== */

function setupSettingsAccountActions() {
  const signOutBtn = document.getElementById("settings-signout-btn");
  const deleteBtn = document.getElementById("settings-delete-btn");

  if (signOutBtn && !signOutBtn.dataset.bound) {
    signOutBtn.dataset.bound = "1";

    signOutBtn.addEventListener("click", async () => {
      if (!supabaseApp) {
        alert("Authentication service is unavailable.");
        return;
      }

      const confirmed = await showConfirmCard(
        "You will be signed out of your UniAI account.",
        {
          title: "Sign out of UniAI?",
          confirmText: "Sign out",
          cancelText: "Cancel"
        }
      );

      if (!confirmed) return;

      signOutBtn.disabled = true;

      try {
        const { error } = await supabaseApp.auth.signOut();

        if (error) throw error;

        state.session = null;
        syncSessionUI(null);
        showPage("home");
      } catch (error) {
        console.error("Settings sign-out failed:", error);
        alert(error.message || "Unable to sign out.");
      } finally {
        signOutBtn.disabled = false;
      }
    });
  }

  if (deleteBtn && !deleteBtn.dataset.bound) {
    deleteBtn.dataset.bound = "1";

    deleteBtn.addEventListener("click", async () => {
      if (!supabaseApp || !state.session?.user) {
        alert("You must be signed in to delete your account.");
        return;
      }

      const firstConfirm = await showConfirmCard(
        "This permanently deletes your account and cannot be undone.",
        {
          title: "Delete your account?",
          confirmText: "Continue",
          cancelText: "Cancel"
        }
      );

      if (!firstConfirm) return;

      const secondConfirm = await showConfirmCard(
        "All account access will be removed permanently. This action cannot be reversed.",
        {
          title: "Final confirmation",
          confirmText: "Delete permanently",
          cancelText: "Keep account"
        }
      );

      if (!secondConfirm) return;

      deleteBtn.disabled = true;
      deleteBtn.textContent = "Deleting…";

      try {
        const userId = state.session.user.id;

        /*
         * Recommended setup:
         * Create a backend endpoint that uses the Supabase service-role key.
         * Never expose the service-role key in browser JavaScript.
         */
        const response = await fetch(
          `${CONFIG.API_BASE}/api/account/delete`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${state.session.access_token}`
            },
            body: JSON.stringify({
              user_id: userId
            })
          }
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            result.error || result.message || "Account deletion failed."
          );
        }

        await supabaseApp.auth.signOut();

        state.session = null;
        syncSessionUI(null);

        alert("Your UniAI account has been deleted.");
        showPage("home");
      } catch (error) {
        console.error("Account deletion failed:", error);
        alert(
          error.message ||
            "Unable to delete your account. Please try again."
        );
      } finally {
        deleteBtn.disabled = false;
        deleteBtn.textContent = "Delete account";
      }
    });
  }
}


/* ==============================
   UNI AI — 7 SECOND INTRO
   ============================== */

document.addEventListener("DOMContentLoaded", () => {

  const intro = document.getElementById("intro");

  if (!intro) return;

  // Keep intro visible for exactly 7 seconds
  setTimeout(() => {

    intro.classList.add("intro-hidden");

    // Remove it from the page after the fade animation
    setTimeout(() => {
      intro.remove();
    }, 800);

  }, 7000);

});