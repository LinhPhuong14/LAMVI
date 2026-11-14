import * as THREE from 'three'
import { easeInOutCubic, easeOutCubic, projectAxisToScreen, tween } from './dragProgress.js'

// ĐIỂM THAY TEXTURE THẬT (§4 yêu cầu bắt đầu bằng texture nhẹ, chỉ đổi khi có asset thật). Đèn đã
// đổi sang ảnh chụp thật dùng chung với catalog (LAMP_PHOTO_URL, mục dưới) — còn hai nơi sau vẫn
// là canvas vẽ thủ tục:
//   - Giấy thư + nền phong bì: `makeNoiseTexture`/`makeEnvelopeFrontTexture` → thay bằng ambientCG
//     "Paper001" (PBR, CC0, ambientcg.com/view?id=Paper001). Giữ alpha thấp khi chồng màu bảng §2.
//   - Mặt bàn: `floorMat` ở dưới → thay bằng Poly Haven "Wood Table" (CC0, polyhaven.com/a/wood_table,
//     bản 1K), hạ tương phản vân gỗ để mắt vẫn hướng về phong bì.
// Màu theo bảng mỹ thuật của đặc tả (§2). Tập trung ở một nơi để đổi theo ảnh sản phẩm thật sau.
export const PALETTE = {
  wall: 0xfaf4e7,
  curtain: 0xb8d2e6,
  envelope: 0xa5b8a3,
  wood: 0xd8b78e,
  seal: 0xdf8e76,
  ink: 0x30433e,
  lampLight: 0xffd99b,
  letter: 0xfdf8ee,
  roomDarkTint: 0x182230,
}

// Kích thước (đơn vị tuỳ ý, ~mét) của phong bì/lá thư — gom một chỗ để chỉnh tỉ lệ không phải sửa
// nhiều nơi (yêu cầu §5: "vị trí thay... mẫu đèn"). Đổi tỉ lệ/màu chụp đèn theo ảnh thật ở LAMP_CFG.
const ENV_W = 0.5
const ENV_L = 0.76
const FLAP_LEN = 0.24
const POCKET_TOP = ENV_L / 2 - FLAP_LEN
const LETTER_W = ENV_W * 0.84
// Phải ngắn hơn chiều dài túi (pocketLen = ENV_L - FLAP_LEN) trừ phần hở PEEK, nếu không mép dưới
// của thư sẽ lòi ra khỏi đáy phong bì ngay cả khi chưa kéo.
const LETTER_L = ENV_L - FLAP_LEN - 0.08
const PEEK = 0.035
const LETTER_REST_Y = POCKET_TOP + PEEK - LETTER_L / 2
const SLIDE_DISTANCE = 0.58

// Ảnh đèn dùng chung với catalog (public/images/lamps — ProductImage.jsx dùng cùng bộ ảnh này cho
// thẻ sản phẩm). Bản "-cutout" đã tách nền, nét hơn hẳn texture canvas vẽ thủ tục trước đây. Đổi
// mẫu đèn hiển thị ở đây — mọi ảnh trong bộ cùng tỉ lệ khung hình nên không cần sửa LAMP_CFG.
const LAMP_PHOTO_URL = '/images/lamps/tu-linh-cutout.webp'
const LAMP_PHOTO_PX = { w: 420, h: 1000 } // kích thước thật của ảnh — xem lý do cần biết trước ở makeLampPhotoTexture
const LAMP_PHOTO_ASPECT = LAMP_PHOTO_PX.w / LAMP_PHOTO_PX.h

const LAMP_CFG = {
  height: 1.05, // chiều cao hiển thị trong cảnh (đơn vị thế giới) — đổi tỉ lệ đèn ở đây
  scale: 1,
}
LAMP_CFG.width = LAMP_CFG.height * LAMP_PHOTO_ASPECT

