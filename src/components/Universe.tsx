'use client';

/**
 * 探索者計畫的 3D 星圖（核心元件，常駐於 root layout，整個網站只建立一次）
 *
 * - 主星：夜空中的發光星圖，深色球體上有經緯線與點陣，北極是太空港
 * - 每位同學在地表上有一座城市，從軌道看是一個代表色的光點；太空港到每座城市都有發光航線，接駁船來回飛
 * - 首頁：繞著星球俯瞰，可拖曳旋轉
 * - /cities/<id>/：鏡頭沿著星球表面的弧線飛進城市，停在穿梭機的站點
 * - 換站、換城市都只移動鏡頭，網頁不重新載入
 */
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { cityModels } from '@/generated/cityModels';
import { shuttle } from '@/kit/shuttle';
import { buildDefaultCity } from '@/lib/defaultCity';
import type { CityFactory, CityMeta } from '@/lib/types';
import { hash, MAX_HEIGHT, PLANET_RADIUS as R, PLOT_RADIUS, plotDirection, seeded } from '@/lib/world';
import styles from './Universe.module.css';

export interface CityData {
  meta: CityMeta;
  plot: number;
}

const UP = new THREE.Vector3(0, 1, 0);
const NIGHT = { body: '#050a18', grid: '#4f8fd6', dot: '#8fc4ff', air: '#4a9dff', frame: '#cfe6ff', fill: '#0a1226', dust: '#9fc7ff' };
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function skyTexture() {
  const cv = document.createElement('canvas');
  cv.width = 4;
  cv.height = 512;
  const g = cv.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#0b1f4a');
  grad.addColorStop(0.55, '#050d24');
  grad.addColorStop(1, '#000000');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 512);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 中心亮、邊緣透明的圓點：星塵與城市光暈共用 */
function softDotTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 發光線框：深色實體遮住背後的東西，邊線用疊加混色發光 */
function glowFrame(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: NIGHT.fill, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })));
  group.add(
    new THREE.LineSegments(
      new THREE.EdgesGeometry(geo, 20),
      new THREE.LineBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    ),
  );
  return group;
}

/** 執行同學的 City.ts；太大時等比縮小。出錯回傳 null，改用預設城市。 */
function createCustomCity(meta: CityMeta, factory: CityFactory) {
  try {
    if (typeof factory !== 'function') throw new Error('City.ts 必須 export default 一個函式');
    const handle = factory({ color: new THREE.Color(meta.color), meta });
    if (!handle || !(handle.object instanceof THREE.Object3D)) throw new Error('City.ts 必須回傳 { object: THREE.Object3D }');
    const holder = new THREE.Group();
    holder.add(handle.object);
    const box = new THREE.Box3().setFromObject(handle.object);
    if (!box.isEmpty()) {
      const spread = Math.max(Math.abs(box.min.x), Math.abs(box.max.x), Math.abs(box.min.z), Math.abs(box.max.z));
      const k = Math.min(1, PLOT_RADIUS / Math.max(spread, 1e-3), MAX_HEIGHT / Math.max(box.max.y, 1e-3));
      if (k < 1) {
        holder.scale.setScalar(k);
        console.warn(`[${meta.id}] City.ts 的城市超出地塊（半徑 ${PLOT_RADIUS}、高度 ${MAX_HEIGHT}），已縮小為 ${Math.round(k * 100)}%`);
      }
    }
    return { holder, update: handle.update };
  } catch (err) {
    console.warn(`[${meta.id}] City.ts 發生錯誤，暫時改用預設城市：`, err);
    return null;
  }
}

interface CityRuntime {
  data: CityData;
  anchor: THREE.Object3D;
  normal: THREE.Vector3;
  update?: (t: number, dt: number, info: { visited: boolean; scene: number | null }) => void;
  routeMat: LineMaterial;
  routeGlow: Line2;
  halo: THREE.Sprite;
  ship: THREE.Object3D;
  routePoint: (t: number, out: THREE.Vector3) => THREE.Vector3;
}

