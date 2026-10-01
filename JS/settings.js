/* ==========================================================================
   UniAI — SETTINGS ENGINE (settings.js)
   --------------------------------------------------------------------------
   Standalone. Load AFTER script.js:

     <script src="script.js"></script>
     <script src="settings.js"></script>

   Contract with script.js
   -----------------------
   - Reads/writes the SAME theme key script.js uses (CONFIG.STORAGE.theme).
   - Wraps window.toggleDarkMode so the navbar switch and the Settings page
     can never disagree about the current theme.
   - Wraps window.showPage / window.showpage for "remember last page".
   - Uses window.supabaseApp for the account panel and follows auth changes.
   - Never redefines applyTheme(); it drives it through the same
     <html data-theme> attribute.
   ========================================================================== */

(() => {
  "use strict";

  /* ======================================================================
     1. KEYS & DEFAULTS
     ====================================================================== */

  const SETTINGS_KEY = "uniai_settings_v2";

  // Must match CONFIG.STORAGE.theme in script.js.
  const THEME_KEY =
    (window.CONFIG && window.CONFIG.STORAGE && window.CONFIG.STORAGE.theme) ||
    "uniai-theme";

  const TAB_KEY = "uniai_settings_tab";
  const LAST_PAGE_KEY = "uniai_last_page";

  // Everything this app owns in localStorage — used by "clear data".
  const APP_KEYS = [
    SETTINGS_KEY,
    THEME_KEY,
    "theme", // legacy key from the old script
    "uniAIConversation",
    "roadmapProgress", // road.js
    "uniai-roadmap", // legacy
    "uniai-shortlist"
  ];

  const DEFAULT_SETTINGS = {
    theme: "system",
    accent: "violet",

    compactMode: false,
    animations: true,

    notifications: true,
    aiActivity: true,
    tips: true,

    autoSave: true,
    rememberPage: true,
    confirmActions: true
  };

  const BOOLEAN_KEYS = Object.keys(DEFAULT_SETTINGS).filter(
    (k) => typeof DEFAULT_SETTINGS[k] === "boolean"
  );

  let settings = { ...DEFAULT_SETTINGS };
  let dirty = false; // unsaved changes (only possible when autoSave is off)

  /* ======================================================================
     2. ACCENT PRESETS
     ====================================================================== */

  const ACCENTS = {
    violet: { primary: "#6d5dfb", dark: "#5848e8", soft: "rgba(109,93,251,.14)" },
    blue:   { primary: "#3b82f6", dark: "#2563eb", soft: "rgba(59,130,246,.14)" },
    cyan:   { primary: "#06b6d4", dark: "#0891b2", soft: "rgba(6,182,212,.14)" },
    pink:   { primary: "#ec4899", dark: "#db2777", soft: "rgba(236,72,153,.14)" },
    green:  { primary: "#10b981", dark: "#059669", soft: "rgba(16,185,129,.14)" },
    orange: { primary: "#f97316", dark: "#ea580c", soft: "rgba(249,115,22,.14)" }
  };

  /* ======================================================================
     3. STORAGE HELPERS
     ====================================================================== */

  function readSettings() {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);

      if (!saved) {
        // No settings blob yet — but the navbar toggle may have already
        // written a preference to the legacy/theme key. Honor it instead
        // of silently reverting to "system".
        const legacy = localStorage.getItem(THEME_KEY) || localStorage.getItem("theme");
        const initial = { ...DEFAULT_SETTINGS };
        if (legacy === "dark" || legacy === "light") initial.theme = legacy;
        return initial;
      }

      const parsed = JSON.parse(saved);
      const merged = { ...DEFAULT_SETTINGS, ...parsed };

      if (!["light", "dark", "system"].includes(merged.theme)) {
        merged.theme = DEFAULT_SETTINGS.theme;
      }
      if (!ACCENTS[merged.accent]) merged.accent = DEFAULT_SETTINGS.accent;
      BOOLEAN_KEYS.forEach((k) => {
        merged[k] = Boolean(merged[k]);
      });

      return merged;
    } catch (error) {
      console.warn("[Settings] Could not read saved settings:", error);
      return { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * @param {boolean} force  write even when autoSave is off (explicit save)
   */
  function persist(force = false) {
    if (!settings.autoSave && !force) {
      dirty = true;
      updateSaveStatus("unsaved");
      emit("uniai:settings-change", settings);
      return false;
    }

    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      dirty = false;
      updateSaveStatus("saved");
      emit("uniai:settings-change", settings);
      return true;
    } catch (error) {
      console.warn("[Settings] Could not save settings:", error);
      updateSaveStatus("error");
      return false;
    }
  }

  function writeThemeKey(resolvedTheme) {
    try {
      // script.js reads this on boot; keep both in lockstep so a reload
      // never flashes the wrong theme.
      localStorage.setItem(THEME_KEY, resolvedTheme);
      localStorage.setItem("theme", resolvedTheme); // legacy compatibility
    } catch (error) {
      console.warn("[Settings] Could not sync theme key:", error);
    }
  }

  /**
   * Fires on BOTH window and document.
   */
  function emit(name, detail) {
    const make = () => new CustomEvent(name, { detail: { ...detail } });
    window.dispatchEvent(make());
    document.dispatchEvent(make());
  }

  /* ======================================================================
     4. SAVE STATUS
     ====================================================================== */

  function updateSaveStatus(mode = "saved") {
    const status = document.querySelector(".settings-save-status");
    if (!status) return;

    const icon = status.querySelector(".save-status-icon");
    const text = status.querySelector(".save-status-text");

    const states = {
      saving: ["◌", "Saving…"],
      unsaved: ["●", "Unsaved changes"],
      error: ["!", "Save failed"],
      saved: ["✓", "All changes saved"]
    };

    const [i, t] = states[mode] || states.saved;
    if (icon) icon.textContent = i;
    if (text) text.textContent = t;
    status.dataset.state = mode;

    const saveBtn = document.querySelector("[data-settings-action='save']");
    if (saveBtn) saveBtn.disabled = mode !== "unsaved";
  }

  /* ======================================================================
     5. THEME
     ====================================================================== */

  function systemPrefersDark() {
    return Boolean(
      window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  }

  function getResolvedTheme() {
    if (settings.theme === "system") return systemPrefersDark() ? "dark" : "light";
    return settings.theme;
  }

  function applySettingsTheme(syncStorage = true) {
    const resolved = getResolvedTheme();
    document.documentElement.setAttribute("data-theme", resolved);

    // Keep the navbar switch visually correct.
    const legacyButton = document.getElementById("theme-toggle");
    if (legacyButton) {
      const isDark = resolved === "dark";
      legacyButton.classList.toggle("dark", isDark);
      legacyButton.setAttribute("aria-pressed", String(isDark));
      legacyButton.setAttribute(
        "aria-label",
        isDark ? "Switch to light mode" : "Switch to dark mode"
      );
    }

    if (syncStorage) writeThemeKey(resolved);

    emit("uniai:theme-change", {
      selected: settings.theme,
      resolved
    });
  }

  function selectTheme(theme, announce = true) {
    if (!["light", "dark", "system"].includes(theme)) return;

    settings.theme = theme;
    applySettingsTheme(true);
    persist();
    renderSettingsState();

    if (!announce) return;
    showSettingsToast(
      theme === "dark"
        ? "🌙 Dark mode activated"
        : theme === "light"
        ? "☀️ Light mode activated"
        : "🖥️ Following your system theme"
    );
  }

  function setupSystemThemeListener() {
    if (!window.matchMedia) return;

    const query = window.matchMedia("(prefers-color-scheme: dark)");

    const onChange = () => {
      if (settings.theme !== "system") return;
      applySettingsTheme(true);
      renderSettingsState();
    };

    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", onChange);
    } else if (typeof query.addListener === "function") {
      query.addListener(onChange); // Safari < 14
    }
  }

  /**
   * The navbar switch is a 2-state control, so it can't express "system".
   * Wrapping it keeps one source of truth.
   */
  function wrapThemeToggle() {
    const original = window.toggleDarkMode;
    if (typeof original !== "function" || original.__settingsWrapped) return;

    const wrapped = function wrappedToggleDarkMode() {
      const btn = document.getElementById("theme-toggle");
      if (btn) {
        btn.classList.remove("animating");
        void btn.offsetWidth;
        btn.classList.add("animating");
        setTimeout(() => btn.classList.remove("animating"), 800);
      }

      selectTheme(getResolvedTheme() === "dark" ? "light" : "dark", false);
    };

    wrapped.__settingsWrapped = true;
    window.toggleDarkMode = wrapped;
  }

  /* ======================================================================
     6. ACCENT
     ====================================================================== */

  function applyAccent(accent, persistChange = true) {
    if (!ACCENTS[accent]) accent = DEFAULT_SETTINGS.accent;

    settings.accent = accent;

    const root = document.documentElement;
    const preset = ACCENTS[accent];

    root.style.setProperty("--settings-accent", preset.primary);
    root.style.setProperty("--settings-accent-dark", preset.dark);
    root.style.setProperty("--settings-accent-soft", preset.soft);

    // Drive the variables the rest of the app already uses.
    root.style.setProperty("--primary", preset.primary);
    root.style.setProperty("--primary-dark", preset.dark);
    root.style.setProperty("--accent", preset.primary);

    if (document.body) document.body.dataset.accent = accent;

    if (persistChange) persist();

    emit("uniai:accent-change", { accent, ...preset });
  }

  /* ======================================================================
     7. BOOLEAN SETTINGS
     ====================================================================== */

  function applyCompactMode() {
    document.documentElement.classList.toggle("compact-mode", settings.compactMode);
    if (document.body) {
      document.body.classList.toggle("settings-compact-mode", settings.compactMode);
    }
  }

  function applyAnimationSetting() {
    const off = !settings.animations;

    document.documentElement.classList.toggle("reduce-ui-motion", off);
    if (document.body) document.body.classList.toggle("animations-disabled", off);

    if (off) {
      document.documentElement.style.setProperty("--settings-motion-duration", "0ms");
    } else {
      document.documentElement.style.removeProperty("--settings-motion-duration");
    }

    const particles = document.getElementById("particles");
    if (particles) particles.style.display = off ? "none" : "";
  }

  function applyNotificationSetting() {
    const on = settings.notifications;

    document.querySelectorAll(".notif-btn").forEach((btn) => {
      btn.style.display = on ? "" : "none";
    });

    if (!on) {
      const panel = document.getElementById("notif-panel");
      if (panel) panel.classList.add("hidden");
    }
  }

  function applyTipsSetting() {
    const hide = !settings.tips;

    document
      .querySelectorAll(".insight-pill, .currency-insight-pill, [data-tip]")
      .forEach((el) => {
        el.style.display = hide ? "none" : "";
      });

    if (document.body) document.body.classList.toggle("tips-hidden", hide);
  }

  function applyAiActivitySetting() {
    if (document.body) {
      document.body.classList.toggle("ai-activity-hidden", !settings.aiActivity);
    }
  }

  function applyAllSettings() {
    applySettingsTheme(false);
    applyAccent(settings.accent, false);
    applyCompactMode();
    applyAnimationSetting();
    applyNotificationSetting();
    applyTipsSetting();
    applyAiActivitySetting();
  }

  /* ======================================================================
     8. TABS
     ====================================================================== */

  function setupTabs() {
    const tabs = Array.from(document.querySelectorAll("[data-settings-tab]"));
    const panels = Array.from(document.querySelectorAll("[data-settings-panel]"));
    if (!tabs.length) return;

    const activate = (target, store = true) => {
      tabs.forEach((item) => {
        const active = item.dataset.settingsTab === target;
        item.classList.toggle("active", active);
        item.setAttribute("aria-selected", String(active));
      });

      panels.forEach((panel) => {
        const active = panel.dataset.settingsPanel === target;
        panel.classList.toggle("active", active);
        panel.classList.toggle("hidden", !active);
      });

      if (store) {
        try {
          sessionStorage.setItem(TAB_KEY, target);
        } catch (_) {}
      }
    };

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => activate(tab.dataset.settingsTab));

      tab.addEventListener("keydown", (event) => {
        if (!["ArrowRight", "ArrowLeft"].includes(event.key)) return;
        event.preventDefault();

        const i = tabs.indexOf(tab);
        const next = tabs[(i + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
        next.focus();
        activate(next.dataset.settingsTab);
      });
    });

    let savedTab = null;
    try {
      savedTab = sessionStorage.getItem(TAB_KEY);
    } catch (_) {}

    const valid = savedTab && tabs.some((t) => t.dataset.settingsTab === savedTab);
    activate(valid ? savedTab : tabs[0].dataset.settingsTab, false);
  }

  /* ======================================================================
     9. THEME / ACCENT CARDS
     ====================================================================== */

  function makeActivatable(el, handler) {
    el.addEventListener("click", handler);

    el.addEventListener("keydown", (event) => {
      if (event.target !== el) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      handler();
    });

    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
    if (!el.hasAttribute("role")) el.setAttribute("role", "button");
  }

  function setupThemeCards() {
    document.querySelectorAll(".theme-option[data-theme]").forEach((card) => {
      makeActivatable(card, () => selectTheme(card.dataset.theme));
    });
  }

  function setupAccentCards() {
    document.querySelectorAll(".accent-option[data-accent]").forEach((card) => {
      makeActivatable(card, () => {
        applyAccent(card.dataset.accent, true);
        renderSettingsState();
        showSettingsToast("🎨 Accent color updated");
      });
    });
  }

  /* ======================================================================
     10. SWITCHES
     ====================================================================== */

  function updateBooleanSetting(setting, value) {
    if (!BOOLEAN_KEYS.includes(setting)) return;

    settings[setting] = Boolean(value);

    applyAllSettings();

    // Turning autoSave back ON should flush anything still pending.
    persist(setting === "autoSave" && settings.autoSave);
    renderSettingsState();
  }

  function setupSwitches() {
    document.querySelectorAll("[data-setting]").forEach((control) => {
      const setting = control.dataset.setting;
      if (!BOOLEAN_KEYS.includes(setting)) return;
      if (control.dataset.settingsBound) return;
      control.dataset.settingsBound = "1";

      const isCheckbox =
        control instanceof HTMLInputElement && control.type === "checkbox";

      if (isCheckbox) {
        control.addEventListener("change", () =>
          updateBooleanSetting(setting, control.checked)
        );
        return;
      }

      makeActivatable(control, () =>
        updateBooleanSetting(setting, !settings[setting])
      );

      if (!control.hasAttribute("role")) control.setAttribute("role", "switch");
    });
  }

  /* ======================================================================
     11. RENDER
     ====================================================================== */

  function renderSettingsState() {
    document.querySelectorAll(".theme-option[data-theme]").forEach((card) => {
      const active = card.dataset.theme === settings.theme;
      card.classList.toggle("selected", active);
      card.classList.toggle("active", active);
      card.setAttribute("aria-pressed", String(active));
    });

    document.querySelectorAll(".accent-option[data-accent]").forEach((card) => {
      const active = card.dataset.accent === settings.accent;
      card.classList.toggle("selected", active);
      card.classList.toggle("active", active);
      card.setAttribute("aria-pressed", String(active));
    });

    BOOLEAN_KEYS.forEach((setting) => {
      document.querySelectorAll(`[data-setting="${setting}"]`).forEach((control) => {
        const enabled = Boolean(settings[setting]);

        control.classList.toggle("active", enabled);
        control.classList.toggle("on", enabled);
        control.setAttribute("aria-checked", String(enabled));

        const knob = control.querySelector(".toggle-knob, .switch-knob, .knob");
        if (knob) knob.setAttribute("aria-hidden", "true");

        if (control instanceof HTMLInputElement && control.type === "checkbox") {
          control.checked = enabled;
        }
      });
    });

    updateSettingsSummary();
  }

  function updateSettingsSummary() {
    const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);

    const themeLabel = document.getElementById("settings-theme-value");
    const accentLabel = document.getElementById("settings-accent-value");

    if (themeLabel) {
      themeLabel.textContent =
        settings.theme === "system"
          ? `System (${getResolvedTheme()})`
          : cap(settings.theme);
    }

    if (accentLabel) accentLabel.textContent = cap(settings.accent);
  }

  /* ======================================================================
     12. ACCOUNT PANEL
     ====================================================================== */

  // Explicit id pairs for every protected feature's lock UI. Each entry is
  // looked up with getElementById and simply skipped if missing — safe by
  // construction, no DOM searching, no cloning. Add a feature here (and its
  // matching markup in the HTML) to extend coverage; nothing here can ever
  // touch elements outside this list.
  const PROTECTED_FEATURE_LOCK_IDS = [
    { pill: "ai-chat-lock-pill", notice: "ai-chat-lock-notice" },
    { pill: "workspace-lock-pill", notice: "workspace-lock-notice" },
    { pill: "visa-guide-lock-pill", notice: "visa-guide-lock-notice" },
    { pill: "sop-studio-lock-pill", notice: "sop-studio-lock-notice" },
    { pill: "roadmap-lock-pill", notice: "roadmap-lock-notice" }
  ];

  /**
   * Syncs every protected-feature lock/unlock UI that exists in the markup.
   * script.js's syncSessionUI() already keeps the AI Chat pair in sync on
   * auth-state changes; this re-applies the same state for all of them
   * whenever the Settings panel repaints (e.g. on tab open), so nothing
   * drifts out of sync. Features with no matching markup are silently
   * skipped — nothing is generated or cloned.
   */
  function updateAIChatAccess(signedIn) {
    PROTECTED_FEATURE_LOCK_IDS.forEach(({ pill: pillId, notice: noticeId }) => {
      const pill = document.getElementById(pillId);
      const notice = document.getElementById(noticeId);

      if (pill) {
        pill.textContent = signedIn ? "Unlocked" : "Locked";
        pill.classList.toggle("locked", !signedIn);
      }

      if (notice) {
        notice.style.display = signedIn ? "none" : "";
      }
    });
  }

  function paintAccount({ name, email, role, initial, signedIn }) {
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    set("settings-account-name", name);
    set("settings-account-email", email);
    set("settings-account-role", role);
    set("settings-account-avatar", initial);

    const signInBtn = document.querySelector("[data-settings-action='signin']");
    const signOutBtn = document.querySelector("[data-settings-action='signout']");

    if (signInBtn) signInBtn.style.display = signedIn ? "none" : "";
    if (signOutBtn) signOutBtn.style.display = signedIn ? "" : "none";

    updateAIChatAccess(signedIn);
  }

  function paintGuest(message = "Not signed in") {
    paintAccount({
      name: "Guest",
      email: message,
      role: "Guest account",
      initial: "?",
      signedIn: false
    });
  }

  function paintFromSession(session) {
    if (!session || !session.user) {
      paintGuest("Not signed in");
      return;
    }

    const user = session.user;
    const meta = user.user_metadata || {};

    const username = meta.username || user.email?.split("@")[0] || "User";
    const cleanName = username.charAt(0).toUpperCase() + username.slice(1);

    paintAccount({
      name: cleanName,
      email: user.email || "",
      role: meta.profile_type || "student",
      initial: cleanName.charAt(0).toUpperCase(),
      signedIn: true
    });
  }

  function waitForSupabase(timeout = 10000) {
    return new Promise((resolve) => {
      const started = Date.now();

      const check = () => {
        const client = window.supabaseApp;

        if (
          client &&
          client.auth &&
          typeof client.auth.getSession === "function"
        ) {
          resolve(client);
          return;
        }

        if (Date.now() - started >= timeout) {
          resolve(null);
          return;
        }

        setTimeout(check, 100);
      };

      check();
    });
  }

  async function hydrateAccountPanel() {
    const anchor =
      document.getElementById("settings-account-name") ||
      document.getElementById("settings-account-email");

    if (!anchor) {
      console.warn("[Settings] Account elements not found in DOM");
      return;
    }

    const client = await waitForSupabase();

    if (!client) {
      console.warn("[Settings] Supabase client was not available");
      paintGuest("Sign in to unlock your account");
      return;
    }

    try {
      const { data, error } = await client.auth.getSession();

      if (error) {
        console.error("[Settings] getSession error:", error);
        paintGuest("Account unavailable");
        return;
      }

      paintFromSession(data?.session || null);
    } catch (error) {
      console.error("[Settings] Could not load account:", error);
      paintGuest("Account unavailable");
    }
  }

  function watchAccount() {
    window.addEventListener("uniai:auth-state", (event) => {
      const session = event.detail ? event.detail.session : null;
      paintFromSession(session);
    });

    const client = window.supabaseApp;

    if (!client || !client.auth) {
      paintGuest("Sign in to unlock your account");
      return;
    }

    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          console.warn("[Settings] Initial session read failed:", error);
          return;
        }

        paintFromSession(data && data.session ? data.session : null);
      })
      .catch((error) => {
        console.warn("[Settings] Initial session error:", error);
      });
  }

  function setupAccountActions() {
    const signIn = document.querySelector("[data-settings-action='signin']");

    if (signIn) {
      signIn.addEventListener("click", () => {
        if (typeof window.openAuthOverlay === "function") {
          window.openAuthOverlay(false);
          return;
        }

        const overlay = document.getElementById("auth-overlay");
        if (overlay) overlay.style.display = "flex";
      });
    }

    const signOut = document.querySelector("[data-settings-action='signout']");

    if (signOut) {
      signOut.addEventListener("click", async () => {
        if (settings.confirmActions) {
          const confirmed = window.showConfirmCard
            ? await window.showConfirmCard(
                "You'll need to sign back in to access your saved data and AI features.",
                {
                  title: "Sign out of UniAI?",
                  confirmText: "Sign out",
                  cancelText: "Stay signed in"
                }
              )
            : window.confirm("Sign out of UniAI?");

          if (!confirmed) return;
        }

        const logoutBtn = document.getElementById("logout-btn");

        if (logoutBtn) {
          logoutBtn.click();
          return;
        }

        const client = window.supabaseApp;

        if (client?.auth) {
          await client.auth.signOut();
        }
      });
    }

    const editBtn = document.querySelector("[data-settings-action='edit-profile']");

    if (editBtn) {
      editBtn.addEventListener("click", () => {
        if (typeof window.openEditModal === "function") {
          window.openEditModal();
        } else {
          showSettingsToast("ℹ️ Profile editing unavailable");
        }
      });
    }
  }

  /* ======================================================================
     13. EXPORT / IMPORT
     ====================================================================== */

  function exportSettings() {
    const blob = new Blob(
      [JSON.stringify(settings, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "uniai-settings.json";
    a.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    showSettingsToast("⬇️ Settings exported");
  }

  function importSettings() {
    const input = document.createElement("input");

    input.type = "file";
    input.accept = "application/json,.json";

    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) return;

      const reader = new FileReader();

      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));

          settings = { ...DEFAULT_SETTINGS, ...parsed };

          localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

          settings = readSettings();

          applyAllSettings();
          applySettingsTheme(true);
          persist(true);
          renderSettingsState();

          showSettingsToast("⬆️ Settings imported");
        } catch (error) {
          console.warn("[Settings] Import failed:", error);
          showSettingsToast("⚠️ That file isn't valid settings JSON");
        }
      };

      reader.readAsText(file);
    });

    input.click();
  }

  /* ======================================================================
     14. RESET / CLEAR
     ====================================================================== */

  function confirmIfNeeded(message) {
    if (!settings.confirmActions) return true;
    return window.confirm(message);
  }

  function resetDashboardSettings() {
    if (!confirmIfNeeded("Reset your appearance and preferences to defaults?")) return;

    settings = { ...DEFAULT_SETTINGS };

    applyAllSettings();
    applySettingsTheme(true);
    persist(true);
    renderSettingsState();

    showSettingsToast("↺ Dashboard settings restored");
  }

  function clearSessionData() {
    if (
      !confirmIfNeeded(
        "Clear saved UniAI data in this browser?\n\n" +
          "This removes your preferences, saved chat, roadmap progress and shortlist.\n" +
          "You will stay signed in."
      )
    ) {
      return;
    }

    APP_KEYS.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (_) {}
    });

    [TAB_KEY, LAST_PAGE_KEY, "uniai-selected-university"].forEach((key) => {
      try {
        sessionStorage.removeItem(key);
      } catch (_) {}
    });

    settings = { ...DEFAULT_SETTINGS };

    applyAllSettings();
    applySettingsTheme(true);
    persist(true);
    renderSettingsState();

    showSettingsToast("🧹 Local UniAI data cleared");
  }

  function factoryReset() {
    if (!window.confirm("Reset ALL UniAI browser settings and reload? This cannot be undone.")) {
      return;
    }

    APP_KEYS.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (_) {}
    });

    try {
      sessionStorage.clear();
    } catch (_) {}

    settings = { ...DEFAULT_SETTINGS };
    applyAllSettings();

    setTimeout(() => window.location.reload(), 450);
  }

  function setupDangerActions() {
    const actions = {
      "reset-dashboard": resetDashboardSettings,
      "clear-session": clearSessionData,
      "factory-reset": factoryReset,
      export: exportSettings,
      import: importSettings,
      save: () => {
        persist(true);
        showSettingsToast("✓ Settings saved");
      }
    };

    Object.entries(actions).forEach(([action, handler]) => {
      document
        .querySelectorAll(`[data-settings-action='${action}']`)
        .forEach((btn) => btn.addEventListener("click", handler));
    });
  }

  /* ======================================================================
     15. TOAST
     ====================================================================== */

  function showSettingsToast(message) {
    let toast = document.getElementById("settings-toast");

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "settings-toast";
      toast.className = "settings-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.remove("show");
    void toast.offsetWidth;

    toast.classList.add("show");

    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  /* ======================================================================
     16. SAVE FEEDBACK
     ====================================================================== */

  function setupAutoSaveFeedback() {
    document.addEventListener("uniai:settings-change", () => {
      if (!settings.autoSave) return;

      updateSaveStatus("saving");
      setTimeout(() => updateSaveStatus(dirty ? "unsaved" : "saved"), 280);
    });

    window.addEventListener("beforeunload", (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    });
  }

  /* ======================================================================
     17. REMEMBER + RESTORE LAST PAGE
     ====================================================================== */

  function setupRememberPage() {
    const original = window.showPage || window.showpage;
    if (typeof original !== "function" || original.__settingsWrapped) return;

    const wrapped = async function wrappedShowPage(page, event) {
      if (settings.rememberPage && page && page !== "settings") {
        try {
          sessionStorage.setItem(LAST_PAGE_KEY, page);
        } catch (_) {}
      }
      return original(page, event);
    };

    wrapped.__settingsWrapped = true;

    window.showPage = wrapped;
    window.showpage = wrapped;
  }

  function restoreLastPage() {
    if (!settings.rememberPage) return;
    if (!document.body || document.body.dataset.restorePage !== "true") return;

    if (window.location.hash && window.location.hash.length > 1) return;

    let lastPage = null;
    try {
      lastPage = sessionStorage.getItem(LAST_PAGE_KEY);
    } catch (_) {}

    if (!lastPage || lastPage === "settings") return;
    if (typeof window.showPage !== "function") return;

    const exists =
      document.getElementById(lastPage + "Page") || document.getElementById(lastPage);
    if (!exists) return;

    window.showPage(lastPage);
  }

  /* ======================================================================
     18. CROSS-TAB SYNC
     ====================================================================== */

  function setupStorageSync() {
    window.addEventListener("storage", (event) => {
      if (event.key !== SETTINGS_KEY) return;

      settings = readSettings();
      applyAllSettings();
      applySettingsTheme(false);
      renderSettingsState();

      showSettingsToast("↻ Settings synced from another tab");
    });
  }

  /* ======================================================================
     19. PAGE OBSERVER
     ====================================================================== */

  function setupPageObserver() {
    const settingsPage = document.getElementById("settingsPage");
    if (!settingsPage) return;

    const observer = new MutationObserver(() => {
      if (settingsPage.classList.contains("hidden")) return;
      hydrateAccountPanel();
      renderSettingsState();
    });

    observer.observe(settingsPage, {
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  /* ======================================================================
     20. SHORTCUTS
     ====================================================================== */

  function setupKeyboardShortcuts() {
    document.addEventListener("keydown", (event) => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;

      if (event.key === ",") {
        event.preventDefault();
        if (typeof window.showPage === "function") window.showPage("settings");

        const firstTab = document.querySelector("[data-settings-tab]");
        if (firstTab) firstTab.focus();
        return;
      }

      if (event.key.toLowerCase() === "s" && dirty) {
        event.preventDefault();
        persist(true);
        showSettingsToast("✓ Settings saved");
      }
    });
  }

  /* ======================================================================
     21. PUBLIC API
     ====================================================================== */

  window.UniAISettings = {
    get: () => ({ ...settings }),
    getDefaults: () => ({ ...DEFAULT_SETTINGS }),
    getAccents: () => ({ ...ACCENTS }),
    resolvedTheme: getResolvedTheme,
    isDirty: () => dirty,

    is(setting) {
      return Boolean(settings[setting]);
    },

    update(changes = {}) {
      settings = { ...settings, ...changes };
      applyAllSettings();
      applySettingsTheme(true);
      persist();
      renderSettingsState();
      return { ...settings };
    },

    setTheme: selectTheme,
    setAccent: (accent) => {
      applyAccent(accent, true);
      renderSettingsState();
    },
    save: () => persist(true),
    reset: resetDashboardSettings,
    clear: clearSessionData,
    factoryReset,
    export: exportSettings,
    import: importSettings,
    toast: showSettingsToast,
    refresh: () => {
      applyAllSettings();
      renderSettingsState();
      hydrateAccountPanel();
    }
  };

  /* ======================================================================
     22. INIT
     ====================================================================== */

  function initializeSettings() {
    if (document.documentElement.dataset.settingsInitialized === "true") return;
    document.documentElement.dataset.settingsInitialized = "true";

    settings = readSettings();

    applyAllSettings();
    applySettingsTheme(true);

    wrapThemeToggle();

    setupTabs();
    setupThemeCards();
    setupAccentCards();
    setupSwitches();

    setupAccountActions();
    setupDangerActions();

    setupAutoSaveFeedback();
    setupRememberPage();
    setupStorageSync();
    setupPageObserver();
    setupKeyboardShortcuts();
    setupSystemThemeListener();

    renderSettingsState();
    hydrateAccountPanel();
    watchAccount();
    restoreLastPage();

    updateSaveStatus("saved");

    console.log(
      "%c UniAI Settings ",
      "background:#6d5dfb;color:#fff;padding:4px 10px;border-radius:6px;font-weight:700;",
      settings
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeSettings);
  } else {
    initializeSettings();
  }
})();