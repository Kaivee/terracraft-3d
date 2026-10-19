import * as THREE from 'three';
import { thirdPersonCamTarget } from './povMath.js';

const EYE = 1.6, WALK = 12, SPRINT = 26, GRAVITY = 60, JUMP = 10;
const CAM_DIST = 7.5, CAM_HEIGHT = 4.2;

function buildPlayer() {
  const group = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x3e6b5e });
  const limb = new THREE.MeshStandardMaterial({ color: 0x22342a });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xe9dec4 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.5), body);
  torso.position.y = 1.15;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), headMat);
  head.position.y = 2.05;
  group.add(torso, head);

  for (const sx of [-0.22, 0.22]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.9, 0.28), limb);
    leg.position.set(sx, 0.45, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.9, 0.24), limb);
    arm.position.set(sx * 2.7, 1.15, 0);
    group.add(leg, arm);
  }

  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

export class POVController {
  constructor({ camera, domElement, scene, sampleWorldHeight, onExit }) {
    this.camera = camera;
    this.domElement = domElement;
    this.scene = scene || null;
    this.onExit = onExit || (() => {});
    this.sampleWorldHeight = sampleWorldHeight;
    this.active = false;
    this.yaw = 0; this.pitch = 0;
    this.pos = { x: 0, y: 0, z: 0 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.camPos = { x: 0, y: 0, z: 0 };
    this.keys = new Set();
    this.player = this.scene ? buildPlayer() : null;
    if (this.player) this.scene.add(this.player);

    this._onMove = (e) => {
      this.yaw -= e.movementX * 0.0022;
      this.pitch = Math.max(-1.0, Math.min(0.6, this.pitch - e.movementY * 0.0022));
    };
    this._onDown = (e) => this.keys.add(e.code);
    this._onUp = (e) => this.keys.delete(e.code);
    this._onLockChange = () => {
      if (document.pointerLockElement === this.domElement) this._onLock();
      else this._onUnlock();
    };
    this._onLock = () => { this.active = true; };
    this._onUnlock = () => { this.active = false; this._removeListeners(); this.disposePlayer(); this.onExit(); };
  }

  setSpawn(wx, wz) {
    this.pos.x = wx; this.pos.z = wz;
    this.pos.y = this.sampleWorldHeight(wx, wz) + EYE;
    this.vel.y = 0;
    this.yaw = Math.PI / 4; this.pitch = 0;
    this.camPos.x = wx + Math.sin(this.yaw) * CAM_DIST;
    this.camPos.z = wz + Math.cos(this.yaw) * CAM_DIST;
    this.camPos.y = this.pos.y + CAM_HEIGHT;
  }

  enter() {
    this._addListeners();
    try {
      const req = this.domElement.requestPointerLock();
      if (req && typeof req.catch === 'function') {
        req.catch(() => { this.active = false; this._removeListeners(); this.disposePlayer(); this.onExit(); });
      }
    } catch {
      this.active = false;
      this._removeListeners();
      this.disposePlayer();
      this.onExit();
    }
  }

  exit() { if (document.pointerLockElement) document.exitPointerLock(); }
  isActive() { return this.active; }
  setBounds(halfG) { this._halfG = halfG; }

  _addListeners() {
    document.addEventListener('pointerlockchange', this._onLockChange);
    document.addEventListener('mousemove', this._onMove);
    document.addEventListener('keydown', this._onDown);
    document.addEventListener('keyup', this._onUp);
  }

  _removeListeners() {
    document.removeEventListener('pointerlockchange', this._onLockChange);
    document.removeEventListener('mousemove', this._onMove);
    document.removeEventListener('keydown', this._onDown);
    document.removeEventListener('keyup', this._onUp);
  }

  disposePlayer() {
    if (this.player && this.scene) {
      this.scene.remove(this.player);
      this.player.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      this.player = null;
    }
  }

  update(dt) {
    if (!this.active) return;
    const speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? SPRINT : WALK;
    const fwd = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    const right = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const dx = (-fwd * sin + right * cos) * speed * dt;
    const dz = (-fwd * cos - right * sin) * speed * dt;
    const lim = (this._halfG ?? 40);
    const nx = Math.max(-lim, Math.min(lim, this.pos.x + dx));
    const nz = Math.max(-lim, Math.min(lim, this.pos.z + dz));
    const ground = this.sampleWorldHeight(nx, nz);
    if (this.keys.has('Space')) { if (Math.abs(this.pos.y - (ground + EYE)) < 0.05) this.vel.y = JUMP; }
    this.vel.y -= GRAVITY * dt;
    this.pos.x = nx; this.pos.z = nz;
    const ny = this.pos.y + this.vel.y * dt;
    if (ny <= ground + EYE) { this.pos.y = ground + EYE; this.vel.y = 0; }
    else this.pos.y = ny;

    if (this.player) {
      this.player.position.set(this.pos.x, this.pos.y - EYE, this.pos.z);
      if (fwd !== 0 || right !== 0) this.player.rotation.y = Math.atan2(dx, dz);
      else this.player.rotation.y = this.yaw + Math.PI;
    }

    const target = thirdPersonCamTarget(
      this.pos,
      this.yaw,
      CAM_HEIGHT + this.pitch * 2.2,
      CAM_DIST,
      this.sampleWorldHeight
    );
    const k = Math.min(1, dt * 8);
    this.camPos.x += (target.x - this.camPos.x) * k;
    this.camPos.y += (target.y - this.camPos.y) * k;
    this.camPos.z += (target.z - this.camPos.z) * k;
    this.camera.position.set(this.camPos.x, this.camPos.y, this.camPos.z);
    this.camera.lookAt(this.pos.x, this.pos.y, this.pos.z);
  }
}
