#!/usr/bin/env node
/**
 * 掃描 cities/ 底下每一座城市：
 *   1. 驗證 city.json（作品識別＋穿梭機站點）與 work.json（作品卡）是否符合公版規格
 *   2. 檢查 Page.tsx／City.ts 是否只引用自己資料夾內的檔案與允許的套件
 *   3. 依 GitHub 帳號分配星球上的地塊（固定、不可自選）
 *   4. 產生 src/generated/cities.ts（頁面）與 src/generated/cityModels.ts（3D 城市）
 *
 * 用法：
 *   node scripts/build-registry.mjs           產生註冊表（dev / build 前自動執行）
 *   node scripts/build-registry.mjs --check   只驗證，不寫檔
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CITIES_DIR = path.join(ROOT, 'cities');
const OUT_DIR = path.join(ROOT, 'src', 'generated');
const CHECK_ONLY = process.argv.includes('--check');

// 與 src/lib/world.ts 一致
const PLOT_COUNT = 96;
const SCENE_RANGE = 250; // 鏡頭 x、z 的範圍 ±250（相鄰地塊最近相距約 285，再遠會跑進鄰居的城市）
const SCENE_MAX_Y = 500;

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 單檔 2 MB
const MAX_CITY_BYTES = 8 * 1024 * 1024; // 整座城市 8 MB
const ALLOWED_PACKAGES = ['react', 'next/link', 'three'];
const ALLOWED_PREFIXES = ['three/addons/'];
const ALLOWED_CORE = ['@/kit'];
const ALLOWED_EXT = ['.tsx', '.ts', '.css', '.json', '.md', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif', '.mp4', '.webm', '.woff2'];
const RESERVED = ['Page.tsx', 'Page.module.css', 'City.ts', 'City.example.ts', 'CLAUDE.md', 'README.md'];
const SCALES = ['house', 'village', 'town', 'metropolis'];
const DIRECTIONS = ['技術', '議題', '美學'];
const STAGES = ['前置期', '做到可玩', '做到展出', '送出去', '收成'];

const errors = [];
const warnings = [];
const fail = (id, msg) => errors.push(`✗ [${id}] ${msg}`);
const warn = (id, msg) => warnings.push(`△ [${id}] ${msg}`);
const len = (s) => [...s].length;

/** 32-bit FNV-1a（與 src/lib/world.ts 的 hash 相同） */
function hash(str, seed = 0x811c9dc5) {
  let h = seed >>> 0;
  for (const ch of str) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.name.startsWith('.')) return []; // .DS_Store 等系統檔
    return d.isDirectory() ? walk(p) : [p];
  });
}

function readJson(id, file) {
  try {
    const v = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      fail(id, `${path.basename(file)} 的內容必須是一個物件 { ... }`);
      return null;
    }
    return v;
  } catch (e) {
    fail(id, `${path.basename(file)} 不是合法的 JSON：${e.message}（常見原因：多了最後一個逗號、用了中文引號）`);
    return null;
  }
}

const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n));

function validateMeta(id, meta) {
  const need = ['id', 'name', 'owner', 'oneLiner', 'color', 'scale', 'keywords', 'scenes'];
  for (const k of need) if (!(k in meta)) fail(id, `city.json 缺少欄位「${k}」（可參考 cities/_template/city.json）`);
  const extra = Object.keys(meta).filter((k) => !need.includes(k));
  if (extra.length) fail(id, `city.json 有規格外的欄位：${extra.join(', ')}。想加新欄位請走框架提案（/propose）。`);

  if (meta.id !== id) fail(id, `city.json 的 id 是「${meta.id}」，但資料夾名稱是「${id}」，兩者必須相同。`);
  if (typeof meta.name !== 'string' || !meta.name.trim() || len(meta.name) > 16) fail(id, 'name（作品名稱）必須是 1–16 字');
  if (typeof meta.owner !== 'string' || !meta.owner.trim()) fail(id, 'owner 必須填寫你的名字');
  if (typeof meta.oneLiner !== 'string' || !meta.oneLiner.trim() || len(meta.oneLiner) > 40) fail(id, 'oneLiner 必須填寫一句話作品描述，40 字以內');
  if (typeof meta.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(meta.color)) fail(id, `color 必須是 6 碼 hex，例如 #2b59c3（目前是 ${JSON.stringify(meta.color)}）`);
  if (!SCALES.includes(meta.scale)) fail(id, `scale 只能是 ${SCALES.map((s) => `"${s}"`).join('、')}（一棟房子／村落／城鎮／大都市）`);
  if (!Array.isArray(meta.keywords) || meta.keywords.length > 3 || meta.keywords.some((k) => typeof k !== 'string' || len(k) > 10))
    fail(id, 'keywords 必須是最多 3 個、每個 10 字以內的文字陣列');

  if (!Array.isArray(meta.scenes) || meta.scenes.length < 1 || meta.scenes.length > 8) {
    fail(id, 'scenes（穿梭機站點）必須有 1–8 站');
    return;
  }
  meta.scenes.forEach((s, i) => {
    const at = `scenes 第 ${i + 1} 站`;
    if (!s || typeof s !== 'object') return fail(id, `${at} 格式錯誤`);
    const extraKeys = Object.keys(s).filter((k) => !['name', 'camera', 'target', 'note'].includes(k));
    if (extraKeys.length) fail(id, `${at} 有規格外的欄位：${extraKeys.join(', ')}`);
    if (typeof s.name !== 'string' || !s.name.trim() || len(s.name) > 12) fail(id, `${at} 的 name 必須是 1–12 字`);
    if (s.note !== undefined && (typeof s.note !== 'string' || len(s.note) > 60)) fail(id, `${at} 的 note 必須是 60 字以內`);
    for (const k of ['camera', 'target']) {
      if (!isVec3(s[k])) {
        fail(id, `${at} 的 ${k} 必須是三個數字 [x, y, z]`);
        continue;
      }
      const [x, y, z] = s[k];
      const minY = k === 'camera' ? 1 : -50;
      if (Math.abs(x) > SCENE_RANGE || Math.abs(z) > SCENE_RANGE || y < minY || y > SCENE_MAX_Y)
        fail(id, `${at} 的 ${k} 超出範圍：x、z 要在 ±${SCENE_RANGE} 之間，y 要在 ${minY}–${SCENE_MAX_Y} 之間`);
    }
    if (isVec3(s.camera) && isVec3(s.target) && s.camera.every((v, j) => v === s.target[j])) fail(id, `${at} 的 camera 和 target 不能是同一點`);
  });
}

