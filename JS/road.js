/* ==========================================================================
   UniAI — Roadmap (road.js)
   The ONLY roadmap script. script.js no longer has roadmap code.

   Storage key: "roadmapProgress"  (mirrored to the account by sync.js)
   Legacy key:  "uniai-roadmap"    (read once, then ignored)
   ========================================================================== */

(function () {
    "use strict";

    const KEY = "roadmapProgress";
    const LEGACY_KEY = "uniai-roadmap";
    const RING_CIRCUMFERENCE = 264; // 2 * PI * r(42)

    const checks = () => [...document.querySelectorAll("[data-road]")];
    const byId = (id) => document.getElementById(id);

    /* ---------- storage ---------- */

    function readProgress() {
        for (const key of [KEY, LEGACY_KEY]) {
            try {
                const raw = localStorage.getItem(key);
                if (!raw) continue;

                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed;
            } catch (err) {
                console.warn("Could not read roadmap progress:", key);
            }
        }
        return [];
    }

    function writeProgress(values) {
        try {
            localStorage.setItem(KEY, JSON.stringify(values));
        } catch (err) {
            console.warn("Could not save roadmap progress.", err);
        }
    }

    /* ---------- render (never writes to storage) ---------- */

    function render() {
        const boxes = checks();
        if (!boxes.length) return;

        const total = boxes.length;
        const completed = boxes.filter((b) => b.checked).length;
        const percent = Math.round((completed / total) * 100);

        const bar = byId("roadmap-bar");
        if (bar) bar.style.width = `${percent}%`;

        const label = byId("roadmap-label");
        if (label) label.textContent = `${completed} / ${total} complete`;

        const remaining = byId("roadmap-remaining");
        if (remaining) {
            const left = total - completed;
            remaining.textContent =
                left === 0
                    ? "All milestones complete 🎉"
                    : `${left} milestone${left === 1 ? "" : "s"} remaining`;
        }

        const percentEl = byId("roadmap-percent");
        if (percentEl) percentEl.textContent = `${percent}%`;

        const completePercent = byId("roadmap-complete-percent");
        if (completePercent) completePercent.textContent = `${percent}%`;

        const ring = byId("roadmap-ring");
        if (ring) {
            ring.style.strokeDashoffset =
                RING_CIRCUMFERENCE - (percent / 100) * RING_CIRCUMFERENCE;
        }

        const line = byId("roadmap-line-fill");
        if (line) line.style.height = `${percent}%`;

        const status = byId("roadmap-status");
        if (status) {
            status.textContent =
                percent === 0 ? "STARTING OUT"
                : percent < 25 ? "BUILDING MOMENTUM"
                : percent < 50 ? "MAKING PROGRESS"
                : percent < 75 ? "HALFWAY THERE"
                : percent < 100 ? "FINAL STRETCH"
                : "MISSION COMPLETE";
        }

        boxes.forEach((box, index) => {
            const step = document.querySelector(`.road-step[data-step="${index}"]`);
            if (step) step.classList.toggle("is-complete", box.checked);
        });
    }

    /* ---------- public ---------- */

    // Called by the checkboxes' inline onchange="saveRoadmap()".
    function saveRoadmap() {
        writeProgress(checks().map((box) => box.checked));
        render();
    }

    function loadRoadmap() {
        const progress = readProgress();

        checks().forEach((box, index) => {
            box.checked = Boolean(progress[index]);
        });

        // Draw only. Writing here would stamp an empty roadmap as "newest"
        // on a fresh browser and overwrite the account's saved progress.
        render();
    }

    window.saveRoadmap = saveRoadmap;
    window.loadRoadmap = loadRoadmap;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", loadRoadmap);
    } else {
        loadRoadmap();
    }
})();