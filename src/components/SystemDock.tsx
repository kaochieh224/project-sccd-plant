'use client';

/**
 * 城市導航列（母 UI，核心）：放在 root layout，換城市時不會重新載入，
 * 點一下就搭穿梭機飛到另一座城市。
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { CityMeta } from '@/lib/types';
import styles from './SystemDock.module.css';

type DockCity = Pick<CityMeta, 'id' | 'name' | 'color'>;

export default function SystemDock({ cities, hubName }: { cities: DockCity[]; hubName: string }) {
  const pathname = usePathname() || '/';
  const current = pathname.match(/\/cities\/([^/]+)/)?.[1];
  if (!current) return null; // 首頁本身就是星球，不需要導航列

  return (
    <nav className={styles.dock} aria-label="城市導航">
      <Link href="/" className={styles.hub} title={`回到${hubName}軌道`} aria-label={`回到${hubName}軌道`} />
      <span className={styles.rule} aria-hidden />
      <ul className={styles.list}>
        {cities.map((c) => (
          <li key={c.id}>
            <Link
              href={`/cities/${c.id}/`}
              className={`${styles.body} ${c.id === current ? styles.current : ''}`}
              style={{ background: c.color }}
              title={c.name}
              aria-label={c.name}
              aria-current={c.id === current ? 'page' : undefined}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}
