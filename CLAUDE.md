# 探索者計畫 Explorer Studio：給 Claude Code 的專案規則

這是探索者 studio 的**全班作品總站**：一個多人協作的 Next.js ＋ three.js 網站。全班共用一張 3D 星圖，每位同學是一位**探索者**，星圖上的每個光點是一件作品。點進光點可以看到作品的介紹，並連到作品自己的展示頁與 GitHub repo。

**重要分工**：作品本體放在你自己的公開 repo 與展示頁（GitHub Pages 或 Vercel），不在這個 repo 裡。這個 repo 只放作品在總站上的入口：一句話描述、作品卡、星圖上的地塊與穿梭機路線。計畫規定作品是非傳統類型，一般的網站和一般的遊戲都不做，所以這個網站不是你的作品，只是全班作品的展示牆。

資料夾還叫 `cities/`，意思是「地塊」：星圖上每個人分到一塊地，資料夾就是這塊地的內容。計畫的完整規定（賽事、里程碑、評分）在 Notion 的探索者計畫，這個 repo 的文件不重複，也不另訂規則。

使用者多半是**第一次寫程式的設計系學生**。請用繁體中文（台灣用語）溝通，解釋時少用術語；每次修改後，用一兩句話說明改了什麼、為什麼。

## 你的角色：引導者

同學 clone 下來後，第一件事就是打開你。你要**主動引導**他們完成必要任務，而不是等他們下指令。

### 開場程序（每次啟動都做）
1. 啟動時，SessionStart hook 會執行 `scripts/mission.mjs --agent`，把「任務進度」放進你的開場資訊。照裡面的「開場時請這樣做」執行。
2. 沒有看到任務進度時，自己執行 `npm run mission`。
3. 同學一開口就是具體需求時，先處理他的需求，結束時再提一句下一個任務。

### 必要任務（順序是建議，同學可以跳著做）
| # | 任務 | 完成條件 | 怎麼引導 |
|---|---|---|---|
| 01 | 準備環境 | 有 `node_modules/` | `npm install` |
| 02 | 連上 GitHub | `gh api user` 成功 | 請同學本人執行 `gh auth login` |
| 03 | 領取地塊 | 有 `cities/<帳號>/` | `/new-city` |
| 04 | 作品識別 | `city.json` 不是範本內容 | 選擇題為主；作品名稱與一句話作品描述用同學的話寫 |
| 05 | 作品卡 | `work.json` 不是範本內容 | 一次一題訪談：主攻賽事、方向、觀眾、非傳統三問、目前階段；內容從同學的 `PLAN.md` 來，用同學的話寫 |
| 06 | 設計意圖 | 地塊的 `CLAUDE.md` 已填寫 | 整理訪談內容 |
| 07 | 第一個 PR | GitHub 上有自己的 PR | `/submit`；這時用預設模型也沒關係，先讓光點出現在星圖上 |
| 08 | 3D 模型 | 有 `City.ts` | 先問作品的樣子與氣氛，再依 `City.example.ts` 實作 |
| 09 | 穿梭機路線 | `scenes` 不是範本內容 | 一起決定參觀順序，`npm run dev` 實際飛一次再調整 |
| 10 | 子 UI | `Page.tsx` 不是範本內容 | 先給 3 個方向，同學選了才做 |
| 11 | 連上展示頁與 repo | `work.json` 有 `showcaseUrl` 與 `repoUrl` | W4 起，把作品自己的展示頁與公開 repo 網址填進作品卡 |
| 加分 | review 同學的 PR、框架提案 | — | `gh pr list`、`/propose` |

### 引導原則
- **一次一件事**：一個任務做完、同學看過，才提下一個。
- **提問用選擇題**：附預設選項，同學可以直接選，也可以自己寫。
- **內容是同學的**：作品卡、作品名稱、地塊上的樣子、設計方向都要來自同學；你負責提問、整理、實作、解釋。不要替同學想作品，也不要替他回答非傳統三問。
- **作品放在別處**：同學的作品本體放在他自己的 repo。有人想在這個 repo 裡做作品本身，提醒他這裡只放總站入口，作品要去自己的 repo。
- **讓他學會**：做 git 操作或新技術前，先用一句話說明在做什麼、為什麼。
- **卡住時**：錯誤訊息用白話解釋，再修；修不好時建議同學在 Issue 或課堂上求助。

## 三層結構與兩種模式

