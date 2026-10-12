/* ==========================================================================
   UniAI — Auth 2.0 (auth.js)

   Replaces the sign-in / sign-up dialog with a multi-step flow:

     Sign in   -> password   OR   6-digit code sent to your email
     Sign up   -> details (+ optional phone) -> 6-digit email code
     Forgot    -> email -> 6-digit code -> new password
     Phone     -> optional SMS verification (off until you add an SMS provider)

   Load order: right AFTER script.js (it reuses window.supabaseApp and takes
   over the #auth-overlay element and window.openAuthOverlay).

     <script src="JS/script.js"></script>
     <script src="JS/auth.js"></script>

   If this file fails to load, the old form in index.html keeps working.

   Supabase dashboard setup is required — see the notes that came with this file.
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------------
     Options
     ------------------------------------------------------------------------ */

  const OPTIONS = {
    OTP_LENGTH: 8, // must match Supabase -> Auth -> Providers -> Email -> OTP length
    RESEND_SECONDS: 60, // Supabase allows one email per address per minute
    MAX_CODE_TRIES: 5, // then the user must request a fresh code
    MIN_PASSWORD: 8,
    PHONE_VERIFY: false, // true ONLY after an SMS provider is configured in Supabase
    DEFAULT_COUNTRY: "IN",
    REDIRECT: window.location.origin
  };

  const COUNTRIES = [
    { code: "IN", dial: "+91", flag: "🇮🇳", name: "India", min: 10, max: 10 },
    { code: "US", dial: "+1", flag: "🇺🇸", name: "United States", min: 10, max: 10 },
    { code: "CA", dial: "+1", flag: "🇨🇦", name: "Canada", min: 10, max: 10 },
    { code: "GB", dial: "+44", flag: "🇬🇧", name: "United Kingdom", min: 9, max: 10 },
    { code: "AU", dial: "+61", flag: "🇦🇺", name: "Australia", min: 9, max: 9 },
    { code: "DE", dial: "+49", flag: "🇩🇪", name: "Germany", min: 10, max: 11 },
    { code: "IE", dial: "+353", flag: "🇮🇪", name: "Ireland", min: 9, max: 9 },
    { code: "SG", dial: "+65", flag: "🇸🇬", name: "Singapore", min: 8, max: 8 },
    { code: "AE", dial: "+971", flag: "🇦🇪", name: "UAE", min: 9, max: 9 },
    { code: "NZ", dial: "+64", flag: "🇳🇿", name: "New Zealand", min: 8, max: 10 },
    { code: "JP", dial: "+81", flag: "🇯🇵", name: "Japan", min: 9, max: 10 }
  ];

  const COMMON_PASSWORDS = new Set([
    "password", "password1", "12345678", "123456789", "qwerty123", "iloveyou",
    "11111111", "00000000", "abcd1234", "admin123", "welcome1"
  ]);

  /* ------------------------------------------------------------------------
     State + small helpers
     ------------------------------------------------------------------------ */

  const S = {
    screen: "signin", // signin | signup | forgot | otp | reset | success
    mode: "password", // sign-in method: password | code
    ctx: null, // what the OTP screen is verifying: signup | signin | recovery | phone
    email: "",
    phone: "", // E.164, only if the user gave one
    draft: { username: "", role: "student", country: OPTIONS.DEFAULT_COUNTRY, phone: "" },
    tries: 0,
    locked: false,
    busy: false,
    titleOverride: null,
    successTitle: "You're in",
    fromOpen: false,
    visible: false
  };

  let overlay = null;
  let modal = null;
  let body = null;
  let cooldownTimer = null;
  let closeTimer = null;

  const esc = (text) =>
    String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const q = (sel, root) => (root || body).querySelector(sel);
  const qa = (sel, root) => Array.from((root || body).querySelectorAll(sel));
  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  const target = () => (S.ctx === "phone" ? S.phone : S.email);

  function need() {
    const db = window.supabaseApp;
    if (!db) throw new Error("Sign-in is unavailable right now. Refresh the page and try again.");
    return db;
  }

  function nice(err) {
    const m = String((err && err.message) || err || "");
    const status = err && err.status;

    if (/invalid login credentials/i.test(m)) return "Email or password is incorrect.";
    if (/(expired|invalid)/i.test(m) && /(token|otp|code)/i.test(m)) return "That code is wrong or has expired.";
    if (status === 429 || /rate limit|too many|security purposes/i.test(m))
      return "Too many attempts. Wait a minute, then try again.";
    if (/same password|different from the old/i.test(m)) return "Choose a password you haven't used before.";
    if (/password should be|weak/i.test(m)) return "That password is too weak. Make it longer and add numbers.";
    if (/failed to fetch|network/i.test(m)) return "Network problem. Check your connection and try again.";
    return m || "Something went wrong. Please try again.";
  }

  /* ---------- password strength ---------- */

  function strength(pw) {
    if (!pw || COMMON_PASSWORDS.has(pw.toLowerCase())) return 0;
    let s = 0;
    if (pw.length >= OPTIONS.MIN_PASSWORD) s++;
    if (pw.length >= 12) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    if (pw.length < OPTIONS.MIN_PASSWORD) return Math.min(s, 1);
    return Math.min(s, 4);
  }

  const STRENGTH_LABELS = ["Too weak", "Weak", "Okay", "Good", "Strong"];

  function updateMeter(form) {
    const meter = q("[data-meter]", form);
    if (!meter) return;
    const pw = form.elements.password.value;
    const level = pw ? strength(pw) : -1;

    qa("i", meter).forEach((bar, i) => {
      bar.className = level >= 0 && i <= Math.max(level - 1, 0) && level > 0 ? `on l${level}` : "";
    });

    const label = q("[data-meter-text]", form);
    if (label) label.textContent = pw ? STRENGTH_LABELS[level] : "";
  }

  /* ---------- phone ---------- */

  function readPhone(form) {
    const raw = (form.elements.phone.value || "").replace(/\D/g, "").replace(/^0+/, "");
    const country = COUNTRIES.find((c) => c.code === form.elements.country.value) || COUNTRIES[0];

    if (!raw) return { ok: true, e164: "", raw: "", country };

    const bad =
      raw.length < country.min ||
      raw.length > country.max ||
      (country.code === "IN" && !/^[6-9]/.test(raw));

    if (bad) return { ok: false, error: `Enter a valid ${country.name} number, or leave it blank.`, raw, country };
    return { ok: true, e164: country.dial + raw, raw, country };
  }

  /* ---------- resend cooldown (survives closing the dialog) ---------- */

  const cdKey = () => `ax-cd:${target()}`;

  function markSent() {
    try {
      sessionStorage.setItem(cdKey(), String(Date.now() + OPTIONS.RESEND_SECONDS * 1000));
    } catch (err) {
      /* private mode — cooldown just won't persist */
    }
  }

  function cooldownLeft() {
    try {
      const until = Number(sessionStorage.getItem(cdKey()) || 0);
      return Math.max(0, Math.ceil((until - Date.now()) / 1000));
    } catch (err) {
      return 0;
    }
  }

  function startCooldown() {
    clearInterval(cooldownTimer);
    const btn = q('[data-act="resend"]');
    if (!btn) return;

    const tick = () => {
      const left = cooldownLeft();
      btn.disabled = left > 0;
      btn.textContent = left > 0 ? `Resend in ${left}s` : "Resend code";
      if (left <= 0) clearInterval(cooldownTimer);
    };

    tick();
    cooldownTimer = setInterval(tick, 500);
  }

  /* ------------------------------------------------------------------------
     Templates
     ------------------------------------------------------------------------ */

  const head = (title, sub) =>
    `<h2 id="ax-title" class="ax-title">${esc(title)}</h2>${sub ? `<p class="ax-sub">${sub}</p>` : ""}`;

  const field = (label, inner) => `<label class="ax-field"><span class="ax-label">${label}</span>${inner}</label>`;

  const pwInput = (autocomplete, name = "password") =>
    `<span class="ax-pw">
       <input class="ax-input" name="${name}" type="password" autocomplete="${autocomplete}" required>
       <button type="button" class="ax-eye" data-act="eye" aria-label="Show password" aria-pressed="false">Show</button>
     </span>`;

  const msgBox = `<div class="ax-msg" role="alert" aria-live="polite"></div>`;

  function tplSignin() {
    const pw = S.mode === "password";

    return `
      ${head(S.titleOverride || "Welcome back", "Sign in to pick up your study-abroad plan where you left it.")}
      <div class="ax-tabs" role="tablist" aria-label="Sign-in method">
        <button type="button" role="tab" aria-selected="${pw}" class="ax-tab${pw ? " on" : ""}" data-act="mode" data-mode="password">Password</button>
        <button type="button" role="tab" aria-selected="${!pw}" class="ax-tab${!pw ? " on" : ""}" data-act="mode" data-mode="code">Email me a code</button>
      </div>
      <form class="ax-form" data-form="signin" novalidate>
        ${field("Email", `<input class="ax-input" name="email" type="email" inputmode="email" autocomplete="email" required value="${esc(S.email)}">`)}
        ${
          pw
            ? field("Password", pwInput("current-password")) +
              `<button type="button" class="ax-link ax-forgot" data-go="forgot">Forgot password?</button>`
            : `<p class="ax-hint">We'll email you a ${OPTIONS.OTP_LENGTH}-digit code. No password needed.</p>`
        }
        ${msgBox}
        <button type="submit" class="glow-btn full-w ax-submit">${pw ? "Sign in" : "Send code"}</button>
      </form>
      <p class="ax-foot">New to UniAI? <button type="button" class="ax-link" data-go="signup">Create an account</button></p>`;
  }

  function tplSignup() {
    const d = S.draft;
    const options = COUNTRIES.map(
      (c) => `<option value="${c.code}"${c.code === d.country ? " selected" : ""}>${c.flag} ${c.dial}</option>`
    ).join("");

    return `
      ${head("Create your account", "Save universities, track your roadmap and get AI guidance.")}
      <form class="ax-form" data-form="signup" novalidate>
        <div class="ax-grid">
          ${field("Username", `<input class="ax-input" name="username" type="text" autocomplete="username" maxlength="30" value="${esc(d.username)}">`)}
          ${field(
            "I am a",
            `<select class="ax-input" name="role">
               <option value="student"${d.role === "student" ? " selected" : ""}>Student</option>
               <option value="counselor"${d.role === "counselor" ? " selected" : ""}>Counselor</option>
             </select>`
          )}
        </div>
        ${field("Email", `<input class="ax-input" name="email" type="email" inputmode="email" autocomplete="email" required value="${esc(S.email)}">`)}
        ${field("Password", pwInput("new-password"))}
        <div class="ax-meter-row"><div class="ax-meter" data-meter><i></i><i></i><i></i><i></i></div><small data-meter-text></small></div>
        <div class="ax-field">
          <span class="ax-label">Phone <em class="ax-opt">optional</em></span>
          <span class="ax-phone">
            <select class="ax-input" name="country" aria-label="Country code">${options}</select>
            <input class="ax-input" name="phone" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="98765 43210" value="${esc(d.phone)}">
          </span>
          <small class="ax-hint">Adds a second way to secure your account. You can skip it.</small>
        </div>
        ${msgBox}
        <button type="submit" class="glow-btn full-w ax-submit">Create account</button>
      </form>
      <p class="ax-foot">Already have an account? <button type="button" class="ax-link" data-go="signin">Sign in</button></p>`;
  }

  function tplForgot() {
    return `
      ${head("Reset your password", "Enter your email and we'll send a code to set a new one.")}
      <form class="ax-form" data-form="forgot" novalidate>
        ${field("Email", `<input class="ax-input" name="email" type="email" inputmode="email" autocomplete="email" required value="${esc(S.email)}">`)}
        ${msgBox}
        <button type="submit" class="glow-btn full-w ax-submit">Send reset code</button>
      </form>
      <p class="ax-foot"><button type="button" class="ax-link" data-go="signin">Back to sign in</button></p>`;
  }

  function otpBoxes() {
    return `<div class="ax-otp" role="group" aria-label="${OPTIONS.OTP_LENGTH}-digit code">${Array.from(
      { length: OPTIONS.OTP_LENGTH },
      (_, i) =>
        `<input class="ax-otp-box" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="${i === 0 ? "one-time-code" : "off"}" aria-label="Digit ${i + 1}">`
    ).join("")}</div>`;
  }

  function tplOtp() {
    const titles = {
      signup: "Verify your email",
      signin: "Check your email",
      recovery: "Enter your reset code",
      phone: "Verify your phone"
    };

    const where = S.ctx === "phone" ? S.phone : S.email;

    return `
      ${head(titles[S.ctx] || "Enter your code", `We sent a ${OPTIONS.OTP_LENGTH}-digit code to <b>${esc(where)}</b>.`)}
      ${otpBoxes()}
      ${msgBox}
      <button type="button" class="glow-btn full-w ax-submit" data-act="verify" disabled>Verify</button>
      <div class="ax-row">
        <button type="button" class="ax-link" data-act="resend" disabled>Resend code</button>
        <button type="button" class="ax-link" data-act="back">${S.ctx === "phone" ? "Skip for now" : "Use a different email"}</button>
      </div>
      <p class="ax-hint ax-center">${S.ctx === "phone" ? "SMS can take a minute." : "Nothing yet? Check your spam folder."}</p>`;
  }

  function tplReset() {
    return `
      ${head("Choose a new password", "You're verified. Pick something you haven't used before.")}
      <form class="ax-form" data-form="reset" novalidate>
        ${field("New password", pwInput("new-password"))}
        <div class="ax-meter-row"><div class="ax-meter" data-meter><i></i><i></i><i></i><i></i></div><small data-meter-text></small></div>
        ${field("Confirm password", pwInput("new-password", "confirm"))}
        ${msgBox}
        <button type="submit" class="glow-btn full-w ax-submit">Update password</button>
      </form>`;
  }

  function tplSuccess() {
    return `
      <div class="ax-success" role="status">
        <svg viewBox="0 0 52 52" width="64" height="64" aria-hidden="true">
          <circle class="ax-ring" cx="26" cy="26" r="24" fill="none" stroke-width="3"/>
          <path class="ax-tick" d="M15 27l8 8 14-16" fill="none" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <h2 id="ax-title" class="ax-title">${esc(S.successTitle)}</h2>
      </div>`;
  }

  const TEMPLATES = { signin: tplSignin, signup: tplSignup, forgot: tplForgot, otp: tplOtp, reset: tplReset, success: tplSuccess };

  /* ------------------------------------------------------------------------
     Rendering
     ------------------------------------------------------------------------ */

  function capture() {
    // Remember what was typed before the screen is replaced (never the password).
    const form = q("form");
    if (!form) return;

    if (form.elements.email) S.email = form.elements.email.value.trim().toLowerCase();

    if (form.dataset.form === "signup") {
      S.draft = {
        username: form.elements.username.value.trim(),
        role: form.elements.role.value,
        country: form.elements.country.value,
        phone: form.elements.phone.value
      };
    }
  }

  function go(screen) {
    clearTimeout(closeTimer);
    capture();
    S.screen = screen;
    render();
  }

  function render() {
    clearInterval(cooldownTimer);
    body.innerHTML = TEMPLATES[S.screen]();
    body.dataset.screen = S.screen;

    if (S.screen === "otp") {
      wireOtp();
      startCooldown();
    }

    if (S.screen !== "success") {
      const first = q("input, select");
      if (first) setTimeout(() => first.focus(), 40);
    }
  }

  function msg(text, kind = "error") {
    const box = q(".ax-msg");
    if (!box) return;

    box.textContent = text || "";
    box.className = `ax-msg${text ? ` show ${kind}` : ""}`;

    if (text && kind === "error") {
      modal.classList.remove("ax-shake");
      void modal.offsetWidth; // restart the animation
      modal.classList.add("ax-shake");
    }
  }

  function setBusy(on) {
    S.busy = on;
    qa(".ax-submit").forEach((btn) => {
      btn.classList.toggle("ax-loading", on);
      if (on) btn.disabled = true;
      else if (btn.dataset.act !== "verify") btn.disabled = false;
    });
  }

  function success(title) {
    S.successTitle = title || "You're in";
    S.screen = "success";
    render();
    closeTimer = setTimeout(() => {
      if (overlay) overlay.style.display = "none";
    }, 1100);
  }

  /* ------------------------------------------------------------------------
     OTP screen
     ------------------------------------------------------------------------ */

  const otpValue = () => qa(".ax-otp-box").map((b) => b.value).join("");

  function clearOtp(focus = true) {
    const boxes = qa(".ax-otp-box");
    boxes.forEach((b) => (b.value = ""));
    const verifyBtn = q('[data-act="verify"]');
    if (verifyBtn) verifyBtn.disabled = true;
    if (focus && boxes[0]) boxes[0].focus();
  }

  function lockOtp(on) {
    S.locked = on;
    qa(".ax-otp-box").forEach((b) => (b.disabled = on));
  }

  function wireOtp() {
    const boxes = qa(".ax-otp-box");
    const verifyBtn = q('[data-act="verify"]');

    const sync = () => {
      const full = boxes.every((b) => b.value);
      if (verifyBtn) verifyBtn.disabled = !full || S.locked || S.busy;
      if (full && !S.locked) verify();
    };

    boxes.forEach((box, i) => {
      box.addEventListener("focus", () => box.select());

      box.addEventListener("input", () => {
        const digits = box.value.replace(/\D/g, "");

        if (!digits) {
          box.value = "";
          if (verifyBtn) verifyBtn.disabled = true;
          return;
        }

        // Handles typing, autofill from SMS/email, and fast typing alike.
        digits
          .slice(0, boxes.length - i)
          .split("")
          .forEach((ch, k) => (boxes[i + k].value = ch));

        boxes[Math.min(i + digits.length, boxes.length - 1)].focus();
        sync();
      });

      box.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !box.value && i > 0) {
          e.preventDefault();
          boxes[i - 1].value = "";
          boxes[i - 1].focus();
        } else if (e.key === "ArrowLeft" && i > 0) {
          e.preventDefault();
          boxes[i - 1].focus();
        } else if (e.key === "ArrowRight" && i < boxes.length - 1) {
          e.preventDefault();
          boxes[i + 1].focus();
        }
      });

      box.addEventListener("paste", (e) => {
        const text = ((e.clipboardData || window.clipboardData).getData("text") || "").replace(/\D/g, "");
        if (!text) return;
        e.preventDefault();
        text
          .slice(0, boxes.length)
          .split("")
          .forEach((ch, k) => (boxes[k].value = ch));
        boxes[Math.min(text.length, boxes.length) - 1].focus();
        sync();
      });
    });
  }

  async function verify() {
    const code = otpValue();
    if (code.length !== OPTIONS.OTP_LENGTH || S.busy || S.locked) return;

    S.busy = true;
    const verifyBtn = q('[data-act="verify"]');
    if (verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.classList.add("ax-loading");
    }
    msg("");

    try {
      const auth = need().auth;
      const types = { signup: "signup", signin: "email", recovery: "recovery" };

      const { error } =
        S.ctx === "phone"
          ? await auth.verifyOtp({ phone: S.phone, token: code, type: "phone_change" })
          : await auth.verifyOtp({ email: S.email, token: code, type: types[S.ctx] });

      if (error) throw error;

      S.tries = 0;
      S.busy = false;

      if (S.ctx === "recovery") {
        S.successTitle = "Password updated";
        return go("reset");
      }
      if (S.ctx === "phone") return success("Phone verified");

      return afterEmailVerified();
    } catch (err) {
      S.busy = false;
      S.tries++;

      const left = OPTIONS.MAX_CODE_TRIES - S.tries;

      if (left <= 0) {
        lockOtp(true);
        msg("Too many wrong codes. Request a new one below.");
      } else {
        msg(`${nice(err)} ${left} ${left === 1 ? "try" : "tries"} left.`);
      }

      clearOtp(left > 0);
      const btn = q('[data-act="verify"]');
      if (btn) btn.classList.remove("ax-loading");
    }
  }

  async function afterEmailVerified() {
    // Optional phone step: only when an SMS provider is set up AND they gave a number.
    if (S.ctx === "signup" && S.phone && OPTIONS.PHONE_VERIFY) {
      try {
        const { error } = await need().auth.updateUser({ phone: S.phone });
        if (error) throw error;

        S.ctx = "phone";
        S.tries = 0;
        markSent();
        return go("otp");
      } catch (err) {
        console.warn("UniAI auth: could not start phone verification.", err);
        // Their account is fine — the number is still saved on the profile.
      }
    }

    success("You're in");
  }

  async function resend() {
    if (cooldownLeft() > 0 || S.busy) return;

    const btn = q('[data-act="resend"]');
    if (btn) btn.disabled = true;

    try {
      const auth = need().auth;

      if (S.ctx === "signup") {
        const { error } = await auth.resend({ type: "signup", email: S.email });
        if (error) throw error;
      } else if (S.ctx === "signin") {
        await sendSigninCode(S.email);
      } else if (S.ctx === "recovery") {
        const { error } = await auth.resetPasswordForEmail(S.email);
        if (error) throw error;
      } else {
        const { error } = await auth.resend({ type: "phone_change", phone: S.phone });
        if (error) throw error;
      }

      markSent();
      S.tries = 0;
      lockOtp(false);
      clearOtp();
      msg("New code sent. Older codes no longer work.", "ok");
    } catch (err) {
      msg(nice(err));
    }

    startCooldown();
  }

  function back() {
    msg("");
    lockOtp(false);
    S.tries = 0;

    if (S.ctx === "phone") return success("You're in"); // skipped phone verification
    go(S.ctx === "signup" ? "signup" : S.ctx === "recovery" ? "forgot" : "signin");
  }

  /* ------------------------------------------------------------------------
     Form handlers
     ------------------------------------------------------------------------ */

  async function sendSigninCode(email) {
    const { error } = await need().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: OPTIONS.REDIRECT }
    });

    // Unknown email: pretend it worked so the form can't be used to discover who has an account.
    if (error && !/signups? not allowed|not found/i.test(error.message || "")) throw error;
  }

  const handlers = {
    async signin(form) {
      const email = form.elements.email.value.trim().toLowerCase();
      if (!validEmail(email)) return msg("Enter a valid email address.");
      S.email = email;

      if (S.mode === "password") {
        const password = form.elements.password.value;
        if (!password) return msg("Enter your password.");

        const { error } = await need().auth.signInWithPassword({ email, password });

        if (error) {
          if (/not confirmed/i.test(error.message || "")) {
            // Signed up earlier but never entered the code — send a fresh one.
            S.ctx = "signup";
            await need().auth.resend({ type: "signup", email });
            markSent();
            return go("otp");
          }
          throw error;
        }

        return success("Welcome back");
      }

      S.ctx = "signin";
      await sendSigninCode(email);
      markSent();
      S.tries = 0;
      go("otp");
    },

    async signup(form) {
      const username = form.elements.username.value.trim();
      const email = form.elements.email.value.trim().toLowerCase();
      const password = form.elements.password.value;
      const role = form.elements.role.value;
      const phone = readPhone(form);

      if (!validEmail(email)) return msg("Enter a valid email address.");
      if (username && !/^[\w .-]{2,30}$/.test(username))
        return msg("Username can use letters, numbers, spaces and . _ - (2–30 characters).");
      if (strength(password) < 2)
        return msg(`Use at least ${OPTIONS.MIN_PASSWORD} characters and mix letters with numbers.`);
      if (!phone.ok) return msg(phone.error);

      S.email = email;
      S.phone = phone.e164;
      S.draft = { username, role, country: phone.country.code, phone: phone.raw };

      const { data, error } = await need().auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: OPTIONS.REDIRECT,
          data: {
            username: username || email.split("@")[0],
            profile_type: role,
            ...(phone.e164 ? { phone_number: phone.e164 } : {})
          }
        }
      });

      if (error) throw error;

      // Existing, confirmed address: Supabase answers "success" with no identities.
      const identities = data && data.user && data.user.identities;
      if (Array.isArray(identities) && identities.length === 0) {
        S.mode = "password";
        go("signin");
        return msg("That email already has an account. Sign in, or use an email code.", "info");
      }

      // "Confirm email" switched off in Supabase -> already signed in.
      if (data && data.session) return afterEmailVerified();

      S.ctx = "signup";
      S.tries = 0;
      markSent();
      go("otp");
    },

    async forgot(form) {
      const email = form.elements.email.value.trim().toLowerCase();
      if (!validEmail(email)) return msg("Enter a valid email address.");

      S.email = email;
      S.ctx = "recovery";

      const { error } = await need().auth.resetPasswordForEmail(email, { redirectTo: OPTIONS.REDIRECT });
      if (error) throw error;

      markSent();
      S.tries = 0;
      go("otp");
    },

    async reset(form) {
      const password = form.elements.password.value;
      const confirm = form.elements.confirm.value;

      if (strength(password) < 2)
        return msg(`Use at least ${OPTIONS.MIN_PASSWORD} characters and mix letters with numbers.`);
      if (password !== confirm) return msg("The two passwords don't match.");

      const { error } = await need().auth.updateUser({ password });
      if (error) throw error;

      success("Password updated");
    }
  };

  async function submit(form) {
    if (S.busy) return;
    const run = handlers[form.dataset.form];
    if (!run) return;

    msg("");
    setBusy(true);

    try {
      await run(form);
    } catch (err) {
      console.warn("UniAI auth:", err);
      msg(nice(err));
    } finally {
      setBusy(false);
    }
  }

  /* ------------------------------------------------------------------------
     Events (one set of listeners; screens are swapped underneath)
     ------------------------------------------------------------------------ */

  function bind() {
    modal.addEventListener("click", (e) => {
      const el = e.target.closest("[data-act], [data-go]");
      if (!el) return;

      if (el.dataset.go) return go(el.dataset.go);

      switch (el.dataset.act) {
        case "close":
          overlay.style.display = "none";
          break;
        case "mode":
          capture();
          S.mode = el.dataset.mode;
          render();
          break;
        case "eye": {
          const input = el.parentElement.querySelector("input");
          const showing = input.type === "text";
          input.type = showing ? "password" : "text";
          el.textContent = showing ? "Show" : "Hide";
          el.setAttribute("aria-pressed", String(!showing));
          el.setAttribute("aria-label", showing ? "Show password" : "Hide password");
          break;
        }
        case "resend":
          resend();
          break;
        case "back":
          back();
          break;
        case "verify":
          verify();
          break;
      }
    });

    modal.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = e.target.closest("form");
      if (form) submit(form);
    });

    modal.addEventListener("input", (e) => {
      if (e.target.name === "password" || e.target.name === "confirm") {
        const form = e.target.closest("form");
        if (form) updateMeter(form);
      }
    });

    // Keep Tab inside the dialog while it is open.
    modal.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;

      const items = qa("button, input, select", modal).filter((n) => !n.disabled && n.offsetParent !== null);
      if (!items.length) return;

      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  /* ------------------------------------------------------------------------
     Public hooks — keep the signatures script.js and other files already call
     ------------------------------------------------------------------------ */

  /**
   * @param {boolean} signUp   open on the sign-up screen
   * @param {string}  title    optional heading ("Unlock your Workspace", ...)
   * @param {object}  pending  { type: "page", page } | { type: "url", url }
   */
  function openAuthOverlay(signUp = false, title, pending = null) {
    if (!overlay) return;

    if (typeof state !== "undefined" && state) state.pendingAction = pending;

    S.titleOverride = title || null;
    S.fromOpen = true;
    S.mode = "password";
    S.tries = 0;
    S.locked = false;
    S.busy = false;

    go(signUp ? "signup" : "signin");
    overlay.style.display = "flex";
  }

  function watchOverlay() {
    // Covers every way the dialog can open or close, including the old inline
    // onclick in the navbar and Escape / backdrop clicks handled by script.js.
    new MutationObserver(() => {
      const open = overlay.style.display === "flex";

      if (open && !S.visible) {
        S.visible = true;
        if (!S.fromOpen) {
          S.titleOverride = null;
          S.mode = "password";
          go("signin");
        }
        S.fromOpen = false;
      } else if (!open && S.visible) {
        S.visible = false;
        clearInterval(cooldownTimer);
        clearTimeout(closeTimer);
        S.busy = false;
        capture();
        S.screen = "signin";
      }
    }).observe(overlay, { attributes: true, attributeFilter: ["style"] });
  }

  /* ------------------------------------------------------------------------
     Styles (scoped to .ax-*, uses your existing CSS variables with fallbacks)
     ------------------------------------------------------------------------ */

  function injectStyles() {
    if (document.getElementById("ax-styles")) return;

    const style = document.createElement("style");
    style.id = "ax-styles";
    style.textContent = `
      .ax-modal{width:min(440px,calc(100vw - 28px));max-height:calc(100vh - 28px);overflow-y:auto;position:relative;text-align:left}
      .ax-modal::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;border-radius:inherit;border-bottom-left-radius:0;border-bottom-right-radius:0;background:linear-gradient(90deg,#6d5dfb,#a78bfa,#00f2fe)}
      .ax-title{margin:6px 0 4px;font-size:1.55rem;line-height:1.2;letter-spacing:-.01em}
      .ax-sub{margin:0 0 18px;color:var(--text-muted,#94a3b8);font-size:.92rem;line-height:1.5}
      .ax-sub b{color:var(--text,inherit);font-weight:700;overflow-wrap:anywhere}
      .ax-form{display:flex;flex-direction:column;gap:14px}
      .ax-field{display:flex;flex-direction:column;gap:6px;min-width:0}
      .ax-label{font-size:.82rem;font-weight:600;color:var(--text-muted,#64748b)}
      .ax-opt{font-style:normal;font-weight:500;opacity:.75;margin-left:4px}
      .ax-modal .ax-input{width:100%;box-sizing:border-box;margin:0;padding:12px 14px;font:inherit;font-size:.96rem;color:var(--text,inherit);background:var(--bg,rgba(148,163,184,.08));border:1px solid var(--border,rgba(148,163,184,.35));border-radius:12px;outline:none;transition:border-color .15s,box-shadow .15s}
      .ax-modal .ax-input:focus{border-color:#6d5dfb;box-shadow:0 0 0 3px rgba(109,93,251,.22)}
      .ax-grid{display:grid;grid-template-columns:1.3fr 1fr;gap:12px}
      .ax-phone{display:grid;grid-template-columns:112px 1fr;gap:8px}
      .ax-pw{position:relative;display:block}
      .ax-pw .ax-input{padding-right:64px}
      .ax-eye{position:absolute;right:6px;top:50%;transform:translateY(-50%);border:0;background:none;cursor:pointer;font:inherit;font-size:.8rem;font-weight:600;color:#6d5dfb;padding:6px 8px;border-radius:8px}
      .ax-hint{margin:0;font-size:.8rem;color:var(--text-muted,#94a3b8);line-height:1.45}
      .ax-center{text-align:center;margin-top:14px}
      .ax-tabs{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;margin-bottom:16px;background:var(--bg,rgba(148,163,184,.12));border:1px solid var(--border,rgba(148,163,184,.25));border-radius:12px}
      .ax-tab{border:0;background:none;padding:9px 8px;font:inherit;font-size:.88rem;font-weight:600;color:var(--text-muted,#64748b);border-radius:9px;cursor:pointer;transition:background .15s,color .15s}
      .ax-tab.on{background:var(--card,#fff);color:#6d5dfb;box-shadow:0 1px 6px rgba(15,23,42,.12)}
      .ax-link{border:0;background:none;padding:0;font:inherit;font-size:.88rem;font-weight:600;color:#7c6cff;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
      .ax-link:disabled{color:var(--text-muted,#94a3b8);text-decoration:none;cursor:default}
      .ax-forgot{align-self:flex-end;margin-top:-6px}
      .ax-foot{margin:18px 0 0;text-align:center;font-size:.88rem;color:var(--text-muted,#94a3b8)}
      .ax-row{display:flex;justify-content:space-between;gap:12px;margin-top:14px}
      .ax-msg{min-height:0;font-size:.85rem;line-height:1.4;border-radius:10px}
      .ax-msg.show{padding:10px 12px}
      .ax-msg.error{color:#dc2626;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3)}
      .ax-msg.ok{color:#059669;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3)}
      .ax-msg.info{color:#6d5dfb;background:rgba(109,93,251,.1);border:1px solid rgba(109,93,251,.3)}
      .ax-meter-row{display:flex;align-items:center;gap:10px;margin-top:-6px}
      .ax-meter{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;flex:1}
      .ax-meter i{height:4px;border-radius:4px;background:var(--border,rgba(148,163,184,.3));transition:background .2s}
      .ax-meter i.on.l1{background:#ef4444}.ax-meter i.on.l2{background:#f59e0b}.ax-meter i.on.l3{background:#22c55e}.ax-meter i.on.l4{background:#10b981}
      .ax-meter-row small{min-width:56px;text-align:right;font-size:.75rem;color:var(--text-muted,#94a3b8)}
      .ax-otp{display:grid;grid-template-columns:repeat(${OPTIONS.OTP_LENGTH},1fr);gap:8px;margin:6px 0 16px}
      .ax-otp-box{width:100%;min-width:0;box-sizing:border-box;height:58px;text-align:center;font:inherit;font-size:1.5rem;font-weight:700;color:var(--text,inherit);background:var(--bg,rgba(148,163,184,.08));border:1.5px solid var(--border,rgba(148,163,184,.35));border-radius:14px;outline:none;caret-color:#6d5dfb;transition:border-color .15s,box-shadow .15s,transform .15s}
      .ax-otp-box:focus{border-color:#6d5dfb;box-shadow:0 0 0 4px rgba(109,93,251,.2);transform:translateY(-2px)}
      .ax-otp-box:not(:placeholder-shown),.ax-otp-box[value]:not([value=""]){border-color:#8b7bff}
      .ax-otp-box:disabled{opacity:.5}
      .ax-submit{position:relative}
      .ax-submit:disabled{opacity:.55;cursor:not-allowed}
      .ax-loading{color:transparent!important}
      .ax-loading::after{content:"";position:absolute;inset:0;margin:auto;width:18px;height:18px;border-radius:50%;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;animation:ax-spin .7s linear infinite}
      .ax-shake{animation:ax-shake .38s}
      .ax-success{display:flex;flex-direction:column;align-items:center;gap:6px;padding:26px 0 18px}
      .ax-ring{stroke:#10b981;stroke-dasharray:151;stroke-dashoffset:151;animation:ax-draw .5s ease forwards}
      .ax-tick{stroke:#10b981;stroke-dasharray:40;stroke-dashoffset:40;animation:ax-draw .35s .4s ease forwards}
      @keyframes ax-spin{to{transform:rotate(360deg)}}
      @keyframes ax-draw{to{stroke-dashoffset:0}}
      @keyframes ax-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}
      @media (max-width:420px){.ax-grid{grid-template-columns:1fr}.ax-otp{gap:6px}.ax-otp-box{height:52px;font-size:1.3rem}}
      @media (prefers-reduced-motion:reduce){.ax-shake,.ax-loading::after{animation:none}.ax-ring,.ax-tick{animation:none;stroke-dashoffset:0}.ax-otp-box:focus{transform:none}}
    `;
    document.head.appendChild(style);
  }

  /* ------------------------------------------------------------------------
     Start-up
     ------------------------------------------------------------------------ */

  function start() {
    overlay = document.getElementById("auth-overlay");
    if (!overlay) return;

    injectStyles();

    overlay.innerHTML = `
      <div class="auth-modal ax-modal" role="dialog" aria-modal="true" aria-labelledby="ax-title">
        <button type="button" class="close-overlay" data-act="close" aria-label="Close">✕</button>
        <div id="ax-body"></div>
      </div>`;

    modal = overlay.firstElementChild;
    body = modal.querySelector("#ax-body");

    bind();
    S.screen = "signin";
    render();
    watchOverlay();

    // script.js calls these by name, so replacing the globals redirects every caller.
    window.openAuthOverlay = openAuthOverlay;
    window.setAuthMode = (signUp) => go(signUp ? "signup" : "signin");
    window.setAuthMessage = (text, kind) => msg(text, kind === "success" ? "ok" : "error");

    // The OTP-length setting must match the Supabase dashboard; make a mismatch obvious.
    window.UniAIAuth = { options: OPTIONS, open: openAuthOverlay };
  }

  // Runs after script.js's own DOMContentLoaded init (it is loaded first).
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();