function validateWork(id, w) {
  const need = ['direction', 'audience', 'competition', 'participation', 'architecture', 'essence', 'stage'];
  const optional = ['oneLinerEn', 'showcaseUrl', 'repoUrl'];
  for (const k of need) if (!(k in w)) fail(id, `work.json 缺少欄位「${k}」（可參考 cities/_template/work.json）`);
  const extra = Object.keys(w).filter((k) => !need.includes(k) && !optional.includes(k));
  if (extra.length) fail(id, `work.json 有規格外的欄位：${extra.join(', ')}。作品卡是公版，想加欄位請走框架提案。`);
  const text = (k, max, label) => {
    if (typeof w[k] !== 'string' || !w[k].trim() || len(w[k]) > max) fail(id, `work.json 的 ${k}（${label}）必須填寫，${max} 字以內`);
  };
  text('audience', 40, '觀眾');
  text('competition', 40, '主攻賽事／類別');
  text('participation', 120, '觀眾怎麼參與');
  text('architecture', 120, '架構差在哪裡');
  text('essence', 120, '拿掉哪個部分就變回傳統');
  if (w.oneLinerEn !== undefined && (typeof w.oneLinerEn !== 'string' || len(w.oneLinerEn) > 120)) fail(id, 'work.json 的 oneLinerEn 必須是 120 字元以內');
  if (!DIRECTIONS.includes(w.direction)) fail(id, `work.json 的 direction 只能是 ${DIRECTIONS.map((x) => `"${x}"`).join('、')}`);
  if (!STAGES.includes(w.stage)) fail(id, `work.json 的 stage 只能是 ${STAGES.map((x) => `"${x}"`).join('、')}`);
  // 這兩個網址會變成全站的連結，只接受 https，避免 javascript: 這類網址
  for (const k of ['showcaseUrl', 'repoUrl']) {
    if (w[k] !== undefined && (typeof w[k] !== 'string' || !/^https:\/\/\S+$/.test(w[k]))) fail(id, `work.json 的 ${k} 必須是 https:// 開頭的網址`);
  }
}

function validateFiles(id, dir) {
  let total = 0;
  for (const f of walk(dir)) {
    const rel = path.relative(dir, f).split(path.sep).join('/');
    const ext = path.extname(f).toLowerCase();
    const size = fs.statSync(f).size;
    total += size;
    if (!ALLOWED_EXT.includes(ext)) fail(id, `不支援的檔案類型：${rel}`);
    if (size > MAX_FILE_BYTES) fail(id, `${rel} 超過 2 MB，請先壓縮（圖片建議轉 .webp）`);
    if (!RESERVED.includes(rel) && /[A-Z\s]/.test(rel)) warn(id, `檔名建議用小寫英數與連字號：${rel}`);
    if (ext === '.css' && !f.endsWith('.module.css')) fail(id, `${rel}：CSS 必須命名為 *.module.css，避免樣式影響別人的城市`);
    if (ext === '.css' && /:global\b/.test(fs.readFileSync(f, 'utf8'))) fail(id, `${rel}：不能使用 :global，它會改到整個網站的樣式`);

    if (ext === '.tsx' || ext === '.ts') {
      const src = fs.readFileSync(f, 'utf8');
      const imports = [
        ...src.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
      ].map((m) => m[1] || m[2] || m[3] || m[4]);
      for (const spec of imports) {
        if (spec.startsWith('.')) {
          const resolved = path.resolve(path.dirname(f), spec);
          if (!resolved.startsWith(dir + path.sep) && resolved !== dir) fail(id, `${rel} 引用了城市資料夾以外的檔案：${spec}`);
        } else if (!ALLOWED_PACKAGES.includes(spec) && !ALLOWED_CORE.includes(spec) && !ALLOWED_PREFIXES.some((pre) => spec.startsWith(pre))) {
          fail(id, `${rel} 引用了「${spec}」。城市只能使用 ${ALLOWED_PACKAGES.join('、')}、three/addons/…、@/kit 與自己資料夾內的檔案；需要新套件請走框架提案。`);
        }
      }
      if (/\bdocument\.body\b|\bdocument\.documentElement\b/.test(src)) warn(id, `${rel} 直接操作 document.body，可能影響整個網站`);
    }
  }
  if (total > MAX_CITY_BYTES) fail(id, `城市總容量 ${(total / 1048576).toFixed(1)} MB，超過 8 MB 上限`);
}