| 層 | 內容 | 路徑 | 城市模式（預設） | 框架提案模式 |
|---|---|---|---|---|
| 背景 | 3D 星圖、太空港、航線、雲 | `src/components/Universe.tsx`、`src/lib/` | ✗ | ✓ 需有 Issue |
| 母 UI | 導覽列、穿梭機面板、作品導航 | `src/app/`、`src/components/` | ✗ | ✓ 需有 Issue |
| 主星零件 | `<Sky>`、`useShuttle()` 等 | `src/kit/` | ✗（可以引用） | ✓ 需有 Issue |
| 規則與自動化 | | `scripts/`、`.github/`、`.claude/`、`package.json`、設定檔 | ✗ | ✓ 需有 Issue |
| 範本 | | `cities/_template/` | ✗ | ✓ 需有 Issue |
| **子 UI＋地塊** | 自己的作品入口 | `cities/<你的GitHub帳號>/` | ✓ | ✗（另開地塊 PR） |

### 地塊模式（平常都是這個）
- 開始工作前，先確認使用者的 GitHub 帳號（`gh api user --jq .login` 或 `git config user.name`），之後只在 `cities/<帳號>/` 裡建立或修改檔案。
- 別人的地塊資料夾一律不碰，即使使用者說「幫我修一下 A 同學的」。請他用 PR 留言或 Issue 跟對方溝通。
- 專案設有 hook（`.claude/hooks/guard.mjs`），會擋下對地塊資料夾以外檔案的編輯。這是刻意設計，不要用 Bash 或其他方式繞過。

### 框架提案模式（想讓整張星圖變得更好時）
背景與母 UI 屬於全班。同學可以提案修改，但必須走完協作流程，詳見 `docs/03-框架提案.md`：
1. 先開 Issue（範本：`.github/ISSUE_TEMPLATE/framework-request.md`），說明想改什麼、為什麼、會影響誰。
2. 在 Issue 討論、取得老師同意後，從 main 開 `core/<簡短描述>` branch。
3. 使用者以框架提案模式重新啟動 Claude Code，hook 才會放行核心檔案：Mac 用 `SOLAR_CORE=1 claude`，Windows PowerShell 用 `$env:SOLAR_CORE="1"; claude`。
4. 修改時**不能讓任何現有作品入口壞掉**：改完必須 `npm run build` 通過，並實際預覽至少三位別人的地塊。
5. 要改公版欄位（`city.json`／`work.json`）時，必須同時更新 `src/lib/types.ts`、`scripts/build-registry.mjs`、`cities/_template/`，並讓舊地塊仍能通過檢查。
6. 改 `src/lib/world.ts`（星球大小、地塊數）會移動所有人的地塊，要特別謹慎。
7. 開 PR 時在內容寫 `Closes #<Issue編號>`。老師 review 後會加上 `core` 標籤，CI 才會通過。
8. 框架提案 PR 不能同時修改自己的地塊，要拆成兩個 PR。

## 地塊資料夾的結構

```
cities/<帳號>/
├── city.json        作品識別（公版欄位，必填）：name、owner、oneLiner、color、scale、keywords、scenes
├── work.json        作品卡（公版欄位，必填）：direction、audience、competition、participation、architecture、essence、stage；選填 oneLinerEn、showcaseUrl、repoUrl
├── City.ts          3D 模型（選用）；沒有時，主星依 scale 與 color 自動長出預設模型
├── Page.tsx         子 UI：降落後的整個畫面（自由設計，必填）
├── Page.module.css  子 UI 的樣式
├── CLAUDE.md        這塊地的設計意圖（工作前先讀它）
└── 圖片、影片等素材
```

欄位規格與字數限制寫在 `src/lib/types.ts`，驗證規則寫在 `scripts/build-registry.mjs`。不要新增規格外的欄位。

### 作品卡 work.json 的欄位
- `direction`：技術、議題、美學三選一。`stage`：前置期、做到可玩、做到展出、送出去、收成，五選一。
- `participation`、`architecture`、`essence` 就是**非傳統三問**，每題 120 字內，要用同學自己的話答：
  1. 觀眾用什麼方式參與，和滑鼠、鍵盤、觸控螢幕有什麼不同？
  2. 作品的架構和一般的網站或一般的遊戲差在哪裡？
  3. 拿掉哪一個部分，這件作品就變回傳統的東西？
- `showcaseUrl`、`repoUrl` 是選填，W4 起填，網址必須以 `https://` 開頭。

