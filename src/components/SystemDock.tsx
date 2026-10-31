'use client';

/**
 * 作品導航列（母 UI，核心）：放在 root layout，換作品時不會重新載入，
 * 點一下就搭穿梭機飛到另一件作品。圓點旁邊會顯示作品名，顏色不是唯一的線索。
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { CityMeta } from '@/lib/types';
import styles from './SystemDock.module.css';
import { useScrolledPast3D } from './useScrolledPast3D';

type DockCity = Pick<CityMeta, 'id' | 'name' | 'color'>;
const WINDOW = 6;

export default function SystemDock({ cities, hubName }: { cities: DockCity[]; hubName: string }) {
  const pathname = usePathname() || '/';
  const current = pathname.match(/\/cities\/([^/]+)/)?.[1];
  const [tip, setTip] = useState<string | null>(null);
  const past3D = useScrolledPast3D();
  const listRef = useRef<HTMLUListElement>(null);

  // 窄螢幕放不下時，把目前作品的圓點捲到中間
  useEffect(() => {
    const list = listRef.current;
    const dot = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (list && dot) list.scrollLeft = dot.offsetLeft - list.clientWidth / 2;
  }, [current]);

  if (!current) return null; // 首頁本身就是星球，不需要導航列

  // 滿載時圓點會超出視窗又捲不到，只列目前作品前後各幾件，其餘回星表找
  const at = cities.findIndex((c) => c.id === current);
  const near = cities.length > WINDOW * 2 + 1 ? cities.slice(Math.max(0, Math.min(at - WINDOW, cities.length - WINDOW * 2 - 1))).slice(0, WINDOW * 2 + 1) : cities;

  return (
    <nav className={`${styles.dock} ${past3D ? styles.dockAway : ''}`} aria-label="作品導航">
      {tip && (
        <span className={styles.tip} aria-hidden>
          {tip}
        </span>
      )}
      <Link href="/" className={styles.hub} aria-label={`回到${hubName}軌道`} onPointerEnter={() => setTip(`回到${hubName}軌道`)} onPointerLeave={() => setTip(null)} onFocus={() => setTip(`回到${hubName}軌道`)} onBlur={() => setTip(null)} />
      <span className={styles.rule} aria-hidden />
      <ul ref={listRef} className={styles.list}>
        {near.map((c) => (
          <li key={c.id}>
            <Link
              href={`/cities/${c.id}/`}
              prefetch={false}
              className={`${styles.body} ${c.id === current ? styles.current : ''}`}
              style={{ background: c.color }}
              aria-label={c.name}
              aria-current={c.id === current ? 'page' : undefined}
              onPointerEnter={() => setTip(c.name)}
              onPointerLeave={() => setTip(null)}
              onFocus={() => setTip(c.name)}
              onBlur={() => setTip(null)}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}
