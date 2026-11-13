import * as T from "three";

const C = {
  paper: "#FAF4E7",
  blue: "#B8D2E6",
  sage: "#A5B8A3",
  wood: "#D8B78E",
  coral: "#DF8E76",
};
export function createRoom(
  host,
  { onAction, onError, recipientName, reduced },
) {
  const scene = new T.Scene();
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  host.appendChild(renderer.domElement);
  const camera = new T.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  const wide = new T.Vector3(8, 9.27, 8),
    close = new T.Vector3(0.9, 8, 2.3),
    target = new T.Vector3(0, 1.35, 0);
  const ambient = new T.HemisphereLight("#c6ddf5", "#8b7762", 0.36);
  scene.add(ambient);
  const sun = new T.DirectionalLight("#fff2d8", 0.2);
  sun.position.set(0, 8, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -5;
  sun.shadow.camera.right = 5;
  sun.shadow.camera.top = 5;
  sun.shadow.camera.bottom = -5;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 4;
  scene.add(sun);
  const light = new T.PointLight("#FFD99B", 0, 9, 2);
  light.position.set(-0.9, 3.25, -0.1);
  scene.add(light);
  const materials = [],
    geometries = [],
    textures = [];
  function mat(color, extra = {}) {
    const m = new T.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
    materials.push(m);
    return m;
  }
  function mesh(geometry, material, x, y, z, parent = scene) {
    geometries.push(geometry);
    const m = new T.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  const box = (w, h, d, m, x, y, z, p) =>
    mesh(new T.BoxGeometry(w, h, d), m, x, y, z, p);
  const wood = mat(C.wood),
    paper = mat(C.paper),
    blue = mat(C.blue),
    sage = mat(C.sage),
    coral = mat(C.coral);
  const woodCanvas = document.createElement('canvas');
  woodCanvas.width = 256; woodCanvas.height = 256;
  const grain = woodCanvas.getContext('2d');
  grain.fillStyle = C.wood; grain.fillRect(0, 0, 256, 256);
  grain.strokeStyle = 'rgba(122,82,44,.09)'; grain.lineWidth = .6;
  for (let i = 0; i < 55; i++) {
    grain.beginPath();
    for (let x = 0; x <= 256; x += 8) {
      const y = i * 5 + Math.sin(x * .027 + i * 1.7) * 2;
      if (x === 0) grain.moveTo(x, y); else grain.lineTo(x, y);
    }
    grain.stroke();
  }
  const woodTexture = new T.CanvasTexture(woodCanvas);
  woodTexture.colorSpace = T.SRGBColorSpace;
  textures.push(woodTexture); wood.map = woodTexture;
  box(5.7, 0.18, 5.2, paper, 0, -0.1, 0);
  box(5.7, 4.1, 0.12, paper, 0, 1.95, -2.55);
  box(0.12, 4.1, 5.2, blue, -2.8, 1.95, 0);
  // A framed window, linen curtain and restrained handmade props.
  box(0.08, 2.05, 1.65, wood, -2.7, 2.55, -0.65);
  box(0.09, 1.84, 1.44, mat("#d9e7ed"), -2.64, 2.55, -0.65);
  box(0.1, 0.06, 1.5, paper, -2.58, 2.55, -0.65);
  box(0.1, 1.9, 0.05, paper, -2.58, 2.55, -0.65);
  for (let i = 0; i < 8; i++)
    box(
      0.13,
      2.25,
      0.11,
      mat(i % 2 ? "#a7c6d9" : "#bad4e4"),
      -2.5,
      2.45,
      0.24 + i * 0.09,
    );
  box(3.9, 0.22, 2.45, wood, 0, 1.62, 0.05);
  for (const x of [-1.65, 1.65])
    for (const z of [-0.88, 0.98]) box(0.15, 1.5, 0.15, wood, x, 0.76, z);
  box(1.8, 0.11, 1.3, mat("#cad2b8"), 0.1, 0.06, 1.3);
  const lamp = new T.Group();
  lamp.position.set(-1, 1.77, -0.25);
  scene.add(lamp);
  mesh(new T.CylinderGeometry(0.49, 0.51, 0.13, 64), wood, 0, 0.065, 0, lamp);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f4e5c6";
  ctx.fillRect(0, 0, 512, 512);
  let seed = 17;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 4200; i++) {
    ctx.strokeStyle = `rgba(125,101,69,${0.03 + rand() * 0.13})`;
    ctx.lineWidth = 0.4 + rand();
    const x = rand() * 512,
      y = rand() * 512;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + rand() * 8 - 4, y + rand() * 18);
    ctx.stroke();
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  textures.push(texture);
  const shadeMat = mat("#fff4dc", {
    map: texture,
    emissive: "#FFD99B",
    emissiveMap: texture,
    emissiveIntensity: 0,
  });
  const shade = mesh(
    new T.CylinderGeometry(0.46, 0.46, 1.55, 64, 1, false),
    shadeMat,
    0,
    0.9,
    0,
    lamp,
  );
  for (const y of [0.14, 1.67])
    mesh(
      new T.TorusGeometry(0.452, 0.018, 8, 64),
      paper,
      0,
      y,
      0,
      lamp,
    ).rotation.x = Math.PI / 2;
  const cord = new T.CatmullRomCurve3([
    new T.Vector3(-1, 1.76, 0.05),
    new T.Vector3(-1.45, 1.76, 0.5),
    new T.Vector3(-0.8, 1.76, 0.9),
    new T.Vector3(-0.5, 1.76, 0.85),
  ]);
  mesh(new T.TubeGeometry(cord, 32, 0.014, 6, false), mat("#77796a"), 0, 0, 0);
  const toggle = box(0.25, 0.07, 0.38, paper, -0.6, 1.8, 0.85);
  box(0.09, 0.035, 0.12, coral, -0.6, 1.85, 0.85);
  // Each envelope layer is a separate mesh. Front pocket occludes the letter.
  const envelope = new T.Group();
  envelope.position.set(0.8, 1.78, 0.35);
  scene.add(envelope);
  box(1.42, 0.025, 0.97, sage, 0, 0, 0, envelope);
  const letter = box(1.27, 0.018, 0.87, paper, 0, 0.025, -0.04, envelope);
  const pocket = box(1.42, 0.018, 0.79, sage, 0, 0.05, 0.1, envelope);
  const flap = new T.Group();
  flap.position.set(0, 0.07, -0.485);
  envelope.add(flap);
  const shape = new T.Shape();
  shape.moveTo(-0.71, 0);
  shape.lineTo(0.71, 0);
  shape.lineTo(0, -0.58);
  shape.closePath();
  const flapMesh = mesh(
    new T.ShapeGeometry(shape),
    mat(C.sage, { side: T.DoubleSide }),
    0,
    0,
    0,
    flap,
  );
  flapMesh.rotation.x = -Math.PI / 2;
  const seal = mesh(
    new T.CylinderGeometry(0.11, 0.11, 0.035, 32),
    coral,
    0,
    0.105,
    0.07,
    envelope,
  );
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 512;
  labelCanvas.height = 128;
  const lc = labelCanvas.getContext("2d");
  lc.fillStyle = "#30433e";
  lc.font = "italic 58px serif";
  lc.textAlign = "center";
  lc.fillText(`Gửi ${recipientName}`, 256, 80);
  const labelTexture = new T.CanvasTexture(labelCanvas);
  textures.push(labelTexture);
  const label = mesh(
    new T.PlaneGeometry(0.8, 0.2),
    new T.MeshBasicMaterial({
      map: labelTexture,
      transparent: true,
      depthWrite: false,
    }),
    0,
    0.07,
    0.35,
    envelope,
  );
  materials.push(label.material);
  label.rotation.x = -Math.PI / 2;
  // Ceramic cup and a small book stay on the same desk through every camera move.
  mesh(
    new T.CylinderGeometry(0.22, 0.19, 0.35, 32),
    mat("#e4dfd1"),
    1.35,
    1.97,
    -0.78,
  );
  mesh(
    new T.CylinderGeometry(0.175, 0.175, 0.005, 32),
    mat("#8b7053"),
    1.35,
    2.15,
    -0.78,
  );
  const handle = mesh(
    new T.TorusGeometry(0.11, 0.035, 8, 24),
    paper,
    1.57,
    2,
    -0.78,
  );
  handle.rotation.y = Math.PI / 2;
  box(0.63, 0.065, 0.8, mat("#779187"), -0.1, 1.78, -0.65);
  box(0.59, 0.04, 0.76, paper, -0.1, 1.82, -0.65);
  const basePaper = ctx.getImageData(0, 0, 512, 512);
  let revealStart = 0;
  let state = { phase: "dark", progress: 0 },
    frame = 0,
    disposed = false,
    phaseStart = performance.now(),
    prev = "dark";
  const raycaster = new T.Raycaster(),
    pointer = new T.Vector2(),
    plane = new T.Plane(new T.Vector3(0, 1, 0), -1.8);
  function project(x, y) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((x - r.left) / r.width) * 2 - 1,
      (-(y - r.top) / r.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const point = new T.Vector3();
    return raycaster.ray.intersectPlane(plane, point) ? point : null;
  }
  function click(e) {
    if (state.phase !== "dark" && state.phase !== "lit") return;
    project(e.clientX, e.clientY);
    const hits = raycaster.intersectObjects(
      state.phase === "dark" ? [toggle, shade] : [pocket, flapMesh, seal],
    );
    if (hits.length) onAction(state.phase === "dark" ? "LIGHT" : "APPROACH");
  }
  renderer.domElement.addEventListener("click", click);
  function resize() {
    const { width, height } = host.getBoundingClientRect();
    renderer.setSize(width, height);
    const aspect = width / height;
    camera.left = -4.2 * aspect;
    camera.right = 4.2 * aspect;
    camera.top = 4.2;
    camera.bottom = -4.2;
    camera.updateProjectionMatrix();
    invalidate();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const ease = (t) => t * t * (3 - 2 * t);
  function draw(now) {
    frame = 0;
    if (disposed) return;
    const elapsed = now - phaseStart;
    const t = ease(Math.min(1, elapsed / (reduced ? 1 : 850)));
    const lit = state.phase === "dark" ? 0 : state.phase === "lighting" ? t : 1;
    ambient.intensity = 0.36 + lit * 1.5;
    sun.intensity = 0.2 + lit * 2;
    light.intensity = lit * 12;
    shadeMat.emissiveIntensity = lit * 0.8;
    const near = !["dark", "lighting", "lit"].includes(state.phase);
    const k = state.phase === "approaching" ? t : near ? 1 : 0;
    camera.position.copy(wide).lerp(close, k);
    target.set(0, 1.35, 0).lerp(new T.Vector3(0.6, 1.78, 0.1), k);
    camera.lookAt(target);
    camera.zoom = (host.clientWidth < 650 ? 0.85 : 1) + k * 0.68;
    camera.updateProjectionMatrix();
    const open =
      state.phase === "approaching"
        ? Math.max(0, (t - 0.65) / 0.35)
        : near
          ? 1
          : 0;
    flap.rotation.x = -open * Math.PI * 0.92;
    seal.visible = open < 0.1;
    const desired = state.progress;
    letter.position.z = T.MathUtils.lerp(
      letter.position.z,
      -0.04 - desired * 1.35,
      reduced ? 1 : 0.25,
    );
    if (state.phase === "reading") letter.visible = false;
    if (state.surprise) {
      ctx.putImageData(basePaper, 0, 0);
      ctx.save();
      ctx.globalAlpha =
        Math.min(1, (now - revealStart) / (reduced ? 1 : 750)) * 0.4;
      ctx.filter = "blur(2px)";
      ctx.fillStyle = "#776947";
      ctx.font = "100px serif";
      ctx.fillText("☾", 130, 280);
      ctx.restore();
      texture.needsUpdate = true;
    }
    renderer.render(scene, camera);
    if (
      elapsed < (reduced ? 5 : 900) ||
      Math.abs(letter.position.z - (-0.04 - desired * 1.35)) > 0.001 ||
      (state.surprise && now - revealStart < 800)
    )
      invalidate();
  }
  function invalidate() {
    if (!frame && !disposed) frame = requestAnimationFrame(draw);
  }
  function lost(e) {
    e.preventDefault();
    onError();
  }
  renderer.domElement.addEventListener("webglcontextlost", lost);
  resize();
  return {
    setState(next) {
      if (next.surprise && !state.surprise) revealStart = performance.now();
      state = next;
      if (next.phase !== prev) {
        phaseStart = performance.now();
        prev = next.phase;
      }
      invalidate();
    },
    project,
    paperRect() {
      letter.updateWorldMatrix(true, false);
      const r = renderer.domElement.getBoundingClientRect();
      const points = [
        [-0.635, -0.435],
        [0.635, -0.435],
        [0.635, 0.435],
        [-0.635, 0.435],
      ].map(([x, z]) => {
        const p = new T.Vector3(x, 0.012, z)
          .applyMatrix4(letter.matrixWorld)
          .project(camera);
        return {
          x: r.left + ((p.x + 1) * r.width) / 2,
          y: r.top + ((1 - p.y) * r.height) / 2,
        };
      });
      const left = Math.min(...points.map((p) => p.x)),
        top = Math.min(...points.map((p) => p.y));
      return {
        left,
        top,
        width: Math.max(...points.map((p) => p.x)) - left,
        height: Math.max(...points.map((p) => p.y)) - top,
      };
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      renderer.domElement.removeEventListener("click", click);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
