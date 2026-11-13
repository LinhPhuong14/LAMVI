/** Lightweight, scene-local paper props. Times (elapsed) are seconds since phase entry. */
export function createPaperSurprise({ THREE, colors = {}, occasion = 'birthday' }) {
  const C = {
    paper: '#FAF4E7', wood: '#D8B78E', sage: '#A5B8A3',
    coral: '#DF8E76', ink: '#30433E', light: '#FFD99B', ...colors,
  };
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  let disposed = false;
  const geometry = (value) => { geometries.add(value); return value; };
  const material = (color, extra = {}) => {
    const value = new THREE.MeshStandardMaterial({
      color, roughness: 0.91, metalness: 0, side: THREE.DoubleSide, ...extra,
    });
    materials.add(value);
    return value;
  };
  const paper = material(C.paper);
  const sage = material(C.sage);
  const coral = material(C.coral);
  const crease = material(C.wood);
  const ink = material(C.ink);
  const group = new THREE.Group();
  group.name = 'paper-surprise';
  group.position.set(0.3, 1.75, -0.45);
  const cardAnchor = new THREE.Object3D();
  cardAnchor.name = 'paper-card-hit-point';
  cardAnchor.position.set(0, 0.025, 0.08);
  group.add(cardAnchor);

  const mesh = (parent, shape, surface, position = [0, 0, 0]) => {
    const value = new THREE.Mesh(geometry(shape), surface);
    value.position.set(...position);
    value.castShadow = true;
    value.receiveShadow = true;
    parent.add(value);
    return value;
  };
  const sheet = (parent, width, depth, surface, position) =>
    mesh(parent, new THREE.BoxGeometry(width, 0.005, depth), surface, position);
  const base = sheet(group, 0.88, 0.66, paper, [0, 0.008, 0]);
  base.name = 'closed-card';
  // The cover really rotates about its rear crease; no scale-based unfolding.
  const cover = new THREE.Group();
  cover.position.set(0, 0.016, -0.33);
  group.add(cover);
  sheet(cover, 0.88, 0.66, sage, [0, 0, 0.33]);
  sheet(group, 0.88, 0.012, crease, [0, 0.014, -0.326]);
  const tab = sheet(group, 0.14, 0.09, coral, [0.26, 0.014, 0.354]);
  tab.name = 'surprise-tab';

  // Original rice sprig printed on transparent paper, never an external asset.
  let ornamentMap = null;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = new THREE.Color(C.sage).getStyle();
      ctx.fillStyle = new THREE.Color(C.coral).getStyle();
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(39, 110); ctx.quadraticCurveTo(87, 60, 72, 16); ctx.stroke();
      for (let i = 0; i < 7; i++) {
        const y = 28 + i * 10;
        const x = 73 - i * i * 0.55;
        for (const side of [-1, 1]) {
          ctx.beginPath(); ctx.ellipse(x + side * 7, y, 3, 7, side * 0.7, 0, Math.PI * 2); ctx.fill();
        }
      }
      ornamentMap = new THREE.CanvasTexture(canvas);
      ornamentMap.colorSpace = THREE.SRGBColorSpace;
      textures.add(ornamentMap);
      const art = mesh(cover, new THREE.PlaneGeometry(0.25, 0.25),
        material('#ffffff', { map: ornamentMap, transparent: true, depthWrite: false }), [0.25, 0.004, 0.39]);
      art.rotation.x = -Math.PI / 2;
      art.castShadow = false;
    }
  }

  const cake = new THREE.Group();
  cake.position.y = 0.023;
  group.add(cake);
  const tiers = [];
  function makeTier(width, height, surface, parent) {
    const tier = new THREE.Group();
    parent.add(tier);
    const panels = [];
    // Thin upright walls have their own bottom hinges and lie outward when flat.
    for (let i = 0; i < 4; i++) {
      const hinge = new THREE.Group();
      hinge.rotation.y = i * Math.PI / 2;
      hinge.position.set(Math.sin(i * Math.PI / 2) * width / 2, 0,
        Math.cos(i * Math.PI / 2) * width / 2);
      tier.add(hinge);
      const fold = new THREE.Group();
      hinge.add(fold);
      mesh(fold, new THREE.BoxGeometry(width, height, 0.004), surface, [0, height / 2, 0]);
      mesh(fold, new THREE.BoxGeometry(width * 0.98, 0.024, 0.005), coral, [0, height * 0.78, 0.003]);
      mesh(hinge, new THREE.BoxGeometry(width, 0.004, 0.007), crease);
      panels.push(fold);
    }
    const top = sheet(tier, width, width, paper, [0, height, 0]);
    const lidHinge = new THREE.Group();
    lidHinge.position.z = -width / 2;
    tier.add(lidHinge);
    // Move the top into a rear hinge, so it folds independently of the side panels.
    lidHinge.add(top);
    top.position.set(0, 0, width / 2);
    const result = { tier, panels, lidHinge, height };
    tiers.push(result);
    return result;
  }
  const bottom = makeTier(0.39, 0.16, sage, cake);
  const upper = makeTier(0.26, 0.13, paper, cake);
  const candle = new THREE.Group();
  cake.add(candle);
  mesh(candle, new THREE.CylinderGeometry(0.014, 0.014, 0.12, 8), coral, [0, 0.06, 0]);
  const wick = mesh(candle, new THREE.CylinderGeometry(0.002, 0.002, 0.019, 5), ink, [0, 0.127, 0]);
  const flameMaterial = material(C.light, {
    emissive: C.light, emissiveIntensity: 0.7, transparent: true, opacity: 0.92,
  });
  const flame = mesh(candle, new THREE.SphereGeometry(0.019, 8, 8), flameMaterial, [0, 0.158, 0]);
  flame.scale.set(0.65, 1.6, 0.65);
  flame.castShadow = false;
  const candleAnchor = new THREE.Object3D();
  candleAnchor.name = 'candle-hit-point';
  candleAnchor.position.set(0, 0.145, 0);
  candle.add(candleAnchor);
  // Larger transparent target gives the fine wick/flame a usable raycast region.
  const candleHit = mesh(candle, new THREE.SphereGeometry(0.065, 8, 6),
    material(C.paper, { transparent: true, opacity: 0, depthWrite: false }), [0, 0.145, 0]);
  candleHit.castShadow = candleHit.receiveShadow = false;
  candleHit.name = 'candle-interaction';

  const smoke = new THREE.Group();
  candle.add(smoke);
  const smokePuffs = [];
  const smokeGeometry = geometry(new THREE.SphereGeometry(0.007, 6, 5));
  for (let i = 0; i < 5; i++) {
    const surface = material(C.paper, { transparent: true, opacity: 0, depthWrite: false });
    const puff = new THREE.Mesh(smokeGeometry, surface);
    smoke.add(puff);
    smokePuffs.push(puff);
  }
  const ribbon = sheet(group, 0.46, 0.12, paper, [0, 0.021, 0.16]);
  sheet(ribbon, 0.012, 0.1, coral, [-0.21, 0.004, 0]);
  const alternative = new THREE.Group();
  group.add(alternative);
  const insert = sheet(alternative, 0.55, 0.43, paper, [0, 0.027, 0]);
  // A mounted photo/date/PS card; personalised text is supplied by the host DOM.
  sheet(alternative, 0.41, 0.23, sage, [0, 0.031, -0.015]);
  sheet(alternative, 0.15, 0.035, coral, [0, 0.035, 0.15]);
  insert.name = `${occasion}-paper-insert`;

  const clamp = (n) => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
  const ease = (n) => { const t = clamp(n); return t * t * (3 - 2 * t); };
  const birthday = occasion === 'birthday';
  function update({ phase, progress = 1, elapsed = 0, reduced = false } = {}) {
    if (disposed) return;
    const active = ['surpriseEntering', 'surprise', 'celebrating', 'celebrated'].includes(phase);
    const entering = phase === 'surpriseEntering';
    const p = active ? (entering && !reduced ? clamp(progress) : 1) : 0;
    const done = phase === 'celebrating' || phase === 'celebrated';
    const time = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
    cover.rotation.x = -Math.PI * 0.95 * ease(p / 0.5);
    cake.visible = birthday && p > 0.28;
    alternative.visible = !birthday && p > 0.28;
    const first = ease((p - 0.28) / 0.45);
    const second = ease((p - 0.52) / 0.48);
    tiers.forEach(({ panels, lidHinge, height }, index) => {
      const fold = index === 0 ? first : second;
      panels.forEach((panel) => { panel.rotation.x = (1 - fold) * Math.PI / 2; });
      lidHinge.position.y = height * fold;
      lidHinge.rotation.x = -(1 - fold) * Math.PI / 2;
    });
    upper.tier.position.y = bottom.height * first + 0.005;
    candle.position.y = upper.tier.position.y + upper.height * second;
    candle.visible = p >= 0.8;
    candle.rotation.x = (1 - second) * Math.PI / 2;
    flame.visible = birthday && p >= 0.99 && !done;
    flame.scale.set(0.65, reduced ? 1.6 : 1.6 + Math.sin(time * 9) * 0.09, 0.65);
    flame.rotation.z = reduced ? 0 : Math.sin(time * 7) * 0.06;
    const fade = phase === 'celebrated' || reduced ? 1 : clamp(time);
    smoke.visible = birthday && phase === 'celebrating' && fade < 1;
    smokePuffs.forEach((puff, i) => {
      const t = clamp((fade - i * 0.045) / 0.8);
      puff.position.set(Math.sin(t * 5 + i) * 0.012 * t, 0.14 + t * 0.12 + i * 0.005, 0);
      puff.scale.setScalar(0.5 + t * 1.3);
      puff.material.opacity = (1 - t) * 0.15;
    });
    ribbon.visible = birthday && done;
    ribbon.position.z = 0.16 + 0.28 * ease(phase === 'celebrated' || reduced ? 1 : time / 0.65);
    alternative.position.z = -0.16 * ease((p - 0.3) / 0.7);
    alternative.rotation.x = -0.22 * ease((p - 0.3) / 0.7);
    // Hosts may inspect this flag before raycasting; hidden parents are also gated below.
    candleHit.userData.interactive = birthday && phase === 'surprise';
    candleHit.visible = candleHit.userData.interactive;
    group.updateMatrixWorld(true);
  }
  update();
  return {
    group, cardAnchor, candleAnchor, interactiveMeshes: [candleHit, wick, flame], update,
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      geometries.forEach((value) => value.dispose());
      materials.forEach((value) => value.dispose());
      textures.forEach((value) => value.dispose());
      geometries.clear(); materials.clear(); textures.clear();
      group.clear();
    },
  };
}
