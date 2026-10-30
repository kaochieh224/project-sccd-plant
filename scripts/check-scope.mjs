#!/usr/bin/env node
/**
 * 守門員：檢查這次的修改有沒有「越界」。
 *   - 城市 PR：一次只能改一個城市資料夾 cities/<帳號>/
 *   - 框架提案 PR：可以修改核心檔案（背景、母 UI、規則），但必須由老師加上 core 標籤才會通過
 *   - 兩種修改不能混在同一個 PR
 *   - 修改的城市與 PR 作者不同時，只提出警告（老師或同學互相幫忙時可能發生）
 *
 * 本機也可以跑：npm run check-scope
 * 環境變數：BASE_REF（比對的基準，預設 origin/main）、PR_LABELS（逗號分隔）、PR_AUTHOR
 */
import { execSync } from 'node:child_process';

const base = process.env.BASE_REF || 'origin/main';
const labels = (process.env.PR_LABELS || '').split(',').map((s) => s.trim()).filter(Boolean);
const author = (process.env.PR_AUTHOR || '').toLowerCase();
const isCore = labels.includes('core');

// --no-renames：搬移檔案要同時算「刪除舊位置」與「新增新位置」，才擋得住把核心檔搬進自己資料夾
// quotePath=false＋-z：中文檔名不會被轉碼成 "\345..."
const git = (args) =>
  execSync(`git -c core.quotePath=false ${args}`, { encoding: 'utf8' })
    .split('\0')
    .map((s) => s.trim())
    .filter(Boolean);
let files;
try {
  files = git(`diff --name-only --no-renames -z ${base}...HEAD`);
  // 在自己的電腦上執行時，連還沒 commit 的修改也一起檢查
  if (!process.env.CI) {
    const staged = git('diff --name-only --no-renames -z HEAD');
    const untracked = git('ls-files --others --exclude-standard -z');
    files = [...new Set([...files, ...staged, ...untracked])];
  }
} catch {
  console.error(`無法和 ${base} 比對。本機請先執行 git fetch origin。`);
  process.exit(1);
}

if (files.length === 0) {
  console.log('✓ 沒有任何變更');
  process.exit(0);
}

const touchedCities = new Set();
const coreFiles = [];
for (const f of files) {
  const m = f.match(/^cities\/([^/]+)\//);
  if (m && !m[1].startsWith('_')) touchedCities.add(m[1]);
  else coreFiles.push(f);
}

const problems = [];
if (coreFiles.length && touchedCities.size && !isCore) {
  problems.push(
    `這個 PR 同時修改了核心檔案與城市（${[...touchedCities].join('、')}）。\n` +
      '  ➜ 請拆成兩個 PR：一個「框架提案」只改核心，一個「城市」PR 只改自己的資料夾。',
  );
} else if (coreFiles.length && !isCore) {
  problems.push(
    `這是一個「框架提案」PR，修改了核心檔案（背景／母 UI／規則）：\n${coreFiles.map((f) => `    - ${f}`).join('\n')}\n` +
      '  ➜ 框架會影響全班，需要老師審核。老師看過後會加上 core 標籤，這項檢查就會重新執行並通過。\n' +
      '  ➜ 如果你其實只是想改自己的城市、不小心動到核心：請 Claude Code「把這些檔案還原成 main 的版本」。',
  );
}
if (touchedCities.size > 1 && !isCore) {
  problems.push(`一次 PR 只能修改一個城市，這次修改了：${[...touchedCities].join('、')}`);
}

if (author && touchedCities.size === 1 && !touchedCities.has(author) && !isCore) {
  console.warn(`△ 注意：PR 作者 @${author} 修改的是 @${[...touchedCities][0]} 的城市，請確認對方同意。`);
}

if (problems.length) {
  console.error('\n✗ 越界檢查未通過\n');
  for (const p of problems) console.error(`  • ${p}\n`);
  process.exit(1);
}

console.log(`✓ 越界檢查通過：${coreFiles.length ? '框架提案（老師已加上 core 標籤）' : `只修改了 cities/${[...touchedCities][0]}/`}`);
