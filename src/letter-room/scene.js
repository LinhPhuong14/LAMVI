import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createCameraRig } from "./CameraRig";
import { shotForPhase } from "./data";
import { createPaperSurprise } from "./PaperSurprise";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

function roundedCylinder(radius, height, bevel) {
  const points = [new T.Vector2(0, -height / 2)];
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 16;
    points.push(
      new T.Vector2(
        radius - bevel + Math.cos(a) * bevel,
        -height / 2 + bevel + Math.sin(a) * bevel,
      ),
    );
  }
  for (let i = 1; i < 12; i++)
    points.push(
      new T.Vector2(
        radius,
        -height / 2 + bevel + ((height - bevel * 2) * i) / 12,
      ),
    );
  for (let i = 0; i <= 8; i++) {
    const a = (i * Math.PI) / 16;
    points.push(
      new T.Vector2(
        radius - bevel + Math.cos(a) * bevel,
        height / 2 - bevel + Math.sin(a) * bevel,
      ),
    );
  }
  points.push(new T.Vector2(0, height / 2));
  const geometry = new T.LatheGeometry(points, 96);
  const uv = geometry.attributes.uv,
    position = geometry.attributes.position;
  for (let i = 0; i < uv.count; i++)
    uv.setY(i, (position.getY(i) + height / 2) / height);
  return geometry;
}

