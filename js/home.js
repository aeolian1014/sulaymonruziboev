/* ============================================================
   home.js — motion for every page, built on Motion
   (js/vendor/motion.js, global `Motion`). Each effect looks for
   its own markup and skips itself when the page has none, so the
   inner pages load this same file. Everything degrades under
   prefers-reduced-motion and on touch pointers.
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

    // the two fans lean apart toward the pointer, each curve a little more
    // than the one before it, so the field feels deep rather than flat
    var ptr = { x: 0, y: 0, tx: 0, ty: 0 };
    if (FINE && MOTION) {
      addEventListener('pointermove', function (e) {
        ptr.tx = (e.clientX / innerWidth - 0.5) * 2;
        ptr.ty = (e.clientY / innerHeight - 0.5) * 2;
      }, { passive: true });
    }
    curves.forEach(function (cu, n) { cu.pos = n < 36 ? 1 : -1; cu.depth = 0.3 + (n % 36) / 36; });

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
        ptr.x += (ptr.tx - ptr.x) * 0.05;
        ptr.y += (ptr.ty - ptr.y) * 0.05;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.strokeStyle = '#f3f2ef';
        for (var i = 0; i < curves.length; i++) {
          var cu = curves[i];
          var dx = ptr.x * 34 * cu.pos * cu.depth, dy = ptr.y * 22 * cu.depth;
          ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * (ox + dx), dpr * (oy + dy));
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

  /* split a line into word > letter spans; letters carry a stagger delay */
  function splitLetters(lines) {
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
    return chars;
  }

  // gradient lines: each letter shows its own slice of one line-wide
  // gradient. offsetLeft, not getBoundingClientRect — letters move.
  function sizeGradient() {
    $$('.hero__line--grad').forEach(function (line) {
      var cs = $$('.ch', line);
      if (!cs.length) return;
      var left = Math.min.apply(null, cs.map(function (c) { return c.offsetLeft; }));
      var right = Math.max.apply(null, cs.map(function (c) { return c.offsetLeft + c.offsetWidth; }));
      line.style.setProperty('--line-w', (right - left) + 'px');
      cs.forEach(function (c) { c.style.setProperty('--ch-x', (c.offsetLeft - left) + 'px'); });
    });
  }

  /* ── 2. hero title — letters spring up, word by word ─────────
     Split now (hidden under the intro), played when the curtain lifts. */
  function heroTitle() {
    var chars = splitLetters($$('#hero-title [data-letters]'));
    var intros = $$('[data-intro]');
    if (MOTION) {
      chars.forEach(function (c) { c.style.opacity = '0'; });
      intros.forEach(function (el) { el.style.opacity = '0'; });
    }
    return function play() {
      if (!MOTION) return;
      chars.forEach(function (c) {
        M.animate(c, { y: ['105%', '0%'], opacity: [0, 1], rotate: [6, 0] },
          { type: 'spring', stiffness: 150, damping: 22, delay: parseFloat(c.dataset.d) });
      });
      intros.forEach(function (el, i) {
        M.animate(el, { opacity: [0, 1], y: [18, 0], filter: ['blur(8px)', 'blur(0px)'] },
          { duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 + i * 0.12 + (i ? 0.45 : 0) });
      });
    };
  }

  /* ── 3. counters — tick up once the hero is revealed ───────── */
  function counters() {
    var nodes = $$('.count');
    if (MOTION) nodes.forEach(function (n) { n.textContent = '0'; });
    return function play() {
      if (!MOTION) return;
      nodes.forEach(function (n) {
        M.animate(0, parseFloat(n.dataset.count) || 0, { duration: 1.8, delay: 0.9, ease: [0.16, 1, 0.3, 1],
          onUpdate: function (v) { n.textContent = Math.round(v); } });
      });
    };
  }

  /* ── intro curtain — name rises, a counter runs, the curtain
     lifts. Once per visit; reduced motion skips it entirely. ─── */
  function intro() {
    var el = $('#loader');
    if (!el) return Promise.resolve();
    var seen = false;
    try { seen = sessionStorage.getItem('intro-seen') === '1'; sessionStorage.setItem('intro-seen', '1'); } catch (e) {}
    if (!MOTION || seen) { el.remove(); return Promise.resolve(); }

    document.body.classList.add('is-locked');
    var words = $$('[data-intro-word]', el), count = $('#intro-count'), bar = $('#intro-bar');
    words.forEach(function (w, i) {
      M.animate(w, { y: ['110%', '0%'] }, { duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 + i * 0.08 });
    });
    M.animate(bar, { scaleX: [0, 1] }, { duration: 1.3, ease: [0.65, 0, 0.35, 1], delay: 0.15 });
    M.animate(0, 100, { duration: 1.3, ease: [0.65, 0, 0.35, 1], delay: 0.15,
      onUpdate: function (v) { count.textContent = String(Math.round(v)).padStart(3, '0'); } });

    return new Promise(function (done) {
      var finished = false;
      var finish = function () {
        if (finished) return; finished = true;
        document.body.classList.remove('is-locked');
        done();
      };
      setTimeout(function () {
        M.animate(words, { y: '-110%' }, { duration: 0.6, ease: [0.7, 0, 0.84, 0] });
        M.animate(el, { clipPath: ['inset(0 0 0% 0)', 'inset(0 0 100% 0)'] },
          { duration: 0.9, ease: [0.76, 0, 0.24, 1], delay: 0.25 }).then(function () { el.remove(); });
        setTimeout(finish, 650);          // start the hero while the curtain is still lifting
      }, 1650);
      setTimeout(function () { finish(); if (el.isConnected) el.remove(); }, 5000);   // never trap the page
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

  /* a pill that slides to whichever item is active — the vanilla
     equivalent of Framer Motion's shared layoutId highlight */
  function slider(pill, host) {
    var first = true;
    return function (el) {
      if (!el) {
        if (M) M.animate(pill, { opacity: 0 }, { duration: MOTION ? 0.25 : 0 });
        else pill.style.opacity = '0';
        return;
      }
      var hr = host.getBoundingClientRect(), r = el.getBoundingClientRect();
      var to = { x: r.left - hr.left, width: r.width, opacity: 1 };
      if (!M) {
        pill.style.transform = 'translateX(' + to.x + 'px)';
        pill.style.width = to.width + 'px';
        pill.style.opacity = '1';
        return;
      }
      // the first placement jumps; after that it springs across
      M.animate(pill, to, (first || !MOTION) ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 32 });
      first = false;
    };
  }

  /* ── 5. featured — the screen tilts flat as it scrolls in, then
     steps through four Cutlass screens ───────────────────────── */
  function tilt() {
    var wrap = $('#tilt'), dev = $('#tilt-device'), head = $('#tilt-head');
    if (!wrap || !dev) return;
    var shots = $$('.tilt__screen img', dev);
    var tabs = $$('.tilt__tabs button');
    var tabHost = $('.tilt__tabs');
    var move = function () {};
    if (tabHost) {                       // the case-study page shows one screen, no tabs
      var pill = document.createElement('span');
      pill.className = 'tabs__pill';
      tabHost.insertBefore(pill, tabHost.firstChild);
      move = slider(pill, tabHost);
    }
    var current = -1;

    function show(i) {
      if (i === current) return;
      current = i;
      shots.forEach(function (s, k) { s.classList.toggle('is-on', k === i); });
      tabs.forEach(function (t, k) { t.setAttribute('aria-selected', String(k === i)); });
      if (tabs[i]) move(tabs[i]);
    }
    show(0);
    tabs.forEach(function (t, k) { t.addEventListener('click', function () { show(k); }); });
    addEventListener('resize', function () { var c = current; current = -1; show(c); });

    if (!MOTION) return;
    var small = matchMedia('(max-width: 760px)');
    var band = 0;
    if (shots.length > 1) M.scroll(function (p) {
      if (small.matches) return;
      // once flat, the rest of the pinned scroll pages through the screens;
      // only switch when the band changes so a clicked tab is not overridden
      var b = clamp(Math.floor((p - 0.5) / 0.5 * shots.length), 0, shots.length - 1);
      if (b !== band) { band = b; show(b); }
    }, { target: wrap, offset: ['start start', 'end end'] });

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

    // active link follows the section in the middle of the screen; the
    // highlight slides to it, and previews whichever link is hovered
    var links = $$('.nav__links a');
    var host = $('#nav-links'), pillEl = $('#nav-pill');
    var move = slider(pillEl, host);
    var active = null;
    var setActive = function (a) {
      active = a;
      links.forEach(function (l) { l.classList.toggle('is-active', l === a); });
      move(a);
    };
    links.forEach(function (l) { l.addEventListener('pointerenter', function () { move(l); }); });
    host.addEventListener('pointerleave', function () { move(active); });
    // inner pages mark their section in the markup (the case study sits under Work)
    var marked = links.filter(function (l) { return l.classList.contains('is-active'); })[0];
    if (marked) {
      setActive(marked);
      addEventListener('resize', function () { move(active); });
      return;
    }

    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        setActive(links.filter(function (l) { return l.getAttribute('href') === '#' + en.target.id; })[0] || null);
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['hero', 'about', 'work', 'capabilities', 'toolkit', 'experience', 'contact'].forEach(function (id) {
      var s = document.getElementById(id); if (s) io.observe(s);
    });
  }

  /* ── 10. reading progress along the top edge ───────────────── */
  function progress() {
    var bar = $('#progress');
    if (!bar || !M) return;
    M.scroll(function (p) { bar.style.transform = 'scaleX(' + p.toFixed(4) + ')'; });
  }

  /* ── 11. footer clock — local time in Tashkent ─────────────── */
  function clock() {
    var el = $('#local-time');
    if (!el) return;
    var fmt;
    try { fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return; }
    var tick = function () { el.textContent = fmt.format(new Date()); };
    tick();
    setInterval(tick, 15000);
  }

  /* ── 12. hero — light follows the pointer, the title leans
     toward it, and the whole block blurs away as you scroll ──── */
  function heroFx() {
    var hero = $('#hero'), inner = $('#hero-inner'), title = $('#hero-title');
    if (!hero || !MOTION) return;

    M.scroll(function (p) {
      inner.style.transform = 'translateY(' + (p * 140).toFixed(1) + 'px) scale(' + (1 - p * 0.1).toFixed(4) + ')';
      inner.style.filter = 'blur(' + (p * 10).toFixed(2) + 'px)';
      inner.style.opacity = (1 - p * 1.15).toFixed(3);
    }, { target: hero, offset: ['start start', 'end start'] });

    if (!FINE) return;
    var tx = 0, ty = 0, x = 0, y = 0, running = false;
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      hero.style.setProperty('--hx', (e.clientX - r.left) + 'px');
      hero.style.setProperty('--hy', (e.clientY - r.top) + 'px');
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
      if (!running) { running = true; requestAnimationFrame(loop); }
    });
    hero.addEventListener('pointerleave', function () { tx = 0; ty = 0; });
    function loop() {
      x += (tx - x) * 0.08; y += (ty - y) * 0.08;
      title.style.transform = 'perspective(900px) rotateX(' + (-y * 9).toFixed(2) + 'deg) rotateY(' + (x * 12).toFixed(2) + 'deg)';
      if (Math.abs(tx - x) + Math.abs(ty - y) > 0.0005) requestAnimationFrame(loop);
      else running = false;
    }
  }

  /* ── 13. section labels decode like a terminal ─────────────── */
  function scramble() {
    if (!MOTION) return;
    var GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/#*+=';
    $$('.label').forEach(function (el) {
      var final = el.textContent;
      M.inView(el, function () {
        var start = performance.now(), dur = 900;
        (function frame(now) {
          var t = clamp((now - start) / dur, 0, 1);
          var out = '';
          for (var i = 0; i < final.length; i++) {
            var ch = final[i];
            out += (ch === ' ' || i / final.length < t) ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
          }
          el.textContent = out;
          if (t < 1) requestAnimationFrame(frame);
          else el.textContent = final;
        })(start);
      }, { amount: 0.8 });
    });
  }

  /* ── 14. headings blur in word by word ─────────────────────── */
  function headings() {
    if (!MOTION) return;
    $$('.h2, .work__sub h3').forEach(function (h) {
      var words = [];
      (function walk(node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (n) {
          if (n.nodeType === 3) {
            var parts = n.textContent.split(/(\s+)/);
            var frag = document.createDocumentFragment();
            parts.forEach(function (p) {
              if (!p) return;
              if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
              var s = document.createElement('span');
              s.className = 'wd';
              s.textContent = p;
              frag.appendChild(s);
              words.push(s);
            });
            n.parentNode.replaceChild(frag, n);
          } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
        });
      })(h);

      // words inside the gradient <em> each take their slice of it
      $$('em', h).forEach(function (em) {
        em.classList.add('is-split');
        var ws = $$('.wd', em);
        var size = function () {
          ws.forEach(function (w) {
            w.style.backgroundSize = em.offsetWidth + 'px 100%';
            w.style.backgroundPosition = -(w.offsetLeft - em.offsetLeft) + 'px 0';
          });
        };
        size();
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(size);
        addEventListener('resize', size);
      });

      M.inView(h, function () {
        words.forEach(function (w, i) {
          M.animate(w, { opacity: [0, 1], y: [28, 0], filter: ['blur(12px)', 'blur(0px)'] },
            { duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: i * 0.06 });
        });
      }, { amount: 0.4 });
    });
  }

  /* ── 15. marquee — scroll speeds it up, flips it and leans it ─ */
  function marquee() {
    var rows = $$('.marquee__row');
    if (!rows.length) return;
    rows.forEach(function (row) {
      var track = $('.marquee__track', row), set = $('.marquee__set', row);
      var copies = Math.max(2, Math.ceil((innerWidth * 2) / Math.max(set.offsetWidth, 1)) + 1);
      for (var i = 1; i < copies; i++) {
        var c = set.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.appendChild(c);
      }
    });
    if (!MOTION) return;

    var lastY = scrollY, lastT = performance.now(), vel = 0, skew = 0, running = false;
    var state = rows.map(function (row) {
      return { row: row, track: $('.marquee__track', row), w: $('.marquee__set', row).offsetWidth,
               dir: parseFloat(row.dataset.velocity) || 1, x: 0 };
    });
    addEventListener('resize', function () { state.forEach(function (s) { s.w = $('.marquee__set', s.row).offsetWidth; }); });

    var flip = 1;
    function frame(now) {
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      var v = (scrollY - lastY) / Math.max(dt, 0.001); lastY = scrollY;
      vel += (v - vel) * 0.1;
      if (Math.abs(vel) > 30) flip = vel > 0 ? 1 : -1;
      var boost = 1 + Math.min(Math.abs(vel) / 260, 6);
      skew += (clamp(-vel / 90, -12, 12) - skew) * 0.12;
      state.forEach(function (s) {
        s.x -= 46 * boost * s.dir * flip * dt;
        if (s.x <= -s.w) s.x += s.w;
        if (s.x > 0) s.x -= s.w;
        s.track.style.transform = 'translate3d(' + s.x.toFixed(2) + 'px,0,0) skewX(' + (skew * s.dir).toFixed(2) + 'deg)';
      });
      if (running) requestAnimationFrame(frame);
    }
    M.inView($('.marquee'), function () {
      running = true; lastT = performance.now(); lastY = scrollY; requestAnimationFrame(frame);
      return function () { running = false; };
    }, { amount: 0 });
  }

  /* ── 16. project cards tilt in 3D with a sliding glare ─────── */
  function cardTilt() {
    if (!FINE || !MOTION) return;
    $$('.card').forEach(function (card) {
      var glare = document.createElement('span');
      glare.className = 'card__glare';
      card.appendChild(glare);
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
        M.animate(card, { rotateX: -ny * 7, rotateY: nx * 9, y: -6 }, { type: 'spring', stiffness: 220, damping: 22 });
        card.style.setProperty('--gx', (50 + nx * 120) + '%');
        card.style.setProperty('--gy', (50 + ny * 120) + '%');
      });
      card.addEventListener('pointerleave', function () {
        M.animate(card, { rotateX: 0, rotateY: 0, y: 0 }, { type: 'spring', stiffness: 160, damping: 16 });
      });
    });
  }

  /* ── 17. border beams on the featured surfaces ─────────────── */
  function beams() {
    if (!MOTION) return;
    $$('.cap, .tilt__device, .hero .pill, [data-beam]').forEach(function (el, i) {
      var b = document.createElement('span');
      b.className = 'beam';
      b.setAttribute('aria-hidden', 'true');
      b.style.setProperty('--beam-delay', (-i * 1.7) + 's');
      el.appendChild(b);
    });
  }

  /* ── 18. magnetic buttons ──────────────────────────────────── */
  function magnetic() {
    if (!FINE || !MOTION) return;
    $$('.magnetic').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        M.animate(el, { x: (e.clientX - r.left - r.width / 2) * 0.3, y: (e.clientY - r.top - r.height / 2) * 0.4 },
          { type: 'spring', stiffness: 260, damping: 18 });
      });
      el.addEventListener('pointerleave', function () {
        M.animate(el, { x: 0, y: 0 }, { type: 'spring', stiffness: 180, damping: 10 });
      });
    });
  }

  /* ── 19. contact title — letters rise toward the pointer ───── */
  function contactTitle() {
    var title = $('#contact-title');
    if (!title) return;
    var lines = $$('[data-chars]', title);
    var chars = splitLetters(lines);
    sizeGradient();
    if (!MOTION) return;

    M.inView(title, function () {
      lines.forEach(function (l, i) {
        M.animate(l, { opacity: [0, 1], y: [60, 0], filter: ['blur(14px)', 'blur(0px)'] },
          { duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: i * 0.12 });
      });
    }, { amount: 0.4 });
    lines.forEach(function (l) { l.style.opacity = '0'; });

    if (!FINE) return;
    var host = $('#contact'), px = -9999, py = -9999, running = false;
    var cur = chars.map(function () { return 0; });
    host.addEventListener('pointermove', function (e) {
      px = e.clientX; py = e.clientY;
      if (!running) { running = true; requestAnimationFrame(loop); }
    });
    host.addEventListener('pointerleave', function () { px = py = -9999; });
    function loop() {
      var moving = false;
      // offsets ignore the lift itself, so letters don't chase their own tail
      var pr = chars[0].offsetParent.getBoundingClientRect();
      for (var i = 0; i < chars.length; i++) {
        var c = chars[i];
        var cx = pr.left + c.offsetLeft + c.offsetWidth / 2;
        var cy = pr.top + c.offsetTop + c.offsetHeight / 2;
        var d = Math.hypot(px - cx, py - cy);
        var f = Math.max(0, 1 - d / 240); f = f * f;
        cur[i] += (f - cur[i]) * 0.15;
        if (Math.abs(f - cur[i]) > 0.001) moving = true;
        c.style.transform = 'translateY(' + (-cur[i] * 26).toFixed(2) + 'px) scale(' + (1 + cur[i] * 0.14).toFixed(4) + ')';
      }
      if (moving || px > -9999) requestAnimationFrame(loop);
      else running = false;
    }
  }

  function init() {
    clock();
    progress();
    paths();
    var playHero = heroTitle();
    var playCounts = counters();
    contactTitle();
    sizeGradient();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeGradient);
    addEventListener('resize', sizeGradient);
    about();
    tilt();
    spotlight();
    headings();
    reveals();
    scramble();
    marquee();
    cardTilt();
    beams();
    magnetic();
    heroFx();
    buildLog();
    nav();
    intro().then(function () { playHero(); playCounts(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
