/** 方块人（玩家形象）+ 头顶名牌 */
import * as THREE from 'three';

function shade(hex, f) {
  const n = Number(hex.replace('#', ''));
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return new THREE.Color('rgb(' + r + ',' + g + ',' + b + ')');
}

function makeLabel(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  spr.scale.set(1.6, 0.4, 1);
  spr.renderOrder = 10;
  return spr;
}

export function makeAvatar(name, color) {
  const g = new THREE.Group();
  const main = new THREE.MeshLambertMaterial({ color: new THREE.Color(color) });
  const dark = new THREE.MeshLambertMaterial({ color: shade(color, 0.6) });

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), main);
  head.position.y = 1.6;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.25), main);
  body.position.y = 1.05;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), dark);
  legL.position.set(-0.14, 0.35, 0);
  const legR = legL.clone(); legR.position.x = 0.14;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), dark);
  armL.position.set(-0.37, 1.0, 0);
  const armR = armL.clone(); armR.position.x = 0.37;
  g.add(head, body, legL, legR, armL, armR);

  const label = makeLabel(name);
  label.position.y = 2.4;
  g.add(label);
  g.userData = { name, color };
  return g;
}
