import * as T from "three";
import CameraControls from "camera-controls";
CameraControls.install({ THREE: T });

export const CAMERA_SHOTS = Object.freeze({
  room: {
    eye: [0.4, 2.95, 3.65],
    target: [-0.15, 2.05, -0.15],
    up: [0, 1, 0],
    ortho: 0,
    height:
      new T.Vector3(0.4, 2.95, 3.65).distanceTo(
        new T.Vector3(-0.15, 2.05, -0.15),
      ) * Math.tan(T.MathUtils.degToRad(47 / 2)),
    fov: 47,
  },
  switch: {
    eye: [-0.28, 1.99, 1.92],
    target: [-0.72, 1.89, 0.4],
    up: [0, 1, 0],
    ortho: 0,
    fov: 55,
  },
  envelope: {
    eye: [0.8, 4, 0.35],
    target: [0.8, 1.75, 0.35],
    up: [0, 0, -1],
    ortho: 0,
    fov: 34,
  },
  slot: {
    eye: [1.38, 2.08, 1.61],
    target: [0.72, 1.82, 0.1],
    up: [0, 1, 0],
    ortho: 0,
    fov: 37,
  },
  letter: {
    eye: [0.25, 2.94, 3.7],
    target: [-0.15, 2.35, -0.2],
    up: [0, 1, 0],
    ortho: 0,
    fov: 47,
  },
  reverse: {
    eye: [1.45, 2.65, -1.15],
    target: [0.05, 1.9, 0.02],
    up: [0, 1, 0],
    ortho: 0,
    fov: 52,
  },
  lamp: {
    eye: [0.7, 3.08, 1.75],
    target: [-1, 2.7, -0.25],
    up: [0, 1, 0],
    ortho: 0,
    fov: 46,
  },
});
const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10);
function pose(config) {
  const eye = new T.Vector3(...config.eye),
    target = new T.Vector3(...config.target);
  return {
    eye,
    target,
    quaternion: new T.Quaternion().setFromRotationMatrix(
      new T.Matrix4().lookAt(eye, target, new T.Vector3(...config.up)),
    ),
    ortho: config.ortho,
    fov: config.fov,
    height:
      config.height ||
      eye.distanceTo(target) * Math.tan(T.MathUtils.degToRad(config.fov / 2)),
  };
}
export function createCameraRig(aspect = 16 / 9) {
  const perspective = new T.PerspectiveCamera(47, aspect, 0.05, 80);
  const controls =
    typeof DOMRect === "function" ? new CameraControls(perspective) : null;
  if (controls) controls.enabled = false;
  const orthographic = new T.OrthographicCamera(
    -3.8 * aspect,
    3.8 * aspect,
    3.8,
    -3.8,
    0.05,
    80,
  );
  const blend = new T.Camera(),
    from = pose(CAMERA_SHOTS.room);
  let current = pose(CAMERA_SHOTS.room),
    destination = pose(CAMERA_SHOTS.room),
    lastTime = 0,
    started = 0,
    duration = 0,
    shot = "room",
    active = orthographic;
  function update(now) {
    lastTime = now;
    const k = duration
      ? ease(Math.min(1, Math.max(0, (now - started) / duration)))
      : 1;
    current = {
      eye: from.eye.clone().lerp(destination.eye, k),
      target: from.target.clone().lerp(destination.target, k),
      quaternion: from.quaternion.clone().slerp(destination.quaternion, k),
      ortho: T.MathUtils.lerp(from.ortho, destination.ortho, k),
      fov: T.MathUtils.lerp(from.fov, destination.fov, k),
      height: T.MathUtils.lerp(from.height, destination.height, k),
    };
    const distance = current.eye.distanceTo(current.target),
      half = current.height;
    perspective.fov = T.MathUtils.radToDeg(
      2 * Math.atan(half / Math.max(0.1, distance)),
    );
    perspective.aspect = aspect;
    perspective.updateProjectionMatrix();
    orthographic.left = -half * aspect;
    orthographic.right = half * aspect;
    orthographic.top = half;
    orthographic.bottom = -half;
    orthographic.updateProjectionMatrix();
    if (current.ortho > 0.99999) active = orthographic;
    else if (current.ortho < 0.00001) active = perspective;
    else {
      active = blend;
      const a = orthographic.projectionMatrix.elements,
        b = perspective.projectionMatrix.elements,
        e = blend.projectionMatrix.elements;
      for (let i = 0; i < 16; i++)
        e[i] = a[i] * current.ortho + (b[i] / distance) * (1 - current.ortho);
      blend.projectionMatrixInverse.copy(blend.projectionMatrix).invert();
    }
    active.position.copy(current.eye);
    active.quaternion.copy(current.quaternion);
    if (controls && active === perspective) {
      perspective.up.set(0, 1, 0).applyQuaternion(current.quaternion);
      controls.updateCameraUp();
      controls.setLookAt(
        current.eye.x,
        current.eye.y,
        current.eye.z,
        current.target.x,
        current.target.y,
        current.target.z,
        false,
      );
      controls.update(0);
      if (k === 1) {
        active.position.copy(destination.eye);
        active.quaternion.copy(destination.quaternion);
      }
    }
    active.updateMatrixWorld();
    return active;
  }
  update(0);
  return {
    get camera() {
      return active;
    },
    get shot() {
      return shot;
    },
    get moving() {
      return lastTime - started < duration;
    },
    resize(value) {
      aspect = value;
      update(lastTime);
    },
    go(next, now, ms = 850) {
      if (next === shot) return;
      update(now);
      Object.assign(from, {
        eye: current.eye.clone(),
        target: current.target.clone(),
        quaternion: current.quaternion.clone(),
        ortho: current.ortho,
        fov: current.fov,
        height: current.height,
      });
      destination = pose(CAMERA_SHOTS[next]);
      started = now;
      duration = ms;
      shot = next;
    },
    update,
    pause(delta) {
      started += delta;
    },
    settled(now) {
      return now - started >= duration;
    },
    dispose() {
      controls?.dispose();
    },
    readerPose() {
      const c = active;
      const d =
        0.87 / (2 * Math.tan(T.MathUtils.degToRad(perspective.fov / 2)) * 0.82);
      return {
        position: c.localToWorld(new T.Vector3(0, 0, -d)),
        quaternion: c.quaternion
          .clone()
          .multiply(
            new T.Quaternion().setFromAxisAngle(
              new T.Vector3(1, 0, 0),
              Math.PI / 2,
            ),
          ),
      };
    },
  };
}
