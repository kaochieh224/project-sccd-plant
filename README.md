# 善意星系 Goodwill Constellation

> 實踐大學 媒體傳達設計學系｜Claude Code × GitHub 協同開發課程

一顆全班共同建造的 3D 星球。每位同學是一座城市的**市長**：在自己的地塊上蓋城市——從一棟房子到巨大的賽博龐克都市都可以——設計穿梭機在城市裡的參觀路線，並在城市裡呈現自己的**善意企劃**。北極的太空港是主星的核心，航線連到每一座城市，接駁船在上面來回飛行。

**受限的框架，自由的填充**：背景與母 UI 屬於全班，每個人在同一套公版裡自由創作自己的城市；想改框架，就透過 Issue 與 PR 提案。

## 三層結構

| 層 | 內容 | 誰可以改 |
|---|---|---|
| 背景 | 3D 星球、太空港、航線、雲（low poly 多彩風格） | 框架提案（Issue → PR → 老師核准） |
| 母 UI | 導覽列、穿梭機面板、城市導航 | 框架提案 |
| 子 UI＋城市 | 你的 3D 城市、穿梭機站點、降落後的整個頁面（風格自由） | 你自己 |

整個網站只有一個 3D 場景，從頭到尾不會重新載入。點選城市時，鏡頭沿著星球表面的弧線飛過去；在城市裡用穿梭機換站，鏡頭也只是飛到下一個景點。

## 我是學生

clone 下來之後打開 Claude Code，它會列出你的**市長任務進度**，一步一步引導你。

| 文件 | 內容 |
|---|---|
| [00 從零開始](docs/00-從零開始.md) | 安裝工具、下載專案、建立城市（約 40 分鐘） |
| [01 建立你的城市](docs/01-建立你的城市.md) | 城市識別、企劃、穿梭機路線、3D 城市、子 UI，與 Claude Code 對話的訣竅 |
| [02 送出 PR](docs/02-送出PR.md) | Git 名詞、PR 流程、CI 沒過怎麼辦 |
| [03 框架提案](docs/03-框架提案.md) | 想讓整顆星球變得更好時 |

| Claude Code 指令 | 做什麼 |
|---|---|
| `/mission` | 查看任務進度、下一步 |
| `/new-city` | 領取地塊、建立你的城市 |
| `/preview` | 在本機預覽 |
| `/check` | 檢查有沒有符合公版規格 |
| `/submit` | 送出 Pull Request |
| `/propose` | 提出框架修改 |

## 我是老師
請看 [10 老師手冊](docs/10-老師手冊.md)：repo 設定、GitHub Pages、分支保護、課程節奏、review 檢查表。

## 專案結構
```
├── cities/                       每座城市一個資料夾（資料夾名稱＝GitHub 帳號）
│   ├── _template/                新城市範本
│   ├── kaochieh224/              示範城市「燈塔港」
│   └── demo-*/                   示範城市（開課前刪除）
├── src/
│   ├── components/Universe.tsx   背景：3D 星球（three.js）
│   ├── components/ShuttleHud.tsx 母 UI：穿梭機面板
│   ├── components/SystemDock.tsx 母 UI：城市導航
│   ├── app/                      首頁、城市頁外框
│   ├── kit/                      主星零件，城市可以引用
│   └── lib/                      公版欄位規格、星球尺寸、預設城市
├── scripts/
│   ├── build-registry.mjs        掃描、驗證城市，分配地塊
│   ├── check-scope.mjs           越界檢查
│   ├── mission.mjs               市長任務進度（Claude Code 開場時自動執行）
│   └── new-city.mjs              建立新城市
├── .claude/                      Claude Code 的 hook 與 slash 指令
├── .github/                      CI、自動部署、PR 與 Issue 範本
└── CLAUDE.md                     給 Claude Code 的專案規則與引導方式
```

## 技術
Next.js 16（靜態輸出）· React 19 · three.js · TypeScript · GitHub Actions · GitHub Pages

```bash
npm install
npm run dev          # http://localhost:3000
npm run mission      # 任務進度
npm run check        # 公版規格＋型別檢查
npm run build        # 輸出到 out/
```