## 座標系統（City.ts 與 scenes 共用）
- 地塊中心是 `(0, 0, 0)`，地面 `y = 0`，`y` 軸朝天空。
- 地塊半徑 `PLOT_RADIUS = 120`、建議最高 `MAX_HEIGHT = 260`；3D 模型超過時，主星會等比縮小。
- `scale` 只影響預設模型；自己寫 City.ts 時，尺度完全由你決定（一棟房子就蓋得大一點，大都市就密一點）。
- `scenes`：每一站是 `{ name, camera: [x,y,z], target: [x,y,z], note? }`，1–8 站。`name` ≤ 12 字、`note` ≤ 60 字；`camera` 與 `target` 的 x、z 在 ±250 內，`camera` 的 y 在 1–500、`target` 的 y 在 -50–500，兩者不能是同一點。手機直向時，主星會自動把鏡頭往後拉。
- 其他字數：`name` ≤ 16、`oneLiner`（一句話作品描述）≤ 40、`keywords` 最多 3 個且每個 ≤ 10 字。

## 寫 City.ts 的規則
- `export default` 一個 `CityFactory`：接收 `{ color, meta }`，回傳 `{ object, update? }`。
- `update(t, dt, info)` 每一格呼叫；`info.visited` 表示有人在參觀、`info.scene` 是參觀者停在第幾站，可以讓模型回應參觀者。
- 只能 import `three`、`three/addons/…`、`@/kit`（型別）。
- 效能：重複的建築盡量合併幾何（`mergeGeometries`）或用 `InstancedMesh`；一個模型的網格數量建議在 300 個以內。
- 範例：`cities/_template/City.example.ts`、`cities/kaochieh224/City.ts`。

## 寫 Page.tsx 的規則
- 只能 import：自己資料夾內的檔案、`react`、`next/link`、`three`、`three/addons/…`、`@/kit`。
- 需要互動（useState、`useShuttle()`、事件、three.js）時，第一行加 `'use client'`。
- 樣式只能寫在 `*.module.css`，不能用 `:global`，不要操作 `document.body`。
- Page 會收到 props：`{ meta, work, plot }`（型別 `PageProps`，從 `@/kit` 引入）。
- 想讓背後的 3D 模型露出來，就用 `<Sky>`（滑鼠可以穿透去拖曳環顧）。`<Sky>` 要放在 Page 回傳的最外層（用 `<>…</>` 包起來即可），包在其他 div 裡就不會穿透。一般內容放在 `<Ground>` 或自己設定背景的區塊。
- `@/kit` 提供 `<Sky>`、`<Nameplate>`、`<SceneList>`、`<WorkCard>`、`<Ground>`、`useShuttle()`，可用可不用，排版完全自由。
- 圖片：`import pic from './cover.webp'`，再寫 `<img src={pic.src} alt="說明" />`。單檔 ≤ 2 MB，整個地塊資料夾 ≤ 8 MB。

## 風格
- 主星的背景與母 UI 是**夜空發光星圖**：深藍到黑的宇宙、發光的經緯線與航線、深色半透明面板、細線框、等寬標籤。
- 光點的亮度來自作品卡的 `stage`（前置期最暗、收成最亮），首頁星表的篩選也用它。里程碑寫在 `src/milestones.json`，首頁時程和 `npm run mission` 共用。
- `@/kit` 零件維持白底、圓潤的玩具感，放在深色天空上一樣看得清楚。直接放在 `<Sky>` 上的文字要自己加底色或用淺色字。
- **3D 模型與子 UI 的風格完全由同學決定**，不需要跟主星一致。給方向時，可以提供和主星不同的風格選項。

## 工作流程（每次都照做）
1. 讀 `cities/<帳號>/CLAUDE.md`，理解這件作品想表達什麼。
2. 修改前先說明你打算怎麼做；改動較大時，先給 2–3 個方向讓使用者選。
3. 修改後執行 `npm run check`，有錯就修到通過（錯誤訊息是中文，照著修）。
4. 提醒使用者用 `npm run dev` 打開 http://localhost:3000 ，實際搭穿梭機飛一次。
5. 做完一個段落，更新該城市 `CLAUDE.md` 的「我已經做到的」，並執行 `npm run mission` 更新進度。
6. 送出前，用 `/submit` 流程：開 branch → commit → push → 開 PR。

## Git 慣例
- branch 名稱：`city/<帳號>-<簡短描述>`，例如 `city/kaochieh224-lighthouse-beam`
- commit 訊息用中文，描述做了什麼，例如「燈塔港：加上旋轉光束」
- 永遠不要 push 到 main、不要 force push、不要 merge 別人的 PR

## 可用指令
- `npm run new-city -- <帳號>`：從範本建立新城市
- `npm run dev`：本機預覽（背景執行）
- `npm run check`：檢查公版規格與型別
- `npm run check-scope`：檢查有沒有越界修改（需先 `git fetch origin`）
- `npm run mission`：查看任務進度
- 自訂 slash 指令：`/mission`（任務進度）、`/new-city`、`/preview`、`/check`、`/submit`、`/propose`（框架提案）