function main() {
  const dirs = fs
    .readdirSync(CITIES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))
    .map((d) => d.name)
    .sort();

  const entries = [];
  for (const id of dirs) {
    const dir = path.join(CITIES_DIR, id);
    if (!/^[a-z0-9](?:[a-z0-9-]{0,38})$/.test(id)) {
      fail(id, '資料夾名稱必須是你的 GitHub 帳號，全部小寫（英數與連字號）');
      continue;
    }
    const metaPath = path.join(dir, 'city.json');
    const workPath = path.join(dir, 'work.json');
    if (!fs.existsSync(metaPath)) {
      fail(id, '缺少 city.json');
      continue;
    }
    if (!fs.existsSync(workPath)) {
      fail(id, '缺少 work.json（作品卡）');
      continue;
    }
    if (!fs.existsSync(path.join(dir, 'Page.tsx'))) fail(id, '缺少 Page.tsx（你的子 UI）');
    const meta = readJson(id, metaPath);
    const work = readJson(id, workPath);
    if (!meta || !work) continue;
    validateMeta(id, meta);
    validateWork(id, work);
    validateFiles(id, dir);
    entries.push({ id, h: hash(id), hasModel: fs.existsSync(path.join(dir, 'City.ts')) });
  }

  // 分配地塊：依雜湊值排序，從 hash % PLOT_COUNT 開始找第一個空位
  if (entries.length > PLOT_COUNT) fail('星球', `城市數量 ${entries.length} 超過地塊上限 ${PLOT_COUNT}，請老師調整 src/lib/world.ts`);
  const taken = new Set();
  for (const e of [...entries].sort((a, b) => a.h - b.h || a.id.localeCompare(b.id))) {
    let p = e.h % PLOT_COUNT;
    while (taken.has(p)) p = (p + 1) % PLOT_COUNT;
    taken.add(p);
    e.plot = p;
  }

  for (const w of warnings) console.warn(w);
  if (errors.length) {
    console.error(`\n城市檢查未通過（${errors.length} 個問題）：\n`);
    for (const e of errors) console.error(e);
    console.error('\n提示：把上面的錯誤訊息貼給 Claude Code，請它修正「自己城市資料夾內」的檔案。\n');
    process.exit(1);
  }

  console.log(`✓ ${entries.length} 座城市通過檢查：${entries.map((e) => e.id).join(', ') || '（尚無）'}`);
  if (CHECK_ONLY) return;

  const header = '// ⚠ 此檔由 scripts/build-registry.mjs 自動產生，請勿手動修改，也不會進入 git。';
  const citiesTs = [
    header,
    "import type { CityEntry, CityMeta, Work } from '@/lib/types';",
    ...entries.flatMap((e, i) => [
      `import Page${i} from '@cities/${e.id}/Page';`,
      `import meta${i} from '@cities/${e.id}/city.json';`,
      `import work${i} from '@cities/${e.id}/work.json';`,
    ]),
    '',
    'export const cities: CityEntry[] = [',
    ...entries.map((e, i) => `  { meta: meta${i} as CityMeta, work: work${i} as Work, plot: ${e.plot}, Page: Page${i} },`),
    '];',
    '',
  ];
  const withModel = entries.filter((e) => e.hasModel);
  // 用動態 import：某座城市的 City.ts 在載入時就出錯，也只會影響那一座城市
  const modelsTs = [
    header,
    "import type { CityFactory } from '@/lib/types';",
    '',
    'export const cityModels: Record<string, () => Promise<{ default: CityFactory }>> = {',
    ...withModel.map((e) => `  ${JSON.stringify(e.id)}: () => import('@cities/${e.id}/City'),`),
    '};',
    '',
  ];
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'cities.ts'), citiesTs.join('\n'));
  fs.writeFileSync(path.join(OUT_DIR, 'cityModels.ts'), modelsTs.join('\n'));
}

main();
