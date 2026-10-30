import type { ComponentType } from 'react';

/**
 * 城市的「公版框架」：這些欄位由主星讀取，用來把你的城市放上星球、
 * 讓穿梭機知道要停在哪些站點，並彙整全班的善意企劃。
 * 規則由 scripts/build-registry.mjs 驗證；改這裡＝改全班的規格，要走框架提案。
 */

/** 城市規模：一棟房子 / 村落 / 城鎮 / 大都市。沒有 City.ts 時，主星依此自動長出預設城市。 */
export type CityScale = 'house' | 'village' | 'town' | 'metropolis';

/** 三維座標 [x, y, z]，以你的城市為原點：地面 y = 0，地塊半徑 PLOT_RADIUS */
export type Vec3 = [number, number, number];

/** 穿梭機站點：一個鏡頭位置＋看向哪裡 */
export interface Scene {
  /** 站名，最多 12 字 */
  name: string;
  /** 鏡頭位置 */
  camera: Vec3;
  /** 鏡頭看向的點 */
  target: Vec3;
  /** 到站時顯示的一句話（選填），最多 60 字 */
  note?: string;
}

export interface CityMeta {
  /** 必須等於資料夾名稱，也就是你的 GitHub 帳號（小寫） */
  id: string;
  /** 城市名稱，最多 16 字 */
  name: string;
  /** 市長（你的名字） */
  owner: string;
  /** 善意企劃一句話：你想為誰、做什麼好事？最多 40 字 */
  goodwill: string;
  /** 城市主色，6 碼 hex */
  color: string;
  /** 城市規模 */
  scale: CityScale;
  /** 關鍵字，最多 3 個 */
  keywords: string[];
  /** 穿梭機站點，1–8 站 */
  scenes: Scene[];
}

/** 企劃版面（proposal.json）：所有人同一套欄位 */
export type ProposalStatus = '構想' | '原型' | '測試' | '完成';
export interface Proposal {
  /** 企劃名稱，最多 24 字 */
  title: string;
  /** 想幫助的對象，最多 40 字 */
  audience: string;
  /** 觀察到的問題，最多 120 字 */
  problem: string;
  /** 我的行動，最多 120 字 */
  action: string;
  /** 期待的改變，最多 120 字 */
  impact: string;
  /** 執行步驟，1–3 步，每步最多 40 字 */
  steps: string[];
  /** 目前進度 */
  status: ProposalStatus;
}

/**
 * 自訂城市模型（選用）：在自己的資料夾建立 City.ts，default export 一個函式。
 * 地面 y = 0；建議把城市蓋在半徑 PLOT_RADIUS、高度 MAX_HEIGHT 之內，超過時主星會等比縮小。
 */
export interface CityContext {
  /** city.json 的主色，已轉成 THREE.Color */
  color: import('three').Color;
  meta: CityMeta;
}
export interface CityFrameInfo {
  /** 有人正在參觀你的城市嗎？ */
  visited: boolean;
  /** 參觀者目前停在第幾站（沒有人參觀時為 null） */
  scene: number | null;
}
export interface CityHandle {
  /** 你的城市模型 */
  object: import('three').Object3D;
  /** 每一格畫面都會呼叫：t＝經過秒數，dt＝與上一格的間隔 */
  update?: (t: number, dt: number, info: CityFrameInfo) => void;
}
export type CityFactory = (ctx: CityContext) => CityHandle;

export interface CityEntry {
  meta: CityMeta;
  proposal: Proposal;
  /** 星球上的地塊編號（由 GitHub 帳號計算，固定、不可自選） */
  plot: number;
  Page: ComponentType<PageProps>;
}

/** 主星傳給你 Page.tsx 的資料 */
export interface PageProps {
  meta: CityMeta;
  proposal: Proposal;
  plot: number;
}
