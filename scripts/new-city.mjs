#!/usr/bin/env node
/**
 * 把作品放上星圖：npm run new-city -- <你的GitHub帳號>
 * 會把 cities/_template 複製成 cities/<帳號>，並填好 id。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = process.argv[2];

if (!raw) {
  console.error('用法：npm run new-city -- <你的GitHub帳號>\n例如：npm run new-city -- kaochieh224');
  process.exit(1);
}
const id = raw.toLowerCase();
if (!/^[a-z0-9](?:[a-z0-9-]{0,38})$/.test(id)) {
  console.error(`「${raw}」不是合法的 GitHub 帳號格式（只能有英數與連字號）`);
  process.exit(1);
}

const src = path.join(ROOT, 'cities', '_template');
const dest = path.join(ROOT, 'cities', id);
if (fs.existsSync(dest)) {
  console.error(`cities/${id} 已經存在，不需要重新建立。`);
  process.exit(1);
}

fs.cpSync(src, dest, { recursive: true, filter: (p) => path.basename(p) !== 'README.md' });
const metaPath = path.join(dest, 'city.json');
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
meta.id = id;
fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');

console.log(`✓ 已建立 cities/${id}/
  下一步：
  1. city.json      決定作品名稱、一句話描述、規模、顏色、穿梭機站點（公版欄位）
  2. work.json      填作品卡：主攻賽事、方向、非傳統三問、階段（公版欄位）
  3. City.example.ts → 改名為 City.ts，蓋作品的 3D 模型（選用）
  4. Page.tsx       降落後的子 UI（完全自由）
  5. CLAUDE.md      告訴 Claude Code 這個地塊想呈現什麼
  6. npm run dev    預覽`);
