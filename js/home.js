/* ============================================================
   home.js — motion for the home page, built on Motion
   (js/vendor/motion.js, global `Motion`). Everything degrades
   under prefers-reduced-motion and on touch pointers.
   ============================================================ */
(function () {
  'use strict';

  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE    = matchMedia('(hover:hover) and (pointer:fine)').matches;
  var M = window.Motion;
  var MOTION = !!M && !REDUCED;

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  if (MOTION) document.documentElement.classList.add('js-motion');

  /* ── 1. flowing paths — two mirrored fans of 36 curves ───────
     Drawn on a canvas: animating 72 SVG dash arrays repaints the
     whole SVG every frame and dropped the page to ~13fps. Each
     curve's visible length and offset swing 0→1→0 over 20–30s. */
  function paths() {
    var NS = 'http://www.w3.org/2000/svg';
    var VW = 696, VH = 316;

    var curves = [];
    var probe = document.createElementNS(NS, 'path');
    [1, -1].forEach(function (pos) {
      for (var i = 0; i < 36; i++) {
        var a = 380 - i * 5 * pos, b = 312 - i * 5 * pos, c = 152 - i * 5 * pos,
            d = 616 - i * 5 * pos, e = 684 - i * 5 * pos;
        var dStr = 'M-' + a + ' -' + (189 + i * 6) + 'C-' + a + ' -' + (189 + i * 6) + ' -' + b + ' ' + (216 - i * 6) +
          ' ' + c + ' ' + (343 - i * 6) + 'C' + d + ' ' + (470 - i * 6) + ' ' + e + ' ' + (875 - i * 6) +
          ' ' + e + ' ' + (875 - i * 6);
        probe.setAttribute('d', dStr);
        curves.push({
          path: new Path2D(dStr),
          len: probe.getTotalLength(),
          width: 0.5 + i * 0.03,
          alpha: 0.06 + i * 0.012,
          dur: 20 + Math.random() * 10,
          phase: Math.random()
        });
      }
    });

    var tri = function (t) { t = t % 1; return t < 0.5 ? t * 2 : 2 - t * 2; };   // 0→1→0

    $$('[data-paths]').forEach(function (host) {
      var cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
      host.appendChild(cv);
      var ctx = cv.getContext('2d');
      var W = 0, H = 0, dpr = 1, k = 1, ox = 0, oy = 0, running = false, raf = 0;

      function size() {
        dpr = Math.min(devicePixelRatio || 1, 1.5);
        W = host.clientWidth; H = host.clientHeight;
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        k = Math.max(W / VW, H / VH);                 // "slice": cover the box
        ox = (W - VW * k) / 2; oy = (H - VH * k) / 2;
      }

      function draw(now) {
        var t = now / 1000;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, dpr * oy);
        ctx.strokeStyle = '#f3f2ef';
        for (var i = 0; i < curves.length; i++) {
          var cu = curves[i];
          var s = MOTION ? tri(t / cu.dur + cu.phase) : 0.5;
          var on = (0.3 + 0.7 * s) * cu.len;
          ctx.globalAlpha = cu.alpha * (0.35 + 0.45 * s) * 1.5;
          ctx.lineWidth = cu.width;
          ctx.setLineDash([on, cu.len]);
          ctx.lineDashOffset = -s * cu.len;
          ctx.stroke(cu.path);
        }
      }

      function loop(now) { draw(now); if (running) raf = requestAnimationFrame(loop); }

      size();
      draw(performance.now());
      addEventListener('resize', function () { size(); draw(performance.now()); });
      if (!MOTION) return;

      // only tick while the field is on screen
      new IntersectionObserver(function (en) {
        var vis = en[0].isIntersecting;
        if (vis && !running) { running = true; raf = requestAnimationFrame(loop); }
        else if (!vis) { running = false; cancelAnimationFrame(raf); }
      }).observe(host);
    });
  }

  /* ── 2. hero title — letters spring up, word by word ───────── */
  function heroTitle() {
    var lines = $$('#hero-title [data-letters]');
    var chars = [];
    lines.forEach(function (line, li) {
      var words = line.textContent.trim().split(/\s+/);
      line.textContent = '';
      words.forEach(function (w, wi) {
        var ws = document.createElement('span');
        ws.className = 'word';
        for (var k = 0; k < w.length; k++) {
          var s = document.createElement('span');
          s.className = 'ch';
          s.textContent = w[k];
          s.dataset.d = (li * 0.25 + wi * 0.1 + k * 0.03).toFixed(3);
          ws.appendChild(s);
          chars.push(s);
        }
        line.appendChild(ws);
      });
    });

    // gradient line: each letter shows its own slice of one line-wide gradient
    function sizeGradient() {
      $$('.hero__line--grad').forEach(function (line) {
        var lr = line.getBoundingClientRect();
        var cs = $$('.ch', line);
        var left = Math.min.apply(null, cs.map(function (c) { return c.getBoundingClientRect().left; }));
        var right = Math.max.apply(null, cs.map(function (c) { return c.getBoundingClientRect().right; }));
        line.style.setProperty('--line-w', (right - left || lr.width) + 'px');
        cs.forEach(function (c) { c.style.setProperty('--ch-x', (c.getBoundingClientRect().left - left) + 'px'); });
      });
    }
    sizeGradient();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeGradient);
    addEventListener('resize', sizeGradient);

    if (!MOTION) return;
    chars.forEach(function (c) {
      M.animate(c, { y: ['105%', '0%'], opacity: [0, 1] },
        { type: 'spring', stiffness: 150, damping: 25, delay: parseFloat(c.dataset.d) + 0.1 });
    });
    $$('[data-intro]').forEach(function (el, i) {
      M.animate(el, { opacity: [0, 1], y: [18, 0] },
        { duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.2 + i * 0.14 + (i ? 0.5 : 0) });
    });
  }

  /* ── 3. counters ───────────────────────────────────────────── */
  function counters() {
    if (!MOTION) return;
    $$('.count').forEach(function (n) {
      var target = parseFloat(n.dataset.count) || 0;
      n.textContent = '0';
      M.inView(n, function () {
        M.animate(0, target, { duration: 1.6, delay: 0.9, ease: [0.16, 1, 0.3, 1],
          onUpdate: function (v) { n.textContent = Math.round(v); } });
      });
    });
  }

  /* ── 4. about — each word lights up as the page scrolls ────── */
  function about() {
    var el = $('#about-text');
    if (!el) return;
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    var spans = words.map(function (w, i) {
      var s = document.createElement('span');
      s.className = 'w';
      s.textContent = w;
      el.appendChild(s);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
      return s;
    });
    if (!MOTION) { el.classList.add('is-static'); return; }
    var n = spans.length;
    M.scroll(function (p) {
      var lit = p * 1.25 * n;            // finish lighting before the section ends
      for (var i = 0; i < n; i++) spans[i].style.opacity = (0.14 + 0.86 * clamp(lit - i, 0, 1)).toFixed(3);
    }, { target: $('.about'), offset: ['start start', 'end end'] });
  }

  /* ── 5. featured — the screen tilts flat as it scrolls in ──── */
  function tilt() {
    var wrap = $('#tilt'), dev = $('#tilt-device'), head = $('#tilt-head');
    if (!wrap || !dev || !MOTION) return;
    var small = matchMedia('(max-width: 760px)');
    M.scroll(function (p) {
      var t = clamp(p / 0.55, 0, 1);
      var e = 1 - Math.pow(1 - t, 3);
      var rot = 22 * (1 - e);
      var sc = small.matches ? 0.94 + 0.06 * e : 1.06 - 0.06 * e;
      dev.style.transform = 'rotateX(' + rot.toFixed(2) + 'deg) scale(' + sc.toFixed(4) + ')';
      head.style.transform = 'translateY(' + (-30 * e).toFixed(1) + 'px)';
    }, { target: wrap, offset: small.matches ? ['start end', 'center center'] : ['start 0.7', 'end end'] });
  }

  /* ── 6. spotlight — light and border follow the pointer ────── */
  function spotlight() {
    if (!FINE || REDUCED) return;
    $$('.spot').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
      el.addEventListener('pointerenter', function () { el.style.setProperty('--spot', '1'); });
      el.addEventListener('pointerleave', function () { el.style.setProperty('--spot', '0'); });
    });
  }

  /* ── 7. scroll reveals, staggered within a row ─────────────── */
  function reveals() {
    if (!MOTION) return;
    $$('.reveal').forEach(function (el) {
      var sibs = $$(':scope > .reveal', el.parentElement);
      var cols = Math.max(1, Math.round(el.parentElement.clientWidth / Math.max(el.offsetWidth, 1)));
      var delay = (sibs.indexOf(el) % cols) * 0.09;
      M.inView(el, function () {
        M.animate(el, { opacity: 1, y: 0 }, { duration: 1, ease: [0.16, 1, 0.3, 1], delay: delay });
      }, { amount: 0.2 });
    });

    var curve = $('[data-curve]');
    if (curve) {
      // the stroke is non-scaling, so draw it on with a wipe rather than a dash
      var svg = curve.ownerSVGElement;
      svg.style.clipPath = 'inset(0 100% 0 0)';
      M.inView(svg, function () {
        M.animate(svg, { clipPath: ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'] }, { duration: 1.6, ease: [0.65, 0, 0.35, 1], delay: 0.3 });
      });
    }
  }

  /* ── 8. build log — a beam fills the rail as you read ──────── */
  function buildLog() {
    var list = $('#log'), beam = $('#log-beam');
    if (!list || !beam) return;
    var items = $$('.log__item', list);
    if (!MOTION) { beam.style.setProperty('--beam', 1); items.forEach(function (i) { i.classList.add('is-on'); }); return; }
    M.scroll(function (p) {
      beam.style.setProperty('--beam', p.toFixed(4));
      var h = list.offsetHeight;
      items.forEach(function (it) { it.classList.toggle('is-on', it.offsetTop / h <= p + 0.02); });
    }, { target: list, offset: ['start 0.65', 'end 0.6'] });
  }

  /* ── 9. nav — glass once scrolled, hides going down ────────── */
  function nav() {
    var bar = $('#nav'), burger = $('#burger'), menu = $('#mobile-menu');
    if (!bar) return;
    var last = scrollY;
    addEventListener('scroll', function () {
      var y = scrollY;
      bar.classList.toggle('is-stuck', y > 40);
      if (!menu.classList.contains('is-open')) bar.classList.toggle('is-hidden', y > last && y > 300);
      last = y;
    }, { passive: true });

    var toggle = function (open) {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      document.body.classList.toggle('is-locked', open);
    };
    burger.addEventListener('click', function () { toggle(burger.getAttribute('aria-expanded') !== 'true'); });
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { toggle(false); }); });
    addEventListener('keydown', function (e) { if (e.key === 'Escape') toggle(false); });

    // active link follows the section in the middle of the screen
    var links = $$('.nav__links a');
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (l) { l.classList.toggle('is-active', l.getAttribute('href') === '#' + en.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['hero', 'about', 'work', 'capabilities', 'toolkit', 'experience', 'contact'].forEach(function (id) {
      var s = document.getElementById(id); if (s) io.observe(s);
    });
  }

  function init() {
    paths();
    heroTitle();
    counters();
    about();
    tilt();
    spotlight();
    reveals();
    buildLog();
    nav();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
