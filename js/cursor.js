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

  var CANVAS = 76;                          // px box the 3D arrow is drawn into


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
    /* The arrow is a real 3D model (modelled in Blender, exported as .glb) drawn
       by Three.js into this little canvas. Real geometry means nothing z-fights,
       and the model's origin sits on its tip, so the point never drifts as it
       spins. The canvas is centred on the pointer. */
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

  /* ---- the 3D arrow -------------------------------------------------------
     Loads assets/cursor.glb, stands it up so its tip is at the origin pointing
     up, then spins it about its own shaft. Falls back to the native cursor if
     WebGL or the model is unavailable. */
  var spinPaused = false;                     // click freezes the spin for a blink
  Promise.all([
    import('./vendor/three.module.js'),
    import('./vendor/GLTFLoader.js')
  ]).then(function (mods) {
    var THREE = mods[0], GLTFLoader = mods[1].GLTFLoader;

    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(CANVAS, CANVAS, false);
    caret.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var H = 34;                               // orthographic half-height
    var cam = new THREE.OrthographicCamera(-H, H, H, -H, 0.1, 200);
    cam.position.set(0, 0, 80); cam.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    var key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(-7, 11, 13); scene.add(key);
    var fill = new THREE.DirectionalLight(0x8a63ff, 0.7); fill.position.set(9, -4, 7); scene.add(fill);
    var rim  = new THREE.DirectionalLight(0xffffff, 0.45); rim.position.set(3, -2, -9); scene.add(rim);

    var spinG = new THREE.Group();            // rolls about the shaft
    var orientG = new THREE.Group();          // aims the arrow up-left
    orientG.add(spinG); scene.add(orientG);
    orientG.rotation.z = 0.79;    // lean the tip up-left, like the OS arrow
    orientG.rotation.x = 0.20;

    new GLTFLoader().load('assets/cursor.glb', function (gltf) {
      var root = gltf.scene;
      root.updateWorldMatrix(true, true);

      /* Bake in whatever transform Blender exported, then stand the arrow up:
         it comes out lying in the XZ plane with its point toward +Z. */
      var mesh = null;
      root.traverse(function (o) { if (o.isMesh && !mesh) mesh = o; });
      if (!mesh) return;
      var geo = mesh.geometry.clone();
      /* deliberately NOT mesh.matrixWorld — Blender bakes a rotation into the
         exported node that would fight the aim set above. The raw geometry lies
         flat in XZ, so one turn stands it upright in the screen plane. */
      geo.rotateX(-Math.PI / 2);
      /* The model is an L-corner: it stands up with its point at the lower left
         and its two arms running up and to the right. Turn it so the point is
         at the top and the arms hang below — that puts the shaft along Y, which
         is the axis the spin below turns about. */
      geo.rotateZ(-Math.PI * 3 / 4);

      /* Pin the point itself to the origin (the topmost vertex once turned), so
         the cursor's hotspot is the arrow's tip and it pivots there. */
      geo.computeBoundingBox();
      var bb = geo.boundingBox;
      geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.max.y, -(bb.min.z + bb.max.z) / 2);
      geo.computeBoundingBox();
      geo.computeVertexNormals();

      /* gradient down the arrow: light at the tip, deep purple at the tails */
      var LIGHT = new THREE.Color(0xe8dfff), DEEP = new THREE.Color(0x2e0d96);
      var pos = geo.attributes.position, n = pos.count;
      var col = new Float32Array(n * 3), c = new THREE.Color();
      var hi = geo.boundingBox.max.y, lo = geo.boundingBox.min.y;
      for (var i = 0; i < n; i++) {
        /* eased rather than linear, so the light end reads clearly instead of
           washing into a single flat purple */
        var t = (pos.getY(i) - lo) / (hi - lo || 1);
        t = t * t * (3 - 2 * t);
        c.copy(DEEP).lerp(LIGHT, t);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

      /* scale so the arrow fills a sensible part of the little canvas */
      var span = geo.boundingBox.max.y - geo.boundingBox.min.y;
      var s = 18 / (span || 1);
      var m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.3, metalness: 0.15
      }));
      m.scale.setScalar(s);
      spinG.add(m);
    });

    var last = performance.now(), RATE = (Math.PI * 2) / 2.6;   // a turn every 2.6s
    (function tick(now) {
      var dt = (now - last) / 1000; last = now;
      if (!REDUCED && !spinPaused) spinG.rotation.y += RATE * dt;
      renderer.render(scene, cam);
      requestAnimationFrame(tick);
    })(last);
  }).catch(function () {
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
