/**
 * 預設城市（核心）：同學沒有寫 City.ts 時，依 city.json 的 scale 與 color 自動長出一座城市。
 * 所有建築合併成一個網格，四十座城市同時存在也不會太重。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CityMeta } from './types';
import { hash, PALETTE, seeded } from './world';

type Piece = THREE.BufferGeometry;

function paint(geo: THREE.BufferGeometry, color: THREE.Color): Piece {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) color.toArray(arr, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

export function buildDefaultCity(meta: CityMeta): THREE.Object3D {
  const rand = seeded(hash(meta.id, 0x2545f491));
  const base = new THREE.Color(meta.color);
  const pick = () => new THREE.Color(PALETTE[Math.floor(rand() * PALETTE.length)]);
  const tint = (c: THREE.Color, l: number) => c.clone().offsetHSL(0, 0, l);
  const pieces: Piece[] = [];

  const box = (w: number, h: number, d: number, x: number, z: number, color: THREE.Color, y = 0, rotY = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.rotateY(rotY);
    g.translate(x, y + h / 2, z);
    pieces.push(paint(g, color));
  };
  const roof = (w: number, h: number, x: number, z: number, y: number, color: THREE.Color, rotY = 0) => {
    const g = new THREE.ConeGeometry(w * 0.75, h, 4);
    g.rotateY(Math.PI / 4 + rotY);
    g.translate(x, y + h / 2, z);
    pieces.push(paint(g, color));
  };
  const tree = (x: number, z: number, s = 1) => {
    const trunk = new THREE.CylinderGeometry(0.9 * s, 1.2 * s, 5 * s, 5);
    trunk.translate(x, 2.5 * s, z);
    pieces.push(paint(trunk, new THREE.Color('#a86b3c')));
    const top = new THREE.ConeGeometry(4.5 * s, 11 * s, 6);
    top.translate(x, 10 * s, z);
    pieces.push(paint(top, new THREE.Color(rand() > 0.5 ? '#7bd389' : '#4fb477')));
  };
  const house = (x: number, z: number, s: number, rotY: number) => {
    const wall = rand() > 0.4 ? base : tint(pick(), 0.15);
    box(16 * s, 12 * s, 14 * s, x, z, wall, 0, rotY);
    roof(16 * s, 9 * s, x, z, 12 * s, tint(pick(), -0.05), rotY);
    box(3.4 * s, 6 * s, 0.6 * s, x + Math.sin(rotY) * 7.2 * s, z + Math.cos(rotY) * 7.2 * s, new THREE.Color('#2a2340'), 0, rotY);
  };

  switch (meta.scale) {
    case 'house': {
      house(0, 0, 2.2, 0);
      box(3, 10, 3, 9, -4, tint(base, -0.15), 26); // 煙囪
      for (let i = 0; i < 9; i++) {
        const a = rand() * Math.PI * 2;
        const r = 50 + rand() * 50;
        tree(Math.cos(a) * r, Math.sin(a) * r, 0.9 + rand() * 0.6);
      }
      box(6, 0.6, 50, 0, 40, new THREE.Color('#f5e6c8')); // 小路
      break;
    }
    case 'village': {
      const n = 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rand() * 0.3;
        const r = 52 + rand() * 18;
        house(Math.cos(a) * r, Math.sin(a) * r, 1 + rand() * 0.4, -a + Math.PI / 2);
      }
      box(10, 4, 10, 0, 0, new THREE.Color('#9aa5b8')); // 水井
      roof(12, 6, 0, 0, 10, base);
      for (let i = 0; i < 14; i++) {
        const a = rand() * Math.PI * 2;
        const r = 20 + rand() * 95;
        tree(Math.cos(a) * r, Math.sin(a) * r, 0.7 + rand() * 0.5);
      }
      break;
    }
    case 'town': {
      const road = new THREE.Color('#5d5677');
      box(220, 0.8, 12, 0, 0, road);
      box(12, 0.8, 220, 0, 0, road);
      for (let gx = -2; gx <= 2; gx++)
        for (let gz = -2; gz <= 2; gz++) {
          if (gx === 0 || gz === 0) continue;
          const x = gx * 40 + (rand() - 0.5) * 6;
          const z = gz * 40 + (rand() - 0.5) * 6;
          if (Math.hypot(x, z) > 115) continue;
          const h = 14 + rand() * 46;
          const w = 18 + rand() * 10;
          box(w, h, w, x, z, rand() > 0.5 ? base : tint(pick(), 0.1));
          if (rand() > 0.5) roof(w, 8, x, z, h, tint(pick(), -0.1));
        }
      for (let i = 0; i < 10; i++) tree((rand() - 0.5) * 200, (rand() - 0.5) * 200, 0.6);
      break;
    }
    case 'metropolis': {
      const neon = PALETTE.map((c) => new THREE.Color(c));
      for (let gx = -5; gx <= 5; gx++)
        for (let gz = -5; gz <= 5; gz++) {
          const x = gx * 20 + (rand() - 0.5) * 4;
          const z = gz * 20 + (rand() - 0.5) * 4;
          const d = Math.hypot(x, z);
          if (d > 112) continue;
          const h = 20 + (1 - d / 120) * 200 * (0.4 + rand() * 0.6);
          const w = 9 + rand() * 7;
          const c = rand() > 0.35 ? tint(base, -0.25 + rand() * 0.2) : neon[Math.floor(rand() * neon.length)];
          if (rand() > 0.8) {
            const cyl = new THREE.CylinderGeometry(w * 0.55, w * 0.65, h, 6);
            cyl.translate(x, h / 2, z);
            pieces.push(paint(cyl, c));
          } else {
            box(w, h, w, x, z, c);
          }
          // 霓虹燈帶
          if (rand() > 0.55) box(w + 0.6, 1.4, w + 0.6, x, z, neon[Math.floor(rand() * neon.length)], h * (0.3 + rand() * 0.6));
          // 天線
          if (h > 140 && rand() > 0.4) box(0.8, 24, 0.8, x, z, new THREE.Color('#ffffff'), h);
        }
      break;
    }
  }

  const merged = mergeGeometries(pieces, false);
  pieces.forEach((p) => p.dispose());
  const mesh = new THREE.Mesh(merged ?? new THREE.BufferGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  const group = new THREE.Group();
  group.add(mesh);
  return group;
}
