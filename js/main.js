/* ============================================================
   main.js — motion, interaction, scroll choreography
   GSAP + ScrollTrigger. Everything degrades under
   prefers-reduced-motion and on coarse pointers.
   ============================================================ */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE    = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  var hasGSAP = typeof window.gsap !== 'undefined';

  if (hasGSAP && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* ── 1. loader ───────────────────────────────────────────── */
  function runLoader() {
    var loader = document.getElementById('loader');
    if (!loader) return Promise.resolve();
    var bar = loader.querySelector('.loader__bar span');
    var pct = loader.querySelector('.loader__pct');

    return new Promise(function (done) {
      var settled = false;
      var finish = function () {
        if (settled) return;
        settled = true;
        loader.classList.add('is-done');
        setTimeout(function () { loader.remove(); }, 750);
        done();
      };

      // failsafe: rAF is throttled in background tabs, so never let the
      // loader trap the page waiting on a tween that isn't ticking.
      setTimeout(finish, 3000);

      if (REDUCED || !hasGSAP) { finish(); return; }

      var v = { p: 0 };
      gsap.to(v, {
        p: 100, duration: 1.25, ease: 'power2.inOut',
        onUpdate: function () {
          var n = Math.round(v.p);
          bar.style.width = n + '%';
          pct.textContent = String(n).padStart(2, '0');
        },
        onComplete: function () { gsap.delayedCall(0.15, finish); }
      });
    });
  }

  /* ── 2. split text into per-character spans ──────────────── */
  function splitChars(el) {
    var text = el.textContent;
    el.textContent = '';
    var frag = document.createDocumentFragment();
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      var s = document.createElement('span');
      s.className = 'ch';
      s.style.display = 'inline-block';
      s.style.willChange = 'transform';
      s.textContent = ch === ' ' ? ' ' : ch;
      frag.appendChild(s);
    }
    el.appendChild(frag);
    return el.querySelectorAll('.ch');
  }

  function splitWords(el) {
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach(function (w, i) {
      var s = document.createElement('span');
      s.className = 'w';
      s.textContent = w;
      el.appendChild(s);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    return el.querySelectorAll('.w');
  }

  /* ── 3. hero entrance ────────────────────────────────────── */
  function heroIntro() {
    if (!hasGSAP) return;

    var lines = document.querySelectorAll('#hero-title [data-split]');
    var tl = gsap.timeline({ defaults: { ease: 'expo.out' } });

    if (REDUCED) {
      gsap.set('[data-reveal]', { opacity: 1, y: 0 });
      return;
    }

    lines.forEach(function (line, li) {
      var chars = splitChars(line);
      tl.from(chars, {
        yPercent: 118,
        rotate: 4,
        duration: 1.25,
        stagger: 0.022
      }, li * 0.11);
    });

    tl.from('.hero .eyebrow',       { y: 20, opacity: 0, duration: .9 }, 0.15)
      .from('.hero__actions',       { y: 24, opacity: 0, duration: .9 }, 0.55)
      .from('.hero__badge',         { scale: .78, opacity: 0, duration: 1.1 }, 0.45)
      .from('.hero__note',          { y: 26, opacity: 0, duration: 1 },  0.6)
      .from('.hero__stat',          { y: 34, opacity: 0, duration: 1.1 }, 0.68)
      .from('.hero__scroll',        { opacity: 0, duration: .8 }, 1);
  }

  /* ── 4. generic scroll reveals ───────────────────────────── */
  function reveals() {
    var items = gsap.utils
      ? gsap.utils.toArray('[data-reveal]')
      : Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));

    if (!hasGSAP || REDUCED) {
      items.forEach(function (el) { el.style.opacity = 1; el.style.transform = 'none'; });
      return;
    }

    items.forEach(function (el) {
      // hero items are handled by the intro timeline
      if (el.closest('.hero')) { gsap.set(el, { opacity: 1, y: 0 }); return; }

      gsap.to(el, {
        opacity: 1, y: 0, duration: 1.1, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });

    // stagger siblings inside grids for a nicer cascade
    ['.caps__grid', '.contact__socials', '.about__meta'].forEach(function (sel) {
      var wrap = document.querySelector(sel);
      if (!wrap) return;
      var kids = wrap.querySelectorAll('[data-reveal]');
      if (!kids.length) return;
      gsap.to(kids, {
        opacity: 1, y: 0, duration: 1.05, ease: 'expo.out', stagger: 0.09,
        scrollTrigger: { trigger: wrap, start: 'top 85%', once: true }
      });
    });
  }

  /* ── 5. about — word-by-word illumination ────────────────── */
  function aboutScrub() {
    var el = document.getElementById('about-text');
    if (!el) return;
    var words = splitWords(el);
    if (!hasGSAP || REDUCED) {
      words.forEach(function (w) { w.classList.add('is-lit'); });
      return;
    }
    gsap.to(words, {
      color: 'rgba(11,11,18,1)',
      ease: 'none',
      stagger: 1,
      scrollTrigger: {
        trigger: el,
        start: 'top 78%',
        end: 'bottom 55%',
        scrub: 0.6
      }
    });
  }

  /* ── 6. counters ─────────────────────────────────────────── */
  function counters() {
    var nodes = document.querySelectorAll('.count');
    nodes.forEach(function (n) {
      var target = parseFloat(n.dataset.count) || 0;
      if (!hasGSAP || REDUCED) { n.textContent = target; return; }
      var obj = { v: 0 };
      gsap.to(obj, {
        v: target, duration: 1.8, ease: 'power2.out',
        onUpdate: function () { n.textContent = Math.round(obj.v); },
        scrollTrigger: { trigger: n, start: 'top 92%', once: true }
      });
    });
  }

  /* ── 7. work cards — entrance + parallax on the image ────── */
  function workMotion() {
    if (!hasGSAP || REDUCED) return;
    gsap.utils.toArray('.card').forEach(function (card, i) {
      gsap.from(card, {
        y: 70, opacity: 0, duration: 1.2, ease: 'expo.out',
        scrollTrigger: { trigger: card, start: 'top 90%', once: true }
      });
      var img = card.querySelector('.card__media img');
      if (img) {
        gsap.fromTo(img, { yPercent: -5 }, {
          yPercent: 5, ease: 'none',
          scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true }
        });
      }
    });
  }

  /* ── 8. section-heading parallax + hero depth on scroll ──── */
  function parallax() {
    if (!hasGSAP || REDUCED) return;

    gsap.to('.hero__head', {
      yPercent: 18, opacity: .25, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: .5 }
    });
    gsap.to('.hero__badge', {
      yPercent: -40, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: .8 }
    });
    gsap.to('.aura--a', { yPercent: 30, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 } });
    gsap.to('.aura--b', { yPercent: -25, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1.2 } });
  }

  /* ── 9. marquee — infinite loop, direction flips with scroll */
  function marquee() {
    var track = document.getElementById('marquee-track');
    if (!track) return;
    var set = track.querySelector('.marquee__set');
    if (!set) return;

    // duplicate until we comfortably overflow, so the loop is seamless
    var copies = Math.max(2, Math.ceil((window.innerWidth * 2) / set.offsetWidth) + 1);
    for (var i = 1; i < copies; i++) track.appendChild(set.cloneNode(true));

    if (!hasGSAP || REDUCED) return;

    var w = set.offsetWidth;
    var tween = gsap.to(track, {
      x: -w, duration: 18, ease: 'none', repeat: -1,
      modifiers: { x: function (x) { return (parseFloat(x) % w) + 'px'; } }
    });

    if (!window.ScrollTrigger) return;
    ScrollTrigger.create({
      trigger: document.body, start: 'top top', end: 'bottom bottom',
      onUpdate: function (self) {
        var d = self.direction === -1 ? -1 : 1;
        gsap.to(tween, { timeScale: d * (1 + Math.min(Math.abs(self.getVelocity()) / 2200, 3)), duration: .4, overwrite: true });
      }
    });
  }

  /* ── 10. card tilt toward the cursor ─────────────────────── */
  function tilt() {
    if (!FINE || REDUCED) return;
    document.querySelectorAll('[data-tilt]').forEach(function (el) {
      var rect = null;
      var enter = function () { rect = el.getBoundingClientRect(); };
      var move = function (e) {
        if (!rect) rect = el.getBoundingClientRect();
        var px = (e.clientX - rect.left) / rect.width  - .5;
        var py = (e.clientY - rect.top)  / rect.height - .5;
        if (hasGSAP) {
          gsap.to(el, {
            rotateY: px * 7, rotateX: -py * 7, transformPerspective: 1000,
            duration: .7, ease: 'power3.out'
          });
        }
      };
      var leave = function () {
        rect = null;
        if (hasGSAP) gsap.to(el, { rotateX: 0, rotateY: 0, duration: 1, ease: 'elastic.out(1,.6)' });
      };
      el.addEventListener('pointerenter', enter);
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', leave);
    });
  }

  /* ── 11. magnetic buttons ────────────────────────────────── */
  function magnetic() {
    if (!FINE || REDUCED || !hasGSAP) return;
    document.querySelectorAll('.magnetic').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        gsap.to(el, {
          x: (e.clientX - (r.left + r.width / 2)) * .28,
          y: (e.clientY - (r.top + r.height / 2)) * .38,
          duration: .6, ease: 'power3.out'
        });
      });
      el.addEventListener('pointerleave', function () {
        gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1,.4)' });
      });
    });
  }

  /* ── 12. custom cursor ───────────────────────────────────── */
  function cursor() {
    var c = document.querySelector('.cursor');
    if (!c || !FINE || REDUCED || !hasGSAP) { if (c) c.remove(); return; }
    var ring = c.querySelector('.cursor__ring');
    var dot  = c.querySelector('.cursor__dot');

    var setRX = gsap.quickTo(ring, 'x', { duration: .55, ease: 'power3' });
    var setRY = gsap.quickTo(ring, 'y', { duration: .55, ease: 'power3' });
    var setDX = gsap.quickTo(dot,  'x', { duration: .12, ease: 'power2' });
    var setDY = gsap.quickTo(dot,  'y', { duration: .12, ease: 'power2' });

    window.addEventListener('pointermove', function (e) {
      setRX(e.clientX); setRY(e.clientY);
      setDX(e.clientX); setDY(e.clientY);
    });

    var hot = 'a, button, [data-tilt], .hero__stat, .reveal__orb';
    document.querySelectorAll(hot).forEach(function (el) {
      el.addEventListener('pointerenter', function () { c.classList.add('is-hot'); });
      el.addEventListener('pointerleave', function () { c.classList.remove('is-hot'); });
    });
  }

  /* ── 13. nav — hide on scroll down, active link, mobile ──── */
  function nav() {
    var bar = document.getElementById('nav');
    var burger = document.getElementById('burger');
    var menu = document.getElementById('mobile-menu');
    if (!bar) return;

    var last = window.scrollY;
    window.addEventListener('scroll', function () {
      var y = window.scrollY;
      bar.classList.toggle('is-stuck', y > 40);
      if (!menu || !menu.classList.contains('is-open')) {
        bar.classList.toggle('is-hidden', y > last && y > 240);
      }
      last = y;
    }, { passive: true });

    if (burger && menu) {
      var toggle = function (open) {
        burger.setAttribute('aria-expanded', String(open));
        menu.classList.toggle('is-open', open);
        menu.setAttribute('aria-hidden', String(!open));
        document.body.classList.toggle('is-locked', open);
      };
      burger.addEventListener('click', function () {
        toggle(burger.getAttribute('aria-expanded') !== 'true');
      });
      menu.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () { toggle(false); });
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') toggle(false);
      });
    }

    // active link via section observation
    var links = bar.querySelectorAll('.nav__links a');
    var map = {};
    links.forEach(function (a) {
      var id = a.getAttribute('href').replace('#', '');
      if (id) map[id] = a;
    });
    var ids = Object.keys(map);
    if (!ids.length || !('IntersectionObserver' in window)) return;

    var setActive = function (a) {
      links.forEach(function (l) { l.classList.remove('is-active'); });
      if (a) a.classList.add('is-active');
    };

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        setActive(map[en.target.id]);
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    ids.forEach(function (id) {
      var s = document.getElementById(id);
      if (s) io.observe(s);
    });

    // near the top nothing may sit in the observer band yet — Home wins there
    var home = map.hero;
    window.addEventListener('scroll', function () {
      if (home && window.scrollY < window.innerHeight * 0.4) setActive(home);
    }, { passive: true });
  }

  /* ── boot ────────────────────────────────────────────────── */
  document.documentElement.classList.remove('no-js');

  function init() {
    nav();
    marquee();
    tilt();
    magnetic();
    cursor();
    reveals();
    aboutScrub();
    counters();
    workMotion();
    parallax();

    runLoader().then(heroIntro);

    if (window.ScrollTrigger) {
      window.addEventListener('load', function () { ScrollTrigger.refresh(); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
