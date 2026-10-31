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
import { luminosity, starCoords } from '@/lib/starCatalog';
import type { CityFactory, CityMeta, WorkStage } from '@/lib/types';
import { hash, MAX_HEIGHT, PLANET_RADIUS as R, PLOT_COUNT, PLOT_RADIUS, plotDirection, seeded } from '@/lib/world';
import styles from './Universe.module.css';

export interface CityData {
  meta: CityMeta;
  plot: number;
  stage: WorkStage;
}

const UP = new THREE.Vector3(0, 1, 0);
const NIGHT = { body: '#030712', grid: '#5f9fe8', dot: '#a8d0ff', air: '#3f8cff', airNear: '#a5e4ff', frame: '#cfe6ff', fill: '#0a1226', dust: '#9fc7ff' };
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = (x: number) => 1 - Math.pow(1 - THREE.MathUtils.clamp(x, 0, 1), 3);
/** 超過這個數量，名牌只在指到時出現，不然會蓋滿星球 */
const DENSE_LABELS = 24;
/** 飛行進度到這裡，鏡頭已經在減速：飛行儀表收起，子 UI 開始進場 */
const LAND_AT = 0.72;
/** 大氣與星球邊緣的受光方向（畫面座標）：讓光從標題那一側照過來，形成月牙 */
const RIM_LIGHT = 'vec2(-0.62, 0.78)';

