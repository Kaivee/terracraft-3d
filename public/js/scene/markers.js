import * as THREE from 'three';
import { formatElevation } from '../core/units.js';

export class Markers {
  constructor(scene, domContainer) {
    this.scene = scene;
    this.domContainer = domContainer;
    this.peakGroup = null;
    this.peakPosWorld = null;
    this.centerGroup = null;
    this._elevMeters = null;
    this._unit = 'm';
    this._badgeVisible = false;

    this.badge = document.createElement('div');
    this.badge.className = 'peak-tag-badge hidden';
    this.badge.innerHTML = '<svg class="icon"><use href="#icon-mountain"/></svg>';
    this.badgeText = document.createElement('span');
    this.badgeText.className = 'peak-text';
    this.badgeText.textContent = 'Peak: 0m';
    this.badge.appendChild(this.badgeText);
    if (domContainer) domContainer.appendChild(this.badge);
  }

  // ── 📍 PEAK MARKER PIN (port of _buildPeakPin 654–690) ──
  buildPeakPin(worldX, worldY, worldZ, elevMeters) {
    this._elevMeters = elevMeters;
    this._badgeVisible = true;
    if (this.badge) this.badge.classList.remove('hidden');

    this.peakGroup = new THREE.Group();
    this.peakGroup.position.set(worldX, worldY, worldZ);

    // Glowing vertical beam line
    const beamGeo = new THREE.CylinderGeometry(0.3, 0.3, 12, 8);
    beamGeo.translate(0, 6, 0);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xa8c43a,
      transparent: true,
      opacity: 0.7,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);

    // Spinning peak ring
    const ringGeo = new THREE.RingGeometry(1.2, 1.8, 16);
    ringGeo.rotateX(-Math.PI / 2);
    ringGeo.translate(0, 12, 0);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xa8c43a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);

    this.peakGroup.add(beam);
    this.peakGroup.add(ring);
    this.scene.add(this.peakGroup);

    this.peakPosWorld = new THREE.Vector3(worldX, worldY + 12.5, worldZ);

    if (this.badgeText) {
      this.badgeText.textContent = `Peak: ${formatElevation(elevMeters, this._unit)}`;
    }
  }

  setBadgeVisible(bool) {
    this._badgeVisible = !!bool;
    if (!this.badge) return;
    this.badge.classList.toggle('hidden', !this._badgeVisible);
  }

  // ── BADGE SCREEN TRACKING (port of _updatePeakBadge 691–714) ──
  updateBadge(camera, unit) {
    if (!this._badgeVisible || !this.peakPosWorld || !this.badge) {
      if (this.badge) this.badge.classList.add('hidden');
      return;
    }

    if (unit !== undefined) this._unit = unit;
    if (this.badgeText) {
      this.badgeText.textContent = `Peak: ${formatElevation(this._elevMeters, this._unit)}`;
    }

    const vec = this.peakPosWorld.clone();
    vec.project(camera);

    // Check if behind camera
    if (vec.z > 1) {
      this.badge.classList.add('hidden');
      return;
    }

    const W = this.domContainer.clientWidth;
    const H = this.domContainer.clientHeight;
    const screenX = (vec.x * 0.5 + 0.5) * W;
    const screenY = (-(vec.y * 0.5) + 0.5) * H;

    this.badge.style.left = `${screenX}px`;
    this.badge.style.top  = `${screenY}px`;
    this.badge.classList.remove('hidden');
  }

  // ── CENTER MARKER (map-center ring + cone, sand 0xd9a05b) ──
  addCenterMarker(x, y, z) {
    if (this.centerGroup) {
      this.scene.remove(this.centerGroup);
      this.centerGroup.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      this.centerGroup = null;
    }

    this.centerGroup = new THREE.Group();
    this.centerGroup.position.set(x, y + 0.2, z);

    const ringGeo = new THREE.RingGeometry(4.2, 5, 48);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xd9a05b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);

    const coneGeo = new THREE.ConeGeometry(1.1, 3.2, 16);
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xd9a05b });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.y = 0.8;

    this.centerGroup.add(ring);
    this.centerGroup.add(cone);
    this.scene.add(this.centerGroup);
  }

  // ── TEARDOWN (port of _clear peak-group/badge section 768–777) ──
  clear() {
    if (this.peakGroup) {
      this.scene.remove(this.peakGroup);
      this.peakGroup.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      this.peakGroup = null;
      this.peakPosWorld = null;
    }

    if (this.centerGroup) {
      this.scene.remove(this.centerGroup);
      this.centerGroup.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      this.centerGroup = null;
    }

    this._elevMeters = null;
    this.setBadgeVisible(false);
  }
}
