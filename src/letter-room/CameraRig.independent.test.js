import { describe, expect, it } from 'vitest'
import * as T from 'three'
import { CAMERA_SHOTS, createCameraRig } from './CameraRig'

const finite = values => expect(values.every(Number.isFinite)).toBe(true)
const closeVector = (actual, expected) => expect(actual.distanceTo(new T.Vector3(...expected))).toBeLessThan(1e-8)

describe('independent CameraRig contracts', () => {
  it('starts with a perspective first-person room camera', () => {
    const rig = createCameraRig()
    expect(rig.camera).toBeInstanceOf(T.PerspectiveCamera)
    expect(rig.shot).toBe('room')
    closeVector(rig.camera.position, CAMERA_SHOTS.room.eye)
    const direction = rig.camera.getWorldDirection(new T.Vector3())
    expect(direction.y).toBeLessThan(0)
    const expected = new T.Vector3(...CAMERA_SHOTS.room.target).sub(rig.camera.position).normalize()
    expect(direction.distanceTo(expected)).toBeLessThan(1e-8)
    expect(Math.abs(direction.z)).toBeGreaterThan(.9)
    expect(rig.camera.aspect).toBeCloseTo(16 / 9)
    expect(rig.camera.fov).toBeCloseTo(47)
  })

  it('envelope shot is exactly 90 degrees top down with a stable projection', () => {
    const rig = createCameraRig()
    rig.go('envelope', 0, 1000)
    rig.update(1000)
    expect(rig.camera).toBeInstanceOf(T.PerspectiveCamera)
    closeVector(rig.camera.getWorldDirection(new T.Vector3()), [0, -1, 0])
    closeVector(rig.camera.position, CAMERA_SHOTS.envelope.eye)
    const target = new T.Vector3(...CAMERA_SHOTS.envelope.target).project(rig.camera)
    expect(target.x).toBeCloseTo(0, 8)
    expect(target.y).toBeCloseTo(0, 8)
    finite(target.toArray())
  })

  it.each([16 / 9, 4 / 3, 21 / 9])('centers the actual envelope and keeps its bounds inside frame at aspect %s', aspect => {
    const rig = createCameraRig(aspect)
    rig.go('envelope', 0, 1000)
    rig.update(1000)
    expect(rig.camera.fov).toBeCloseTo(34, 6)
    const center = new T.Vector3(.8, 1.75, .35).project(rig.camera)
    expect(center.x).toBeCloseTo(0, 6)
    expect(center.y).toBeCloseTo(0, 6)
    // Physical envelope pocket is 1.42 wide and .99 deep, centered on (.8,1.75,.35).
    for (const x of [-.71, .71]) for (const z of [-.495, .495]) {
      const point = new T.Vector3(.8 + x, 1.75, .35 + z).project(rig.camera)
      finite(point.toArray())
      expect(Math.abs(point.x)).toBeLessThan(.95)
      expect(Math.abs(point.y)).toBeLessThan(.95)
    }
  })

  it.each([16 / 9, 4 / 3, 21 / 9])('all shots and transitions stay finite at aspect %s', aspect => {
    const rig = createCameraRig(aspect)
    let now = 0
    for (const shot of Object.keys(CAMERA_SHOTS)) {
      rig.go(shot, now, 1000)
      for (const elapsed of [0, 1, 250, 500, 750, 999, 1000]) {
        const camera = rig.update(now + elapsed)
        finite(camera.projectionMatrix.elements)
        finite(camera.projectionMatrixInverse.elements)
        finite(camera.matrixWorld.elements)
        expect(Math.abs(camera.projectionMatrix.determinant())).toBeGreaterThan(1e-12)
        finite(new T.Vector3(.3, 1.8, .2).project(camera).toArray())
        finite(rig.readerPose().position.toArray())
        finite(rig.readerPose().quaternion.toArray())
      }
      now += 1000
    }
  })

  it.each([16 / 9, 4 / 3, 21 / 9])('reader paper fills 82 percent of frame height without clipping at aspect %s', aspect => {
    const rig = createCameraRig(aspect)
    rig.go('letter', 0, 1100)
    rig.update(1100)
    const pose = rig.readerPose()
    // Actual scene paper dimensions: 1.27 x .018 x .87, lying in local XZ.
    const corners = [-1, 1].flatMap(x => [-1, 1].map(z =>
      new T.Vector3(x * 1.27 / 2, 0, z * .87 / 2)
        .applyQuaternion(pose.quaternion).add(pose.position).project(rig.camera)))
    const xs = corners.map(p => p.x), ys = corners.map(p => p.y)
    expect((Math.max(...ys) - Math.min(...ys)) / 2).toBeCloseTo(.82, 6)
    expect((Math.max(...xs) + Math.min(...xs)) / 2).toBeCloseTo(0, 6)
    expect((Math.max(...ys) + Math.min(...ys)) / 2).toBeCloseTo(0, 6)
    for (const point of corners) {
      finite(point.toArray())
      expect(Math.abs(point.x)).toBeLessThan(1)
      expect(Math.abs(point.y)).toBeLessThan(1)
      expect(point.z).toBeGreaterThan(-1)
      expect(point.z).toBeLessThan(1)
    }
    expect(pose.position.distanceTo(rig.camera.position)).toBeLessThan(2.7)
  })

  it('locks an arrived shot despite repeated go calls and later frames', () => {
    const rig = createCameraRig()
    rig.go('letter', 0, 500)
    rig.update(500)
    const position = rig.camera.position.clone(), quaternion = rig.camera.quaternion.clone()
    for (const now of [600, 900, 3000]) {
      rig.go('letter', now, 500)
      rig.update(now)
      expect(rig.camera.position.equals(position)).toBe(true)
      expect(rig.camera.quaternion.angleTo(quaternion)).toBeLessThan(1e-7)
      expect(rig.settled(now)).toBe(true)
    }
  })

  it('repeating a destination during travel does not restart the transition', () => {
    const rig = createCameraRig()
    rig.go('slot', 0, 1000)
    rig.update(400)
    rig.go('slot', 400, 1000)
    rig.update(1000)
    expect(rig.settled(1000)).toBe(true)
    closeVector(rig.camera.position, CAMERA_SHOTS.slot.eye)
  })

  it('pause offsets the motion clock without losing its pose', () => {
    const rig = createCameraRig()
    rig.go('switch', 100, 1000)
    rig.update(500)
    const position = rig.camera.position.clone()
    rig.pause(10000)
    rig.update(10500)
    expect(rig.camera.position.distanceTo(position)).toBeLessThan(1e-8)
    expect(rig.settled(10500)).toBe(false)
    rig.update(11100)
    closeVector(rig.camera.position, CAMERA_SHOTS.switch.eye)
  })

  it('zero duration transitions settle immediately with finite matrices', () => {
    const rig = createCameraRig()
    rig.go('envelope', 20, 0)
    rig.update(20)
    expect(rig.settled(20)).toBe(true)
    closeVector(rig.camera.getWorldDirection(new T.Vector3()), [0, -1, 0])
    finite(rig.camera.projectionMatrix.elements)
  })

  it('resize during motion preserves the current camera pose', () => {
    const rig = createCameraRig()
    rig.go('switch', 0, 1000)
    rig.update(400)
    const position = rig.camera.position.clone()
    rig.resize(4 / 3)
    expect(rig.camera.position.distanceTo(position)).toBeLessThan(1e-8)
  })

  it('moving becomes false after arriving', () => {
    const rig = createCameraRig()
    expect(rig.moving).toBe(false)
    rig.go('letter', 0, 500)
    expect(rig.moving).toBe(true)
    rig.update(500)
    expect(rig.settled(500)).toBe(true)
    expect(rig.moving).toBe(false)
  })
})
