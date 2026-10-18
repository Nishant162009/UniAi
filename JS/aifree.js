/* ==========================================
   AI FREE JOBS — INTERACTION ENGINE (fixed)
   ========================================== */

let currentFilter = "all";
let scanRunning = false;

// Legacy store (titles only). Read once to migrate old saves, then emptied.
let savedJobs = [];
try {
  const legacy = JSON.parse(localStorage.getItem("aiSavedJobs") || "[]");
  if (Array.isArray(legacy)) savedJobs = legacy;
} catch (err) {
  savedJobs = [];
}

const $ = id => document.getElementById(id);
const allCards = () => [...document.querySelectorAll(".crazy-job-card")];


/* ------------------------------------------
   SEARCH + FILTER
------------------------------------------ */

function filterJobs(animate = true) {

  const searchEl = $("jobSearch");
  const query = searchEl ? searchEl.value.toLowerCase().trim() : "";

  let visible = 0;

  allCards().forEach(card => {

    // textContent works even when the card is display:none
    const text = card.textContent.toLowerCase();
    const categories = (card.dataset.category || "").toLowerCase();

    const matchesSearch = !query || text.includes(query);
    const matchesFilter =
      currentFilter === "all" || categories.includes(currentFilter);

    const show = matchesSearch && matchesFilter;
    const wasHidden = card.style.display === "none";

    card.style.display = show ? "" : "none";

    if (show) {
      visible++;

      // only animate cards that just appeared
      if (animate && wasHidden) {
        card.animate(
          [
            { opacity: 0, transform: "translateY(10px)" },
            { opacity: 1, transform: "translateY(0)" }
          ],
          { duration: 250, easing: "ease-out" }
        );
      }
    }
  });

  const count = $("jobCount");
  if (count) count.textContent = String(visible).padStart(2, "0");

  const none = $("noJobs");
  if (none) none.classList.toggle("hidden", visible !== 0);
}


function setJobFilter(filter, button) {

  currentFilter = String(filter).toLowerCase();

  document
    .querySelectorAll(".job-filter")
    .forEach(btn => btn.classList.remove("active"));

  if (button) button.classList.add("active");

  filterJobs();
}


/* ------------------------------------------
   SORT
------------------------------------------ */

function sortJobs(type) {

  const grid = $("jobGrid");
  if (!grid) return;

  const num = (el, key) => Number(el.dataset[key]) || 0;

  const sorters = {
    match: (a, b) => num(b, "match") - num(a, "match"),
    pay:   (a, b) => num(b, "pay") - num(a, "pay"),
    hours: (a, b) => num(a, "hours") - num(b, "hours")
  };

  const sorter = sorters[type];
  if (!sorter) return;

  const cards = [...grid.querySelectorAll(".crazy-job-card")].sort(sorter);
  cards.forEach(card => grid.appendChild(card));

  filterJobs(false);
}


/* ------------------------------------------
   SAVE JOB
------------------------------------------ */

function jobRecord(card) {

  const clean = el => el ? el.textContent.trim() : "";

  const tags = [
    clean(card.querySelector(".job-type")),
    clean(card.querySelector(".job-bottom strong")),
    ...[...card.querySelectorAll(".job-tags span")].map(clean)
  ].filter(Boolean);

  return {
    type: "job",
    name: clean(card.querySelector("h3")),
    tags
  };
}


function setHeart(button, saved) {

  if (!button) return;

  button.classList.toggle("saved", saved);
  button.textContent = saved ? "♥" : "♡";
  button.setAttribute("aria-pressed", String(saved));
}


function isJobSaved(card) {

  const rec = jobRecord(card);

  return window.UniAISaved
    ? window.UniAISaved.isSaved(rec)
    : savedJobs.includes(rec.name);
}


function toggleSave(button) {

  const card = button.closest(".crazy-job-card");
  if (!card) return;

  const rec = jobRecord(card);
  let nowSaved;

  if (window.UniAISaved) {

    // save.js stores it, syncs it and shows its own toast.
    nowSaved = window.UniAISaved.toggle(rec);

  } else {

    nowSaved = !savedJobs.includes(rec.name);

    savedJobs = nowSaved
      ? [...savedJobs, rec.name]
      : savedJobs.filter(job => job !== rec.name);

    try {
      localStorage.setItem("aiSavedJobs", JSON.stringify(savedJobs));
    } catch (err) {}

    toast(nowSaved ? "JOB SAVED" : "REMOVED FROM SAVED");
  }

  setHeart(button, nowSaved);

  if (nowSaved) createConfetti(button);
}


/* ------------------------------------------
   RESTORE SAVED JOBS
------------------------------------------ */

function migrateLegacyJobs() {

  if (!window.UniAISaved || !savedJobs.length) return;

  const cards = allCards();

  savedJobs.forEach(title => {

    const card = cards.find(c => {
      const h3 = c.querySelector("h3");
      return h3 && h3.textContent.trim() === title;
    });

    const rec = card
      ? jobRecord(card)
      : { type: "job", name: title, tags: [] };

    if (!window.UniAISaved.isSaved(rec)) {
      window.UniAISaved.toggle(rec);
    }
  });

  savedJobs = [];
  try {
    localStorage.setItem("aiSavedJobs", "[]");
  } catch (err) {}
}


function refreshJobHearts() {

  allCards().forEach(card => {
    setHeart(card.querySelector(".save-job"), isJobSaved(card));
  });
}


function restoreSavedJobs() {

  migrateLegacyJobs();
  refreshJobHearts();
}


