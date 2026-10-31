/**
 * 星表（核心）：把地塊編號換成星圖上的座標，把作品階段換成光度。
 * 首頁的作品名冊與 3D 星圖共用這份資料，讓表上的一列和天上的一顆星說的是同一件事。
 */
import type { WorkStage } from './types';
import { plotDirection } from './world';

export const STAGES: WorkStage[] = ['前置期', '做到可玩', '做到展出', '送出去', '收成'];

/** 光度 1–5：作品走得越遠，光點越亮 */
export const luminosity = (stage: WorkStage) => STAGES.indexOf(stage) + 1;

/** 星表編號與赤經赤緯，例如 EX-038、07h 42m、+23°41′ */
export function starCoords(plot: number) {
  const [x, y, z] = plotDirection(plot);
  const hours = (((Math.atan2(z, x) / (Math.PI * 2)) % 1) + 1) % 1 * 24;
  const deg = (Math.asin(y) * 180) / Math.PI;
  const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');
  return {
    code: `EX-${String(plot + 1).padStart(3, '0')}`,
    ra: `${pad(hours)}h ${pad((hours % 1) * 60)}m`,
    dec: `${deg < 0 ? '−' : '+'}${pad(Math.abs(deg))}°${pad((Math.abs(deg) % 1) * 60)}′`,
  };
}
