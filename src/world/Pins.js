import * as THREE from 'three';
import { store } from '../store';

export class PinsManager {
  constructor(world) {
    this.world = world;
    this.group = new THREE.Group();
    this.world.scene.add(this.group);
    this.entries = new Map();
    this.ray = new THREE.Raycaster();
  }

  sync() {
    const seen = new Set();
    for (const pin of store.pins) {
      seen.add(pin.id);
      let marker = this.entries.get(pin.id);
      if (!marker) {
        const material = new THREE.MeshStandardMaterial({ color: this.colorFor(pin.ownerId), roughness: 0.45 });
        marker = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.54, 12), material);
        marker.userData.pinId = pin.id;
        marker.castShadow = true;
        this.group.add(marker);
        this.entries.set(pin.id, marker);
      }
      marker.position.set(pin.x, pin.y + 0.28, pin.z);
    }
    for (const [id, marker] of this.entries) {
      if (!seen.has(id)) {
        this.group.remove(marker);
        marker.geometry.dispose();
        marker.material.dispose();
        this.entries.delete(id);
      }
    }
  }

  colorFor(ownerId) {
    let hash = 0;
    for (const ch of String(ownerId)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return new THREE.Color().setHSL((hash % 360) / 360, 0.78, 0.55);
  }

  pick() {
    this.ray.setFromCamera({ x: 0, y: 0 }, this.world.camera);
    const hit = this.ray.intersectObjects([...this.entries.values()], false)[0];
    if (!hit) return null;
    const pin = store.pins.find((item) => item.id === hit.object.userData.pinId);
    if (pin) {
      store.selectedPin = pin;
      if (document.pointerLockElement) document.exitPointerLock();
    }
    return pin || null;
  }

  placePoint() {
    const collider = this.world.building.collider;
    if (!collider) return null;
    this.ray.setFromCamera({ x: 0, y: 0 }, this.world.camera);
    const hit = this.ray.intersectObject(collider, false)
      .find((candidate) => candidate.distance >= 1 && candidate.distance <= 35);
    if (!hit || !hit.face || hit.face.normal.y < 0.65 ||
        Math.abs(hit.point.y - store.playerPos.y) > 1.5) return null;
    const { x, y, z } = hit.point;
    if (x < -50 || x > 50 || z < -49 || z > 49) return null;
    return { x, y, z };
  }
}
