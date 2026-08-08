/* ============================================================
   blob.js — draggable orb + elastic reveal window

   The orb can be dragged anywhere inside the hero. What follows it
   is a dividing cell: one lobe stays anchored at the badge, a second
   lobe wraps the orb, and the two stay joined by a neck that thins
   as they pull apart but never breaks. The shape is a clip window
   onto a photo layered under the page background — the further it
   opens, the more of that photo is uncovered.

   Geometry note: the outline is built as a half-width profile along
   the axis between the two lobe centres, NOT as a radius around a
   single centre. A dumbbell isn't star-shaped from any one point —
   rays near the neck cross the boundary three times — so a radial
   representation would flatten the neck into a straight wedge.
   Sampling along the axis has no such problem.

   Plain DOM + SVG + rAF. No library, and no module — so it works
   over file:// as well as http://.
   ============================================================ */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var layer  = document.getElementById('hero-reveal');
  var svg    = document.getElementById('reveal-svg');
  var clip   = document.getElementById('blob-clip-path');
  var stroke = document.getElementById('blob-stroke');
  var img    = document.getElementById('reveal-img');
  var veil   = document.getElementById('reveal-veil');
  var orbEl  = document.getElementById('reveal-orb');
  var hero   = document.getElementById('hero');
  var badge  = document.querySelector('.hero__badge');
  var label  = badge && badge.querySelector('p');

  if (!layer || !svg || !clip || !orbEl || !hero || !badge) return;
  if (REDUCED) { layer.remove(); return; }        // keep the plain CSS badge

  /* ── tuning ────────────────────────────────────────────── */
  var M            = 52;    // samples along the axis (outline = 2M-2 points)
  var CENTER_LAG   = 0.10;  // how far the anchored lobe drifts after the orb
  var ORB_RISE     = 0.22;  // orb sits this fraction of a badge radius above
                            // centre, leaving the label room underneath
  /* Lobe and neck are both sized FROM the separation, so the cell keeps its
     proportions however far it is pulled. Sizing them absolutely is what
     turned it into a thread: the gap grew while the lobes did not. */
  /* Note: at close range the waist is set by how far the two lobes overlap,
     not by NECK_RATIO — so this is the knob that actually thins the neck. */
  var LOBE_RATIO   = 0.56;  // lobe radius as a fraction of lobe separation
  var LOBE_CAP     = 0.45;  // …but never more than this fraction of the hero
  var SEP_MAX      = 1.9;   // separation, capped in lobe radii, so the pair
                            // stays a peanut once the lobes stop growing
  var NECK_RATIO   = 0.48;  // neck radius as a fraction of the lobe radius
  var WAVE_FRAC    = 0.16;  // ripple amplitude ceiling, as a fraction of a lobe
  var WAVE_MAX     = 34;    // hard ceiling on the ripple (px)

  /* ── state ─────────────────────────────────────────────── */
  var W = 0, H = 0;                       // layer size
  var orbR = 30;                          // orb radius
  var rest = { x: 0, y: 0 }, R0 = 100;    // badge centre + radius, re-read each frame

  var orb = { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0 };
  var cx = 0, cy = 0, cvx = 0, cvy = 0;   // anchored lobe centre + velocity
  var phi = 0;                            // axis direction, kept between frames

  var hw  = new Float64Array(M);          // sprung half-width at each sample
  var hv  = new Float64Array(M);
  var raw = new Float64Array(M);          // this frame's ideal profile
  var sm  = new Float64Array(M);          // …smoothed, to round the junctions

  var pts = [];
  for (var i = 0; i < 2 * M - 2; i++) pts.push({ x: 0, y: 0 });

  /* The orb is DRAWN this many px above where the physics thinks it is, so the
     cell still rests as a clean circle on the badge centre while the orb sits
     high in it. Pointer targets are shifted by the same amount, so the orb
     lands under the cursor rather than below it. */
  var curRise = 0;

  var wob = 0, T = 0, lastT = 0;          // ripple energy + wave clock
  var dragging = false, pointerId = null;
  var primed = false;
  var visible = true, running = false;

  /* Samples are clustered toward both ends (Chebyshev). The profile turns
     vertical at the two caps, so evenly spaced samples would cut the lobes
     into flat-topped domes. Positions are fixed per index, so every sample
     keeps a stable identity for its spring as the shape morphs. */
  var U = new Float64Array(M);
  for (var j = 0; j < M; j++) U[j] = 0.5 - 0.5 * Math.cos(Math.PI * j / (M - 1));

  /* ── geometry helpers ──────────────────────────────────── */
  function measure() {
    var lr = layer.getBoundingClientRect();
    W = Math.round(lr.width); H = Math.round(lr.height);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    if (img) {
      img.setAttribute('x', 0); img.setAttribute('y', 0);
      img.setAttribute('width', W); img.setAttribute('height', H);
    }
    orbR = orbEl.offsetWidth / 2 || 30;
    return lr;
  }

  // The badge is animated (intro scale + scroll parallax), so its centre is
  // re-read every frame rather than cached.
  function readRest(layerRect) {
    var b = badge.getBoundingClientRect();
    rest.x = b.left - layerRect.left + b.width / 2;
    rest.y = b.top - layerRect.top + b.height / 2;
    R0 = b.width / 2;
  }

  /* ── closed Catmull-Rom path through the points ────────── */
  function toPath(p) {
    var n = p.length, d = 'M' + p[0].x.toFixed(2) + ',' + p[0].y.toFixed(2);
    for (var i = 0; i < n; i++) {
      var p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
      d += 'C' + (p1.x + (p2.x - p0.x) / 6).toFixed(2) + ',' + (p1.y + (p2.y - p0.y) / 6).toFixed(2) +
           ' ' + (p2.x - (p3.x - p1.x) / 6).toFixed(2) + ',' + (p2.y - (p3.y - p1.y) / 6).toFixed(2) +
           ' ' + p2.x.toFixed(2) + ',' + p2.y.toFixed(2);
    }
    return d + 'Z';
  }

  /* ── the loop ──────────────────────────────────────────── */
  function frame() {
    running = true;
    requestAnimationFrame(frame);
    if (!visible) return;

    var lr = layer.getBoundingClientRect();
    if (Math.round(lr.width) !== W || Math.round(lr.height) !== H) measure();
    readRest(lr);

    if (!primed) {
      orb.x = orb.tx = rest.x; orb.y = orb.ty = rest.y;
      cx = rest.x; cy = rest.y;
      for (var q = 0; q < M; q++) hw[q] = 0;
      primed = true;
      layer.classList.add('is-ready');
    }

    /* How far the orb may travel. Past this the cell would have to swell to
       keep the orb enclosed, so instead the orb stops and the shape holds its
       final size. Derived from the capped lobe: at full stretch the two lobe
       centres sit SEP_MAX radii apart and the orb rides just inside the far
       lobe's rim. Divided by (1 - CENTER_LAG) because the anchored lobe has
       itself drifted that fraction of the way toward the orb. */
    var capR = Math.min(W, H) * LOBE_CAP;
    var maxPull = (capR * (SEP_MAX + 1) - orbR - 10) / (1 - CENTER_LAG);
    var tdx = orb.tx - rest.x, tdy = orb.ty - rest.y;
    var td = Math.hypot(tdx, tdy);
    if (td > maxPull) {
      orb.tx = rest.x + tdx / td * maxPull;
      orb.ty = rest.y + tdy / td * maxPull;
    }

    if (dragging) {
      // While held the pointer is the truth — track it with a plain eased
      // follow so the orb never overshoots the cursor. Keep the velocity in
      // sync so releasing hands off smoothly into the spring below.
      var nx = orb.x + (orb.tx - orb.x) * 0.32;
      var ny = orb.y + (orb.ty - orb.y) * 0.32;
      orb.vx = nx - orb.x; orb.vy = ny - orb.y;
      orb.x = nx; orb.y = ny;
    } else {
      // Released: spring home, underdamped so it snaps back with a bounce.
      orb.tx = rest.x; orb.ty = rest.y;
      orb.vx = (orb.vx + (orb.tx - orb.x) * 0.10) * 0.80;
      orb.vy = (orb.vy + (orb.ty - orb.y) * 0.10) * 0.80;
      orb.x += orb.vx; orb.y += orb.vy;
    }

    curRise = R0 * ORB_RISE;
    orbEl.style.transform =
      'translate3d(' + (orb.x - orbR) + 'px,' + (orb.y - curRise - orbR) + 'px,0)';

    var dx = orb.x - rest.x, dy = orb.y - rest.y;
    var dist = Math.hypot(dx, dy);

    // the anchored lobe stays near the badge, drifting only slightly
    cvx = (cvx + ((rest.x + dx * CENTER_LAG) - cx) * 0.20) * 0.72;
    cvy = (cvy + ((rest.y + dy * CENTER_LAG) - cy) * 0.20) * 0.72;
    cx += cvx; cy += cvy;

    var bx = orb.x - cx, by = orb.y - cy;
    var d  = Math.hypot(bx, by);
    if (d > 1) phi = Math.atan2(by, bx);   // hold last direction when centred
    var ux = Math.cos(phi), uy = Math.sin(phi);
    var vx = -uy, vy = ux;                 // axis normal

    // Equal lobes that grow with the separation, so the pair stays a fat
    // peanut instead of stretching into two balls on a string.
    var Rl = Math.max(R0, d * LOBE_RATIO);
    var cap = Math.min(W, H) * LOBE_CAP;
    if (Rl > cap) Rl = cap;
    // Past the cap the lobe centre stops chasing the orb, which then rides
    // off-centre inside its lobe. The orb's reach is clamped to match (see
    // maxPull above), so the cell simply stops growing rather than swelling
    // to keep up — the safety net below should never actually fire.
    var sep = Math.min(d, Rl * SEP_MAX);
    var need = (d - sep) + orbR + 10;
    if (Rl < need) Rl = Math.min(need, cap * 1.06);
    var Rn = Rl * NECK_RATIO;              // neck stays thick, in proportion

    // ripple: wiggling the pointer pumps energy into the membrane
    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    if (!lastT) lastT = now;
    T += Math.min(0.05, (now - lastT) / 1000); lastT = now;
    var speed = Math.hypot(orb.vx, orb.vy);
    var wTarget = Math.min(WAVE_MAX, Rl * WAVE_FRAC, speed * 1.5);
    wob += (wTarget - wob) * (wTarget > wob ? 0.40 : 0.06);

    /* ideal profile: the union of two discs and the capsule bridging them,
       measured as a half-width at each point along the axis */
    var t0 = -Rl, span = sep + 2 * Rl;
    var k, t, a2, b2, hA, hB, over, n2, h;
    for (k = 0; k < M; k++) {
      t  = t0 + U[k] * span;
      a2 = Rl * Rl - t * t;                       // anchored lobe
      hA = a2 > 0 ? Math.sqrt(a2) : 0;
      b2 = Rl * Rl - (t - sep) * (t - sep);       // grabbed lobe
      hB = b2 > 0 ? Math.sqrt(b2) : 0;
      over = t < 0 ? -t : (t > sep ? t - sep : 0); // capsule neck
      n2 = Rn * Rn - over * over;
      h  = n2 > 0 ? Math.sqrt(n2) : 0;
      if (hA > h) h = hA;
      if (hB > h) h = hB;
      raw[k] = h;
    }

    /* Smoothing the profile turns the hard lobe→neck corners into the
       concave fillets that make it read as one dividing cell rather than
       two balls on a stick. Ramped in with separation so the resting
       shape stays an exact circle. */
    var sAmt = Math.min(1, sep / (Rl * 0.8));
    if (sAmt > 0.001) {
      var pass, prev, cur;
      sm[0] = raw[0]; sm[M - 1] = raw[M - 1];
      for (k = 1; k < M - 1; k++) sm[k] = raw[k];
      for (pass = 0; pass < 2; pass++) {
        prev = sm[0];
        for (k = 1; k < M - 1; k++) {
          cur = sm[k];
          sm[k] = 0.25 * prev + 0.5 * cur + 0.25 * sm[k + 1];
          prev = cur;
        }
      }
      for (k = 0; k < M; k++) raw[k] = raw[k] + (sm[k] - raw[k]) * sAmt;
    }

    /* springs: the grabbed end is stiff and tracks the orb, the anchored end
       is soft and loosely damped so it lags and keeps sloshing */
    for (k = 0; k < M; k++) {
      var lead = U[k];
      var target = raw[k];

      if (wob > 0.5) {
        // fades to zero at both caps so the lobes stay closed and round
        var fade = Math.sin(Math.PI * U[k]);
        target += wob * fade * (1 - lead * lead * 0.6) *
                  // 2.5 and 4 cycles per side — the axis samples bunch at the
                  // caps, so the sparse middle can't carry more without aliasing
                  (0.60 * Math.sin(15.71 * U[k] + T * 5.2) +
                   0.40 * Math.sin(25.13 * U[k] - T * 3.4));
      }

      var ks = 0.16 + Math.pow(lead, 1.2) * 0.30;
      var ds = 0.90 - lead * 0.14;
      hv[k] = (hv[k] + (target - hw[k]) * ks) * ds;
      hw[k] += hv[k];
      if (hw[k] < 0) hw[k] = 0;
    }
    hw[0] = 0; hw[M - 1] = 0;               // keep the caps closed

    /* outline: up one side of the axis and back down the other */
    var p = 0, ax, ay;
    ax = cx + ux * t0; ay = cy + uy * t0;
    pts[p].x = ax; pts[p].y = ay; p++;
    for (k = 1; k < M - 1; k++) {
      t = t0 + U[k] * span;
      ax = cx + ux * t; ay = cy + uy * t;
      pts[p].x = ax + vx * hw[k]; pts[p].y = ay + vy * hw[k]; p++;
    }
    t = t0 + span;
    ax = cx + ux * t; ay = cy + uy * t;
    pts[p].x = ax; pts[p].y = ay; p++;
    for (k = M - 2; k >= 1; k--) {
      t = t0 + U[k] * span;
      ax = cx + ux * t; ay = cy + uy * t;
      pts[p].x = ax - vx * hw[k]; pts[p].y = ay - vy * hw[k]; p++;
    }

    var dstr = toPath(pts);
    clip.setAttribute('d', dstr);
    if (stroke) stroke.setAttribute('d', dstr);

    // the wider it opens, the more of the photo shows through
    var reachMax = Math.min(W, H) * 0.55;
    var open = Math.min(1, dist / reachMax);
    if (veil) veil.setAttribute('opacity', (0.86 - open * 0.80).toFixed(3));
    if (label) label.style.opacity = Math.max(0, 1 - open * 2.4).toFixed(3);
  }

  /* ── dragging ──────────────────────────────────────────── */
  function clampToHero(x, y) {
    var pad = orbR + 6;
    return {
      x: Math.min(Math.max(x, pad), W - pad),
      y: Math.min(Math.max(y, pad), H - pad)
    };
  }

  orbEl.addEventListener('pointerdown', function (e) {
    dragging = true; pointerId = e.pointerId;
    // capture is an optimisation, not a requirement — the move/up listeners
    // live on window so the drag survives if it isn't granted
    try { orbEl.setPointerCapture(pointerId); } catch (_) {}
    orbEl.classList.add('is-dragging');
    document.documentElement.classList.add('orb-drag');
    // kill any range the browser may already have started
    var sel = window.getSelection && window.getSelection();
    if (sel && sel.removeAllRanges) sel.removeAllRanges();
    e.preventDefault();
  });

  window.addEventListener('pointermove', function (e) {
    if (!dragging || e.pointerId !== pointerId) return;
    var lr = layer.getBoundingClientRect();
    var p = clampToHero(e.clientX - lr.left, e.clientY - lr.top);
    orb.tx = p.x; orb.ty = p.y + curRise;   // undo the draw offset
  });

  function release(e) {
    if (!dragging || (e && e.pointerId != null && e.pointerId !== pointerId)) return;
    dragging = false;
    orbEl.classList.remove('is-dragging');
    document.documentElement.classList.remove('orb-drag');
    try { orbEl.releasePointerCapture(pointerId); } catch (_) {}
    pointerId = null;
  }
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  window.addEventListener('blur', release);

  /* ── lifecycle ─────────────────────────────────────────── */
  window.addEventListener('resize', function () { measure(); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
    }, { threshold: 0 }).observe(hero);
  }

  function start() {
    if (running) return;
    document.documentElement.classList.add('blob-on');
    measure();
    frame();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
