/**
 * 燈塔港的 3D 城市：一座燈塔、一排小屋、一條碼頭、一片海。
 * 示範 City.ts 怎麼寫：回傳 object（城市模型）與 update（每一格的動畫），
 * 並用 info.scene 讓城市回應參觀者停在哪一站。
 */
import * as THREE from 'three';
import type { CityFactory } from '@/kit';

const city: CityFactory = () => {
  const group = new THREE.Group();
  const m = (color: number) => new THREE.MeshLambertMaterial({ color, flatShading: true });

  // 海：地塊的一半是水
  const sea = new THREE.Mesh(new THREE.CircleGeometry(118, 10, Math.PI * 0.05, Math.PI * 0.9), m(0x3ec1d3));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = 0.6;
  group.add(sea);

  // 碼頭
  const pier = new THREE.Mesh(new THREE.BoxGeometry(12, 3, 70), m(0xc98b4f));
  pier.position.set(10, 2, 55);
  group.add(pier);

  // 小屋
  const roofs = [0xff5d8f, 0xffb627, 0x9b5de5, 0x7bd389];
  for (let i = 0; i < 4; i++) {
    const x = -80 + i * 26;
    const house = new THREE.Mesh(new THREE.BoxGeometry(18, 14, 16), m(0xfff3d1));
    house.position.set(x, 7, -40 + (i % 2) * 8);
    group.add(house);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(14, 10, 4), m(roofs[i]));
    roof.position.set(x, 19, -40 + (i % 2) * 8);
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
  }

  // 燈塔
  const stripes = [0xffffff, 0xff5d8f];
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(9 - i * 0.7, 9.6 - i * 0.7, 14, 8), m(stripes[i % 2]));
    seg.position.y = 7 + i * 14;
    group.add(seg);
  }
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
  const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(6), lampMat);
  lamp.position.y = 96;
  group.add(lamp);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(8, 10, 8), m(0x2a2340));
  cap.position.y = 106;
  group.add(cap);

  // 光束
  const beamPivot = new THREE.Group();
  beamPivot.position.y = 96;
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(14, 110, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.rotation.z = Math.PI / 2;
  beam.position.x = 55;
  beamPivot.add(beam);
  group.add(beamPivot);

  return {
    object: group,
    update: (t, _dt, info) => {
      // 停在「燈室」那一站時，光束放慢，讓人看清楚
      beamPivot.rotation.y = info.scene === 3 ? t * 0.3 : t * 1.2;
      lamp.rotation.y = t;
      lampMat.color.setHex(info.visited ? 0xffd23f : 0xffb627);
    },
  };
};

export default city;
