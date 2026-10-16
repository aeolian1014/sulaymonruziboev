/* Motion & AI video section: cards with hover/in-view previews and a dialog lightbox. */
(function () {
  var list = window.VIDEO_WORKS, grid = document.getElementById('video-grid');
  if (!list || !grid) return;
  var BASE = 'assets/work/video/';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  grid.innerHTML = list.map(function (w) {
    return '<li class="vcard' + (w.v ? ' vcard--v' : '') + '">' +
      '<button type="button" class="vcard__btn" data-id="' + w.id + '" aria-label="Play ' + esc(w.name) + (w.concept ? ' (concept)' : '') + '">' +
        '<span class="vcard__media">' +
          '<img src="' + BASE + w.id + '.jpg" alt="" loading="lazy" decoding="async" />' +
          (reduce ? '' : '<video muted loop playsinline preload="none" tabindex="-1" aria-hidden="true" data-src="' + BASE + w.id + '-loop.mp4"></video>') +
          '<span class="vcard__play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>' +
          (w.concept ? '<span class="vcard__badge">Concept</span>' : '') +
        '</span>' +
        '<span class="vcard__info"><b>' + esc(w.name) + '</b><i>' + esc(w.tag) + ' · ' + w.year + '</i></span>' +
      '</button></li>';
  }).join('');

  /* previews: hover on desktop, in view on touch, none with reduced motion */
  if (!reduce) {
    var vids = Array.prototype.slice.call(grid.querySelectorAll('video'));
    var play = function (v) {
      if (!v.getAttribute('src')) v.src = v.dataset.src;
      var p = v.play(); if (p && p.catch) p.catch(function () {});
      v.classList.add('is-on');
    };
    var stop = function (v) { v.pause(); v.classList.remove('is-on'); };
    if (canHover) {
      vids.forEach(function (v) {
        var btn = v.closest('.vcard__btn');
        btn.addEventListener('pointerenter', function () { play(v); });
        btn.addEventListener('pointerleave', function () { stop(v); });
        btn.addEventListener('focus', function () { play(v); });
        btn.addEventListener('blur', function () { stop(v); });
      });
    } else if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) play(e.target); else stop(e.target); });
      }, { threshold: 0.6 });
      vids.forEach(function (v) { io.observe(v); });
    }
  }

  /* lightbox: native <dialog> gives Esc, focus trap and focus return */
  var dlg = document.getElementById('video-lightbox');
  var stage = dlg.querySelector('.lightbox__stage');
  var title = dlg.querySelector('.lightbox__title');
  function open(w) {
    stage.innerHTML = '';
    var v = document.createElement('video');
    v.controls = true; v.playsInline = true; v.preload = 'auto';
    v.poster = BASE + w.id + '.jpg';
    v.setAttribute('aria-label', w.name);
    v.src = BASE + w.id + '.mp4';
    stage.appendChild(v);
    dlg.classList.toggle('is-v', !!w.v);
    title.textContent = w.name + (w.concept ? ' — concept' : '');
    dlg.showModal();
    var p = v.play(); if (p && p.catch) p.catch(function () {});
  }
  function shut() {
    var v = stage.querySelector('video');
    if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
    stage.innerHTML = '';
  }
  function close() { if (dlg.open) dlg.close(); shut(); }
  dlg.addEventListener('close', shut);
  dlg.addEventListener('cancel', shut);
  dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target === stage) close(); });
  dlg.querySelector('.lightbox__close').addEventListener('click', close);
  grid.addEventListener('click', function (e) {
    var b = e.target.closest('.vcard__btn'); if (!b) return;
    var w = list.filter(function (x) { return x.id === b.dataset.id; })[0];
    if (w) open(w);
  });
})();
