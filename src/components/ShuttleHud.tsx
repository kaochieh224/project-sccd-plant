'use client';

/**
 * 穿梭機面板（母 UI，核心）：在城市裡切換站點。
 * 也可以用鍵盤 ← →，或在網址後面加 #2 直接飛到第 2 站。
 */
import { useEffect } from 'react';
import { shuttle, useShuttle } from '@/kit/shuttle';
import type { Scene } from '@/lib/types';
import styles from './ShuttleHud.module.css';

export default function ShuttleHud({ scenes }: { scenes: Record<string, Scene[]> }) {
  const { cityId, scene, go, next, prev } = useShuttle();
  const list = cityId ? scenes[cityId] : undefined;

  useEffect(() => {
    if (!list || list.length < 2) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      if (e.key === 'ArrowRight') shuttle.set({ scene: shuttle.get().scene + 1 });
      if (e.key === 'ArrowLeft') shuttle.set({ scene: shuttle.get().scene - 1 });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [list]);

  if (!list) return null;
  const current = list[scene] ?? list[0];

  return (
    <section className={styles.hud} aria-label="穿梭機">
      <div className={styles.screen} aria-live="polite">
        <p className={styles.kicker}>
          穿梭機　{String(scene + 1).padStart(2, '0')} / {String(list.length).padStart(2, '0')}
        </p>
        <p className={styles.name}>{current.name}</p>
        {current.note && <p className={styles.note}>{current.note}</p>}
      </div>
      {list.length > 1 && (
        <div className={styles.controls}>
          <button type="button" onClick={prev} aria-label="上一站" className={styles.btn}>
            ←
          </button>
          <ol className={styles.dots}>
            {list.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  className={`${styles.dot} ${i === scene ? styles.dotOn : ''}`}
                  onClick={() => go(i)}
                  aria-label={`第 ${i + 1} 站：${s.name}`}
                  aria-current={i === scene ? 'step' : undefined}
                  title={s.name}
                />
              </li>
            ))}
          </ol>
          <button type="button" onClick={next} aria-label="下一站" className={styles.btn}>
            →
          </button>
        </div>
      )}
    </section>
  );
}