export default function Universe({ cities, hubName }: { cities: CityData[]; hubName: string }) {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const focusId = pathname.match(/\/cities\/([^/]+)/)?.[1] ?? null;
  const isHome = !focusId;

  const mountRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const hoverRef = useRef<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  hoverRef.current = hover;

  // 路由 → 穿梭機狀態（網址 #3 代表第 3 站）
  useEffect(() => {
    const city = cities.find((c) => c.meta.id === focusId);
    const readHash = () => {
      const n = Number(window.location.hash.replace('#', '')) - 1;
      return city && Number.isInteger(n) && n >= 0 && n < city.meta.scenes.length ? n : 0;
    };
    shuttle.set({ cityId: city ? city.meta.id : null, count: city ? city.meta.scenes.length : 0, scene: readHash() });
    setHover(null);
    const onHash = () => city && shuttle.set({ scene: readHash() });
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [focusId, cities]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [pathname]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    let disposed = false;
    const scene = new THREE.Scene();
    const skyTex = skyTexture();
    scene.background = skyTex;
    const softDot = softDotTexture();
    const fog = new THREE.Fog(0x030816, 2000, 7000);
    scene.fog = fog;
    const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 20000);
    const rand = seeded(20261030);
    const animated: ((t: number, dt: number) => void)[] = [];

    // 燈光強度不要調暗：同學的 City.ts 多半用受光材質，夜色由星球與天空負責
    scene.add(new THREE.HemisphereLight(0xd8f1ff, 0xffd3e6, 1.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.7);
    sun.position.set(1.2, 2, 1.4).multiplyScalar(R);
    scene.add(sun);

    // ── 主星：深色球體＋發光的經緯線與點陣 ─────────────
    // 經緯線與點陣都低於半徑 R（地塊頂面的高度），才不會穿過城市地面
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(R - 3, 96, 64), new THREE.MeshBasicMaterial({ color: NIGHT.body })));
    {
      const STEP = THREE.MathUtils.degToRad(3);
      const at = (lat: number, lon: number) => [Math.cos(lat) * Math.cos(lon) * (R - 1), Math.sin(lat) * (R - 1), Math.cos(lat) * Math.sin(lon) * (R - 1)];
      const grid: number[] = [];
      for (let d = -75; d <= 75; d += 15) {
        const lat = THREE.MathUtils.degToRad(d);
        for (let lon = 0; lon < Math.PI * 2 - 1e-6; lon += STEP) grid.push(...at(lat, lon), ...at(lat, lon + STEP));
      }
      for (let d = 0; d < 360; d += 15) {
        const lon = THREE.MathUtils.degToRad(d);
        for (let lat = -Math.PI / 2; lat < Math.PI / 2 - 1e-6; lat += STEP) grid.push(...at(lat, lon), ...at(lat + STEP, lon));
      }
      const gridGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(grid, 3));
      const gridMat = new THREE.LineBasicMaterial({ color: NIGHT.grid, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
      scene.add(new THREE.LineSegments(gridGeo, gridMat));

      const dots: number[] = [];
      const DOTS = 6000;
      const golden = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < DOTS; i++) dots.push(...at(Math.asin(1 - (2 * (i + 0.5)) / DOTS), golden * i));
      const dotGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(dots, 3));
      const dotMat = new THREE.PointsMaterial({ color: NIGHT.dot, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
      scene.add(new THREE.Points(dotGeo, dotMat));
    }

    // 大氣光暈：球體外圍往外淡出；鏡頭靠近地表時收掉，才不會把整片天空洗白
    const air = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { color: { value: new THREE.Color(NIGHT.air) }, fade: { value: 1 } },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalMatrix * normal;
          vView = -mv.xyz;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 color;
        uniform float fade;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          float d = abs(dot(normalize(vNormal), normalize(vView)));
          float a = pow(clamp(d / 0.42, 0.0, 1.0), 2.5) * 0.55 * fade;
          gl_FragColor = vec4(color, a);
        }`,
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.1, 64, 48), air));

    // ── 北極太空港（主星的核心） ───────────────────────
    const port = new THREE.Group();
    port.position.set(0, R - 6, 0);
    port.add(glowFrame(new THREE.CylinderGeometry(80, 92, 24, 10), NIGHT.frame));
    const tower = glowFrame(new THREE.CylinderGeometry(10, 16, 120, 6), NIGHT.frame);
    tower.position.y = 72;
    port.add(tower);
    const portRing = glowFrame(new THREE.TorusGeometry(44, 6, 4, 12), NIGHT.frame);
    portRing.rotation.x = Math.PI / 2;
    portRing.position.y = 110;
    port.add(portRing);
    const beacon = glowFrame(new THREE.OctahedronGeometry(18), '#ffffff');
    beacon.position.y = 150;
    port.add(beacon);
    scene.add(port);
    const portTop = new THREE.Vector3(0, R + 140, 0);
    animated.push((t, dt) => {
      portRing.rotation.z += dt * 0.6;
      beacon.rotation.y += dt * 1.2;
      beacon.position.y = 150 + Math.sin(t * 2) * 6;
    });

    // ── 分層星點與星塵 ─────────────────────────────────
    const scatter = (n: number, rMin: number, rMax: number) => {
      const pos: number[] = [];
      const v = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        v.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize().multiplyScalar(rMin + rand() * (rMax - rMin));
        pos.push(v.x, v.y, v.z);
      }
      return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    };
    // 三層星點各轉各的速度，移動鏡頭時才有遠近感；半徑要留在鏡頭 far（20000）之內
    [
      { n: 1400, size: 1.1, opacity: 0.55, radius: 9000, spin: 0.002 },
      { n: 500, size: 1.8, opacity: 0.8, radius: 11000, spin: 0.004 },
      { n: 120, size: 2.8, opacity: 1, radius: 13000, spin: 0.007 },
    ].forEach(({ n, size, opacity, radius, spin }) => {
      const stars = new THREE.Points(
        scatter(n, radius, radius * 1.1),
        new THREE.PointsMaterial({ color: '#ffffff', size, sizeAttenuation: false, transparent: true, opacity, fog: false, depthWrite: false }),
      );
      scene.add(stars);
      animated.push((_t, dt) => (stars.rotation.y += dt * spin));
    });
    const dust = new THREE.Points(
      scatter(400, R * 1.6, R * 2.6),
      new THREE.PointsMaterial({ color: NIGHT.dust, map: softDot, size: 40, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    scene.add(dust);
    animated.push((t, dt) => {
      dust.rotation.y += dt * 0.012;
      dust.rotation.x = Math.sin(t * 0.05) * 0.08;
    });

    // ── 城市 ───────────────────────────────────────────
    const pickables: THREE.Object3D[] = [];
    const shipGeo = new THREE.ConeGeometry(4, 14, 5).rotateX(Math.PI / 2);
    const runtimes = new Map<string, CityRuntime>();
    cities.forEach((data) => {
      const { meta } = data;
      const normal = new THREE.Vector3(...plotDirection(data.plot)).normalize();
      const anchor = new THREE.Object3D();
      anchor.position.copy(normal).multiplyScalar(R);
      anchor.quaternion.setFromUnitVectors(UP, normal);
      anchor.rotateY(((hash(meta.id) % 360) * Math.PI) / 180);
      scene.add(anchor);
      anchor.updateMatrixWorld(true);

      // 地塊：讓城市坐在一塊平台上，邊線用城市代表色；深色的代表色提亮一點才看得到
      const color = new THREE.Color(meta.color);
      const pad = glowFrame(new THREE.CylinderGeometry(PLOT_RADIUS + 4, PLOT_RADIUS + 14, 40, 12), color.clone().lerp(new THREE.Color('#ffffff'), 0.25));
      pad.position.y = -20;
      anchor.add(pad);

      // 光暈：從軌道看，城市是星圖上的一個光點；靠近時在主迴圈裡淡出
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.position.copy(normal).multiplyScalar(R + 40);
      halo.scale.setScalar(PLOT_RADIUS * 3.2);
      scene.add(halo);

      // 先放預設城市；有 City.ts 的話，載入成功後再換成同學自己蓋的城市
      const fallback = buildDefaultCity(meta);
      anchor.add(fallback);
      const load = cityModels[meta.id];
      if (load) {
        load()
          .then((mod) => {
            if (disposed) return;
            const custom = createCustomCity(meta, mod.default);
            if (!custom) return;
            anchor.remove(fallback);
            anchor.add(custom.holder);
            const rt = runtimes.get(meta.id);
            if (rt) rt.update = custom.update;
          })
          .catch((err) => console.warn(`[${meta.id}] City.ts 載入失敗，暫時使用預設城市：`, err));
      }

      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(PLOT_RADIUS * 1.15, 10, 8),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      hit.position.y = 40;
      hit.userData.id = meta.id;
      anchor.add(hit);
      pickables.push(hit);

      // 航線：太空港 → 城市上空，沿著星球表面的弧線
      const cityTop = normal.clone().multiplyScalar(R + 160);
      const a = portTop.clone().normalize();
      const angle = a.angleTo(normal);
      const q = new THREE.Quaternion().setFromUnitVectors(a, normal);
      const qi = new THREE.Quaternion();
      const qId = new THREE.Quaternion();
      const routePoint = (t: number, out: THREE.Vector3) => {
        qi.slerpQuaternions(qId, q, t);
        const radius = THREE.MathUtils.lerp(portTop.length(), cityTop.length(), t) + Math.sin(Math.PI * t) * (80 + angle * 140);
        return out.copy(a).applyQuaternion(qi).multiplyScalar(radius);
      };
      const pts = Array.from({ length: 65 }, (_, i) => routePoint(i / 64, new THREE.Vector3()));
      // WebGL 內建線條只有 1px，要有粗細得用 Line2。光暈線平常不畫，有人參觀或指到才打開
      const routeGeo = new LineGeometry().setPositions(pts.flatMap((p) => [p.x, p.y, p.z]));
      const routeMat = new LineMaterial({ color, linewidth: 1.2, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false });
      scene.add(new Line2(routeGeo, routeMat));
      const routeGlow = new Line2(routeGeo, new LineMaterial({ color, linewidth: 6, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
      routeGlow.visible = false;
      scene.add(routeGlow);
      const ship = new THREE.Mesh(shipGeo, new THREE.MeshBasicMaterial({ color }));
      scene.add(ship);

      runtimes.set(meta.id, { data, anchor, normal, routeMat, routeGlow, halo, ship, routePoint });
    });

    // ── 鏡頭 ───────────────────────────────────────────
    let controls: OrbitControls | null = null;
    const makeControls = (up: THREE.Vector3, target: THREE.Vector3, mode: 'home' | 'city') => {
      controls?.dispose();
      camera.up.copy(up);
      const c = new OrbitControls(camera, renderer.domElement);
      // OrbitControls 會把觸控全部攔下；首頁改回可以上下滑動捲頁，城市裡才把觸控全部交給 3D 環顧
      renderer.domElement.style.touchAction = mode === 'home' ? 'pan-y' : 'none';
      c.enableDamping = true;
      c.enablePan = false;
      c.target.copy(target);
      if (mode === 'home') {
        c.minDistance = R * 1.35;
        c.maxDistance = R * 6;
        c.autoRotate = !reduce;
        c.autoRotateSpeed = 0.35;
      } else {
        c.minDistance = 8;
        c.maxDistance = 700;
        c.rotateSpeed = 0.6;
      }
      c.update();
      controls = c;
    };

    let homeDist = R * 3.8;
    // 首頁在寬螢幕上把星球往右推，讓出左邊的標題
    let offsetOn = !shuttle.get().cityId;
    const applyOffset = () => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      if (offsetOn && camera.aspect > 1.2) camera.setViewOffset(w, h, -w * 0.12, 0, w, h);
      else camera.clearViewOffset();
    };
    const resize = () => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      homeDist = R * (camera.aspect < 1 ? 3.6 / Math.max(camera.aspect, 0.45) : 3.8);
      applyOffset();
      fog.near = homeDist * 0.9;
      fog.far = homeDist * 2.4;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const lookTarget = new THREE.Vector3();
    const lastHomeDir = new THREE.Vector3(0.35, 0.55, 1).normalize();
    camera.position.copy(lastHomeDir).multiplyScalar(homeDist);
    camera.lookAt(0, 0, 0);

    type Pose = { pos: THREE.Vector3; target: THREE.Vector3; up: THREE.Vector3 };
    type Goal = Pose & { mode: 'home' | 'city' };
    const desiredPose = (): Goal => {
      const s = shuttle.get();
      const rt = s.cityId ? runtimes.get(s.cityId) : undefined;
      if (rt) {
        const sc = rt.data.meta.scenes[s.scene] ?? rt.data.meta.scenes[0];
        const target = new THREE.Vector3(...sc.target);
        // 手機直向畫面比較窄，鏡頭自動往後退一點，才看得到同樣的景
        const k = camera.aspect < 1 ? Math.min(1.9, 1 / Math.max(camera.aspect, 0.5)) : 1;
        const pos = new THREE.Vector3(...sc.camera).sub(target).multiplyScalar(k).add(target);
        return {
          mode: 'city',
          pos: rt.anchor.localToWorld(pos),
          target: rt.anchor.localToWorld(target),
          up: rt.normal.clone(),
        };
      }
      // 回到軌道時，停在剛才那座城市的上空
      if (camera.position.length() < R * 2) lastHomeDir.copy(camera.position.clone().normalize().lerp(UP, 0.25).normalize());
      return { mode: 'home', pos: lastHomeDir.clone().multiplyScalar(homeDist), target: new THREE.Vector3(), up: UP.clone() };
    };

    let flight: { from: Pose; to: Goal; start: number; dur: number; angle: number } | null = null;
    const startFlight = () => {
      const to = desiredPose();
      controls?.dispose();
      controls = null;
      const from = { pos: camera.position.clone(), target: lookTarget.clone(), up: camera.up.clone() };
      const angle = from.pos.clone().normalize().angleTo(to.pos.clone().normalize());
      const secs = reduce ? 0 : THREE.MathUtils.clamp(1.1 + angle * 1.6 + (Math.abs(from.pos.length() - to.pos.length()) / R) * 0.5, 1.1, 4.8);
      flight = { from, to, start: performance.now(), dur: secs * 1000, angle };
      offsetOn = to.mode === 'home';
      applyOffset();
    };

    // 換站或換城市時起飛
    let lastKey = `${shuttle.get().cityId}:${shuttle.get().scene}`;
    const unsub = shuttle.subscribe(() => {
      const s = shuttle.get();
      const key = `${s.cityId}:${s.scene}`;
      if (key === lastKey) return;
      lastKey = key;
      startFlight();
      if (s.cityId) history.replaceState(history.state, '', `#${s.scene + 1}`);
    });
    if (shuttle.get().cityId) startFlight();
    else makeControls(UP, lookTarget, 'home');

    const qa = new THREE.Quaternion();
    const qe = new THREE.Quaternion();
    const qIdentity = new THREE.Quaternion();
    const upQ = new THREE.Quaternion();
    const upE = new THREE.Quaternion();
    const stepFlight = (now: number) => {
      if (!flight) return;
      const { from, to } = flight;
      const raw = flight.dur === 0 ? 1 : Math.min(1, (now - flight.start) / flight.dur);
      const e = easeInOut(raw);
      const dA = from.pos.clone().normalize();
      const dB = to.pos.clone().normalize();
      if (flight.angle > 0.04) {
        // 沿著星球表面的弧線飛，不會穿過星球
        qa.setFromUnitVectors(dA, dB);
        qe.slerpQuaternions(qIdentity, qa, e);
        const bump = Math.sin(Math.PI * e) * R * 0.55 * Math.min(1, flight.angle / 1.2);
        camera.position.copy(dA.applyQuaternion(qe)).multiplyScalar(THREE.MathUtils.lerp(from.pos.length(), to.pos.length(), e) + bump);
      } else {
        camera.position.lerpVectors(from.pos, to.pos, e);
      }
      lookTarget.lerpVectors(from.target, to.target, e);
      // 鏡頭的「上方」用旋轉插值，避免飛到星球另一側時中途翻轉
      upQ.setFromUnitVectors(from.up, to.up);
      upE.slerpQuaternions(qIdentity, upQ, e);
      camera.up.copy(from.up).applyQuaternion(upE).normalize();
      camera.lookAt(lookTarget);
      if (raw >= 1) {
        flight = null;
        lookTarget.copy(to.target);
        makeControls(to.up, to.target, to.mode);
      }
    };

    // ── 指標互動（只在首頁） ───────────────────────────
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downAt: { x: number; y: number } | null = null;
    const pick = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      return (raycaster.intersectObjects(pickables, false)[0]?.object.userData.id as string | undefined) ?? null;
    };
    const onMove = (e: PointerEvent) => {
      if (shuttle.get().cityId || e.pointerType === 'touch') return;
      const id = pick(e);
      if (id !== hoverRef.current) setHover(id);
      renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
    };
    const onDown = (e: PointerEvent) => (downAt = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (shuttle.get().cityId || !downAt) return;
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      downAt = null;
      if (moved > 6) return;
      const id = pick(e);
      if (!id) return setHover(null);
      if (e.pointerType === 'touch' && hoverRef.current !== id) return setHover(id); // 觸控：第一下看資訊，第二下降落
      router.push(`/cities/${id}/`);
    };
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    // ── 主迴圈 ─────────────────────────────────────────
    let frame = 0;
    let last = performance.now();
    let t = 0;
    const tmpA = new THREE.Vector3();
    const tmpB = new THREE.Vector3();
    const proj = new THREE.Vector3();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      const s = shuttle.get();
      const w = renderer.domElement.clientWidth;
      const h = renderer.domElement.clientHeight;

      if (!reduce) for (const fn of animated) fn(t, dt);
      air.uniforms.fade.value = THREE.MathUtils.smoothstep(camera.position.length(), R * 1.15, R * 1.6);

      runtimes.forEach((rt, id) => {
        const visited = s.cityId === id;
        if (rt.update) {
          try {
            rt.update(t, dt, { visited, scene: visited ? s.scene : null });
          } catch (err) {
            console.warn(`[${id}] City.ts 的 update 發生錯誤，已停止它的動畫：`, err);
            rt.update = undefined;
          }
        }
        // 接駁船在太空港與城市之間來回
        const period = 14 + (hash(id) % 8);
        const p = reduce ? 0.5 : ((t + (hash(id) % 100) / 10) % period) / period;
        const u = p < 0.5 ? p * 2 : 2 - p * 2;
        rt.routePoint(u, tmpA);
        rt.routePoint(THREE.MathUtils.clamp(u + (p < 0.5 ? 0.01 : -0.01), 0, 1), tmpB);
        rt.ship.position.copy(tmpA);
        rt.ship.lookAt(tmpB);
        const lit = visited || hoverRef.current === id;
        rt.routeMat.opacity = lit ? 1 : 0.4;
        rt.routeGlow.visible = lit;
        rt.halo.material.opacity = THREE.MathUtils.smoothstep(camera.position.distanceTo(rt.halo.position), 400, 1600) * (lit ? 1 : 0.7);

        // 城市名牌：只在首頁、且城市面向鏡頭時顯示
        const label = labelRefs.current[id];
        if (label) {
          rt.anchor.getWorldPosition(proj);
          const facing = tmpA.copy(camera.position).sub(proj).normalize().dot(rt.normal);
          proj.addScaledVector(rt.normal, 150).project(camera);
          const show = !s.cityId && facing > 0.1 && proj.z < 1;
          label.style.opacity = show ? '1' : '0';
          label.style.transform = `translate(-50%, -100%) translate(${((proj.x + 1) / 2) * w}px, ${((1 - proj.y) / 2) * h}px)`;
        }
      });

      if (flight) stepFlight(now);
      else controls?.update();

      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      unsub();
      skyTex.dispose();
      softDot.dispose();
      ro.disconnect();
      controls?.dispose();
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line || o instanceof THREE.Points) o.geometry.dispose();
        if (o instanceof THREE.Mesh || o instanceof THREE.Line || o instanceof THREE.Points || o instanceof THREE.Sprite) {
          const m = o.material as THREE.Material | THREE.Material[];
          (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
    // 城市資料在 build 時就固定，場景只需建立一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = cities.find((c) => c.meta.id === hover) ?? null;
  const scaleName = { house: '一棟房子', village: '村落', town: '城鎮', metropolis: '大都市' } as const;

  return (
    <div className={styles.universe} aria-hidden={!isHome}>
      <div ref={mountRef} className={styles.canvas} />

      <div className={styles.labels} style={{ opacity: isHome ? 1 : 0 }}>
        {cities.map((c) => (
          <div
            key={c.meta.id}
            ref={(el) => {
              labelRefs.current[c.meta.id] = el;
            }}
            className={`${styles.label} ${hover === c.meta.id ? styles.labelActive : ''}`}
          >
            <span className={styles.labelDot} style={{ background: c.meta.color, boxShadow: `0 0 8px ${c.meta.color}` }} />
            {c.meta.name}
          </div>
        ))}
      </div>

      {isHome && !scrolled && (
        <aside className={styles.panel} aria-live="polite">
          {active ? (
            <>
              <p className="label">
                {scaleName[active.meta.scale]}　·　{active.meta.scenes.length} 個站點
              </p>
              <h2 className={styles.panelTitle}>{active.meta.name}</h2>
              <p className={styles.panelOwner}>探索者　{active.meta.owner}</p>
              <p className={styles.signal}>
                <span className={styles.signalMark} aria-hidden />
                {active.meta.oneLiner}
              </p>
              <button type="button" className={styles.go} onClick={() => router.push(`/cities/${active.meta.id}/`)}>
                搭穿梭機降落 →
              </button>
            </>
          ) : (
            <>
              <p className="label">{hubName}　·　太空港接收中</p>
              <p className={styles.stat}>
                <b>{cities.length}</b> 件作品
              </p>
              <p className={styles.hint}>
                {failed ? '你的瀏覽器無法顯示 3D，請往下捲動查看作品名冊。' : '拖曳旋轉星球，指向光點看作品的一句話描述，點選就能搭穿梭機降落。'}
              </p>
            </>
          )}
        </aside>
      )}
    </div>
  );
}
