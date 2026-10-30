#!/usr/bin/env node
/**
 * 任務進度：檢查同學目前完成到哪一步，並給出下一步。
 *
 *   npm run mission            給人看的進度表
 *   node scripts/mission.mjs --agent
 *       給 Claude Code 看的版本。由 .claude/settings.json 的 SessionStart hook
 *       在每次啟動 Claude Code 時自動執行，輸出會成為 Claude 的開場資訊，
 *       讓 Claude 主動引導同學完成下一個任務。
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AGENT = process.argv.includes('--agent');

const sh = (cmd, timeout = 2500) => {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};
const read = (p) => {
  try {
    return fs.readFileSync(path.join(ROOT, p), 'utf8');
  } catch {
    return null;
  }
};
const json = (p) => {
  try {
    return JSON.parse(read(p));
  } catch {
    return null;
  }
};

// ── 找出同學的 GitHub 帳號 ─────────────────────────────
const ghUser = sh('gh api user --jq .login')?.toLowerCase() || null;
const ghAuthed = Boolean(ghUser);
const gitName = sh('git config user.name')?.toLowerCase() || null;
const cityDirs = fs.existsSync(path.join(ROOT, 'cities'))
  ? fs.readdirSync(path.join(ROOT, 'cities')).filter((d) => !d.startsWith('_') && !d.startsWith('.'))
  : [];
const id = ghUser || (gitName && cityDirs.includes(gitName) ? gitName : null);
const dir = id ? `cities/${id}` : null;

// ── 範本內容：還沒改掉就代表還沒完成 ──────────────────
const tplMeta = json('cities/_template/city.json') || {};
const tplProposal = json('cities/_template/proposal.json') || {};
const meta = dir ? json(`${dir}/city.json`) : null;
const proposal = dir ? json(`${dir}/proposal.json`) : null;
const page = dir ? read(`${dir}/Page.tsx`) : null;
const notes = dir ? read(`${dir}/CLAUDE.md`) : null;

const metaDone =
  meta && meta.name !== tplMeta.name && meta.owner !== tplMeta.owner && meta.goodwill !== tplMeta.goodwill && !/＿/.test(meta.goodwill || '');
const proposalDone =
  proposal && ['title', 'audience', 'problem', 'action', 'impact'].every((k) => proposal[k] && proposal[k] !== tplProposal[k]) &&
  JSON.stringify(proposal.steps) !== JSON.stringify(tplProposal.steps);
const notesDone = notes && /我想幫助的對象：[^\S\n]*\S/.test(notes) && /登陸後的第一印象[^：\n]*：[^\S\n]*\S/.test(notes);
const pageDone = page && !page.includes('這裡還是一片空地');
const hasModel = dir && fs.existsSync(path.join(ROOT, dir, 'City.ts'));
const scenesDone = meta && Array.isArray(meta.scenes) && JSON.stringify(meta.scenes) !== JSON.stringify(tplMeta.scenes);

const prCount = ghAuthed ? Number(sh('gh pr list --author @me --state all --json number --jq length') ?? 0) : null;
const repoName = ghAuthed ? sh('gh repo view --json nameWithOwner --jq .nameWithOwner') : null;
const reviewCount = repoName ? Number(sh(`gh search prs --repo ${repoName} --reviewed-by @me --json number --jq length`) ?? 0) : null;
const proposeCount = ghAuthed
  ? Number(sh('gh issue list --author @me --label framework --state all --json number --jq length') ?? 0)
  : null;

const branch = sh('git branch --show-current');
const dirty = sh('git status --porcelain');

// ── 任務清單 ───────────────────────────────────────────
const missions = [
  { key: 'env', title: '準備環境', done: fs.existsSync(path.join(ROOT, 'node_modules')), how: '執行 npm install' },
  { key: 'gh', title: '連上 GitHub', done: ghAuthed, how: '請同學在終端機執行 gh auth login（見 docs/00-從零開始.md 步驟 4）' },
  { key: 'create', title: '領取地塊、建立城市', done: Boolean(dir && fs.existsSync(path.join(ROOT, dir))), how: '執行 /new-city' },
  { key: 'meta', title: '城市識別 city.json', done: Boolean(metaDone), how: '用選擇題引導同學決定城市名稱、規模、顏色、善意一句話' },
  { key: 'proposal', title: '寫下善意企劃 proposal.json', done: Boolean(proposalDone), how: '一次一題訪談同學：對象、問題、行動、改變、步驟；用同學的話寫，不要代想' },
  { key: 'notes', title: '寫給 Claude 的設計意圖 CLAUDE.md', done: Boolean(notesDone), how: '依訪談內容填寫城市資料夾裡的 CLAUDE.md' },
  { key: 'pr', title: '送出第一個 PR（讓城市出現在星球上）', done: prCount === null ? false : prCount > 0, how: '執行 /submit；這時城市用預設模型也沒關係' },
  { key: 'model', title: '親手蓋城市 City.ts', done: Boolean(hasModel), how: '先請同學描述城市的樣子與尺度（一棟房子到大都市都可以），再依 City.example.ts 實作' },
  { key: 'scenes', title: '設計穿梭機路線 scenes', done: Boolean(scenesDone), how: '和同學一起決定參觀者依序會看到哪些景色，每站一個鏡頭位置；用 npm run dev 實際飛一次調整' },
  { key: 'page', title: '設計降落後的子 UI Page.tsx', done: Boolean(pageDone), how: '先給 3 個版面方向讓同學選，再實作；可用 useShuttle() 讓內容跟著站點改變' },
];
const extras = [
  { key: 'review', title: '幫一位同學 review PR', done: reviewCount ? reviewCount > 0 : false, how: '用 gh pr list 找同學的 PR，引導同學留下具體、友善的回饋' },
  { key: 'propose', title: '提出一個框架提案', done: proposeCount ? proposeCount > 0 : false, how: '執行 /propose' },
];
const next = missions.find((m) => !m.done) || extras.find((m) => !m.done) || null;
const doneCount = missions.filter((m) => m.done).length;

// ── 輸出 ───────────────────────────────────────────────
const line = (m) => `${m.done ? '✓' : '□'} ${m.title}`;

if (!AGENT) {
  console.log(`\n善意星系　任務進度　${doneCount}/${missions.length}${id ? `　@${id}` : ''}\n`);
  missions.forEach((m, i) => console.log(`  ${String(i + 1).padStart(2, '0')} ${line(m)}`));
  console.log('\n  加分任務');
  extras.forEach((m) => console.log(`     ${line(m)}`));
  console.log(next ? `\n下一步：${next.title}（${next.how}）\n` : '\n全部完成！可以繼續擴建你的城市，或幫同學 review PR。\n');
  process.exit(0);
}

const out = [
  '【善意星系：市長任務進度（由 SessionStart hook 自動產生）】',
  `GitHub 帳號：${id ? `@${id}` : '尚未確認（gh 未登入，請詢問同學）'}　城市資料夾：${dir ?? '尚未建立'}`,
  `目前分支：${branch ?? '未知'}${dirty ? '　（有尚未 commit 的修改）' : ''}`,
  `必要任務 ${doneCount}/${missions.length}：`,
  ...missions.map((m, i) => `  ${String(i + 1).padStart(2, '0')} ${line(m)}`),
  '加分任務：',
  ...extras.map((m) => `     ${line(m)}`),
  '',
  next ? `下一個任務：「${next.title}」——做法：${next.how}` : '必要任務都完成了：可以建議同學擴建城市、增加站點，或去 review 同學的 PR。',
  '',
  '開場時請這樣做：',
  '1. 用一句話打招呼，並把上面的任務進度表原樣列給同學看。',
  '2. 說明下一個任務是什麼、為什麼要做，用一個選擇題問同學「現在要開始嗎？」或讓他選擇想先做的事。',
  '3. 一次只引導一個任務；每完成一個，重新執行 `npm run mission` 更新進度，再提出下一個。',
  '4. 企劃與設計的內容來自同學，你負責提問、整理、實作，不要替同學決定。',
];
if (branch === 'main' && dirty) out.push('⚠ 同學在 main 上有未 commit 的修改：開始前先協助他開一個 city/ 開頭的分支。');
if (process.env.SOLAR_CORE === '1') out.push('⚠ 目前是「框架提案模式」（SOLAR_CORE=1）：可以修改核心檔案，請遵守 CLAUDE.md 的框架提案規則，並確認有對應的 Issue。');
console.log(out.join('\n'));