const ROOM = { width: 4.6, depth: 3.4, height: 2.6 }
// Khoảng cách ngang đèn/phong bì phải vừa trong viewW của khung dọc hẹp nhất (điện thoại, §5 mục 1)
const LAMP_POS = new THREE.Vector3(-0.8, 0, -0.3)
const ENVELOPE_POS = new THREE.Vector3(0.55, 0.01, 0.38)
const ENVELOPE_ROT_Z = 0.09 // đặt lệch nhẹ như đồ vật thật để trên bàn, không chính giữa cứng
const ENVELOPE_TILT_X = -Math.PI / 2 // nằm phẳng trên bàn, mặt bì hướng lên (+Y)

function makeNoiseTexture({ w = 256, h = 256, base = '#faf4e7', fiber = '#e9ddc5', alpha = 0.16 } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)
  ctx.globalAlpha = alpha
  ctx.strokeStyle = fiber
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * w
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + (Math.random() - 0.5) * 24, h)
    ctx.lineWidth = Math.random() * 0.8 + 0.2
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// Hình bóng đơn giản cho Cảnh E mục 7 (Tặng bất chợt) — vẽ như một miếng giấy cắt đặt trong chụp
// đèn, hiện qua thớ giấy khi đèn sáng. (cx,cy) là tâm, size là chiều cao ước lượng của hình.
function drawSilhouette(ctx, shape, cx, cy, size) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.fillStyle = 'rgba(20,24,22,0.82)'
  if (shape === 'cat') {
    const s = size / 10
    ctx.beginPath()
    ctx.ellipse(0, s * 1.5, s * 3.2, s * 2.4, 0, 0, Math.PI * 2) // thân
    ctx.fill()
    ctx.beginPath()
    ctx.arc(-s * 2.6, s * 0.4, s * 1.5, 0, Math.PI * 2) // đầu
    ctx.fill()
    ctx.beginPath() // tai
    ctx.moveTo(-s * 3.6, -s * 0.6)
    ctx.lineTo(-s * 3.2, -s * 2)
    ctx.lineTo(-s * 2.4, -s * 0.9)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(-s * 2.2, -s * 0.9)
    ctx.lineTo(-s * 1.6, -s * 2.1)
    ctx.lineTo(-s * 1.2, -s * 0.6)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath() // đuôi cong
    ctx.moveTo(s * 2.6, s * 2.2)
    ctx.quadraticCurveTo(s * 5, s * 1.6, s * 4.4, -s * 1)
    ctx.quadraticCurveTo(s * 4.1, -s * 2, s * 3.3, -s * 1.4)
    ctx.quadraticCurveTo(s * 3.7, s * 0.4, s * 1.8, s * 1.6)
    ctx.closePath()
    ctx.fill()
  } else {
    // Hình chưa có nét vẽ riêng (tách trà, ô, trăng…) → mặt trăng tròn đơn giản, vẫn đọc được ý
    // "có một hình nhỏ" thay vì bỏ trống
    ctx.beginPath()
    ctx.arc(0, 0, size / 2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// Texture cho mặt phẳng hiển thị đèn: nạp ảnh chụp thật (bất đồng bộ — `<img>`/canvas, không chặn
// khung hình đầu). Canvas dựng đúng LAMP_PHOTO_PX ngay từ đầu, KHÔNG resize sau khi ảnh tải xong —
// đổi cỡ canvas sau khi texture đã tạo làm WebGL cố `texSubImage2D` lên texture cũ còn kích thước
// ban đầu, lệch kích thước và vỡ hẳn kết cấu (đã gặp khi chụp thử: cả mặt phẳng ra một màu nhoè đặc).
// Hình bóng Cảnh E mục 7 (nếu có) vẽ đè lên giữa ảnh khi đã tải xong — toàn bộ mặt trước chụp đèn
// đều lọt vào khung hình (khác texture hình trụ cũ phải né mặt sau không thấy được).
function makeLampPhotoTexture(occasionShape, onReady) {
  const canvas = document.createElement('canvas')
  canvas.width = LAMP_PHOTO_PX.w
  canvas.height = LAMP_PHOTO_PX.h
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  // Ảnh thật không vuông/luỹ thừa 2 — tắt mipmap, nếu không WebGL lọc ra kết cấu nhoè/sai màu.
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  const img = new Image()
  img.onload = () => {
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    // Đặt ở dải lề kem phía trên hoạ tiết (ảnh thật khá rậm hoạ tiết, đặt giữa thân sẽ chìm mất)
    if (occasionShape) drawSilhouette(ctx, occasionShape, canvas.width * 0.5, canvas.height * 0.105, canvas.width * 0.55)
    tex.needsUpdate = true
    onReady?.()
  }
  img.src = LAMP_PHOTO_URL
  return tex
}

function makeEnvelopeFrontTexture(recipientName) {
  const w = 512
  const h = Math.round((w * ENV_L) / ENV_W)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#a5b8a3'
  ctx.fillRect(0, 0, w, h)
  // Mép dấu niêm nhỏ phía trên, điểm nhấn dẫn mắt (§2)
  ctx.fillStyle = '#df8e76'
  ctx.beginPath()
  ctx.ellipse(w * 0.78, h * 0.16, 26, 26, 0, 0, Math.PI * 2)
  ctx.fill()
  // Tên người nhận — chữ viết tay (Itim có dấu tiếng Việt)
  ctx.fillStyle = '#30433e'
  ctx.font = '600 52px Itim, cursive'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(recipientName, w / 2, h * 0.56)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makeGlowSprite() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(255,217,155,0.9)')
  grad.addColorStop(0.5, 'rgba(255,217,155,0.35)')
  grad.addColorStop(1, 'rgba(255,217,155,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(1.6, 1.6, 1)
  return sprite
}

// Bóng tiếp xúc mềm giả (quầng tối mờ dần, không phải shadow map thật) — rẻ trên di động và vẫn
// giữ rõ thớ giấy như yêu cầu §2 "Ánh sáng": "bóng tiếp xúc dưới chân đèn và dưới bì thư".
function makeContactShadow(opacity = 0.35) {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, `rgba(10,10,8,${opacity})`)
  grad.addColorStop(0.7, `rgba(10,10,8,${opacity * 0.4})`)
  grad.addColorStop(1, 'rgba(10,10,8,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
  mesh.rotation.x = -Math.PI / 2
  return mesh
}

// Rèm vải một tấm có nếp gấp thật (đẩy đỉnh theo sin dọc chiều ngang) thay vì xếp chồng nhiều mặt
// phẳng — vẫn một draw call, chỉ thêm vài chục vertex, nhìn có khối hơn hẳn mặt phẳng trơn.
function makeCurtainGeometry(width, height, folds = 5, depth = 0.05) {
  const geo = new THREE.PlaneGeometry(width, height, folds * 6, 1)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const wave = Math.sin(((x / width) * Math.PI * 2 * folds) / 2) * depth
    pos.setZ(i, wave)
  }
  geo.computeVertexNormals()
  return geo
}

// Hai "khung hình" camera (Cảnh A rộng, Cảnh B áp sát phong bì) — nội suy vị trí/điểm nhìn/zoom giữa
// hai khung này khi vào Cảnh B (yêu cầu §Cảnh B: "nội suy vị trí, điểm nhìn và độ zoom").
function cameraShot({ azimuth, elevation, distance, target, zoom }) {
  const az = (azimuth * Math.PI) / 180
  const el = (elevation * Math.PI) / 180
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
  const position = dir.multiplyScalar(distance).add(target)
  return { position, target: target.clone(), zoom }
}

// `zoom` là hệ số nhân lên BASE_VIEW_H (chiều cao khung nhìn ở độ phóng 1×, xem applyProjection) —
// KHÔNG phải pixel. 1 = thấy đủ chiều cao phòng; lớn hơn = phóng gần hơn (yêu cầu §Cảnh B).
const SHOT_WIDE = cameraShot({ azimuth: 45, elevation: 35, distance: 5, target: new THREE.Vector3(-0.12, 0.55, 0.03), zoom: 1 })
const SHOT_ENVELOPE = cameraShot({ azimuth: 38, elevation: 58, distance: 3.2, target: new THREE.Vector3(ENVELOPE_POS.x, 0.05, ENVELOPE_POS.z), zoom: 2.6 })

/**
 * Engine Three.js thuần (không React Three Fiber — repo chưa dùng R3F, và cảnh này cần điều khiển
 * tween camera/kéo giấy bằng tay nên imperative API gọn hơn). Chỉ import ở nơi đã xác nhận WebGL
 * khởi tạo được (xem WishRoomPage.jsx) — đừng import file này trong test chạy jsdom.
 */
export function createWishRoomEngine(canvas, { recipientName, reducedMotion = false, occasionShape = null } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
  renderer.setClearColor(PALETTE.roomDarkTint, 1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  // Thử ACESFilmicToneMapping + HemisphereLight + fog nhưng cùng làm phẳng/nhạt tương phản
  // ấm/lạnh mà bảng màu §2 cố tình giữ (đứng/hoè nóng vs chàm đêm lạnh) — bỏ cả ba, giữ bản
  // AmbientLight phẳng đã tuned. Thêm rim light lạnh cố định phía rèm thay cho hemisphere/fog —
  // rẻ hơn (một light tĩnh) và giữ đúng ý "ánh sáng vẫn giữ màu xanh của phòng sau khi bật đèn".

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20)
  camera.position.copy(SHOT_WIDE.position)
  camera.zoom = SHOT_WIDE.zoom
  camera.lookAt(SHOT_WIDE.target)

  const ambient = new THREE.AmbientLight(PALETTE.roomDarkTint, 0.55)
  scene.add(ambient)

  const rimLight = new THREE.PointLight(PALETTE.curtain, 0.35, 5, 2)
  rimLight.position.set(-ROOM.width / 2 + 0.4, ROOM.height * 0.5, 0.6)
  scene.add(rimLight)

  const lampLight = new THREE.PointLight(PALETTE.lampLight, 0, 6, 2)

  // --- Phòng: sàn/bàn + hai vách + rèm + khay gốm (đạo cụ ít theo §2) ---
  const room = new THREE.Group()
  const floorMat = new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.85 })
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.width, ROOM.depth), floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = false
  room.add(floor)

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.width, ROOM.height), new THREE.MeshStandardMaterial({ color: PALETTE.wall, roughness: 0.95 }))
  backWall.position.set(0, ROOM.height / 2, -ROOM.depth / 2)
  room.add(backWall)

  const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.depth, ROOM.height), new THREE.MeshStandardMaterial({ color: PALETTE.curtain, roughness: 0.95 }))
  sideWall.position.set(-ROOM.width / 2, ROOM.height / 2, 0)
  sideWall.rotation.y = Math.PI / 2
  room.add(sideWall)

  // Rèm vải mỏng trước vách phụ — nếp gấp thật bằng hình học (makeCurtainGeometry), không phải
  // nhiều mặt phẳng chồng lệch vị trí
  const curtainWidth = ROOM.depth * 0.9
  const curtainHeight = ROOM.height * 0.82
  const curtain = new THREE.Mesh(
    makeCurtainGeometry(curtainWidth, curtainHeight, 4, 0.07),
    new THREE.MeshStandardMaterial({ color: PALETTE.curtain, roughness: 0.85, transparent: true, opacity: 0.92, side: THREE.DoubleSide }),
  )
  curtain.rotation.y = Math.PI / 2
  curtain.position.set(-ROOM.width / 2 + 0.2, ROOM.height * 0.44, 0)
  room.add(curtain)

  // Khay gốm nhỏ, trang trí
  const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.07, 24), new THREE.MeshStandardMaterial({ color: 0xf1ece2, roughness: 0.6 }))
  tray.position.set(1.4, 0.035, -0.5)
  room.add(tray)

  const lampShadow = makeContactShadow(0.4)
  lampShadow.scale.setScalar(LAMP_CFG.width * 1.7)
  lampShadow.position.set(LAMP_POS.x, 0.002, LAMP_POS.z)
  room.add(lampShadow)

  const envelopeShadow = makeContactShadow(0.3)
  envelopeShadow.scale.set(ENV_W * 1.8, ENV_L * 1.5, 1)
  envelopeShadow.position.set(ENVELOPE_POS.x, 0.001, ENVELOPE_POS.z)
  envelopeShadow.rotation.z = ENVELOPE_ROT_Z
  room.add(envelopeShadow)

  scene.add(room)

  // --- Đèn ngủ giấy dó: một mặt phẳng dùng ảnh chụp thật (đã tách nền) thay vì dựng hình trụ thủ
  // tục — ảnh cùng bộ với catalog nên nét hơn hẳn texture canvas trước đây. Chỉ xoay quanh trục Y
  // (billboard theo phương ngang) để đèn vẫn "đứng thẳng" tự nhiên, không ngả theo góc nghiêng của
  // camera — camera không bao giờ xoay quanh đèn trong lúc đèn còn hiện (chỉ thấy ở Cảnh A/B rộng).
  const lamp = new THREE.Group()
  lamp.position.copy(LAMP_POS)
  lamp.scale.setScalar(LAMP_CFG.scale)

  const LAMP_DARK = new THREE.Color(0x3a4350) // đủ sáng để còn thấy dáng đèn khi phòng tối (yêu cầu §Cảnh A)
  const LAMP_LIT = new THREE.Color(0xffffff)
  const lampPlaneMat = new THREE.MeshBasicMaterial({ map: null, color: LAMP_DARK, transparent: true })
  const lampPlane = new THREE.Mesh(new THREE.PlaneGeometry(LAMP_CFG.width, LAMP_CFG.height), lampPlaneMat)
  lampPlane.position.y = LAMP_CFG.height / 2
  const localCameraPos = SHOT_WIDE.position.clone().sub(LAMP_POS)
  lampPlane.rotation.y = Math.atan2(localCameraPos.x, localCameraPos.z)
  lampPlane.userData.hit = 'light'
  lamp.add(lampPlane)
  lampPlaneMat.map = makeLampPhotoTexture(occasionShape, () => render())

  lampLight.position.set(0, LAMP_CFG.height * 0.52, 0)
  lamp.add(lampLight)
  const glow = makeGlowSprite()
  glow.position.copy(lampLight.position)
  lamp.add(glow)
  lamp.userData.hit = 'light'
  scene.add(lamp)

  // --- Phong bì (nằm phẳng trên bàn) ---
  const envelope = new THREE.Group()
  envelope.position.copy(ENVELOPE_POS)
  envelope.rotation.x = ENVELOPE_TILT_X
  envelope.rotation.z = ENVELOPE_ROT_Z

  // Hai trục local của phong bì sau khi `rotation.x = -90°` (nằm phẳng trên bàn): local Y (chiều
  // dài PlaneGeometry) là trục "dọc theo phong bì / trục rút giấy"; local Z là trục "chồng lớp" —
  // giá trị nhỏ ở đây quyết định mặt nào che mặt nào khi nhìn từ trên xuống (không cần clip plane).
  const LIFT = { postscript: -0.002, back: 0, letter: 0.002, pocket: 0.004, flap: 0.006 }

  const backPanel = new THREE.Mesh(new THREE.PlaneGeometry(ENV_W, ENV_L), new THREE.MeshStandardMaterial({ color: PALETTE.envelope, roughness: 0.9 }))
  backPanel.position.z = LIFT.back
  backPanel.userData.hit = 'envelope'
  envelope.add(backPanel)

  const frontTex = makeEnvelopeFrontTexture(recipientName)
  const pocketLen = ENV_L - FLAP_LEN
  const pocket = new THREE.Mesh(new THREE.PlaneGeometry(ENV_W, pocketLen), new THREE.MeshStandardMaterial({ color: PALETTE.envelope, map: frontTex, roughness: 0.85 }))
  pocket.position.set(0, (-ENV_L / 2 + POCKET_TOP) / 2, LIFT.pocket)
  pocket.userData.hit = 'envelope'
  envelope.add(pocket)

  // Nắp bì — xoay quanh đường gấp (đặt pivot ở mép gấp bằng group riêng)
  const flapPivot = new THREE.Group()
  flapPivot.position.set(0, POCKET_TOP, LIFT.flap)
  const flapShape = new THREE.Shape()
  flapShape.moveTo(-ENV_W / 2, 0)
  flapShape.lineTo(ENV_W / 2, 0)
  flapShape.lineTo(0, FLAP_LEN)
  flapShape.lineTo(-ENV_W / 2, 0)
  const flap = new THREE.Mesh(new THREE.ShapeGeometry(flapShape), new THREE.MeshStandardMaterial({ color: PALETTE.envelope, roughness: 0.85, side: THREE.DoubleSide }))
  flapPivot.add(flap)
  envelope.add(flapPivot)

  // Lá thư — nằm giữa back và front theo chiều cao world, trượt theo local +Y (yêu cầu §Cảnh C)
  const letterTex = makeNoiseTexture({ base: '#fdf8ee', fiber: '#efe5cf', alpha: 0.12 })
  const letter = new THREE.Mesh(new THREE.PlaneGeometry(LETTER_W, LETTER_L), new THREE.MeshStandardMaterial({ color: PALETTE.letter, map: letterTex, roughness: 0.9 }))
  letter.position.set(0, LETTER_REST_Y, LIFT.letter)
  letter.userData.hit = 'letterEdge'
  envelope.add(letter)

  // Tái bút — mẩu giấy nhỏ giấu dưới mặt bì (lift thấp hơn backPanel), nằm trong chiều dài phong bì
  // nên bị che hoàn toàn tới khi trượt sang ngang (local X) thò ra khỏi mép bì
  const PS_REST_X = ENV_W * 0.22
  const PS_SLIDE_X = 0.3
  const psTex = makeNoiseTexture({ base: '#fdf8ee', fiber: '#efe5cf', alpha: 0.1 })
  const postscript = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.2), new THREE.MeshStandardMaterial({ color: PALETTE.letter, map: psTex, roughness: 0.9 }))
  postscript.position.set(PS_REST_X, -ENV_L * 0.3, LIFT.postscript)
  postscript.userData.hit = 'postscript'
  envelope.add(postscript)

  scene.add(envelope)

  // Chiều cao khung nhìn (đơn vị thế giới) ở zoom = 1 — đủ thấy hết chiều cao phòng (ROOM.height)
  // kèm margin, để Cảnh A luôn giữ đèn + phong bì trong khung (yêu cầu §1).
  const BASE_VIEW_H = ROOM.height * 1.3
  let currentZoom = SHOT_WIDE.zoom
  function applyProjection() {
    const el = canvas.clientWidth || canvas.width || 1
    const eh = canvas.clientHeight || canvas.height || 1
    const aspect = el / eh
    const viewH = BASE_VIEW_H
    const viewW = viewH * aspect
    camera.left = (-viewW / 2) * 1
    camera.right = (viewW / 2) * 1
    camera.top = viewH / 2
    camera.bottom = -viewH / 2
    camera.zoom = currentZoom
    camera.updateProjectionMatrix()
  }

  function resize(width, height) {
    renderer.setSize(width, height, false)
    applyProjection()
    render()
  }

  function render() {
    renderer.render(scene, camera)
  }
  applyProjection()
  render()

  function worldToScreen(worldPoint) {
    const v = new THREE.Vector3(worldPoint.x, worldPoint.y, worldPoint.z).project(camera)
    const w = canvas.clientWidth || canvas.width
    const h = canvas.clientHeight || canvas.height
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h }
  }

  function letterWorldOrigin() {
    return letter.getWorldPosition(new THREE.Vector3())
  }

  function letterAxisWorld() {
    // local +Y của envelope (trục lá thư trượt ra) chiếu sang world bằng normalMatrix của envelope
    const axisLocal = new THREE.Vector3(0, 1, 0)
    return axisLocal.applyQuaternion(envelope.quaternion).normalize()
  }

  function getDragAxisScreen() {
    const origin = letterWorldOrigin()
    const axis = letterAxisWorld()
    return projectAxisToScreen(worldToScreen, { x: origin.x, y: origin.y, z: origin.z }, { x: axis.x, y: axis.y, z: axis.z })
  }

  // Khoảng cách màn hình (px) tương ứng với quãng trượt hết SLIDE_DISTANCE — dùng để quy đổi
  // delta con trỏ (px) thành tiến độ 0..1 (xem computeDragProgress).
  function getSlideDistancePx() {
    const origin = letterWorldOrigin()
    const axis = letterAxisWorld()
    const o = worldToScreen({ x: origin.x, y: origin.y, z: origin.z })
    const tip = worldToScreen({ x: origin.x + axis.x * SLIDE_DISTANCE, y: origin.y + axis.y * SLIDE_DISTANCE, z: origin.z + axis.z * SLIDE_DISTANCE })
    return Math.hypot(tip.x - o.x, tip.y - o.y)
  }

  function setLetterProgress(t) {
    letter.position.y = LETTER_REST_Y + t * SLIDE_DISTANCE
    render()
  }

  function setFlapOpen(t) {
    flapPivot.rotation.x = t * (Math.PI * 0.72)
    render()
  }

  function setPostscriptProgress(t) {
    postscript.position.x = PS_REST_X + t * PS_SLIDE_X
    render()
  }

  // Góc chiếu màn hình (bounding box) của lá thư — để lớp đọc HTML căn khớp vị trí/kích thước
  // (yêu cầu §Cảnh C: "căn khớp với vị trí, kích thước và màu của tờ giấy 3D").
  function getLetterScreenRect() {
    const geo = letter.geometry
    geo.computeBoundingBox()
    const corners = [
      new THREE.Vector3(geo.boundingBox.min.x, geo.boundingBox.min.y, 0),
      new THREE.Vector3(geo.boundingBox.max.x, geo.boundingBox.min.y, 0),
      new THREE.Vector3(geo.boundingBox.max.x, geo.boundingBox.max.y, 0),
      new THREE.Vector3(geo.boundingBox.min.x, geo.boundingBox.max.y, 0),
    ].map((p) => letter.localToWorld(p.clone()))
    const pts = corners.map((p) => worldToScreen({ x: p.x, y: p.y, z: p.z }))
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    const left = Math.min(...xs)
    const top = Math.min(...ys)
    return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top }
  }

  // Điểm màn hình của đèn/phong bì ở khung hình hiện tại — dùng để đặt nút hướng dẫn HTML đúng vị
  // trí vật thể (yêu cầu §Cảnh A/B: nút nằm "gần công tắc" / theo đúng phong bì).
  function getLampScreenPoint() {
    const mid = new THREE.Vector3(0, LAMP_CFG.height * 0.52, 0)
    return worldToScreen(lamp.localToWorld(mid))
  }
  function getEnvelopeScreenPoint() {
    return worldToScreen(flapPivot.getWorldPosition(new THREE.Vector3()))
  }

  function hitTest(ndcX, ndcY) {
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera)
    const hits = raycaster.intersectObjects([lamp, envelope], true)
    for (const h of hits) {
      const tag = h.object.userData?.hit
      if (tag) return tag
    }
    return null
  }

  let cancelCurrent = null
  function stopCurrent() {
    cancelCurrent?.()
    cancelCurrent = null
  }

  function animateLightUp(onDone) {
    stopCurrent()
    const fromAmbient = ambient.color.clone()
    const toAmbient = new THREE.Color(PALETTE.wall)
    const fromIntensity = ambient.intensity
    cancelCurrent = tween({
      duration: 900,
      reducedMotion,
      onUpdate: (t) => {
        // Giấy đèn sáng lên trước (0-45%), rồi môi trường mới nâng sáng dần (yêu cầu Cảnh A)
        const lampT = Math.min(1, t / 0.45)
        const ambientT = Math.max(0, (t - 0.3) / 0.7)
        const easedAmbientT = easeInOutCubic(ambientT)
        lampLight.intensity = easeOutCubic(lampT) * 1.8
        lampPlaneMat.color.copy(LAMP_DARK).lerp(LAMP_LIT, easeOutCubic(lampT))
        glow.material.opacity = easeOutCubic(lampT) * 0.85
        ambient.color.copy(fromAmbient).lerp(toAmbient, easedAmbientT)
        ambient.intensity = fromIntensity + (0.85 - fromIntensity) * easedAmbientT
        render()
      },
      onDone: () => {
        cancelCurrent = null
        onDone?.()
      },
    })
  }

  function animateFocusEnvelope(onDone) {
    stopCurrent()
    const fromPos = camera.position.clone()
    const toPos = SHOT_ENVELOPE.position
    const fromTarget = SHOT_WIDE.target.clone()
    const toTarget = SHOT_ENVELOPE.target
    const fromZoom = currentZoom
    const toZoom = SHOT_ENVELOPE.zoom
    cancelCurrent = tween({
      duration: 820,
      reducedMotion,
      onUpdate: (t) => {
        camera.position.copy(fromPos).lerp(toPos, t)
        const target = fromTarget.clone().lerp(toTarget, t)
        camera.lookAt(target)
        currentZoom = fromZoom + (toZoom - fromZoom) * t
        applyProjection()
        render()
      },
      onDone: () => {
        cancelCurrent = null
        // Nắp hé lên sau khi camera đã dừng (yêu cầu Cảnh B)
        tween({
          duration: 420,
          reducedMotion,
          onUpdate: (t) => setFlapOpen(easeOutCubic(t) * 0.42),
          onDone,
        })
      },
    })
  }

  function animateLetterTo(target, onDone) {
    stopCurrent()
    const from = (letter.position.y - LETTER_REST_Y) / SLIDE_DISTANCE
    const duration = target > from ? 400 : 320
    cancelCurrent = tween({
      duration,
      reducedMotion,
      onUpdate: (t) => setLetterProgress(from + (target - from) * easeOutCubic(t)),
      onDone: () => {
        cancelCurrent = null
        onDone?.()
      },
    })
  }

  function animatePostscript(onDone) {
    stopCurrent()
    cancelCurrent = tween({
      duration: 380,
      reducedMotion,
      onUpdate: (t) => setPostscriptProgress(easeOutCubic(t)),
      onDone: () => {
        cancelCurrent = null
        onDone?.()
      },
    })
  }

  function dispose() {
    stopCurrent()
    renderer.dispose()
    scene.traverse((obj) => {
      obj.geometry?.dispose?.()
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      mats.forEach((m) => {
        m?.map?.dispose?.()
        m?.dispose?.()
      })
    })
  }

  return {
    resize,
    render,
    hitTest,
    worldToScreen,
    getDragAxisScreen,
    getSlideDistancePx,
    getLetterScreenRect,
    getLampScreenPoint,
    getEnvelopeScreenPoint,
    setLetterProgress,
    animateLightUp,
    animateFocusEnvelope,
    animateLetterTo,
    animatePostscript,
    cancelAnimation: stopCurrent,
    dispose,
  }
}
