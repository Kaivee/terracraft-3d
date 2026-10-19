import * as THREE from 'three';

export class Sky {
  constructor(scene, fogColor = 0x161d18) {
    this.scene = scene;
    this.fogColor = fogColor;
    this.hemi = new THREE.HemisphereLight(0xefe9e2, 0x2a2018, 1.0); // warm sky / dark ground
    this.sun = new THREE.DirectionalLight(0xffe6c4, 1.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 600;
    this.sun.shadow.camera.left = -180;
    this.sun.shadow.camera.right = 180;
    this.sun.shadow.camera.top = 180;
    this.sun.shadow.camera.bottom = -180;
    this.sun.shadow.bias = -0.0004;
    this.ambient = new THREE.AmbientLight(0xefe9e2, 0.35);
    scene.add(this.hemi, this.sun, this.ambient);
    this.stars = this._buildStars();
    scene.add(this.stars);
    this._updateIntensity(45);
  }

  _buildStars() {
    // 500 random points on a big dome (r ~ 1200), opacity 0 until night
    const positions = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      const theta = Math.acos(Math.random());          // 0..π/2 above the horizon
      const phi = Math.random() * Math.PI * 2;
      const r = 1200;
      positions[i * 3]     = r * Math.sin(theta) * Math.cos(phi);
      positions[i * 3 + 1] = r * Math.cos(theta);
      positions[i * 3 + 2] = r * Math.sin(theta) * Math.sin(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xfff2d9,
      size: 1.2,
      transparent: true,
      opacity: 0,
      fog: false,
    });
    return new THREE.Points(geo, mat);
  }

  setSunPosition(az, el) {
    const a = (az * Math.PI) / 180;
    const e = (el * Math.PI) / 180;
    const d = 240;
    this.sun.position.set(
      d * Math.cos(e) * Math.sin(a),
      d * Math.sin(e),
      d * Math.cos(e) * Math.cos(a)
    );
    this._updateIntensity(el);
  }

  _updateIntensity(el) {
    const day = Math.max(0, Math.min(1, el / 25));
    this.hemi.intensity = 0.35 + 0.65 * day;
    this.sun.intensity = 0.4 + 1.6 * day;
    this.stars.material.opacity = 1 - day; // day→0, night→1
    this.scene.background.setHex(day > 0.9 ? this.fogColor : 0x0d0f12); // deeper night tint
  }
}
