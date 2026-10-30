'use client';

/**
 * 穿梭機站點清單（主星零件）：列出 city.json 裡的所有站點，點一下就飛過去。
 *   <SceneList meta={meta} />
 */
import type { CityMeta } from '@/lib/types';
import { useShuttle } from './shuttle';
import styles from './kit.module.css';

export default function SceneList({ meta }: { meta: CityMeta }) {
  const { scene, go } = useShuttle();
  return (
    <ol className={styles.sceneList} aria-label="穿梭機站點">
      {meta.scenes.map((s, i) => (
        <li key={i}>
          <button type="button" onClick={() => go(i)} className={i === scene ? styles.sceneOn : undefined} aria-current={i === scene ? 'step' : undefined}>
            <span className={styles.sceneNum}>{String(i + 1).padStart(2, '0')}</span>
            <span>
              <b>{s.name}</b>
              {s.note && <small>{s.note}</small>}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
