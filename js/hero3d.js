/* ============================================================
   hero3d.js — the hero's glass crystal
   Procedural geometry only (no model files to download).
   Refractive MeshPhysicalMaterial lit by a generated room
   environment, with a drifting particle field around it.

   Degrades to a CSS gradient orb when WebGL is unavailable,
   the device is low-powered, or motion is reduced.
   ============================================================ */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const canvas = document.getElementById('hero-canvas');
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function bail() {
  document.documentElement.classList.add('no-webgl');
}

if (!canvas) {
  bail();
} else if (REDUCED) {
  bail();
} else {
  try {
    init();
  } catch (err) {
    console.warn('[hero3d] falling back:', err);
    bail();
  }
}

function init() {
  /* ── renderer ──────────────────────────────────────────── */
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 5.2);

  /* ── environment (drives the refraction) ───────────────── */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;

  /* ── the crystal ───────────────────────────────────────── */
  const group = new THREE.Group();
  scene.add(group);

  const geo = new THREE.IcosahedronGeometry(1.32, 0); // faceted, flat-shaded
  const glass = new THREE.MeshPhysicalMaterial({
    transmission: 1,
    thickness: 1.6,
    roughness: 0.06,
    metalness: 0,
    ior: 1.7,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    iridescence: 1,
    iridescenceIOR: 1.4,
    iridescenceThicknessRange: [120, 520],
    envMapIntensity: 1.5,
    attenuationColor: new THREE.Color('#8f6bff'),
    attenuationDistance: 3.2,
    flatShading: true,
    transparent: true
  });
  const crystal = new THREE.Mesh(geo, glass);
  group.add(crystal);

  // faint wireframe shell for a technical, "scanned" read
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.62, 1),
    new THREE.MeshBasicMaterial({
      color: 0x6a3bff, wireframe: true, transparent: true, opacity: 0.13
    })
  );
  group.add(shell);

  // inner core that glows through the glass
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.42, 2),
    new THREE.MeshBasicMaterial({ color: 0x00c2ff, transparent: true, opacity: 0.55 })
  );
  group.add(core);

  /* ── particle field ────────────────────────────────────── */
  const COUNT = window.innerWidth < 760 ? 260 : 620;
  const pos = new Float32Array(COUNT * 3);
  const seed = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const r = 2.3 + Math.random() * 2.6;
    const t = Math.random() * Math.PI * 2;
    const p = Math.acos(2 * Math.random() - 1);
    pos[i * 3]     = r * Math.sin(p) * Math.cos(t);
    pos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t) * 0.7;
    pos[i * 3 + 2] = r * Math.cos(p);
    seed[i] = Math.random();
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 0.028,
    color: 0x6a3bff,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    sizeAttenuation: true
  }));
  scene.add(dust);

  /* ── lights (transmission still wants direct light) ────── */
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 4, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x00c2ff, 1.6);
  rim.position.set(-4, -1, -3);
  scene.add(rim);
  const warm = new THREE.PointLight(0xff4d9d, 6, 12);
  warm.position.set(-2.5, 2, 2);
  scene.add(warm);

  /* ── resize ────────────────────────────────────────────── */
  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  /* ── pointer (eased, for momentum) ─────────────────────── */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  /* ── scroll offset ─────────────────────────────────────── */
  let scrollN = 0;
  window.addEventListener('scroll', () => {
    scrollN = window.scrollY / Math.max(1, window.innerHeight);
  }, { passive: true });

  /* ── pause when the hero is off-screen ─────────────────── */
  let visible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 })
      .observe(canvas);
  }

  /* ── loop ──────────────────────────────────────────────── */
  const clock = new THREE.Clock();

  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;

    const t = clock.getElapsedTime();

    pointer.x += (pointer.tx - pointer.x) * 0.045;
    pointer.y += (pointer.ty - pointer.y) * 0.045;

    group.rotation.y = t * 0.18 + pointer.x * 0.5;
    group.rotation.x = Math.sin(t * 0.28) * 0.16 + pointer.y * 0.32;
    group.position.y = Math.sin(t * 0.6) * 0.09 - scrollN * 0.9;
    group.scale.setScalar(1 + Math.sin(t * 0.9) * 0.015);

    shell.rotation.y = -t * 0.12;
    shell.rotation.z = t * 0.06;

    core.rotation.y = -t * 0.5;
    core.material.opacity = 0.42 + Math.sin(t * 1.6) * 0.14;

    dust.rotation.y = t * 0.05 + pointer.x * 0.2;
    dust.rotation.x = pointer.y * 0.12;

    camera.position.x += (pointer.x * 0.35 - camera.position.x) * 0.05;
    camera.position.y += (-pointer.y * 0.25 - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  frame();
}
