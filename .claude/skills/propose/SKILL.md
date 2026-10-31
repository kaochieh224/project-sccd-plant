---
name: propose
description: 協助使用者提出「框架提案」：修改背景（3D 宇宙）、母 UI、主星零件或公版規格。使用者說「我想改主星」「框架可以加一個功能嗎」「我想改導覽列」時使用。
---

# 框架提案

背景與母 UI 屬於全班，所以修改要經過討論。每一步都向使用者說明「為什麼要這樣做」，這正是多人協作的重點。

## 階段一：提出 Issue（還不要寫程式）
1. 問使用者三件事（選擇題或一句話即可）：想改什麼？為什麼需要？會影響其他人的地塊嗎？
2. 用 `gh issue list --label framework` 檢查是否已有類似提案；有的話，建議使用者到那則 Issue 留言加入討論，不要重複開。
3. 依 `.github/ISSUE_TEMPLATE/framework-request.md` 的格式，用 `gh issue create --label framework` 開 Issue，把網址給使用者。
4. 告訴使用者：等老師或同學在 Issue 回覆、同意後，再進入階段二。

## 階段二：實作（Issue 已獲同意）
1. 確認目前 Claude Code 是以框架提案模式啟動；如果不是，hook 會擋下編輯。請使用者結束後重新啟動：Mac 用 `SOLAR_CORE=1 claude`，Windows PowerShell 用 `$env:SOLAR_CORE="1"; claude`。
2. `git switch main && git pull`，再 `git switch -c core/<簡短英文描述>`。
3. 實作前先說明修改計畫，列出會動到的檔案。
4. 實作時遵守根目錄 `CLAUDE.md` 的「框架提案模式」規則，特別是：不能讓現有作品入口壞掉、公版欄位要向下相容。
5. 執行 `npm run check` 與 `npm run build`，並請使用者用 `npm run dev` 實際打開至少三個別人的地塊確認正常。
6. commit、push，用 `gh pr create` 開 PR，內容寫 `Closes #<Issue編號>`，並說明：改了什麼、怎麼測試、對其他地塊的影響。
7. 告訴使用者：CI 的越界檢查會先顯示失敗，這是正常的，等老師 review 並加上 `core` 標籤後就會通過。