/** 天空：一次畫好的星雲貼圖，貼在整個天球上，鏡頭轉動時才看得出遠近 */
function skyTexture(rand: () => number) {
  const W = 2048;
  const H = 1024;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#02040b';
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  const hues = ['38,72,170', '24,112,150', '84,48,160', '140,52,120'];
  for (let i = 0; i < 110; i++) {
    const u = rand();
    const x = u * W;
    const y = H * (0.5 + 0.2 * Math.sin(u * Math.PI * 2 + 0.6) + (rand() - 0.5) * 0.26);
    const r = 50 + rand() * 230;
    const rgb = hues[Math.floor(rand() * rand() * hues.length)];
    const a = 0.02 + rand() * 0.065;
    // 左右各多畫一次，貼圖接縫才看不出來
    for (const dx of [-W, 0, W]) {
      const grad = g.createRadialGradient(x + dx, y, 0, x + dx, y, r);
      grad.addColorStop(0, `rgba(${rgb},${a})`);
      grad.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = grad;
      g.fillRect(x + dx - r, y - r, r * 2, r * 2);
    }
  }
  // 深色漸層會出現色階，加一層極淡的雜點打散
  g.globalCompositeOperation = 'source-over';
  const img = g.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 3; // seeded() 逐像素用會排出規律的格紋，這裡要真的亂
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
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
function glowFrame(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, fill: THREE.ColorRepresentation = NIGHT.fill) {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: fill, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })));
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
  routeGeo: LineGeometry;
  halo: THREE.Sprite;
  light: number;
  reticle: THREE.LineSegments;
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
  const teleRef = useRef<HTMLDivElement>(null);
  const teleNameRef = useRef<HTMLParagraphElement>(null);
  const teleReadRef = useRef<HTMLParagraphElement>(null);
  const hoverRef = useRef<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [emptyPlot, setEmptyPlot] = useState<number | null>(null);
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
    const onScroll = () => {
      const past = window.scrollY > window.innerHeight * 0.4;
      setScrolled(past);
      if (past && window.matchMedia('(hover: none)').matches) setHover(null); // 觸控沒有「移開」，不清掉面板會留在原地
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [pathname]);

  // 星球上指到哪顆星，首頁的星表也標出那一列
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('starmap:hover', { detail: hover }));
  }, [hover]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isHomeNow = () => !shuttle.get().cityId;
    // data-landed：鏡頭快到了，子 UI 才進場。data-seen：開場看過了，回到首頁不再重播標題動畫
    const root = document.documentElement;
    let landedCity: string | null = null;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setFailed(true);
      root.dataset.landed = '1';
      root.dataset.seen = '1';
      return;
    }
    let pixelRatio = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(pixelRatio);
    mount.appendChild(renderer.domElement);

    let disposed = false;
    const scene = new THREE.Scene();
    const rand = seeded(20261030);
    const skyTex = skyTexture(rand);
    scene.background = skyTex;
    const softDot = softDotTexture();
    const fog = new THREE.Fog(0x030816, 2000, 7000);
    scene.fog = fog;
    const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 20000);
    const animated: ((t: number, dt: number) => void)[] = [];
    // 城市越多，每座的光暈、航線與標記圈就越收斂：5 座時要亮，96 座時不能糊成一片
    const density = Math.min(1, Math.sqrt(12 / Math.max(cities.length, 1)));
    // 星圖的著色器共用：時間、開場掃描的進度（從北極算起的角度）、螢幕像素比
    const shared = { uTime: { value: 0 }, uReveal: { value: 0 }, uPixel: { value: pixelRatio } };

    // 燈光強度不要調暗：同學的 City.ts 多半用受光材質，夜色由星球與天空負責
    scene.add(new THREE.HemisphereLight(0xd8f1ff, 0xffd3e6, 1.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.7);
    sun.position.set(1.2, 2, 1.4).multiplyScalar(R);
    scene.add(sun);

    // ── 主星：深色球體＋發光的經緯線與點陣 ─────────────
    // 經緯線與點陣都低於半徑 R（地塊頂面的高度），才不會穿過城市地面
    const viewVarying = `
      varying vec3 vNormal;
      varying vec3 vView;`;
    const viewVertex = `
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vNormal = normalMatrix * normalize(normal);
      vView = -mv.xyz;
      gl_Position = projectionMatrix * mv;`;
    // 球體不是一塊平的黑：光從一側掠過，邊緣有一圈月牙，才有體積
    scene.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(R - 3, 96, 64),
        new THREE.ShaderMaterial({
          uniforms: { body: { value: new THREE.Color(NIGHT.body) }, rim: { value: new THREE.Color(NIGHT.air) } },
          vertexShader: `${viewVarying}
            void main() {${viewVertex}}`,
          fragmentShader: `${viewVarying}
            uniform vec3 body;
            uniform vec3 rim;
            void main() {
              vec3 n = normalize(vNormal);
              float facing = max(dot(n, normalize(vView)), 0.0);
              float side = smoothstep(-0.5, 0.9, dot(normalize(n.xy + 1e-4), ${RIM_LIGHT}));
              float edge = pow(1.0 - facing, 3.2) * (0.08 + 0.62 * side);
              float day = max(dot(n, normalize(vec3(${RIM_LIGHT}, 0.55))), 0.0);
              gl_FragColor = vec4(body + rim * (edge + day * day * 0.05), 1.0);
              #include <colorspace_fragment>
            }`,
        }),
      ),
    );
    // 經緯線與點陣共用：開場時從北極往南掃開；越靠近球的邊緣越淡，點才不會擠成摩爾紋
    const surfaceChunk = `
      uniform float uReveal;
      float limb(vec3 n, vec3 v) { return smoothstep(0.02, 0.5, dot(normalize(n), normalize(v))); }
      float sweep(float polar) { return smoothstep(uReveal, uReveal - 0.3, polar); }
      float sweepEdge(float polar) { return exp(-pow((polar - uReveal) * 9.0, 2.0)); }`;
    {
      const STEP = THREE.MathUtils.degToRad(3);
      const at = (lat: number, lon: number, out: number[], r = R - 1) => out.push(Math.cos(lat) * Math.cos(lon) * r, Math.sin(lat) * r, Math.cos(lat) * Math.sin(lon) * r);
      const grid: number[] = [];
      const gridWeight: number[] = [];
      const seg = (latA: number, lonA: number, latB: number, lonB: number, w: number) => {
        at(latA, lonA, grid);
        at(latB, lonB, grid);
        gridWeight.push(w, w);
      };
      // 每 30 度一條主線，其餘淡一半，星圖才有層次
      for (let d = -75; d <= 75; d += 15) {
        const lat = THREE.MathUtils.degToRad(d);
        const w = d === 0 ? 0.8 : d % 30 === 0 ? 0.42 : 0.17;
        for (let lon = 0; lon < Math.PI * 2 - 1e-6; lon += STEP) seg(lat, lon, lat, lon + STEP, w);
      }
      for (let d = 0; d < 360; d += 15) {
        const lon = THREE.MathUtils.degToRad(d);
        const w = d % 30 === 0 ? 0.42 : 0.17;
        for (let lat = -Math.PI / 2; lat < Math.PI / 2 - 1e-6; lat += STEP) seg(lat, lon, lat + STEP, lon, w);
      }
      const gridGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(grid, 3));
      gridGeo.setAttribute('normal', new THREE.Float32BufferAttribute(grid, 3));
      gridGeo.setAttribute('aWeight', new THREE.Float32BufferAttribute(gridWeight, 1));
      scene.add(
        new THREE.LineSegments(
          gridGeo,
          new THREE.ShaderMaterial({
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            uniforms: { uReveal: shared.uReveal, color: { value: new THREE.Color(NIGHT.grid) } },
            vertexShader: `${viewVarying}
              attribute float aWeight;
              varying float vWeight;
              varying float vPolar;
              void main() {
                vWeight = aWeight;
                vPolar = acos(clamp(normalize(position).y, -1.0, 1.0));
                ${viewVertex}
              }`,
            fragmentShader: `${viewVarying}
              ${surfaceChunk}
              uniform vec3 color;
              varying float vWeight;
              varying float vPolar;
              void main() {
                float a = vWeight * mix(0.25, 0.8, limb(vNormal, vView)) * sweep(vPolar);
                gl_FragColor = vec4(color + sweepEdge(vPolar) * 0.8, a + sweepEdge(vPolar) * 0.8);
                #include <colorspace_fragment>
              }`,
          }),
        ),
      );

      // 點陣：靠近城市的點染上城市的代表色，作品走得越遠染得越開
      const dots: number[] = [];
      const dotColor: number[] = [];
      const dotSize: number[] = [];
      const DOTS = 9000;
      const golden = Math.PI * (3 - Math.sqrt(5));
      const base = new THREE.Color(NIGHT.dot);
      const lights = cities.map((c) => ({
        dir: new THREE.Vector3(...plotDirection(c.plot)).normalize(),
        color: new THREE.Color(c.meta.color),
        reach: (0.09 + luminosity(c.stage) * 0.045) * (0.6 + 0.4 * density),
      }));
      const tint = new THREE.Color();
      const dir = new THREE.Vector3();
      for (let i = 0; i < DOTS; i++) {
        const lat = Math.asin(1 - (2 * (i + 0.5)) / DOTS);
        const lon = golden * i;
        at(lat, lon, dots);
        dir.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
        tint.copy(base);
        let glow = 0;
        for (const l of lights) {
          const k = 1 - dir.angleTo(l.dir) / l.reach;
          if (k > glow) {
            glow = k;
            tint.copy(base).lerp(l.color, Math.min(1, k * 1.6));
          }
        }
        dotColor.push(tint.r, tint.g, tint.b);
        dotSize.push((1.2 + rand() * 0.7) * (1 + glow * 1.2));
      }
      const dotGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(dots, 3));
      dotGeo.setAttribute('normal', new THREE.Float32BufferAttribute(dots, 3));
      dotGeo.setAttribute('aColor', new THREE.Float32BufferAttribute(dotColor, 3));
      dotGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(dotSize, 1));
      scene.add(
        new THREE.Points(
          dotGeo,
          new THREE.ShaderMaterial({
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            uniforms: { uReveal: shared.uReveal, uTime: shared.uTime, uPixel: shared.uPixel },
            vertexShader: `${viewVarying}
              attribute vec3 aColor;
              attribute float aSize;
              uniform float uPixel;
              varying vec3 vColor;
              varying float vPolar;
              void main() {
                vColor = aColor;
                vPolar = acos(clamp(normalize(position).y, -1.0, 1.0));
                ${viewVertex}
                gl_PointSize = aSize * uPixel;
              }`,
            fragmentShader: `${viewVarying}
              ${surfaceChunk}
              uniform float uTime;
              varying vec3 vColor;
              varying float vPolar;
              void main() {
                if (length(gl_PointCoord - 0.5) > 0.5) discard;
                // 從太空港往外傳的訊號波，很慢，幾乎只在餘光裡感覺得到
                float wave = pow(max(sin(vPolar * 7.0 - uTime * 0.5), 0.0), 18.0);
                float a = (0.42 + wave * 0.5) * limb(vNormal, vView) * sweep(vPolar);
                gl_FragColor = vec4(vColor, a);
                #include <colorspace_fragment>
              }`,
          }),
        ),
      );
    }

    // 大氣光暈：球體外圍往外淡出，受光那一側亮、背光那一側幾乎沒有；鏡頭靠近地表時收掉，才不會把整片天空洗白
    const air = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { color: { value: new THREE.Color(NIGHT.air) }, near: { value: new THREE.Color(NIGHT.airNear) }, fade: { value: 1 } },
      vertexShader: `${viewVarying}
        void main() {${viewVertex}}`,
      fragmentShader: `${viewVarying}
        uniform vec3 color;
        uniform vec3 near;
        uniform float fade;
        void main() {
          vec3 n = normalize(vNormal);
          float d = clamp(abs(dot(n, normalize(vView))) / 0.42, 0.0, 1.0);
          float side = smoothstep(-0.7, 0.85, dot(normalize(n.xy + 1e-4), ${RIM_LIGHT}));
          float a = (pow(d, 3.0) * 0.5 + pow(d, 12.0) * 0.55) * (0.06 + 0.94 * side) * fade;
          gl_FragColor = vec4(mix(color, near, pow(d, 7.0)), a);
          #include <colorspace_fragment>
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
    // 每顆星有自己的大小、色溫與閃爍節奏：多數冷白，少數偏暖
    const starMat = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: { uTime: shared.uTime, uPixel: shared.uPixel },
      vertexShader: `
        attribute vec4 aStar;
        uniform float uTime;
        uniform float uPixel;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float warm = fract(aStar.z * 7.31);
          vColor = warm > 0.86 ? vec3(1.0, 0.82, 0.66) : warm > 0.55 ? vec3(0.72, 0.84, 1.0) : vec3(1.0);
          vAlpha = aStar.y * (0.72 + 0.28 * sin(uTime * (0.4 + aStar.z * 1.6) + aStar.z * 40.0));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aStar.x * uPixel;
        }`,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float a = smoothstep(0.5, 0.05, length(gl_PointCoord - 0.5));
          gl_FragColor = vec4(vColor, a * vAlpha);
          #include <colorspace_fragment>
        }`,
    });
    [
      { n: 3200, size: 1.7, bright: 0.75, radius: 9000, spin: 0.002 },
      { n: 800, size: 2.7, bright: 1, radius: 11000, spin: 0.004 },
      { n: 130, size: 4.6, bright: 1, radius: 13000, spin: 0.007 },
    ].forEach(({ n, size, bright, radius, spin }) => {
      const geo = scatter(n, radius, radius * 1.1);
      const star: number[] = [];
      for (let i = 0; i < n; i++) star.push(size * (0.7 + rand() * 0.6), bright * (0.45 + rand() * 0.55), rand(), 0);
      geo.setAttribute('aStar', new THREE.Float32BufferAttribute(star, 4));
      const stars = new THREE.Points(geo, starMat);
      scene.add(stars);
      animated.push((_t, dt) => (stars.rotation.y += dt * spin));
    });
    const dust = new THREE.Points(
      scatter(400, R * 1.6, R * 2.6),
      new THREE.PointsMaterial({ color: NIGHT.dust, map: softDot, size: 34, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false }),
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
      const pad = glowFrame(new THREE.CylinderGeometry(PLOT_RADIUS + 4, PLOT_RADIUS + 14, 40, 12), color.clone().lerp(new THREE.Color('#ffffff'), 0.25), new THREE.Color(NIGHT.fill).lerp(color, 0.05));
      pad.position.y = -20;
      anchor.add(pad);

      // 光暈：從軌道看，城市是星圖上的一個光點；靠近時在主迴圈裡淡出
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      const light = luminosity(data.stage);
      halo.position.copy(normal).multiplyScalar(R + 40);
      halo.scale.setScalar(PLOT_RADIUS * (1.6 + light * 0.75) * (0.6 + 0.4 * density));
      scene.add(halo);

      // 星圖上的標記圈：外環加四個刻度，慢慢轉，指到時放大
      const ring: number[] = [];
      const RING = PLOT_RADIUS + 42;
      for (let i = 0; i < 72; i++) {
        if (i % 18 < 2) continue; // 留缺口，看起來像儀器上的準星
        const a0 = (i / 72) * Math.PI * 2;
        const a1 = ((i + 1) / 72) * Math.PI * 2;
        ring.push(Math.cos(a0) * RING, 0, Math.sin(a0) * RING, Math.cos(a1) * RING, 0, Math.sin(a1) * RING);
      }
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 36;
        ring.push(Math.cos(a) * (RING + 8), 0, Math.sin(a) * (RING + 8), Math.cos(a) * (RING + 30), 0, Math.sin(a) * (RING + 30));
      }
      const reticle = new THREE.LineSegments(
        new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(ring, 3)),
        new THREE.LineBasicMaterial({ color: color.clone().lerp(new THREE.Color('#ffffff'), 0.35), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      reticle.position.y = 2;
      anchor.add(reticle);

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
      // 虛線＋往前推的 dashOffset，看起來就是訊號沿著航線在流動
      const routeMat = new LineMaterial({ color, linewidth: 1.2, dashed: true, dashSize: 34, gapSize: 58, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
      const route = new Line2(routeGeo, routeMat);
      route.computeLineDistances();
      scene.add(route);
      const routeGlow = new Line2(routeGeo, new LineMaterial({ color, linewidth: 5, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
      routeGlow.visible = false;
      scene.add(routeGlow);
      const ship = new THREE.Mesh(shipGeo, new THREE.MeshBasicMaterial({ color }));
      // 從軌道上看不見船身，船頭帶一團光才知道有船在飛
      const comet = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot, color, transparent: true, opacity: 0.9 * density, blending: THREE.AdditiveBlending, depthWrite: false }));
      comet.scale.setScalar(46 * (0.5 + 0.5 * density));
      ship.add(comet);
      scene.add(ship);

      runtimes.set(meta.id, { data, anchor, normal, routeMat, routeGlow, routeGeo, halo, light, reticle, ship, routePoint });
    });
    const routeSegments = runtimes.values().next().value?.routeGeo.instanceCount ?? 0;

    // 還沒有人認領的地塊：地表上一個個空心小圈，等著被點亮
    {
      const used = new Set(cities.map((c) => c.plot));
      const empty: number[] = [];
      for (let i = 0; i < PLOT_COUNT; i++) {
        if (used.has(i)) continue;
        const [x, y, z] = plotDirection(i);
        empty.push(x * (R + 8), y * (R + 8), z * (R + 8)); // 離地高一點，球緣的圈才不會被球面切掉一半
      }
      const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(empty, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(empty, 3));
      scene.add(
        new THREE.Points(
          geo,
          new THREE.ShaderMaterial({
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            uniforms: { uReveal: shared.uReveal, uPixel: shared.uPixel, color: { value: new THREE.Color(NIGHT.frame) } },
            vertexShader: `${viewVarying}
              uniform float uPixel;
              varying float vPolar;
              void main() {
                vPolar = acos(clamp(normalize(position).y, -1.0, 1.0));
                ${viewVertex}
                gl_PointSize = 9.0 * uPixel;
              }`,
            fragmentShader: `${viewVarying}
              ${surfaceChunk}
              uniform vec3 color;
              varying float vPolar;
              void main() {
                float d = length(gl_PointCoord - 0.5);
                float ring = smoothstep(0.5, 0.44, d) * smoothstep(0.3, 0.36, d);
                gl_FragColor = vec4(color, ring * 0.42 * smoothstep(0.25, 0.6, dot(normalize(vNormal), normalize(vView))) * sweep(vPolar));
                #include <colorspace_fragment>
              }`,
          }),
        ),
      );
    }

    // ── 鏡頭 ───────────────────────────────────────────
    let controls: OrbitControls | null = null;
    const makeControls = (up: THREE.Vector3, target: THREE.Vector3, mode: 'home' | 'city') => {
      controls?.dispose();
      camera.up.copy(up);
      const c = new OrbitControls(camera, renderer.domElement);
      // OrbitControls 會把觸控全部攔下；首頁改回可以上下滑動捲頁，城市裡才把觸控全部交給 3D 環顧
      renderer.domElement.style.touchAction = 'pan-y';
      c.enableDamping = true;
      c.enablePan = false;
      c.enableZoom = false; // 滾輪和上下滑動都留給頁面往下捲；環顧用拖曳
      c.target.copy(target);
      if (mode === 'home') {
        c.autoRotate = !reduce;
        c.autoRotateSpeed = 0.35;
      } else {
        c.rotateSpeed = 0.6;
      }
      c.update();
      controls = c;
    };

    let homeDist = R * 2.85;
    // 首頁把星球往右推、讓它超出畫面一點，左邊留給標題；捲到星表時再往右讓出更多位置
    let offsetOn = !shuttle.get().cityId;
    const parallax = new THREE.Vector2();
    const parallaxGoal = new THREE.Vector2();
    let offsetK = 0.2;
    const applyOffset = () => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      if (!offsetOn) return camera.clearViewOffset();
      if (camera.aspect > 1.2) camera.setViewOffset(w, h, -w * offsetK + parallax.x * 14, parallax.y * 10, w, h);
      else camera.setViewOffset(w, h, parallax.x * 6, -h * 0.13, w, h); // 窄螢幕：標題在上，星球往下
    };
    const resize = () => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      homeDist = R * (camera.aspect < 1.2 ? Math.min(5.8, 2.7 / Math.max(camera.aspect, 0.45)) : 2.85);
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
      if (landedCity !== shuttle.get().cityId) {
        landedCity = null;
        delete root.dataset.landed;
      }
      controls?.dispose();
      controls = null;
      const from = { pos: camera.position.clone(), target: lookTarget.clone(), up: camera.up.clone() };
      const angle = from.pos.clone().normalize().angleTo(to.pos.clone().normalize());
      const secs = reduce ? 0 : THREE.MathUtils.clamp(1.1 + angle * 1.6 + (Math.abs(from.pos.length() - to.pos.length()) / R) * 0.5, 1.1, 4.8);
      flight = { from, to, start: performance.now(), dur: secs * 1000, angle };
      offsetOn = to.mode === 'home';
      applyOffset();
      if (to.mode === 'home') root.dataset.returning = '1';
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
      // 飛行中視角微微張開，抵達時收回，速度感由這裡來
      camera.fov = 40 + Math.sin(Math.PI * e) * (flight.angle > 0.04 ? 16 : 0);
      camera.updateProjectionMatrix();
      const dest = shuttle.get().cityId ? runtimes.get(shuttle.get().cityId!) : undefined;
      if (teleNameRef.current) teleNameRef.current.textContent = dest ? dest.data.meta.name : `${hubName}軌道`;
      if (teleReadRef.current) {
        const alt = Math.max(0, Math.round(camera.position.length() - R));
        const dist = Math.round(camera.position.distanceTo(to.pos));
        teleReadRef.current.textContent = `ALT ${String(alt).padStart(5, '0')}　DST ${String(dist).padStart(5, '0')}`;
      }
      if (teleRef.current) teleRef.current.dataset.on = raw < LAND_AT && flight.dur > 1200 ? '1' : '0';
      if (raw >= LAND_AT) delete root.dataset.returning;
      if (raw >= LAND_AT && to.mode === 'city') {
        landedCity = shuttle.get().cityId;
        root.dataset.landed = '1';
      }
      if (raw >= 1) {
        flight = null;
        camera.fov = 40;
        camera.updateProjectionMatrix();
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
    // 還沒點亮的座標：鏡頭射線打到球面的那一點，離哪個空地塊夠近就算指到（pick 已經把 raycaster 設好了）
    const usedPlots = new Set(cities.map((c) => c.plot));
    const planetBall = new THREE.Sphere(new THREE.Vector3(), R);
    const hitPoint = new THREE.Vector3();
    const plotDir = new THREE.Vector3();
    let emptyHover: number | null = null;
    const emptyMark = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot, color: NIGHT.frame, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    emptyMark.scale.setScalar(70);
    emptyMark.visible = false;
    scene.add(emptyMark);
    const pickEmpty = () => {
      if (!raycaster.ray.intersectSphere(planetBall, hitPoint)) return null;
      hitPoint.normalize();
      for (let i = 0; i < PLOT_COUNT; i++) {
        if (usedPlots.has(i)) continue;
        if (hitPoint.dot(plotDir.fromArray(plotDirection(i))) > 0.9985) return i;
      }
      return null;
    };
    const onMove = (e: PointerEvent) => {
      parallaxGoal.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
      if (shuttle.get().cityId || e.pointerType === 'touch') return;
      const id = pick(e);
      if (id !== hoverRef.current) setHover(id);
      const plot = id ? null : pickEmpty();
      if (plot !== emptyHover) {
        emptyHover = plot;
        setEmptyPlot(plot);
        emptyMark.visible = plot !== null;
        if (plot !== null) emptyMark.position.fromArray(plotDirection(plot)).multiplyScalar(R + 10);
      }
      renderer.domElement.style.cursor = id || plot !== null ? 'pointer' : 'grab';
    };
    const onDown = (e: PointerEvent) => (downAt = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (shuttle.get().cityId || !downAt) return;
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      downAt = null;
      if (moved > 6) return;
      const id = pick(e);
      if (!id && pickEmpty() !== null) return document.getElementById('join')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
      if (!id) return setHover(null);
      if (e.pointerType === 'touch' && hoverRef.current !== id) return setHover(id); // 觸控：第一下看資訊，第二下降落
      router.push(`/cities/${id}/`);
    };
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    // 星表的列被指到：星球轉到那顆星。離開就回到篩選的位置，沒有篩選就恢復自轉
    let focusDir: THREE.Vector3 | null = null;
    const onStarFocus = (e: Event) => {
      const rt = runtimes.get((e as CustomEvent<string | null>).detail ?? '');
      focusDir = rt ? rt.normal.clone().lerp(UP, 0.2).normalize() : filterDir;
      setHover(rt ? rt.data.meta.id : null);
    };
    window.addEventListener('starmap:focus', onStarFocus);
    // 星表的篩選：沒選到的光點暗下去
    let filtered: Set<string> | null = null;
    let filterDir: THREE.Vector3 | null = null;
    let filterDirs: THREE.Vector3[] = [];
    let filterIds: string[] = [];
    let tourId: string | null = null; // 篩選巡遊目前停在哪顆星：航線與名牌跟著亮
    let filterClock = 0;
    const onStarFilter = (e: Event) => {
      const ids = (e as CustomEvent<string[] | null>).detail;
      filtered = ids ? new Set(ids) : null;
      // 轉到第一顆選到的星；不只一顆時在主迴圈裡輪流停留（轉到中間的話，每一顆都可能看不見）
      filterIds = (ids ?? []).filter((id) => runtimes.has(id));
      filterDirs = filterIds.map((id) => runtimes.get(id)!.normal.clone().lerp(UP, 0.2).normalize());
      tourId = filterIds[0] ?? null;
      filterDir = filterDirs[0] ?? null;
      focusDir = filterDir;
      filterClock = 0;
    };
    window.addEventListener('starmap:filter', onStarFilter);

    // ── 開場：經緯線從北極掃開 → 航線一條條射出 → 城市依序點亮。任何操作都可以跳過 ──
    let intro = shuttle.get().cityId || reduce ? 1e3 : 0;
    if (intro) root.dataset.seen = '1';
    const skipIntro = () => {
      intro = 1e3;
      root.dataset.seen = '1';
    };
    window.addEventListener('pointerdown', skipIntro);
    window.addEventListener('wheel', skipIntro, { passive: true });
    window.addEventListener('keydown', skipIntro);
    const ROUTE_START = 1.3;
    const ROUTE_DUR = 0.9;
    const routeStagger = Math.min(0.16, 1.1 / Math.max(cities.length, 1));
    const introDolly = 3.4;

    // ── 主迴圈 ─────────────────────────────────────────
    let frame = 0;
    let last = performance.now();
    let t = 0;
    const tmpA = new THREE.Vector3();
    const tmpB = new THREE.Vector3();
    const proj = new THREE.Vector3();
    let heroBox: DOMRect | null = null;
    let frames = 0;
    let frameTime = 0;
    const cityIds = [...runtimes.keys()];

    const tick = (now: number) => {
      const raw = (now - last) / 1000;
      const dt = Math.min(0.05, raw);
      last = now;
      t += dt;
      intro += Math.min(raw, 0.25); // 開場照真實時間走，掉幀時才不會和標題的進場對不上
      if (intro > 4 && intro < 1e3) root.dataset.seen = '1';
      const s = shuttle.get();
      const w = renderer.domElement.clientWidth;
      const h = renderer.domElement.clientHeight;

      // 撐不住時把解析度往下調，畫面先順再清楚；一直降到 1 倍為止
      if (raw < 0.25) {
        frames++;
        frameTime += raw;
      }
      if (frames === 90) {
        if (frameTime / frames > 1 / 28 && pixelRatio > 1) {
          pixelRatio = Math.max(1, pixelRatio - 0.25);
          renderer.setPixelRatio(pixelRatio);
          shared.uPixel.value = pixelRatio;
          resize();
        }
        frames = 0;
        frameTime = 0;
      }

      shared.uTime.value = t;
      shared.uReveal.value = easeOut(intro / 2.2) * (Math.PI + 0.4);
      if (!reduce) for (const fn of animated) fn(t, dt);
      air.uniforms.fade.value = THREE.MathUtils.smoothstep(camera.position.length(), R * 1.15, R * 1.6);

      if (offsetOn) {
        offsetK += ((window.scrollY > window.innerHeight * 0.4 ? 0.33 : 0.2) - offsetK) * (1 - Math.exp(-dt * 3));
        if (!reduce) parallax.lerp(parallaxGoal, 1 - Math.exp(-dt * 2.5));
        applyOffset();
      }
      if (frames % 30 === 0) heroBox = isHomeNow() ? (document.querySelector('[data-hero-copy]')?.getBoundingClientRect() ?? null) : null;

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
        const lit = visited || hoverRef.current === id || tourId === id;
        const dim = filtered && !filtered.has(id) ? 0.1 : 1;

        // 開場：航線一條條射出，抵達時城市點亮並閃一下
        const order = cityIds.indexOf(id);
        const arrive = ROUTE_START + order * routeStagger + ROUTE_DUR;
        const shot = THREE.MathUtils.clamp((intro - (arrive - ROUTE_DUR)) / ROUTE_DUR, 0, 1);
        rt.routeGeo.instanceCount = shot >= 1 ? routeSegments : Math.floor(easeInOut(shot) * routeSegments);
        rt.ship.visible = shot >= 1;
        rt.anchor.visible = shot >= 1;
        const ignite = shot >= 1 ? 1 + Math.exp(-(intro - arrive) * 3.2) * 2.4 : 0;

        rt.routeMat.opacity = lit ? 1 : (0.16 + rt.light * 0.09) * density * density * dim;
        rt.routeMat.dashOffset = reduce ? 0 : -t * (lit ? 90 : 26);
        rt.routeGlow.visible = lit;
        const far = THREE.MathUtils.smoothstep(camera.position.distanceTo(rt.halo.position), 400, 1600);
        // 光度 1–5 差距要看得出來；最暗的也還是一個光點，不能讓剛起步的作品消失
        rt.halo.material.opacity = far * (lit ? 1 : (0.1 + rt.light * 0.18) * density * dim) * ignite;
        const ringGoal = lit ? 1.14 : 1;
        const ringK = 1 - Math.exp(-dt * 7);
        rt.reticle.scale.setScalar(rt.reticle.scale.x + (ringGoal - rt.reticle.scale.x) * ringK);
        (rt.reticle.material as THREE.LineBasicMaterial).opacity = THREE.MathUtils.smoothstep(camera.position.distanceTo(rt.halo.position), 500, 1300) * (lit ? 1 : 0.32 * density * density * dim);
        if (!reduce) rt.reticle.rotation.y += dt * (lit ? 0.5 : 0.08);

        // 城市名牌：只在首頁、城市面向鏡頭時顯示；不壓到標題
        const label = labelRefs.current[id];
        if (label) {
          rt.anchor.getWorldPosition(proj);
          const facing = tmpA.copy(camera.position).sub(proj).normalize().dot(rt.normal);
          // 名牌放在標記圈的上緣（畫面的上方），正面看城市時才不會蓋在模型上
          tmpB.setFromMatrixColumn(camera.matrixWorld, 1);
          proj.addScaledVector(tmpB, PLOT_RADIUS + 60).project(camera);
          // 文字寬度約 170px：指到的名牌貼著視窗邊留在畫面內，其他的超出就不顯示
          const rawX = ((proj.x + 1) / 2) * w;
          const x = lit ? THREE.MathUtils.clamp(rawX, 96, w - 96) : rawX;
          const y = ((1 - proj.y) / 2) * h;
          const clipped = x < 96 || x > w - 96 || y < 56;
          const overHero = heroBox && x < heroBox.right + 70 && y > heroBox.top - 30 && y < heroBox.bottom + 30;
          const show = !s.cityId && shot >= 1 && facing > 0.12 && proj.z < 1 && !overHero && !clipped && dim === 1 && (lit || (cities.length <= DENSE_LABELS && w >= 700 && window.scrollY < window.innerHeight * 0.4));
          label.style.opacity = show ? '1' : '0';
          label.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`;
        }
      });

      if (flight) stepFlight(now);
      else {
        if (controls) controls.autoRotate = !reduce && !focusDir && !s.cityId;
        if (filterDirs.length > 1 && !hoverRef.current && !reduce) {
          filterClock += dt;
          const at = Math.floor(filterClock / 4) % filterDirs.length;
          filterDir = filterDirs[at];
          focusDir = filterDir;
          tourId = filterIds[at];
        }
        if (focusDir && !s.cityId) {
          const len = camera.position.length();
          camera.position.normalize().lerp(focusDir, reduce ? 1 : 1 - Math.exp(-dt * 2.4)).normalize().multiplyScalar(len);
        }
        if (intro < introDolly && !s.cityId) camera.position.setLength(THREE.MathUtils.lerp(homeDist * 1.32, homeDist, easeOut(intro / introDolly)));
        controls?.update();
      }

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
      window.removeEventListener('starmap:focus', onStarFocus);
      window.removeEventListener('starmap:filter', onStarFilter);
      window.removeEventListener('pointerdown', skipIntro);
      window.removeEventListener('wheel', skipIntro);
      window.removeEventListener('keydown', skipIntro);
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

  return (
    <div className={styles.universe} aria-hidden={!isHome}>
      <div ref={mountRef} className={styles.canvas} />
      <div className={`${styles.film} ${isHome ? styles.filmOn : ''}`} />

      <div ref={teleRef} className={styles.tele} aria-hidden>
        <p style={{ margin: 0 }}>穿梭機航行中</p>
        <p ref={teleNameRef} className={styles.teleName} />
        <p ref={teleReadRef} style={{ margin: 0 }} />
      </div>

      <div className={styles.labels} style={{ opacity: isHome ? 1 : 0 }}>
        {cities.map((c) => (
          <div
            key={c.meta.id}
            ref={(el) => {
              labelRefs.current[c.meta.id] = el;
            }}
            className={`${styles.label} ${hover === c.meta.id ? styles.labelActive : ''}`}
          >
            <span className={styles.labelCode}>{starCoords(c.plot).code}</span>
            {c.meta.name}
          </div>
        ))}
      </div>

      {isHome && (!scrolled || active) && (
        <aside key={active ? active.meta.id : emptyPlot ?? 'idle'} className={`${styles.panel} ${active || emptyPlot !== null ? styles.panelActive : ''}`} aria-live="polite">
          {!active && emptyPlot !== null ? (
            <>
              <p className={styles.panelKicker}>{starCoords(emptyPlot).code}</p>
              <h2 className={styles.panelTitle}>這個座標還沒點亮</h2>
              <p className={styles.goHint}>點一下看怎麼加入星圖</p>
            </>
          ) : active ? (
            <>
              <p className={styles.panelKicker}>
                {starCoords(active.plot).code}　{starCoords(active.plot).ra}　{starCoords(active.plot).dec}
              </p>
              <h2 className={styles.panelTitle}>{active.meta.name}</h2>
              <p className={styles.panelOwner}>
                {active.meta.owner}　/　{active.stage}
              </p>
              <p className={styles.signal}>{active.meta.oneLiner}</p>
              {/* 滑鼠移向面板時光點就離開了，所以只有觸控才需要按鈕；滑鼠直接點光點或星表 */}
              <p className={styles.goHint}>點一下就搭穿梭機降落</p>
              <button type="button" className={styles.go} onClick={() => router.push(`/cities/${active.meta.id}/`)}>
                搭穿梭機降落 →
              </button>
            </>
          ) : (
            <>
              <p className={styles.panelKicker}>
                {cities.length} 個光點　/　{PLOT_COUNT - cities.length} 個座標還沒點亮
              </p>
              <p className={styles.hint}>
                {failed ? '你的瀏覽器無法顯示 3D，請往下捲動打開星表。' : '拖曳旋轉星球。指向光點看作品的一句話，點一下就搭穿梭機降落。'}
              </p>
            </>
          )}
        </aside>
      )}
    </div>
  );
}
