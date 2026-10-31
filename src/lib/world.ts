/**
 * 星球的尺寸與地塊配置（核心）。
 * 修改這裡會移動所有人的城市，必須走框架提案。
 */

/** 星球半徑 */
export const PLANET_RADIUS = 900;
/** 每座城市的地塊半徑（城市座標的單位） */
export const PLOT_RADIUS = 120;
/** 城市建議的最高高度，超過會被等比縮小 */
export const MAX_HEIGHT = 260;
/** 地塊總數（北極是太空港，不分配） */
export const PLOT_COUNT = 96;

/** 第 i 個地塊在單位球上的方向（Fibonacci 分布，避開北極太空港） */
export function plotDirection(i: number): [number, number, number] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  // y 從 0.82 到 -0.95，北極留給太空港
  const y = 0.82 - (i / (PLOT_COUNT - 1)) * 1.77;
  const r = Math.sqrt(1 - y * y);
  const theta = golden * i;
  return [Math.cos(theta) * r, y, Math.sin(theta) * r];
}

/** 32-bit FNV-1a：同一個帳號永遠得到同一個數字 */
export function hash(str: string, seed = 0x811c9dc5) {
  let h = seed >>> 0;
  for (const ch of str) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** 固定種子的亂數 */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0;
    return s / 4294967296;
  };
}

/** 預設城市的多彩色票（low poly 玩具感） */
export const PALETTE = ['#ff5d8f', '#ffb627', '#3ec1d3', '#7bd389', '#9b5de5', '#ff8c42', '#4d96ff', '#f15bb5'];
