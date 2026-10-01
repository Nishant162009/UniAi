/* ==========================================
   AI FREE JOBS — INTERACTION ENGINE
   ========================================== */

let currentFilter = "all";

// Legacy store (titles only). Saved jobs now live in save.js (UniAISaved) so
// they show on the Saved page and follow the account. This list is read once
// to migrate old saves, then emptied.
let savedJobs = [];
try {
  const legacy = JSON.parse(localStorage.getItem("aiSavedJobs") || "[]");
  if (Array.isArray(legacy)) savedJobs = legacy;
} catch (err) {
  savedJobs = [];
}


/* ------------------------------------------
   SEARCH
------------------------------------------ */

function filterJobs() {

  const query =
    document.getElementById("jobSearch")
      .value
      .toLowerCase()
      .trim();

  const cards =
    [...document.querySelectorAll(".crazy-job-card")];

  let visible = 0;

  cards.forEach(card => {

    const text = card.innerText.toLowerCase();
    const categories =
      card.dataset.category.toLowerCase();

    const matchesSearch =
      !query || text.includes(query);

    const matchesFilter =
      currentFilter === "all" ||
      categories.includes(currentFilter);

    const show =
      matchesSearch && matchesFilter;

    card.style.display = show ? "" : "none";

    if (show) {
      visible++;

      card.animate(
        [
          { opacity: 0, transform: "translateY(10px)" },
          { opacity: 1, transform: "translateY(0)" }
        ],
        {
          duration: 250,
          easing: "ease-out"
        }
      );
    }
  });

  document.getElementById("jobCount")
    .textContent =
    String(visible).padStart(2, "0");

  document.getElementById("noJobs")
    .classList.toggle("hidden", visible !== 0);
}


/* ------------------------------------------
   FILTERS
------------------------------------------ */

function setJobFilter(filter, button) {

  currentFilter = filter;

  document
    .querySelectorAll(".job-filter")
    .forEach(btn =>
      btn.classList.remove("active")
    );

  button.classList.add("active");

  filterJobs();
}


/* ------------------------------------------
   SORT
------------------------------------------ */

function sortJobs(type) {

  const grid =
    document.getElementById("jobGrid");

  const cards =
    [...grid.querySelectorAll(".crazy-job-card")];

  cards.sort((a, b) => {

    if (type === "match") {
      return Number(b.dataset.match) -
             Number(a.dataset.match);
    }

    if (type === "pay") {
      return Number(b.dataset.pay) -
             Number(a.dataset.pay);
    }

    if (type === "hours") {
      return Number(a.dataset.hours) -
             Number(b.dataset.hours);
    }

  });

  cards.forEach(card => grid.appendChild(card));

  filterJobs();
}


/* ------------------------------------------
   SAVE JOB
------------------------------------------ */

function jobRecord(card) {

  const clean = el => el ? el.innerText.trim() : "";

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
  button.innerText = saved ? "♥" : "♡";
  button.setAttribute("aria-pressed", String(saved));
}


function isJobSaved(card) {

  const rec = jobRecord(card);

  return window.UniAISaved
    ? window.UniAISaved.isSaved(rec)
    : savedJobs.includes(rec.name);
}


