# Portfolio — Sulaymon Ruziboev

Personal portfolio site. Static, no build step, no framework — plain HTML, CSS
and JavaScript.

## Structure

```
index.html          the site — hero, work, capabilities, build log, contact
soon.html           placeholder for projects with no site yet (linked from card 04)

css/home.css        every page — dark design tokens, all components, and the
                    inner-page pieces (case study, CV, "still exporting")
css/style.css       the old light design; no page loads it any more

js/home.js          motion for every page: intro, flowing-paths hero, scroll-lit
                    about, tilting Cutlass screen, spotlight cards, build-log
                    beam, nav. Each effect skips itself where its markup is absent.
js/vendor/motion.js Motion 13.4.6 (formerly Framer Motion), vendored
js/cursor.js        the 3D code cursor, on every page

assets/work/        screenshots and the hero background
```

## Running it

It **must be served over HTTP**. Opening `index.html` by double-clicking
loads it over `file://`, which blocks ES modules — so `js/hero3d.js` never
starts and the 3D hero silently falls back to a flat gradient.

```
serve.bat
```

That starts a local server on <http://localhost:5178> and opens it. Or use any
static server:

```
python -m http.server 5178
npx http-server -p 5178 .
```

## Notes

- **No build step and no dependencies.** GSAP and Three.js load from a CDN;
  everything else is hand-written.
- **`blob.js` is a classic script, not a module**, so the orb still works over
  `file://` even though the 3D hero does not.
- **Asset filenames are lowercase with no spaces.** Windows ignores case but
  Linux hosts do not, so a mismatch works locally and 404s once deployed.
- **Motion is gated on `prefers-reduced-motion`** throughout — the blob removes
  itself entirely, the 3D hero never initialises, and reveals resolve instantly.
