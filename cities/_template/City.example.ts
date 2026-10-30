/**
 * 自訂 3D 城市（選用）
 *
 * 想親手蓋自己的城市？把這個檔案改名為 City.ts。
 * 沒有 City.ts 的話，主星會依 city.json 的 scale 與 color 自動長出預設城市。
 *
 * 座標規則：
 *   - 地面是 y = 0，城市中心是 (0, 0, 0)
 *   - 建議蓋在半徑 120（PLOT_RADIUS）、高度 260（MAX_HEIGHT）之內；超過會被等比縮小
 *   - city.json 的 scenes（穿梭機站點）用的是同一套座標
 * 規則：
 *   - 只能 import 'three'、'three/addons/…' 與 '@/kit'
 *   - 出錯時主星會自動改用預設城市，不會讓整個星球壞掉
 *
 * 可以請 Claude Code：「把 City.ts 做成一座漂在雲上的郵局小鎮」
 * 或：「做一座有霓虹燈和高架軌道的賽博龐克都市，第 2 站有人來參觀時招牌會亮」。
 */
import * as THREE from 'three';
import type { CityFactory } from '@/kit';

const city: CityFactory = ({ color }) => {
  const group = new THREE.Group();
  const wall = new THREE.MeshLambertMaterial({ color, flatShading: true });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xff5d8f, flatShading: true });

  // 一棟小房子
  const house = new THREE.Mesh(new THREE.BoxGeometry(30, 22, 26), wall);
  house.position.y = 11;
  group.add(house);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(24, 16, 4), roofMat);
  roof.position.y = 30;
  roof.rotation.y = Math.PI / 4;
  group.add(roof);

  // 會轉的風車
  const fan = new THREE.Mesh(new THREE.BoxGeometry(2, 30, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  fan.position.set(0, 30, 14);
  group.add(fan);

  return {
    object: group,
    update: (t, _dt, info) => {
      fan.rotation.z = t * (info.visited ? 3 : 1); // 有人來參觀時轉得更快
    },
  };
};

export default city;
