#!/usr/bin/env node
/**
 * Claude Code hook：在 Claude 編輯檔案前檢查路徑。
 * 只允許修改 cities/<某個帳號>/ 內的檔案；其他專案檔案一律擋下。
 * 要修改核心（框架提案）時，啟動 Claude Code 前先設定環境變數：SOLAR_CORE=1 claude
 * 詳見 docs/03-框架提案.md
 */
import path from 'node:path';

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  if (process.env.SOLAR_CORE === '1') process.exit(0);

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }
  const file = input?.tool_input?.file_path || input?.tool_input?.notebook_path;
  if (!file) process.exit(0);

  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const rel = path.relative(root, path.resolve(root, file)).split(path.sep).join('/');

  // 專案以外的檔案（例如使用者自己的設定）不在管轄範圍
  if (rel.startsWith('..') || path.isAbsolute(rel)) process.exit(0);

  const m = rel.match(/^cities\/([^/]+)\//);
  if (m && !m[1].startsWith('_')) process.exit(0);

  process.stderr.write(
    `已阻擋：${rel} 是探索者計畫總站的核心檔案（背景、母 UI 或規則）。目前是「地塊模式」，只能修改 cities/<自己的GitHub帳號>/。\n` +
      '如果使用者想改框架：請先確認已經有對應的 Issue，並在 core/ 開頭的 branch 上工作，' +
      '然後請使用者結束 Claude Code，以框架提案模式重新啟動：Mac 用 `SOLAR_CORE=1 claude`，Windows PowerShell 用 `$env:SOLAR_CORE="1"; claude`。流程見 docs/03-框架提案.md。',
  );
  process.exit(2);
});