function toggleSave(button) {

  const card =
    button.closest(".crazy-job-card");

  if (!card) return;

  const rec = jobRecord(card);

  let nowSaved;

  if (window.UniAISaved) {

    // save.js stores it, syncs it to the account and shows its own toast.
    nowSaved = window.UniAISaved.toggle(rec);

  } else {

    // save.js not on this page: old local-only behaviour.
    nowSaved = !savedJobs.includes(rec.name);

    savedJobs = nowSaved
      ? [...savedJobs, rec.name]
      : savedJobs.filter(job => job !== rec.name);

    localStorage.setItem(
      "aiSavedJobs",
      JSON.stringify(savedJobs)
    );

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

  const cards =
    [...document.querySelectorAll(".crazy-job-card")];

  savedJobs.forEach(title => {

    const card = cards.find(c =>
      c.querySelector("h3").innerText.trim() === title
    );

    const rec = card
      ? jobRecord(card)
      : { type: "job", name: title, tags: [] };

    if (!window.UniAISaved.isSaved(rec)) {
      window.UniAISaved.toggle(rec);
    }
  });

  // Empty the old list (this also clears it on the account copy).
  savedJobs = [];
  localStorage.setItem("aiSavedJobs", "[]");
}


function refreshJobHearts() {

  document
    .querySelectorAll(".crazy-job-card")
    .forEach(card => {
      setHeart(
        card.querySelector(".save-job"),
        isJobSaved(card)
      );
    });
}


function restoreSavedJobs() {

  migrateLegacyJobs();
  refreshJobHearts();
}


// Hearts follow the Saved page: removing a job there un-hearts it here,
// and account sync updates them once it finishes loading.
window.addEventListener("uniai:saved-change", refreshJobHearts);


/* ------------------------------------------
   JOB MODAL
------------------------------------------ */

function openJob(button) {

  const card =
    button.closest(".crazy-job-card");

  const title =
    card.querySelector("h3").innerText;

  const description =
    card.querySelector("p").innerText;

  const match =
    card.dataset.match + "%";

  const type =
    card.querySelector(".job-type").innerText;

  const pay =
    card.querySelector(".job-bottom strong").innerText;

  document.getElementById("modalTitle")
    .innerText = title;

  document.getElementById("modalDescription")
    .innerText = description;

  document.getElementById("modalMatch")
    .innerText = match;

  document.getElementById("modalType")
    .innerText = type;

  document.getElementById("modalPay")
    .innerText = pay;

  document
    .getElementById("jobModal")
    .classList.remove("hidden");

 document.documentElement.style.overflow = "hidden";
 document.body.style.overflow = "hidden";
}


function closeJob() {

  document
    .getElementById("jobModal")
    .classList.add("hidden");

  document.body.style.overflow = "";
}


function expressInterest() {

  closeJob();

  toast(
    "INTEREST RECORDED · APPLICATION FLOW READY"
  );

  createConfetti(
    document.querySelector(".scan-btn")
  );
}


/* ------------------------------------------
   AI SCANNER
------------------------------------------ */

function runJobScan() {

  const status =
    document.getElementById("scanStatus");

  const btn =
    document.querySelector(".scan-btn");

  const messages = [
    "SCANNING NETWORK...",
    "ANALYZING SKILLS...",
    "MATCHING OPPORTUNITIES...",
    "REMOVING PAYWALLS...",
    "CALCULATING FIT...",
    "SCAN COMPLETE"
  ];

  btn.disabled = true;

  let index = 0;

  const interval =
    setInterval(() => {

      status.innerText =
        messages[index];

      index++;

      if (index >= messages.length) {

        clearInterval(interval);

        btn.disabled = false;

        highlightBestJobs();

        toast(
          "3 HIGH-CONFIDENCE OPPORTUNITIES DETECTED"
        );
      }

    }, 550);
}


/* ------------------------------------------
   HIGHLIGHT BEST MATCHES
------------------------------------------ */

function highlightBestJobs() {

  const cards =
    [...document.querySelectorAll(".crazy-job-card")];

  cards.forEach(card => {

    const match =
      Number(card.dataset.match);

    card.style.boxShadow =
      match >= 90
        ? "0 0 45px rgba(120,90,255,.28)"
        : "";

    if (match >= 90) {

      card.animate(
        [
          { transform: "scale(.98)" },
          { transform: "scale(1.02)" },
          { transform: "scale(1)" }
        ],
        {
          duration: 700,
          easing: "ease-out"
        }
      );
    }
  });
}


/* ------------------------------------------
   TOAST
------------------------------------------ */

function toast(message) {

  const old =
    document.querySelector(".ai-toast");

  if (old) old.remove();

  const el =
    document.createElement("div");

  el.className = "ai-toast";

  el.innerHTML = `
    <span class="toast-dot"></span>
    ${message}
  `;

  document.body.appendChild(el);

  setTimeout(() => {
    el.classList.add("out");

    setTimeout(
      () => el.remove(),
      300
    );

  }, 2200);
}


/* ------------------------------------------
   CONFETTI
------------------------------------------ */

function createConfetti(origin) {

  if (!origin) return;

  const rect =
    origin.getBoundingClientRect();

  for (let i = 0; i < 18; i++) {

    const piece =
      document.createElement("i");

    piece.className = "confetti-piece";

    piece.style.left =
      rect.left + rect.width / 2 + "px";

    piece.style.top =
      rect.top + rect.height / 2 + "px";

    piece.style.setProperty(
      "--x",
      `${(Math.random() - .5) * 260}px`
    );

    piece.style.setProperty(
      "--y",
      `${(Math.random() - .5) * 220}px`
    );

    document.body.appendChild(piece);

    setTimeout(
      () => piece.remove(),
      900
    );
  }
}


/* ------------------------------------------
   KEYBOARD COMMAND CENTER
------------------------------------------ */

document.addEventListener("keydown", e => {

  if (
    (e.metaKey || e.ctrlKey) &&
    e.key.toLowerCase() === "k"
  ) {

    e.preventDefault();

    document
      .getElementById("jobSearch")
      .focus();
  }

  if (e.key === "Escape") {
    closeJob();
  }
});


/* ------------------------------------------
   CARD MAGNETIC EFFECT
------------------------------------------ */

document
  .querySelectorAll(".crazy-job-card")
  .forEach(card => {

    card.addEventListener("mousemove", e => {

      const rect =
        card.getBoundingClientRect();

      const x =
        e.clientX - rect.left;

      const y =
        e.clientY - rect.top;

      const rotateX =
        ((y / rect.height) - .5) * -5;

      const rotateY =
        ((x / rect.width) - .5) * 5;

      card.style.transform =
        `perspective(900px)
         rotateX(${rotateX}deg)
         rotateY(${rotateY}deg)
         translateY(-6px)`;
    });

    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });


/* ------------------------------------------
   INITIALIZE
------------------------------------------ */

document.addEventListener("DOMContentLoaded", () => {

  restoreSavedJobs();

  sortJobs("match");

  filterJobs();
});