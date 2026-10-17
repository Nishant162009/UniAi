/* UniAI — interactive hero globe v4 (transparent, continents only) */
(() => {
  "use strict";

  const canvas = document.getElementById("hero-globe");
  if (!canvas) return;
  const host = canvas.parentElement;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  /* ---------- config ---------- */
  const CFG = {
    topoUrl: "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json",
    topojsonUrl: "https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js",
    points: 30000,     // sphere samples (~30% land). Higher = denser dots
    radius: 0.39,      // globe radius as a fraction of the (oversized) canvas
    roll: 0.32,        // axis lean in radians (the tilted look)
    dwell: 5200,       // ms per destination during the tour
    resumeAfter: 3500,
    ring: { r: 1.28, elevation: 0.5, roll: 0.3, points: 160 }
  };

  const ORIGIN = { lat: 20.6, lon: 78.9 }; // India
  const DEST = [
    { id: "uk",    lat: 51.5,  lon: -0.1,   chip: ".chip-uk" },
    { id: "usa",   lat: 40.7,  lon: -74.0,  chip: ".chip-usa" },
    { id: "japan", lat: 35.7,  lon: 139.7,  chip: ".chip-japan" },
    { id: "aus",   lat: -33.9, lon: 151.2,  chip: ".chip-aus" }
  ];

  // dots: [left, middle, right] colour across the disc
  const PAL = {
    light: { dots: ["70,110,240", "105,80,235", "165,70,220"],
             ring: "109,93,251", ringA: 0.45, add: false },
    dark:  { dots: ["105,150,255", "150,110,255", "210,120,255"],
             ring: "140,110,255", ringA: 0.75, add: true }
  };

  /* ---------- helpers ---------- */
  const TAU = Math.PI * 2, RAD = Math.PI / 180;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  const vec = (lat, lon) => {
    const la = lat * RAD, lo = lon * RAD;
    return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
  };
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isDark = () => document.documentElement.getAttribute("data-theme") === "dark";

  /* ---------- state ---------- */
  let W = 0, H = 0, dpr = 1, Rpx = 100;
  const maxDpr = Math.min(window.devicePixelRatio || 1, 2);
  let qualityDpr = maxDpr;

  let yaw = 0, tilt = 0.3, vYaw = 0;
  let cY = 1, sY = 0, cT = 1, sT = 0;
  const cR = Math.cos(CFG.roll), sR = Math.sin(CFG.roll);
  let rx = 0, ry = 0, rz = 0; // output of rotate() / ringPoint()

  let focusIdx = 0, focusAt = 0, autopilotAt = 0, activeShown = false;

  let dragging = false, lastX = 0, lastY = 0, lastT = 0;
  let land = null, loadedAt = 0, t0 = 0;
  let dark = isDark(), dirty = true;
  let visible = false, running = false, raf = 0, last = 0;
  let slowFrames = 0;

  const chips = DEST.map((d) => host.querySelector(d.chip));

  /* ---------- geometry (built once) ---------- */
  const originVec = vec(ORIGIN.lat, ORIGIN.lon);
  const destVec = DEST.map((d) => vec(d.lat, d.lon));

  const ARC_N = 72;
  const arcs = destVec.map((b) => {
    const a = originVec;
    const om = Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1));
    const s = Math.sin(om);
    const lift = 0.06 + 0.26 * (om / Math.PI);
    const pts = new Float32Array(ARC_N * 3);
    for (let i = 0; i < ARC_N; i++) {
      const t = i / (ARC_N - 1);
      const k1 = Math.sin((1 - t) * om) / s, k2 = Math.sin(t * om) / s;
      const h = 1 + lift * Math.sin(Math.PI * t);
      pts[i * 3] = (a[0] * k1 + b[0] * k2) * h;
      pts[i * 3 + 1] = (a[1] * k1 + b[1] * k2) * h;
      pts[i * 3 + 2] = (a[2] * k1 + b[2] * k2) * h;
    }
    return pts;
  });
  const ax = new Float32Array(ARC_N), ay = new Float32Array(ARC_N), av = new Uint8Array(ARC_N);

  // Sparkles around the globe (dark mode only)
  const stars = Array.from({ length: 22 }, (_, i) => ({
    x: Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1,
    y: Math.abs(Math.sin(i * 78.233) * 12345.6789) % 1,
    p: i * 1.7
  }));

  /* ---------- land mask -> dots (no main-thread freeze) ---------- */
  function loadScript(src) {
    return new Promise((res, rej) => {
      if (window.topojson) return res();
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  async function buildLand() {
    await loadScript(CFG.topojsonUrl);
    const topo = await (await fetch(CFG.topoUrl)).json();
    const fc = window.topojson.feature(topo, topo.objects.land);
    const geoms = fc.type === "FeatureCollection" ? fc.features.map((f) => f.geometry) : [fc.geometry];

    const w = 1024, h = 512;
    const off = document.createElement("canvas");
    off.width = w; off.height = h;
    const g = off.getContext("2d", { willReadFrequently: true });
    g.fillStyle = "#fff";
    g.beginPath();
    const rings = (poly) => poly.forEach((ring) => {
      ring.forEach(([lon, lat], i) => {
        const x = ((lon + 180) / 360) * w, y = ((90 - lat) / 180) * h;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      });
      g.closePath();
    });
    geoms.forEach((geo) => {
      if (geo.type === "Polygon") rings(geo.coordinates);
      else if (geo.type === "MultiPolygon") geo.coordinates.forEach(rings);
    });
    g.fill("evenodd");
    const data = g.getImageData(0, 0, w, h).data;

    const golden = Math.PI * (3 - Math.sqrt(5));
    const X = [], Y = [], Z = [];
    for (let i = 0; i < CFG.points; i++) {
      const y = 1 - (2 * (i + 0.5)) / CFG.points;
      const r = Math.sqrt(1 - y * y), th = i * golden;
      const x0 = Math.cos(th) * r, z0 = Math.sin(th) * r;
      const lon = Math.atan2(x0, z0) / RAD, lat = Math.asin(y) / RAD;
      const px = clamp((((lon + 180) / 360) * w) | 0, 0, w - 1);
      const py = clamp((((90 - lat) / 180) * h) | 0, 0, h - 1);
      if (data[(py * w + px) * 4 + 3] > 128) { X.push(x0); Y.push(y); Z.push(z0); }
    }
    land = { n: X.length, x: Float32Array.from(X), y: Float32Array.from(Y), z: Float32Array.from(Z) };
    loadedAt = performance.now();
    dirty = true;
  }

  /* ---------- 3D ---------- */
  // Globe: yaw -> tilt -> roll (the roll leans the whole axis)
  function rotate(x, y, z) {
    const x1 = x * cY + z * sY, z1 = z * cY - x * sY;
    const y1 = y * cT - z1 * sT;
    rz = y * sT + z1 * cT;
    rx = x1 * cR - y1 * sR;
    ry = x1 * sR + y1 * cR;
  }

  // Orbit ring: fixed in view space, doesn't spin with the globe
  const rcR = Math.cos(CFG.ring.roll), rsR = Math.sin(CFG.ring.roll);
  const rcE = Math.cos(CFG.ring.elevation), rsE = Math.sin(CFG.ring.elevation);
  function ringPoint(a) {
    const px = CFG.ring.r * Math.cos(a), pz = CFG.ring.r * Math.sin(a);
    const y1 = -pz * rsE;
    rz = pz * rcE;
    rx = px * rcR - y1 * rsR;
    ry = px * rsR + y1 * rcR;
  }

  /* ---------- focus / tour ---------- */
  const focusYaw = (i) => -DEST[i].lon * RAD;
  const focusTilt = (i) => clamp(DEST[i].lat * RAD * 0.6, -0.45, 0.6);

  function showActive(on) {
    activeShown = on;
    chips.forEach((c, k) => c && c.classList.toggle("is-active", on && k === focusIdx));
  }
  function setFocus(i) {
    focusIdx = i; focusAt = performance.now(); autopilotAt = 0;
    showActive(true); dirty = true;
  }
  chips.forEach((c, i) => {
    if (!c) return;
    c.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") setFocus(i); });
    c.addEventListener("click", () => setFocus(i));
  });

  /* ---------- input ---------- */
  host.style.touchAction = "pan-y";
  host.style.cursor = "grab";

  host.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".badge-chip")) return;
    dragging = true; vYaw = 0;
    lastX = e.clientX; lastY = e.clientY; lastT = performance.now();
    host.setPointerCapture(e.pointerId);
    host.style.cursor = "grabbing";
    showActive(false);
  });
  host.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    dirty = true;
    const now = performance.now();
    const dtm = Math.max(1, now - lastT) / 1000;
    const dyaw = (e.clientX - lastX) / Rpx;
    yaw += dyaw;
    tilt = clamp(tilt + ((e.clientY - lastY) / Rpx) * 0.8, -0.9, 0.9);
    vYaw = clamp(vYaw * 0.6 + (dyaw / dtm) * 0.4, -6, 6);
    lastX = e.clientX; lastY = e.clientY; lastT = now;
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    if (performance.now() - lastT > 80) vYaw = 0;
    autopilotAt = performance.now() + CFG.resumeAfter;
    host.style.cursor = "grab";
  };
  host.addEventListener("pointerup", endDrag);
  host.addEventListener("pointercancel", endDrag);

  /* ---------- update ---------- */
  function update(now, dt) {
    if (dragging) return;

    if (vYaw !== 0) {
      yaw += vYaw * dt;
      vYaw *= Math.exp(-dt * 2.2);
      if (Math.abs(vYaw) < 0.02) vYaw = 0;
      dirty = true;
      return;
    }
    if (now < autopilotAt) return;
    if (!activeShown) showActive(true);

    if (!reduceMotion && now - focusAt > CFG.dwell) {
      focusIdx = (focusIdx + 1) % DEST.length;
      focusAt = now;
      showActive(true);
    }
    const dy = wrap(focusYaw(focusIdx) - yaw), dt2 = focusTilt(focusIdx) - tilt;
    const k = 1 - Math.exp(-dt * 2.6);
    yaw += dy * k; tilt += dt2 * k;
    if (Math.abs(dy) > 1e-4 || Math.abs(dt2) > 1e-4) dirty = true;
  }

  /* ---------- drawing pieces ---------- */
  function strokeRing(front, R, cx, cy, pal) {
    const N = CFG.ring.points;
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i <= N; i++) {
      ringPoint((i / N) * TAU);
      const vis = front ? rz >= 0 : rz < 0; // globe is transparent: back half stays visible
      if (!vis) { pen = false; continue; }
      const x = cx + rx * R, y = cy - ry * R;
      pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      pen = true;
    }
    const k = front ? 1 : 0.45;
    ctx.lineWidth = R * 0.016;
    ctx.strokeStyle = `rgba(${pal.ring},${0.12 * k})`;
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = `rgba(${pal.ring},${pal.ringA * k})`;
    ctx.stroke();
  }

  function drawSatellite(a, R, cx, cy, pal) {
    ringPoint(a);
    const x = cx + rx * R, y = cy - ry * R, s = R * 0.05;
    const g = ctx.createRadialGradient(x, y, 0, x, y, s);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.25, `rgba(${pal.ring},0.85)`);
    g.addColorStop(1, `rgba(${pal.ring},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
  }

  function drawOrigin(T, R, cx, cy) {
    rotate(originVec[0], originVec[1], originVec[2]);
    if (rz < 0.05) return;
    const x = cx + rx * R, y = cy - ry * R, r = R * 0.013;
    if (!reduceMotion) {
      const p = (T / 1600) % 1;
      ctx.beginPath(); ctx.arc(x, y, r + R * 0.05 * p, 0, TAU);
      ctx.strokeStyle = `rgba(56,189,248,${(1 - p) * 0.6})`;
      ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = "rgb(56,189,248)"; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.stroke();
  }

  // Map pin. Returns the pin head position (for the leader line).
  function drawPin(v, T, phase, active, R, cx, cy) {
    rotate(v[0], v[1], v[2]);
    if (rz < 0.06) return null;
    const x = cx + rx * R, y = cy - ry * R;
    const r = R * (active ? 0.03 : 0.022), h = r * 2.6;

    ctx.save();
    ctx.globalAlpha *= clamp((rz - 0.06) / 0.2, 0, 1);

    if (!reduceMotion) { // pulse on the ground
      const p = (T / 1700 + phase) % 1;
      ctx.beginPath();
      ctx.ellipse(x, y, r * (1.2 + 2.6 * p), r * (0.5 + 1.1 * p), 0, 0, TAU);
      ctx.strokeStyle = `rgba(167,139,250,${(1 - p) * 0.7})`;
      ctx.lineWidth = 1.4; ctx.stroke();
    }

    ctx.translate(x, y);
    ctx.shadowColor = "rgba(139,92,246,0.9)";
    ctx.shadowBlur = active ? 18 : 10;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-r * 0.35, -h * 0.45, -r, -h * 0.6, -r, -h);
    ctx.arc(0, -h, r, Math.PI, 0);
    ctx.bezierCurveTo(r, -h * 0.6, r * 0.35, -h * 0.45, 0, 0);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -h - r, 0, 0);
    g.addColorStop(0, "#c4b5fd");
    g.addColorStop(1, "#7c3aed");
    ctx.fillStyle = g; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(0, -h, r * 0.4, 0, TAU);
    ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.fill();
    ctx.restore();

    return [x, y - h];
  }

  /* ---------- main draw ---------- */
  function draw(now) {
    if (!t0) t0 = now;
    const sceneIn = easeOut(clamp((now - t0) / 1300, 0, 1));
    const dotsIn = loadedAt ? easeOut(clamp((now - loadedAt) / 1600, 0, 1)) : 0;
    if (sceneIn < 1 || dotsIn < 1) dirty = true;

    const pal = dark ? PAL.dark : PAL.light;
    const T = reduceMotion ? 0 : now;
    const cx = W / 2, cy = H / 2;
    Rpx = Math.min(W, H) * CFG.radius;
    const R = Rpx * (0.92 + 0.08 * sceneIn);
    cY = Math.cos(yaw); sY = Math.sin(yaw); cT = Math.cos(tilt); sT = Math.sin(tilt);

    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = sceneIn;

    // Sparkles
    if (dark) {
      for (const s of stars) {
        const x = s.x * W, y = s.y * H;
        if (Math.hypot(x - cx, y - cy) < R * 1.1) continue;
        const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(T / 700 + s.p));
        ctx.fillStyle = `rgba(190,170,255,${a})`;
        ctx.fillRect(x, y, 1.6, 1.6);
      }
    }

    // Back half of the orbit ring (visible through the transparent globe)
    strokeRing(false, R, cx, cy, pal);

    // Land dots: 6 depth levels x 3 colours = 18 fills
    if (land && dotsIn > 0) {
      const B = 6, C = 3, { n, x, y, z } = land;
      const paths = Array.from({ length: B * C }, () => new Path2D());
      for (let i = 0; i < n; i++) {
        rotate(x[i], y[i], z[i]);
        if (rz <= 0.02) continue;
        const px = cx + rx * R, py = cy - ry * R;
        const d = Math.min(B - 1, (rz * B) | 0);
        const c = clamp(((rx + 1) * 0.5 * C) | 0, 0, C - 1);
        const rr = R * 0.0068 * (0.8 + 0.5 * (d / (B - 1)));
        const p = paths[d * C + c];
        p.moveTo(px + rr, py);
        p.arc(px, py, rr, 0, TAU);
      }
      if (pal.add) ctx.globalCompositeOperation = "lighter";
      for (let d = 0; d < B; d++) {
        const f = d / (B - 1);
        const a = (0.3 + 0.7 * Math.pow(f, 1.1)) * dotsIn;
        for (let c = 0; c < C; c++) {
          ctx.fillStyle = `rgba(${pal.dots[c]},${a})`;
          ctx.fill(paths[d * C + c]);
        }
      }
      ctx.globalCompositeOperation = "source-over";
    }

    // Arcs from India with travelling comets
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    arcs.forEach((pts, j) => {
      for (let i = 0; i < ARC_N; i++) {
        rotate(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
        ax[i] = cx + rx * R; ay[i] = cy - ry * R;
        av[i] = rz >= 0 || rx * rx + ry * ry >= 1 ? 1 : 0;
      }
      const hot = activeShown && j === focusIdx;
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i < ARC_N; i++) {
        if (!av[i]) { pen = false; continue; }
        pen ? ctx.lineTo(ax[i], ay[i]) : ctx.moveTo(ax[i], ay[i]);
        pen = true;
      }
      ctx.lineWidth = R * 0.006;
      ctx.strokeStyle = `rgba(168,130,255,${hot ? 0.55 : 0.2})`;
      ctx.stroke();

      if (reduceMotion) return;
      const head = (((T / 1000) * 0.28 + j * 0.23) % 1.35) * (ARC_N - 1);
      const tail = 18;
      for (let i = Math.max(1, Math.floor(head) - tail); i <= Math.min(ARC_N - 1, Math.floor(head)); i++) {
        if (!av[i] || !av[i - 1]) continue;
        const a = clamp(1 - (head - i) / tail, 0, 1);
        ctx.beginPath(); ctx.moveTo(ax[i - 1], ay[i - 1]); ctx.lineTo(ax[i], ay[i]);
        ctx.lineWidth = R * (0.005 + 0.008 * a);
        ctx.strokeStyle = `rgba(215,195,255,${a * (hot ? 1 : 0.75)})`;
        ctx.stroke();
      }
    });

    // Front half of the orbit ring + satellites
    strokeRing(true, R, cx, cy, pal);
    if (!reduceMotion) {
      drawSatellite(T * 0.00032, R, cx, cy, pal);
      drawSatellite(T * 0.00032 + Math.PI, R, cx, cy, pal);
    } else {
      drawSatellite(0.9, R, cx, cy, pal);
    }

    // Markers
    drawOrigin(T, R, cx, cy);
    let activePos = null;
    destVec.forEach((v, j) => {
      const act = activeShown && j === focusIdx;
      const pos = drawPin(v, T, j * 0.25, act, R, cx, cy);
      if (act) activePos = pos;
    });

    // Leader line: active pin -> its chip
    const chip = chips[focusIdx];
    if (activeShown && activePos && chip) {
      const cr = canvas.getBoundingClientRect(), r = chip.getBoundingClientRect();
      const l = r.left - cr.left, t = r.top - cr.top;
      const tx = clamp(activePos[0], l, l + r.width), ty = clamp(activePos[1], t, t + r.height);
      if (Math.hypot(tx - activePos[0], ty - activePos[1]) > 6) {
        ctx.beginPath(); ctx.moveTo(activePos[0], activePos[1]); ctx.lineTo(tx, ty);
        ctx.setLineDash([3, 4]); ctx.lineWidth = 1.25;
        ctx.strokeStyle = "rgba(167,139,250,0.7)"; ctx.stroke(); ctx.setLineDash([]);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- loop ---------- */
  function frame(now) {
    raf = 0;
    if (!running) return;
    raf = requestAnimationFrame(frame);

    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    update(now, dt);
    if (reduceMotion && !dirty && !dragging) return;
    dirty = false;
    draw(now);

    slowFrames = dt > 0.025 ? slowFrames + 1 : Math.max(0, slowFrames - 2);
    if (slowFrames > 45 && qualityDpr > 1) {
      qualityDpr = Math.max(1, qualityDpr - 0.25); slowFrames = 0; resize();
    }
  }

  function sync() {
    const should = visible && !document.hidden;
    if (should && !running) { running = true; last = performance.now(); if (!raf) raf = requestAnimationFrame(frame); }
    else if (!should) running = false;
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; // canvas is larger than its host
    if (!w || !h) return;
    W = w; H = h; dpr = Math.min(maxDpr, qualityDpr);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dirty = true;
  }

  /* ---------- boot ---------- */
  setFocus(0);
  yaw = focusYaw(0) + (reduceMotion ? 0 : 1.6);
  tilt = focusTilt(0);

  new ResizeObserver(resize).observe(host);
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; sync(); }).observe(canvas);
  document.addEventListener("visibilitychange", sync);
  new MutationObserver(() => { dark = isDark(); dirty = true; })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  resize();
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 60));
  idle(() => buildLand().catch((err) => console.warn("Globe: land data unavailable.", err)));

  window.UniAIGlobe = { focus: (id) => { const i = DEST.findIndex((d) => d.id === id); if (i >= 0) setFocus(i); } };
})();