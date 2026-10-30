'use client';

/**
 * 穿梭機狀態（核心）：目前在哪座城市、停在第幾站。
 * 3D 宇宙、穿梭機面板與同學的 Page.tsx 共用這份狀態，換站時不會重新載入。
 *
 * 在你的 Page.tsx 使用（第一行要加 'use client'）：
 *   import { useShuttle } from '@/kit';
 *   const { scene, go, next, prev } = useShuttle();
 */
import { useSyncExternalStore } from 'react';

export interface ShuttleState {
  /** 目前所在城市的 id；在主星軌道上時為 null */
  cityId: string | null;
  /** 目前停在第幾站（從 0 開始） */
  scene: number;
  /** 這座城市一共有幾站 */
  count: number;
}

let state: ShuttleState = { cityId: null, scene: 0, count: 0 };
const listeners = new Set<() => void>();

export const shuttle = {
  get: () => state,
  set(partial: Partial<ShuttleState>) {
    const next = { ...state, ...partial };
    if (next.count > 0) next.scene = ((next.scene % next.count) + next.count) % next.count;
    if (next.cityId === state.cityId && next.scene === state.scene && next.count === state.count) return;
    state = next;
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

/** 讀取與控制穿梭機 */
export function useShuttle() {
  const s = useSyncExternalStore(shuttle.subscribe, shuttle.get, shuttle.get);
  return {
    ...s,
    /** 飛到第 i 站 */
    go: (i: number) => shuttle.set({ scene: i }),
    /** 下一站 */
    next: () => shuttle.set({ scene: shuttle.get().scene + 1 }),
    /** 上一站 */
    prev: () => shuttle.set({ scene: shuttle.get().scene - 1 }),
  };
}
