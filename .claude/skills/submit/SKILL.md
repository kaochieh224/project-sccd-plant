---
name: submit
description: 把使用者的地塊修改送出成 Pull Request。使用者說「送出」「交作業」「開 PR」時使用。每一步都說明在做什麼，讓使用者學會 Git 流程。
---

# 送出 Pull Request

每一步執行前，先用一句話告訴使用者「現在要做什麼、為什麼」，讓他學會這個流程。

1. 先跑 `/check` 的流程，全部通過才能繼續。
2. `git status`：讓使用者看到改了哪些檔案；確認只有 `cities/<帳號>/` 內的檔案。
3. 如果目前在 `main`，建立新 branch：`git switch -c city/<帳號>-<簡短英文描述>`。
4. `git add cities/<帳號>/`（只加自己的資料夾，不要用 `git add .`）。
5. 和使用者一起寫中文 commit 訊息，例如「潮間帶：完成作品卡與 3D 外觀」，然後 `git commit`。
6. `git push -u origin <branch>`。
7. 用 `gh pr create` 開 PR：標題同 commit 訊息，內容依 `.github/pull_request_template.md` 填寫，「我和 Claude Code 的協作」一欄請使用者用自己的話回答。
8. 把 PR 網址給使用者，說明接下來會發生的事：自動檢查（約 2 分鐘）→ 老師 review → 合併後約 2 分鐘，你的光點就會出現在線上的星圖裡。
9. 不要自己 merge，不要 push 到 main。