const C = {
  paper: "#F4E8CF",
  blue: "#EAD6B7",
  sage: "#C89A63",
  wood: "#C89A63",
  coral: "#8B5E3C",
};
export function createRoom(
  host,
  {
    onAction,
    onError,
    onReady,
    onFrame,
    onPaperPointer,
    recipientName,
    reduced,
    occasion = "birthday",
    legacyAssets = false,
  },
) {
  const scene = new T.Scene();
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  host.appendChild(renderer.domElement);
  const pmrem = new T.PMREMGenerator(renderer);
  const environment = new RoomEnvironment();
  const environmentTarget = pmrem.fromScene(environment, 0.05);
  scene.environment = environmentTarget.texture;
  environment.dispose();
  pmrem.dispose();
  const rig = createCameraRig();
  let camera = rig.camera;
  const ambient = new T.HemisphereLight("#EAD6B7", "#3F200B", 0.3);
  scene.add(ambient);
  const sun = new T.DirectionalLight("#EAD6B7", 0.13);
  sun.position.set(-3, 7, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -5;
  sun.shadow.camera.right = 5;
  sun.shadow.camera.top = 5;
  sun.shadow.camera.bottom = -5;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 4;
  scene.add(sun);
  const bounce = new T.DirectionalLight("#F4E8CF", 0.08);
  bounce.position.set(1, 4, 6);
  scene.add(bounce);
  const light = new T.PointLight("#ffcf86", 0, 12, 1.8);
  light.position.set(-0.9, 3.25, -0.1);
  scene.add(light);
  const materials = [],
    geometries = [],
    textures = [];
  function mat(color, extra = {}) {
    const m = new T.MeshPhysicalMaterial({ color, roughness: 0.85, ...extra });
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
    mesh(
      new RoundedBoxGeometry(
        w,
        h,
        d,
        3,
        Math.min(0.055, Math.min(w, h, d) * 0.22),
      ),
      m,
      x,
      y,
      z,
      p,
    );
  const wood = mat(C.wood, {
      roughness: 0.56,
      clearcoat: 0.12,
      clearcoatRoughness: 0.72,
    }),
    paper = mat(C.paper),
    blue = mat(C.blue),
    sage = mat(C.sage),
    coral = mat(C.coral);
  const woodCanvas = document.createElement("canvas");
  woodCanvas.width = 256;
  woodCanvas.height = 256;
  const grain = woodCanvas.getContext("2d");
  grain.fillStyle = C.wood;
  grain.fillRect(0, 0, 256, 256);
  grain.strokeStyle = "rgba(122,82,44,.09)";
  grain.lineWidth = 0.6;
  for (let i = 0; i < 55; i++) {
    grain.beginPath();
    for (let x = 0; x <= 256; x += 8) {
      const y = i * 5 + Math.sin(x * 0.027 + i * 1.7) * 2;
      if (x === 0) grain.moveTo(x, y);
      else grain.lineTo(x, y);
    }
    grain.stroke();
  }
  const woodTexture = new T.CanvasTexture(woodCanvas);
  woodTexture.colorSpace = T.SRGBColorSpace;
  textures.push(woodTexture);
  wood.map = woodTexture;
  const roomStart = scene.children.length;
  box(6.2, 0.18, 6.2, wood, 0.1, -0.1, 0.4);
  box(6, 4.1, 0.12, paper, 0.15, 1.95, -2.55);
  box(0.12, 4.1, 6.2, blue, -2.8, 1.95, 0.4);
  // A framed window, linen curtain and restrained handmade props.
  box(0.08, 2.05, 1.65, wood, -2.7, 2.55, -0.65);
  box(0.09, 1.84, 1.44, mat("#7a6855"), -2.64, 2.55, -0.65);
  box(0.1, 0.06, 1.5, paper, -2.58, 2.55, -0.65);
  box(0.1, 1.9, 0.05, paper, -2.58, 2.55, -0.65);
  const clothGeometry = new T.PlaneGeometry(0.82, 2.25, 48, 16);
  const clothPosition = clothGeometry.attributes.position;
  for (let i = 0; i < clothPosition.count; i++)
    clothPosition.setZ(
      i,
      Math.cos((clothPosition.getX(i) / 0.82) * Math.PI * 8) * 0.035,
    );
  clothGeometry.computeVertexNormals();
  const curtain = mesh(
    clothGeometry,
    mat("#EAD6B7", { roughness: 1, side: T.DoubleSide }),
    -2.48,
    2.45,
    0.54,
  );
  curtain.rotation.y = Math.PI / 2;
  const rail = mesh(
    roundedCylinder(0.024, 2.5, 0.01),
    wood,
    -2.43,
    3.63,
    -0.25,
  );
  rail.rotation.x = Math.PI / 2;
  const artCanvas = document.createElement("canvas");
  artCanvas.width = 256;
  artCanvas.height = 320;
  const art = artCanvas.getContext("2d");
  art.fillStyle = "#F4E8CF";
  art.fillRect(0, 0, 256, 320);
  art.strokeStyle = "#8B5E3C";
  art.lineWidth = 2;
  art.beginPath();
  art.arc(128, 115, 48, 0.3, Math.PI * 1.7);
  art.bezierCurveTo(158, 102, 126, 74, 157, 72);
  art.stroke();
  art.beginPath();
  art.moveTo(128, 258);
  art.quadraticCurveTo(110, 225, 134, 186);
  art.moveTo(124, 239);
  art.quadraticCurveTo(88, 228, 97, 211);
  art.quadraticCurveTo(123, 214, 124, 239);
  art.moveTo(126, 220);
  art.quadraticCurveTo(164, 214, 159, 195);
  art.quadraticCurveTo(135, 197, 126, 220);
  art.stroke();
  const artTexture = new T.CanvasTexture(artCanvas);
  artTexture.colorSpace = T.SRGBColorSpace;
  textures.push(artTexture);
  box(0.83, 1.03, 0.055, wood, 1.38, 3.32, -2.43);
  mesh(
    new T.PlaneGeometry(0.72, 0.92),
    mat(C.paper, { map: artTexture }),
    1.38,
    3.32,
    -2.396,
  );
  const roomMeshes = scene.children.slice(roomStart);
  const architecture = new T.Group();
  scene.add(architecture);
  for (const object of roomMeshes) architecture.add(object);
  const tableParts = [];
  tableParts.push(box(3.9, 0.22, 2.45, wood, 0, 1.62, 0.05));
  for (const x of [-1.65, 1.65])
    for (const z of [-0.88, 0.98])
      tableParts.push(box(0.15, 1.5, 0.15, wood, x, 0.76, z));
  box(1.8, 0.11, 1.3, mat("#B79974"), 0.1, 0.06, 1.3);
  const lamp = new T.Group();
  lamp.position.set(-1, 1.735, -0.25);
  scene.add(lamp);
  mesh(roundedCylinder(0.5, 0.13, 0.028), wood, 0, 0.065, 0, lamp);
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
    bumpMap: texture,
    bumpScale: 0.014,
  });
  const shade = mesh(
    roundedCylinder(0.46, 1.55, 0.018),
    shadeMat,
    0,
    0.9,
    0,
    lamp,
  );
  shade.rotation.y = Math.PI;
  const cord = new T.CatmullRomCurve3([
    new T.Vector3(-1, 1.746, 0.05),
    new T.Vector3(-1.45, 1.746, 0.5),
    new T.Vector3(-0.8, 1.746, 0.9),
    new T.Vector3(-0.5, 1.746, 0.85),
  ]);
  mesh(new T.TubeGeometry(cord, 32, 0.014, 6, false), mat("#77796a"), 0, 0, 0);
  const toggle = box(0.25, 0.07, 0.38, paper, -0.6, 1.77, 0.85);
  const rocker = box(0.09, 0.035, 0.12, coral, -0.6, 1.815, 0.85);
  // Each envelope layer is a separate mesh. Front pocket occludes the letter.
  const envelope = new T.Group();
  envelope.position.set(0.8, 1.75, 0.35);
  scene.add(envelope);
  box(1.42, 0.025, 0.97, sage, 0, 0, 0, envelope);
  const agedCanvas = document.createElement("canvas");
  agedCanvas.width = 512;
  agedCanvas.height = 384;
  const aged = agedCanvas.getContext("2d");
  const agedFill = aged.createRadialGradient(230, 170, 30, 256, 192, 340);
  agedFill.addColorStop(0, "#d9bb8c");
  agedFill.addColorStop(0.7, "#c89a63");
  agedFill.addColorStop(1, "#8b5e3c");
  aged.fillStyle = agedFill;
  aged.fillRect(0, 0, 512, 384);
  for (let i = 0; i < 3500; i++) {
    aged.fillStyle = `rgba(79,44,16,${rand() * 0.09})`;
    aged.fillRect(
      rand() * 512,
      rand() * 384,
      rand() * 2 + 0.3,
      rand() * 3 + 0.3,
    );
  }
  const agedTexture = new T.CanvasTexture(agedCanvas);
  agedTexture.colorSpace = T.SRGBColorSpace;
  textures.push(agedTexture);
  sage.color.set("#F4E8CF");
  sage.map = agedTexture;
  const gridCanvas = document.createElement("canvas");
  gridCanvas.width = 512;
  gridCanvas.height = 512;
  const grid = gridCanvas.getContext("2d");
  grid.fillStyle = "#F4E8CF";
  grid.fillRect(0, 0, 512, 512);
  grid.strokeStyle = "rgba(139,94,60,.2)";
  grid.lineWidth = 1;
  for (let i = 0; i <= 512; i += 24) {
    grid.beginPath();
    grid.moveTo(i, 0);
    grid.lineTo(i, 512);
    grid.moveTo(0, i);
    grid.lineTo(512, i);
    grid.stroke();
  }
  const gridTexture = new T.CanvasTexture(gridCanvas);
  gridTexture.colorSpace = T.SRGBColorSpace;
  textures.push(gridTexture);
  const gridPaper = mat("#F4E8CF", { map: gridTexture });
  const letter = box(1.27, 0.018, 0.87, gridPaper, 0, 0.025, -0.04, envelope);
  const paperVertices = Float32Array.from(
    letter.geometry.attributes.position.array,
  );
  const pocketShape = new T.Shape();
  pocketShape.moveTo(-0.71, 0.485);
  pocketShape.lineTo(0, -0.14);
  pocketShape.lineTo(0.71, 0.485);
  pocketShape.lineTo(0.71, -0.495);
  pocketShape.lineTo(-0.71, -0.495);
  pocketShape.closePath();
  const pocket = mesh(
    new T.ExtrudeGeometry(pocketShape, {
      depth: 0.018,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.002,
      bevelThickness: 0.002,
    }),
    sage,
    0,
    0.05,
    0,
    envelope,
  );
  pocket.rotation.x = -Math.PI / 2;
  const flap = new T.Group();
  flap.position.set(0, 0.07, -0.485);
  envelope.add(flap);
  const shape = new T.Shape();
  shape.moveTo(-0.71, 0);
  shape.lineTo(0.71, 0);
  shape.lineTo(0, -0.65);
  shape.closePath();
  const flapMesh = mesh(
    new T.ExtrudeGeometry(shape, {
      depth: 0.008,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.002,
      bevelThickness: 0.002,
    }),
    mat("#F4E8CF", { side: T.DoubleSide, map: agedTexture }),
    0,
    0,
    0,
    flap,
  );
  flapMesh.rotation.x = -Math.PI / 2;
  const seal = mesh(
    roundedCylinder(0.115, 0.04, 0.008),
    mat(C.coral, { roughness: 0.48, clearcoat: 0.18 }),
    0,
    0.105,
    0.07,
    envelope,
  );
  const seams = new T.BufferGeometry().setFromPoints([
    new T.Vector3(-0.71, 0.073, -0.29),
    new T.Vector3(0, 0.073, 0.25),
    new T.Vector3(0.71, 0.073, -0.29),
    new T.Vector3(0.71, 0.073, 0.495),
    new T.Vector3(0, 0.073, 0.08),
    new T.Vector3(-0.71, 0.073, 0.495),
    new T.Vector3(-0.71, 0.073, -0.29),
  ]);
  const seamInk = new T.LineBasicMaterial({
    color: "#8B5E3C",
    transparent: true,
    opacity: 0.35,
  });
  envelope.add(new T.Line(seams, seamInk));
  geometries.push(seams);
  materials.push(seamInk);
  const waxRing = mesh(
    new T.TorusGeometry(0.075, 0.006, 6, 32),
    wood,
    0,
    0.126,
    0.07,
    envelope,
  );
  waxRing.rotation.x = -Math.PI / 2;
  const stampCanvas = document.createElement("canvas");
  stampCanvas.width = 192;
  stampCanvas.height = 224;
  const stampCtx = stampCanvas.getContext("2d");
  stampCtx.fillStyle = "#ead6b7";
  stampCtx.fillRect(4, 4, 184, 216);
  stampCtx.strokeStyle = "#8b5e3c";
  stampCtx.lineWidth = 3;
  stampCtx.strokeRect(13, 13, 166, 198);
  stampCtx.strokeRect(20, 20, 152, 184);
  stampCtx.beginPath();
  stampCtx.arc(96, 93, 46, 0, Math.PI * 2);
  stampCtx.stroke();
  stampCtx.fillStyle = "#8b5e3c";
  stampCtx.textAlign = "center";
  stampCtx.font = "23px serif";
  stampCtx.fillText("LAMVI", 96, 101);
  stampCtx.font = "15px serif";
  stampCtx.fillText("THƯƠNG GỬI", 96, 176);
  const stampTexture = new T.CanvasTexture(stampCanvas);
  stampTexture.colorSpace = T.SRGBColorSpace;
  textures.push(stampTexture);
  const stamp = mesh(
    new T.PlaneGeometry(0.17, 0.2),
    mat("#F4E8CF", { map: stampTexture }),
    0.51,
    0.067,
    0.32,
    envelope,
  );
  stamp.rotation.x = -Math.PI / 2;
  const waxVertices = seal.geometry.attributes.position;
  for (let i = 0; i < waxVertices.count; i++) {
    const x = waxVertices.getX(i),
      z = waxVertices.getZ(i),
      angle = Math.atan2(z, x),
      swell = 1 + 0.028 * Math.sin(angle * 7) + 0.015 * Math.cos(angle * 13);
    waxVertices.setX(i, x * swell);
    waxVertices.setZ(i, z * swell);
  }
  seal.geometry.computeVertexNormals();
  const embossCanvas = document.createElement("canvas");
  embossCanvas.width = 128;
  embossCanvas.height = 128;
  const emboss = embossCanvas.getContext("2d");
  emboss.strokeStyle = "#b68a58";
  emboss.lineWidth = 5;
  emboss.lineCap = "round";
  emboss.beginPath();
  emboss.moveTo(63, 101);
  emboss.quadraticCurveTo(54, 60, 74, 24);
  emboss.moveTo(63, 80);
  emboss.quadraticCurveTo(28, 68, 36, 48);
  emboss.quadraticCurveTo(64, 51, 63, 80);
  emboss.moveTo(64, 59);
  emboss.quadraticCurveTo(98, 48, 96, 30);
  emboss.quadraticCurveTo(73, 32, 64, 59);
  emboss.stroke();
  const embossTexture = new T.CanvasTexture(embossCanvas);
  embossTexture.colorSpace = T.SRGBColorSpace;
  textures.push(embossTexture);
  const waxFace = mesh(
    new T.PlaneGeometry(0.12, 0.12),
    mat("#F4E8CF", {
      map: embossTexture,
      transparent: true,
      depthWrite: false,
    }),
    0,
    0.133,
    0.07,
    envelope,
  );
  waxFace.rotation.x = -Math.PI / 2;
  envelope.updateMatrixWorld(true);
  for (const piece of [seal, waxRing, waxFace]) flap.attach(piece);
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 512;
  labelCanvas.height = 128;
  const lc = labelCanvas.getContext("2d");
  lc.fillStyle = "#3F200B";
  lc.font = "48px Itim, cursive";
  lc.textAlign = "center";
  lc.fillText(`Gửi ${recipientName}`, 256, 64);
  lc.font = "15px serif";
  lc.fillText("MỘT LỜI THƯƠNG ĐƯỢC GIỮ LẠI", 256, 104);
  lc.strokeStyle = "#8B5E3C";
  lc.strokeRect(8, 8, 496, 112);
  const labelTexture = new T.CanvasTexture(labelCanvas);
  labelTexture.colorSpace = T.SRGBColorSpace;
  textures.push(labelTexture);
  const label = mesh(
    new T.PlaneGeometry(1.1, 0.25),
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
  label.position.y = .082;
  label.renderOrder = 4;
  label.material.polygonOffset = true;
  label.material.polygonOffsetFactor = -1;
  label.material.polygonOffsetUnits = -1;
  label.rotation.x = -Math.PI / 2;
  // Ceramic cup and a small book stay on the same desk through every camera move.
  mesh(
    new T.LatheGeometry(
      [
        [0, -0.175],
        [0.16, -0.175],
        [0.18, -0.17],
        [0.195, -0.14],
        [0.22, 0.14],
        [0.218, 0.17],
        [0.21, 0.18],
        [0.2, 0.17],
        [0.197, 0.14],
        [0.175, -0.13],
        [0, -0.13],
      ].map(([x, y]) => new T.Vector2(x, y)),
      64,
    ),
    mat("#f4e8cf", { roughness: 0.3, clearcoat: 0.25 }),
    1.35,
    1.905,
    -0.78,
  );
  mesh(
    new T.CylinderGeometry(0.185, 0.185, 0.005, 64),
    mat("#8b7053"),
    1.35,
    2.085,
    -0.78,
  );
  const handle = mesh(
    new T.TorusGeometry(0.11, 0.035, 8, 24),
    paper,
    1.57,
    1.935,
    -0.78,
  );
  handle.rotation.y = 0;
  box(0.63, 0.065, 0.8, mat("#8B5E3C"), -0.1, 1.7625, -0.65);
  box(0.59, 0.04, 0.76, paper, -0.1, 1.8025, -0.65);
  // Soft local occlusion grounds the objects without a per-frame blur pass.
  const occlusionCanvas = document.createElement("canvas");
  occlusionCanvas.width = 128;
  occlusionCanvas.height = 128;
  const occlusion = occlusionCanvas.getContext("2d"),
    gradient = occlusion.createRadialGradient(64, 64, 4, 64, 64, 64);
  gradient.addColorStop(0, "rgba(42,23,10,.55)");
  gradient.addColorStop(0.5, "rgba(42,23,10,.25)");
  gradient.addColorStop(1, "rgba(42,23,10,0)");
  occlusion.fillStyle = gradient;
  occlusion.fillRect(0, 0, 128, 128);
  const occlusionTexture = new T.CanvasTexture(occlusionCanvas);
  textures.push(occlusionTexture);
  function contact(x, z, w, d, opacity) {
    const m = mesh(
      new T.PlaneGeometry(w, d),
      new T.MeshBasicMaterial({
        map: occlusionTexture,
        transparent: true,
        opacity,
        depthWrite: false,
      }),
      x,
      1.735,
      z,
    );
    materials.push(m.material);
    m.rotation.x = -Math.PI / 2;
    m.castShadow = false;
    m.receiveShadow = false;
    return m;
  }
  contact(-1, -0.25, 1.35, 1.35, 0.7);
  contact(1.35, -0.78, 0.7, 0.7, 0.5);
  contact(-0.1, -0.65, 0.95, 1.15, 0.25);
  const envelopeShadow = contact(0.8, 0.35, 1.75, 1.3, 0.25);
  tableParts.push(box(3.5, 0.16, 0.09, wood, 0, 1.44, 1.1));
  tableParts.push(box(0.09, 0.16, 1.95, wood, -1.72, 1.44, 0.05));
  tableParts.push(box(0.09, 0.16, 1.95, wood, 1.72, 1.44, 0.05));
  box(5.9, 0.15, 0.08, wood, 0.15, 0.08, -2.45, architecture);
  box(0.08, 0.15, 6.1, wood, -2.7, 0.08, 0.4, architecture);
  let backgroundSettled = false,
    modelSettled = legacyAssets,
    artworkSettled = false;
  const ready = () => {
    if (backgroundSettled && modelSettled && artworkSettled && !disposed) onReady?.();
  };
  if (!legacyAssets)
    new GLTFLoader().load(
      "/letter-room/models/kaykit-furniture/table-medium-long-geometry.glb",
      (gltf) => {
        const model = gltf.scene;
        if (disposed) {
          model.traverse((o) => {
            o.geometry?.dispose();
            if (o.material)
              for (const m of Array.isArray(o.material)
                ? o.material
                : [o.material])
                m.dispose();
          });
          return;
        }
        const bounds = new T.Box3().setFromObject(model),
          size = bounds.getSize(new T.Vector3()),
          center = bounds.getCenter(new T.Vector3());
        model.position.set(-center.x, -bounds.min.y, -center.z);
        const group = new T.Group();
        group.add(model);
        group.scale.set(3.9 / size.x, 1.73 / size.y, 2.45 / size.z);
        group.position.set(0, 0, 0.05);
        model.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = true;
          o.receiveShadow = true;
          geometries.push(o.geometry);
          for (const m of Array.isArray(o.material)
            ? o.material
            : [o.material]) {
            m.roughness = 0.82;
            m.color.set("#D8B78E");
            m.metalness = 0;
            m.map = wood.map;
            m.needsUpdate = true;
            if (!materials.includes(m)) materials.push(m);
            for (const key of ["map", "normalMap", "roughnessMap"])
              if (m[key] && !textures.includes(m[key])) textures.push(m[key]);
          }
        });
        for (const part of tableParts) part.visible = false;
        scene.add(group);
        modelSettled = true;
        renderer.shadowMap.needsUpdate = true;
        ready();
        invalidate();
      },
      undefined,
      () => {
        modelSettled = true;
        ready();
      },
    );
  const loader = new T.TextureLoader();
  function loadMap(file, apply, color = false) {
    const map = loader.load(
      `/letter-room/textures/${file}.webp`,
      (loaded) => {
        if (disposed) {
          loaded.dispose();
          return;
        }
        if (color) loaded.colorSpace = T.SRGBColorSpace;
        loaded.anisotropy = Math.min(
          4,
          renderer.capabilities.getMaxAnisotropy(),
        );
        apply(loaded);
        invalidate();
      },
      undefined,
      () => {},
    );
    textures.push(map);
  }
  loadMap(
    "wood-color",
    (map) => {
      wood.map = map;
      wood.color.set("#ead6b7");
      wood.needsUpdate = true;
    },
    true,
  );
  loadMap("wood-normal", (map) => {
    wood.normalMap = map;
    wood.normalScale.set(0.18, 0.18);
    wood.needsUpdate = true;
  });
  loadMap("wood-rough", (map) => {
    wood.roughnessMap = map;
    wood.roughness = 0.82;
    wood.needsUpdate = true;
  });
  loadMap(
    "paper-color",
    (map) => {
      paper.map = map;
      paper.needsUpdate = true;
    },
    true,
  );
  loadMap("paper-normal", (map) => {
    for (const material of [paper, shadeMat, gridPaper, flapMesh.material]) {
      material.normalMap = map;
      material.normalScale.set(0.11, 0.11);
      material.needsUpdate = true;
    }
  });
  loadMap("paper-rough", (map) => {
    for (const material of [paper, shadeMat, gridPaper, flapMesh.material]) {
      material.roughnessMap = map;
      material.needsUpdate = true;
    }
  });
  const referenceCamera = new T.PerspectiveCamera(47, 16 / 9, 0.05, 80);
  referenceCamera.position.set(0.4, 2.95, 3.65);
  referenceCamera.lookAt(-0.15, 2.05, -0.15);
  referenceCamera.updateMatrixWorld();
  const paintProjection = new T.Matrix4().multiplyMatrices(
    referenceCamera.projectionMatrix,
    referenceCamera.matrixWorldInverse,
  );
  const roomPaint = new T.ShaderMaterial({
    uniforms: {
      plate: { value: null },
      paintProjection: { value: paintProjection },
      level: { value: 0.22 },
      base: { value: new T.Color(C.paper) },
    },
    side: T.DoubleSide,
    vertexShader:
      "uniform mat4 paintProjection; varying vec4 vPaint; void main(){vec4 world=modelMatrix*vec4(position,1.0);vPaint=paintProjection*world;gl_Position=projectionMatrix*viewMatrix*world;}",
    fragmentShader: `uniform sampler2D plate;uniform float level;uniform vec3 base;varying vec4 vPaint;void main(){vec2 uv=vPaint.xy/vPaint.w*.5+.5;float edge=smoothstep(-.12,.03,uv.x)*smoothstep(-.12,.03,uv.y)*smoothstep(-.12,.03,1.-uv.x)*smoothstep(-.12,.03,1.-uv.y);vec3 painted=texture2D(plate,clamp(uv,0.,1.)).rgb;gl_FragColor=vec4(mix(base,painted,edge)*level,1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`,
  });
  materials.push(roomPaint);
  const backdropSize =
    host.clientWidth * Math.min(devicePixelRatio, 1.65) > 1100 ? 1600 : 960;
  const backdrop = loader.load(
    `/letter-room/background/room-modern-v4-${backdropSize}.webp`,
    (loaded) => {
      if (disposed) {
        loaded.dispose();
        return;
      }
      loaded.colorSpace = T.SRGBColorSpace;
      scene.background = loaded;
      roomPaint.uniforms.plate.value = loaded;
      architecture.visible = false;
      architecture.traverse((object) => {
        if (object.isMesh) {
          object.material = roomPaint;
          object.receiveShadow = false;
        }
      });
      backgroundSettled = true;
      ready();
      renderer.shadowMap.needsUpdate = true;
      invalidate();
    },
    undefined,
    () => {
      backgroundSettled = true;
      ready();
    },
  );
  textures.push(backdrop);
  const paperSurprise = createPaperSurprise({ THREE: T, colors: C, occasion });
  paperSurprise.group.scale.setScalar(1.45);
  paperSurprise.group.position.set(.2,1.75,.55);
  scene.add(paperSurprise.group);
  let basePaper = ctx.getImageData(0, 0, 512, 512);
  const artworkImage = new Image();
  artworkImage.onload = () => {
    if (disposed) return;
    ctx.drawImage(artworkImage, 144, 175, 224, 150);
    basePaper = ctx.getImageData(0,0,512,512);
    texture.needsUpdate = true;
    artworkSettled = true; ready(); invalidate();
  };
  artworkImage.onerror = () => { artworkSettled=true; ready(); };
  artworkImage.src = "/letter-room/textures/dong-ho-roosters-v5.webp";
  let state = { phase: "dark", progress: 0 },
    frame = 0,
    disposed = false,
    phaseStart = performance.now(),
    pauseStarted = 0,
    settleFrom = 0,
    renderedProgress = 0,
    letterDetached = false,
    lastEmit = "";
  const raycaster = new T.Raycaster(),
    pointer = new T.Vector2(),
    dragPlane = new T.Plane(new T.Vector3(0, 1, 0), -1.784);
  const letterFlat = new T.Quaternion();
  const liftStart = new T.Vector3(),
    liftQuaternion = new T.Quaternion();
  const envelopeReturn = new T.Vector3(), envelopeReturnQ = new T.Quaternion();
  let suppressClick = false;
  function coordinates(x, y) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((x - r.left) / r.width) * 2 - 1,
      (-(y - r.top) / r.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
  }
  function project(x, y) {
    coordinates(x, y);
    const p = new T.Vector3();
    return raycaster.ray.intersectPlane(dragPlane, p) ? envelope.worldToLocal(p) : null;
  }
  function hit(x, y, objects) {
    coordinates(x, y);
    return raycaster.intersectObjects(objects, true).length > 0;
  }
  function allowed() {
    return (
      !state.paused &&
      rig.settled(performance.now()) &&
      ["dark", "envelope", "ready", "surprise"].includes(state.phase)
    );
  }
  function click(e) {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (!allowed()) return;
    const objects =
      state.phase === "dark"
        ? [toggle, rocker]
        : state.phase === "envelope"
          ? [pocket, flapMesh, seal]
          : state.phase === "ready"
            ? [letter]
            : occasion === "justBecause"
              ? [shade]
              : paperSurprise.interactiveMeshes;
    if (state.phase === "envelope" || hit(e.clientX, e.clientY, objects))
      onAction(
        state.phase === "dark"
          ? "LIGHT"
          : state.phase === "envelope"
            ? "APPROACH"
            : state.phase === "ready"
              ? "OPEN"
              : occasion === "birthday"
                ? "BLOW"
                : "REVEAL",
      );
  }
  function pointerDown(e) {
    if (
      state.phase === "ready" &&
      allowed() &&
      hit(e.clientX, e.clientY, [letter])
    ) {
      suppressClick = true;
      onPaperPointer?.("start", e);
    }
  }
  function pointerMove(e) {
    onPaperPointer?.("move", e);
    if (!allowed()) return;
    const objects =
      state.phase === "dark"
        ? [toggle, rocker]
        : state.phase === "envelope"
          ? [pocket, flapMesh, seal]
          : state.phase === "ready"
            ? [letter]
            : paperSurprise.interactiveMeshes;
    renderer.domElement.style.cursor = hit(e.clientX, e.clientY, objects)
      ? "pointer"
      : "default";
  }
  const pointerUp = (e) => onPaperPointer?.("end", e),
    pointerCancel = (e) => onPaperPointer?.("cancel", e);
  const listeners = {
    click,
    pointerdown: pointerDown,
    pointermove: pointerMove,
    pointerup: pointerUp,
    pointercancel: pointerCancel,
    lostpointercapture: pointerCancel,
  };
  for (const [type, listener] of Object.entries(listeners))
    renderer.domElement.addEventListener(type, listener);
  function resize() {
    const { width, height } = host.getBoundingClientRect();
    renderer.setSize(width, height);
    rig.resize(width / Math.max(1, height));
    invalidate();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10),
    clamp = (x) => Math.max(0, Math.min(1, x));
  function screenPoint(object, offset = new T.Vector3()) {
    const p = object.localToWorld(offset.clone()).project(camera);
    return {
      x: Math.round(((p.x + 1) * host.clientWidth) / 2),
      y: Math.round(((1 - p.y) * host.clientHeight) / 2),
    };
  }
  function paperRect() {
    letter.updateWorldMatrix(true, false);
    const r = host.getBoundingClientRect();
    const points = [
      [-0.635, -0.435],
      [0.635, -0.435],
      [0.635, 0.435],
      [-0.635, 0.435],
    ].map(([x, z]) => screenPoint(letter, new T.Vector3(x, 0.012, z)));
    const left = Math.min(...points.map((p) => p.x)),
      top = Math.min(...points.map((p) => p.y));
    return {
      left: r.left + left,
      top: r.top + top,
      width: Math.max(...points.map((p) => p.x)) - left,
      height: Math.max(...points.map((p) => p.y)) - top,
    };
  }
  function draw(now) {
    frame = 0;
    if (disposed || state.paused) return;
    const elapsed = now - phaseStart,
      phase = state.phase;
    camera = rig.update(now);
    const lit =
      phase === "dark"
        ? 0
        : phase === "lighting"
          ? ease(clamp((elapsed - 350) / (reduced ? 1 : 1050)))
          : 1;
    scene.environmentIntensity = 0.025 + lit * 0.3;
    ambient.intensity = 0.3 + lit * 0.65;
    sun.intensity = 0.13 + lit * 0.35;
    bounce.intensity = 0.08 + lit * 0.8;
    light.intensity = lit * 12;
    shadeMat.emissiveIntensity = lit * .72;
    scene.backgroundIntensity = 0.22 + lit * 0.78;
    roomPaint.uniforms.level.value = 0.22 + lit * 0.78;
    rocker.position.y =
      1.815 -
      (phase === "lighting"
        ? 0.022 * Math.sin(clamp((elapsed - 650) / 450) * Math.PI)
        : 0);
    // The camera stays seated; the envelope itself comes to the player.
    const floatPhases = ["approaching", "ready", "returning", "extracting"];
    const floating = floatPhases.includes(phase);
    const fly = phase === "approaching" ? ease(clamp(elapsed / (reduced ? 1 : 1000))) : floating ? 1 : 0;
    const front = camera.localToWorld(new T.Vector3(0, -.42, -2.45));
    const facing = camera.quaternion.clone().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0), Math.PI/2));
    if (floating) {
      envelope.position.set(.8, 1.75, .35).lerp(front, fly);
      envelope.quaternion.identity().slerp(facing, fly);
    } else if (["lifting","reading"].includes(phase)) {
      const back = phase === "reading" ? 1 : ease(clamp(elapsed/(reduced?1:1100)));
      envelope.position.copy(envelopeReturn).lerp(new T.Vector3(.8,1.75,.35),back);
      envelope.quaternion.copy(envelopeReturnQ).slerp(new T.Quaternion(),back);
    } else if (phase === "surpriseEntering") {
      const back = ease(clamp(elapsed / (reduced ? 1 : 1100)));
      envelope.position.copy(envelopeReturn).lerp(new T.Vector3(1.15,1.75,-.2),back);
      envelope.quaternion.copy(envelopeReturnQ).slerp(new T.Quaternion(),back);
    } else if (["surprise","celebrating","celebrated"].includes(phase)) {
      envelope.position.set(1.15,1.75,-.2); envelope.quaternion.identity();
    } else {
      envelope.position.set(.8, 1.75, .35); envelope.quaternion.identity();
    }
    const packed = ["surpriseEntering","surprise","celebrating","celebrated"].includes(phase) ? (phase === "surpriseEntering" ? ease(clamp(elapsed/(reduced?1:1100))) : 1) : 0;
    envelope.scale.setScalar(1-packed*.26);
    envelope.updateMatrixWorld(true);
    dragPlane.setFromNormalAndCoplanarPoint(new T.Vector3(0,1,0).applyQuaternion(envelope.quaternion), envelope.localToWorld(new T.Vector3(0,.034,0)));
    const opening = [
      "approaching",
      "ready",
      "returning",
      "extracting",
      "lifting",
      "reading",
      "surpriseEntering",
      "surprise",
      "celebrating",
      "celebrated",
    ].includes(phase);
    const flapOpen =
      phase === "approaching"
        ? ease(clamp((elapsed - (reduced ? 0 : 650)) / (reduced ? 1 : 450)))
        : opening
          ? 1
          : 0;
    // Fold away from the reader so the extracted sheet passes in front of the lid.
    // Settle the lid flat when the envelope returns to the tabletop.
    const restingLid = phase === "lifting" ? ease(clamp(elapsed/(reduced?1:1100))) : ["reading","surpriseEntering","surprise","celebrating","celebrated"].includes(phase) ? 1 : 0;
    flap.rotation.x = flapOpen * Math.PI * (.92 + restingLid*.08);
    if (phase === "ready") renderedProgress = state.progress;
    else if (phase === "returning")
      renderedProgress = T.MathUtils.lerp(
        settleFrom,
        0,
        ease(clamp(elapsed / (reduced ? 1 : 380))),
      );
    else if (phase === "extracting")
      renderedProgress = T.MathUtils.lerp(
        settleFrom,
        1,
        ease(clamp(elapsed / (reduced ? 1 : 420))),
      );
    if (!letterDetached) {
      const nudge =
        phase === "ready" && state.progress === 0 && !reduced
          ? Math.sin(clamp(elapsed / 700) * Math.PI) * 0.025
          : 0;
      letter.position.z = -0.04 - renderedProgress * .9 - nudge;
      const bend = Math.sin(renderedProgress * Math.PI) * 0.065;
      const positions = letter.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const z = paperVertices[i * 3 + 2];
        positions.setY(
          i,
          paperVertices[i * 3 + 1] +
            Math.sin(((z + 0.435) / 0.87) * Math.PI) * bend,
        );
      }
      positions.needsUpdate = true;
      letter.geometry.computeVertexNormals();
    }
    if (phase === "lifting") {
      const k = ease(clamp(elapsed / (reduced ? 1 : 1100))),
        pose = rig.readerPose();
      letter.position.copy(liftStart).lerp(pose.position, k);
      letter.quaternion.copy(liftQuaternion).slerp(pose.quaternion, k);
    }
    if (phase === "reading") {
      const pose = rig.readerPose();
      letter.position.copy(pose.position);
      letter.quaternion.copy(pose.quaternion);
    }
    if (
      ["surpriseEntering", "surprise", "celebrating", "celebrated"].includes(
        phase,
      )
    ) {
      const k =
        phase === "surpriseEntering"
          ? ease(clamp(elapsed / (reduced ? 1 : 1100)))
          : 1;
      letter.position.copy(liftStart).lerp(new T.Vector3(1.15, 1.79, .1), k);
      letter.quaternion.copy(liftQuaternion).slerp(letterFlat, k);
      letter.scale.setScalar(1 - k*.28);
      paperSurprise.update({
        phase,
        progress: k,
        elapsed: elapsed / 1000,
        reduced,
      });
    } else paperSurprise.update({ phase, progress: 0, elapsed: 0, reduced });
    letter.visible = phase !== "reading";
    if (
      occasion === "justBecause" &&
      ["surpriseEntering", "surprise", "celebrating", "celebrated"].includes(
        phase,
      )
    ) {
      ctx.putImageData(basePaper, 0, 0);
      ctx.save();
      ctx.globalAlpha = 0.4 * clamp(elapsed / 750);
      ctx.filter = "blur(2px)";
      ctx.fillStyle = "#776947";
      ctx.font = "100px serif";
      ctx.fillText("☾", 130, 280);
      ctx.restore();
      texture.needsUpdate = true;
    }
    envelopeShadow.material.opacity = 0.25;
    if (
      [
        "lighting",
        "approaching",
        "returning",
        "extracting",
        "lifting",
        "surpriseEntering",
      ].includes(phase)
    )
      renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
    const view = {
      shot: rig.shot,
      stable: rig.settled(now),
      anchors: {
        switch: screenPoint(toggle),
        envelope: screenPoint(pocket),
        paper: screenPoint(letter, new T.Vector3(0, 0.012, -0.435)),
        card: screenPoint(paperSurprise.cardAnchor),
        candle: screenPoint(paperSurprise.candleAnchor),
        lamp: screenPoint(shade, new T.Vector3(0, 0.1, 0.46)),
      },
    };
    const serial = JSON.stringify(view);
    if (serial !== lastEmit) {
      lastEmit = serial;
      onFrame?.(view);
    }
    if (
      !rig.settled(now) ||
      elapsed <
        (reduced
          ? 5
          : phase === "lighting"
            ? 1850
            : phase === "approaching"
              ? 1250
              : phase === "lifting"
                ? 1150
                : phase === "surpriseEntering"
                  ? 1150
                  : phase === "celebrating"
                    ? 1150
                    : phase === "extracting"
                      ? 450
                      : phase === "returning"
                        ? 410
                        : phase === "ready"
                          ? 750
                          : 1000) ||
      (phase === "surprise" && occasion === "birthday" && !reduced)
    )
      invalidate();
  }
  function invalidate() {
    if (!frame && !disposed && !state.paused)
      frame = requestAnimationFrame(draw);
  }
  function lost(e) {
    e.preventDefault();
    onError();
  }
  renderer.domElement.addEventListener("webglcontextlost", lost);
  resize();
  return {
    get canInteract() {
      return allowed();
    },
    project,
    paperRect,
    setState(next) {
      const now = performance.now();
      if (next.paused && !state.paused) {
        pauseStarted = now;
        cancelAnimationFrame(frame);
        frame = 0;
      }
      if (!next.paused && state.paused) {
        const gap = now - pauseStarted;
        phaseStart += gap;
        rig.pause(gap);
      }
      if (next.phase !== state.phase) {
        settleFrom = renderedProgress;
        phaseStart = now;
        if (next.phase === "lifting") {
          envelopeReturn.copy(envelope.position); envelopeReturnQ.copy(envelope.quaternion);
          envelope.updateMatrixWorld(true);
          scene.attach(letter);
          letterDetached = true;
          letter.getWorldPosition(liftStart);
          letter.getWorldQuaternion(liftQuaternion);
        }
        if (next.phase === "surpriseEntering") {
          envelopeReturn.copy(envelope.position); envelopeReturnQ.copy(envelope.quaternion);
          liftStart.copy(letter.position);
          liftQuaternion.copy(letter.quaternion);
        }
        rig.go(
          shotForPhase(next.phase, occasion),
          now,
          reduced
            ? 0
            : next.phase === "lighting"
              ? 850
              : next.phase === "approaching"
                ? 1000
                : next.phase === "lifting"
                  ? 1100
                  : next.phase === "surpriseEntering"
                    ? 1050
                    : 800,
        );
        renderer.shadowMap.needsUpdate = true;
      }
      state = next;
      invalidate();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      for (const [type, listener] of Object.entries(listeners))
        renderer.domElement.removeEventListener(type, listener);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      paperSurprise.dispose();
      rig.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      environmentTarget.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
