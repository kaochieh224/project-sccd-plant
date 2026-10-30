---
name: check
description: 檢查使用者的地塊是否符合公版規格、沒有越界修改。送出 PR 前或使用者說「檢查一下」時使用。
---

# 檢查

1. 執行 `npm run check`（公版規格＋型別）。
2. 執行 `git fetch origin` 後，再執行 `npm run check-scope`（越界檢查）。
3. 有錯誤時：
   - 用一兩句白話說明每個錯誤是什麼意思
   - 只修改 `cities/<使用者帳號>/` 內的檔案來修正
   - 越界檢查失敗（動到核心檔案）時，用 `git checkout origin/main -- <檔案>` 還原，並先告訴使用者你要還原哪些檔案
4. 全部通過後，回報結果，並建議下一步 `/submit`。
