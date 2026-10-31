import type { ComponentType } from 'react';

/**
 * 作品的「公版框架」：這些欄位由主星讀取，用來把你的作品放上星圖、
 * 讓穿梭機知道要停在哪些站點，並彙整全班的作品卡。
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
  /** 作品名稱，最多 16 字 */
  name: string;
  /** 探索者（你的名字） */
  owner: string;
  /** 一句話作品描述：觀眾在這件作品前會做什麼？最多 40 字 */
  oneLiner: string;
  /** 作品主色，6 碼 hex */
  color: string;
  /** 城市規模 */
  scale: CityScale;
  /** 關鍵字，最多 3 個 */
  keywords: string[];
  /** 穿梭機站點，1–8 站 */
  scenes: Scene[];
}

/** 作品卡（work.json）：所有人同一套欄位，對應探索者計畫的非傳統三問與四個階段 */
export type WorkDirection = '技術' | '議題' | '美學';
export type WorkStage = '前置期' | '做到可玩' | '做到展出' | '送出去' | '收成';
export interface Work {
  /** 一句話作品描述的英文版（選填），最多 120 字元 */
  oneLinerEn?: string;
  /** 作品方向 */
  direction: WorkDirection;
  /** 觀眾是誰，最多 40 字 */
  audience: string;
  /** 主攻賽事／類別，最多 40 字 */
  competition: string;
  /** 非傳統三問之一：觀眾怎麼參與，最多 120 字 */
  participation: string;
  /** 非傳統三問之二：架構差在哪裡，最多 120 字 */
  architecture: string;
  /** 非傳統三問之三：拿掉哪個部分就變回傳統，最多 120 字 */
  essence: string;
  /** 目前階段 */
  stage: WorkStage;
  /** 作品展示頁網址（選填，W4 起建立），必須是 https:// */
  showcaseUrl?: string;
  /** 作品的公開 GitHub repo（選填），必須是 https:// */
  repoUrl?: string;
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
  work: Work;
  /** 星球上的地塊編號（由 GitHub 帳號計算，固定、不可自選） */
  plot: number;
  Page: ComponentType<PageProps>;
}

/** 主星傳給你 Page.tsx 的資料 */
export interface PageProps {
  meta: CityMeta;
  work: Work;
  plot: number;
}