window.addEventListener("uniai:saved-change", refreshJobHearts);


/* ------------------------------------------
   JOB MODAL
------------------------------------------ */

function lockScroll(lock) {

  document.documentElement.style.overflow = lock ? "hidden" : "";
  document.body.style.overflow = lock ? "hidden" : "";
}


function openJob(button) {

  const card = button.closest(".crazy-job-card");
  if (!card) return;

  const text = sel => {
    const el = card.querySelector(sel);
    return el ? el.textContent.trim() : "";
  };

  const set = (id, value) => {
    const el = $(id);
    if (el) el.textContent = value;
  };

  set("modalTitle", text("h3"));
  set("modalDescription", text("p"));
  set("modalMatch", (card.dataset.match || "0") + "%");
  set("modalType", text(".job-type"));
  set("modalPay", text(".job-bottom strong"));

  const modal = $("jobModal");
  if (modal) modal.classList.remove("hidden");

  lockScroll(true);
}


function closeJob() {

  const modal = $("jobModal");
  if (modal) modal.classList.add("hidden");

  // FIX: openJob locked both <html> and <body>, but close only freed <body>,
  // so the page could stay stuck unscrollable.
  lockScroll(false);
}


function expressInterest() {

  closeJob();

  toast("INTEREST RECORDED · APPLICATION FLOW READY");

  createConfetti(document.querySelector(".scan-btn"));
}


/* ------------------------------------------
   AI SCANNER
------------------------------------------ */

function runJobScan() {

  if (scanRunning) return;

  const status = $("scanStatus");
  const btn = document.querySelector(".scan-btn");

  const messages = [
    "SCANNING NETWORK...",
    "ANALYZING SKILLS...",
    "MATCHING OPPORTUNITIES...",
    "REMOVING PAYWALLS...",
    "CALCULATING FIT...",
    "SCAN COMPLETE"
  ];

  scanRunning = true;
  if (btn) btn.disabled = true;

  let index = 0;

  const interval = setInterval(() => {

    if (status) status.textContent = messages[index];

    index++;

    if (index >= messages.length) {

      clearInterval(interval);

      scanRunning = false;
      if (btn) btn.disabled = false;

      const found = highlightBestJobs();

      // FIX: toast used to always say "3" no matter what was found.
      toast(
        found
          ? `${found} HIGH-CONFIDENCE OPPORTUNIT${found === 1 ? "Y" : "IES"} DETECTED`
          : "SCAN COMPLETE · NO HIGH-CONFIDENCE MATCHES"
      );
    }

  }, 550);
}


function highlightBestJobs() {

  let found = 0;

  allCards().forEach(card => {

    const strong = Number(card.dataset.match) >= 90;

    card.style.boxShadow = strong ? "0 0 45px rgba(120,90,255,.28)" : "";

    if (strong) {
      found++;

      card.animate(
        [
          { transform: "scale(.98)" },
          { transform: "scale(1.02)" },
          { transform: "scale(1)" }
        ],
        { duration: 700, easing: "ease-out" }
      );
    }
  });

  return found;
}


/* ------------------------------------------
   TOAST
------------------------------------------ */

function toast(message) {

  const old = document.querySelector(".ai-toast");
  if (old) old.remove();

  const el = document.createElement("div");
  el.className = "ai-toast";

  const dot = document.createElement("span");
  dot.className = "toast-dot";

  el.append(dot, document.createTextNode(" " + message));

  document.body.appendChild(el);

  setTimeout(() => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 300);
  }, 2200);
}


/* ------------------------------------------
   CONFETTI
------------------------------------------ */

function createConfetti(origin) {

  if (!origin) return;

  const rect = origin.getBoundingClientRect();

  for (let i = 0; i < 18; i++) {

    const piece = document.createElement("i");

    piece.className = "confetti-piece";
    piece.style.left = rect.left + rect.width / 2 + "px";
    piece.style.top = rect.top + rect.height / 2 + "px";
    piece.style.setProperty("--x", `${(Math.random() - .5) * 260}px`);
    piece.style.setProperty("--y", `${(Math.random() - .5) * 220}px`);

    document.body.appendChild(piece);

    setTimeout(() => piece.remove(), 900);
  }
}


/* ------------------------------------------
   KEYBOARD
------------------------------------------ */

document.addEventListener("keydown", e => {

  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {

    const search = $("jobSearch");

    if (search) {
      e.preventDefault();
      search.focus();
    }
  }

  if (e.key === "Escape") closeJob();
});


/* ------------------------------------------
   CARD MAGNETIC EFFECT
------------------------------------------ */

function initMagneticCards() {

  // FIX: this used to run at script load, so if the script sat in <head>
  // there were no cards yet and the effect silently never attached.
  // Skipped on touch devices and for reduced-motion users.

  const reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const touch =
    window.matchMedia &&
    window.matchMedia("(hover: none)").matches;

  if (reduce || touch) return;

  allCards().forEach(card => {

    card.addEventListener("mousemove", e => {

      const rect = card.getBoundingClientRect();

      const rotateX = (((e.clientY - rect.top) / rect.height) - .5) * -5;
      const rotateY = (((e.clientX - rect.left) / rect.width) - .5) * 5;

      card.style.transform =
        `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;
    });

    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });
}


/* ------------------------------------------
   INITIALIZE
------------------------------------------ */

document.addEventListener("DOMContentLoaded", () => {

  restoreSavedJobs();
  initMagneticCards();

  sortJobs("match");
  filterJobs(false);
});