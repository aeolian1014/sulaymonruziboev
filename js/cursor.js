/* ============================================================================
   Code cursor — a terminal caret that trails code as it moves and splashes
   symbols on click. Self-contained: no dependencies, no required markup. Drop
   it on any page with <script src="js/cursor.js" defer></script>.

   Degrades cleanly: coarse pointers (touch) and prefers-reduced-motion keep the
   native cursor and this does nothing.
   ========================================================================== */
(function () {
  'use strict';

  var FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
  var REDUCED = matchMedia('(prefers-reduced-motion:reduce)').matches;
  if (!FINE) return;                       // touch devices keep their native cursor

  /* Any cursor markup a page shipped for the old dot-and-ring is replaced by
     this one — otherwise two cursors chase the pointer. */
  var old = document.querySelector('.cursor');
  if (old) old.remove();

  /* ---- tokens the trail and the splash draw from ------------------------- */
  var TRAIL = ['{', '}', '(', ')', '<', '>', '/', ';', '=', '=>', '&&', '||',
               'const', 'let', '::', '//', '[]', '0', '1', '*', '+', '.', '#'];
  var SPLASH = ['{', '}', '<', '>', '/', ';', '=', '=>', '(', ')', '!', '&',
                '|', '#', '*', '+', '$', '%', '::', '<>'];
  var HUES = ['var(--accent, #6a3bff)', 'var(--accent-2, #00c2ff)', 'var(--accent-3, #ff4d9d)'];
  var pick = function (a) { return a[(Math.random() * a.length) | 0]; };

  var CANVAS = 72;                          // px box the 3D arrow is drawn into

  /* The loader owns the pointer while the page boots — the custom cursor must
     not appear over it. init() runs once the loader is gone (or immediately on
     pages that have none, like the case-study page). */
  function init() {

  /* ---- styles ------------------------------------------------------------ */
  var css = document.createElement('style');
  css.textContent = [
    'html.cc-on, html.cc-on *{ cursor:none !important; }',
    '.cc-layer{ position:fixed; inset:0; z-index:9998; pointer-events:none; }',
    '.cc-cursor{ position:fixed; top:0; left:0; z-index:9999; pointer-events:none;',
    '  will-change:transform; }',
    /* REAL 3D: a Three.js canvas holding an actual arrow mesh. Genuine geometry
       means no fake stacked layers, so nothing z-fights (no flicker) and the
       apex — which sits exactly on the spin axis — never drifts. The canvas is
       centred on the pointer; the mesh's tip is at the canvas centre. */
    '.cc-caret{ position:absolute; top:0; left:0; width:' + CANVAS + 'px; height:' + CANVAS + 'px;',
    '  transform:translate(-' + (CANVAS / 2) + 'px,-' + (CANVAS / 2) + 'px); }',
    '.cc-caret canvas{ display:block; width:100%; height:100%; }',
    /* over a clickable thing the cursor eases forward and back along its aim */
    REDUCED ? '' : '.cc-cursor.is-hot .cc-caret{ animation:cc-nudge .9s ease-in-out infinite; }',
    '@keyframes cc-nudge{ 0%,100%{ transform:translate(-' + (CANVAS / 2) + 'px,-' + (CANVAS / 2) + 'px) }',
    '  50%{ transform:translate(-' + (CANVAS / 2 + 4) + 'px,-' + (CANVAS / 2 + 4) + 'px) } }',
    '.cc-bit{ position:absolute; top:0; left:0; will-change:transform, opacity;',
    '  font:700 15px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;',
    '  transform:translate(-50%,-50%); white-space:nowrap; }'
  ].join('\n');
  document.head.appendChild(css);

  /* ---- elements ---------------------------------------------------------- */
  var layer = document.createElement('div');
  layer.className = 'cc-layer';
  var cur = document.createElement('div');
  cur.className = 'cc-cursor';
  var caret = document.createElement('span'); caret.className = 'cc-caret';

  cur.appendChild(caret);
  document.body.appendChild(layer);
  document.body.appendChild(cur);
  document.documentElement.classList.add('cc-on');

  /* ---- the real 3D arrow (Three.js, loaded as a module) ------------------- */
  var spinPaused = false;                    // click briefly freezes the spin
  import('./vendor/three.module.js').then(function (THREE) {
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(CANVAS, CANVAS, false);
    caret.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    /* orthographic, centred on the origin — the arrow's apex sits at the origin,
       so it lands on the pointer and cannot drift as the mesh turns */
    var H = 34;
    var cam = new THREE.OrthographicCamera(-H, H, H, -H, 0.1, 100);
    cam.position.set(0, 0, 50); cam.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    var key = new THREE.DirectionalLight(0xffffff, 1.9); key.position.set(-6, 10, 12); scene.add(key);
    var fill = new THREE.DirectionalLight(0x8a63ff, 0.65); fill.position.set(8, -4, 6); scene.add(fill);

    /* Gradient across the body: vertex colours run from a light lilac at the tip
       to deep purple at the tails, so as it spins the lit and dark faces blend. */
    var LIGHT = new THREE.Color(0xb49bff), DEEP = new THREE.Color(0x4a1fd0);
    function paint(geo) {
      var pos = geo.attributes.position, n = pos.count;
      var col = new Float32Array(n * 3), c = new THREE.Color();
      var ys = [];
      for (var i = 0; i < n; i++) ys.push(pos.getY(i));
      var lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);
      for (var j = 0; j < n; j++) {
        var t = (pos.getY(j) - lo) / (hi - lo || 1);   // 0 tail .. 1 tip
        c.copy(DEEP).lerp(LIGHT, t);
        col[j * 3] = c.r; col[j * 3 + 1] = c.g; col[j * 3 + 2] = c.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return geo;
    }
    var mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.14 });

    var L = 15, R = 2.25, off = L / 2 + R;
    function leg(sign) {
      var g = paint(new THREE.CapsuleGeometry(R, L, 8, 20).translate(0, -off, 0));
      var m = new THREE.Mesh(g, mat);
      m.rotation.z = sign * 0.40;
      return m;
    }
    var spinG = new THREE.Group(); spinG.add(leg(1)); spinG.add(leg(-1));
    var orientG = new THREE.Group(); orientG.add(spinG);
    orientG.rotation.z = -0.733;             // aim up-left like the OS cursor
    orientG.rotation.x = 0.30;               // slight lean
    scene.add(orientG);

    var last = performance.now(), RATE = (Math.PI * 2) / 2.6;   // one turn / 2.6s
    (function tick(now) {
      var dt = (now - last) / 1000; last = now;
      if (!REDUCED && !spinPaused) spinG.rotation.y += RATE * dt;
      renderer.render(scene, cam);
      requestAnimationFrame(tick);
    })(last);
  }).catch(function () {
    /* three.js unavailable — leave the native cursor rather than showing nothing */
    document.documentElement.classList.remove('cc-on');
    cur.style.display = 'none';
  });

  /* ---- follow loop — the caret rides the exact pointer position ---------- */
  var mx = innerWidth / 2, my = innerHeight / 2;
  cur.style.transform = 'translate(' + mx + 'px,' + my + 'px)';
  if (REDUCED) {
    addEventListener('pointermove', function (e) {
      cur.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)';
    }, { passive: true });
  } else {
    (function frame() {
      cur.style.transform = 'translate(' + mx + 'px,' + my + 'px)';
      requestAnimationFrame(frame);
    })();
  }

  /* ---- trail: drop a token every ~30px travelled ------------------------- */
  var lastX = mx, lastY = my, active = 0, CAP = 26;

  function bit(text, x, y, opts) {
    if (active >= CAP) return;
    active++;
    var el = document.createElement('span');
    el.className = 'cc-bit';
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.color = opts.hue;
    el.style.fontSize = opts.size + 'px';
    el.style.opacity = String(opts.o0);
    layer.appendChild(el);
    var anim = el.animate(
      [
        { transform: 'translate(-50%,-50%) translate(0,0) rotate(0deg) scale(1)', opacity: opts.o0 },
        { transform: 'translate(-50%,-50%) translate(' + opts.dx + 'px,' + opts.dy + 'px) rotate(' + opts.rot + 'deg) scale(' + opts.s1 + ')', opacity: 0 }
      ],
      { duration: opts.dur, easing: opts.ease, fill: 'forwards' }
    );
    anim.onfinish = anim.oncancel = function () { el.remove(); active--; };
  }

  addEventListener('pointermove', function (e) {
    mx = e.clientX; my = e.clientY;
    if (REDUCED) return;
    var dx = mx - lastX, dy = my - lastY;
    if (dx * dx + dy * dy < 30 * 30) return;   // space the trail out
    lastX = mx; lastY = my;
    bit(pick(TRAIL), mx, my, {
      hue: Math.random() < 0.4 ? pick(HUES) : 'var(--ink-soft, #3a3a48)',
      size: 13 + Math.random() * 4,
      o0: 0.72,
      dx: (Math.random() - 0.5) * 24,
      dy: -16 - Math.random() * 22,          // drifts up, like it's floating off
      rot: (Math.random() - 0.5) * 40,
      s1: 0.72,
      dur: 780 + Math.random() * 360,
      ease: 'cubic-bezier(.2,.7,.2,1)'
    });
  }, { passive: true });

  /* ---- click: freeze the spin for a blink, then splash symbols ----------- */
  var pauseT;
  addEventListener('pointerdown', function (e) {
    if (!REDUCED) {
      spinPaused = true;                          // hard stop
      clearTimeout(pauseT);
      pauseT = setTimeout(function () { spinPaused = false; }, 90);
    }
    if (REDUCED) return;
    var n = 11 + (Math.random() * 3 | 0);
    var base = Math.random() * Math.PI * 2;
    for (var i = 0; i < n; i++) {
      var ang = base + (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      var dist = 46 + Math.random() * 60;
      bit(pick(SPLASH), e.clientX, e.clientY, {
        hue: pick(HUES),
        size: 17 + Math.random() * 9,
        o0: 1,
        dx: Math.cos(ang) * dist,
        dy: Math.sin(ang) * dist,
        rot: (Math.random() - 0.5) * 200,
        s1: 0.55,
        dur: 640 + Math.random() * 320,
        ease: 'cubic-bezier(.15,.8,.25,1)'
      });
    }
  }, { passive: true });

  /* ---- hot state: the brackets open wider over interactive things -------- */
  var HOT = 'a, button, input, textarea, select, summary, [data-tilt], .shot, .cut-node, [role="button"]';
  function hover(on) { return function () { cur.classList.toggle('is-hot', on); }; }
  document.querySelectorAll(HOT).forEach(function (el) {
    el.addEventListener('pointerenter', hover(true));
    el.addEventListener('pointerleave', hover(false));
  });

  /* pointer leaving the window hides the caret so it doesn't stick at an edge */
  document.addEventListener('mouseleave', function () { cur.style.opacity = '0'; });
  document.addEventListener('mouseenter', function () { cur.style.opacity = '1'; });

  } /* end init() */

  /* ---- gate: wait for the loader to finish before showing the cursor ----- */
  var started = false;
  function start() { if (started) return; started = true; init(); }

  var loader = document.getElementById('loader');
  if (!loader) {
    start();                              // no loader on this page — go now
  } else {
    // fire only once the loader element is gone from the page
    var obs = new MutationObserver(function () {
      if (!document.getElementById('loader')) { obs.disconnect(); start(); }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    // safety net: never leave the cursor off if the loader logic never runs
    window.addEventListener('load', function () { setTimeout(start, 1200); });
  }
})();
