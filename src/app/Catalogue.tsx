'use client';

/**
 * 星表（母 UI，核心）：全班作品的名冊。
 * 滑鼠或鍵盤停在一列，背後的星球就轉到那顆星，航線亮起來；在星球上指到光點，這裡也會標出對應的列。
 * 階段（也是光度的圖例）和關鍵字都可以篩選：沒選到的光點暗下去，星球轉到選到的那一群。
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { STAGES } from '@/lib/starCatalog';
import styles from './page.module.css';

export interface CatalogueItem {
  id: string;
  name: string;
  owner: string;
  color: string;
  oneLiner: string;
  competition: string;
  direction: string;
  stage: string;
  light: number;
  stops: number;
  keywords: string[];
  code: string;
  ra: string;
  dec: string;
  showcaseUrl?: string;
}

const focus = (id: string | null) => window.dispatchEvent(new CustomEvent('starmap:focus', { detail: id }));

export default function Catalogue({ items }: { items: CatalogueItem[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const shown = filter ? items.filter((c) => c.stage === filter || c.keywords.includes(filter)) : items;
  const keywords = [...new Set(items.flatMap((c) => c.keywords))];

  useEffect(() => {
    const onHover = (e: Event) => setActive((e as CustomEvent<string | null>).detail);
    window.addEventListener('starmap:hover', onHover);
    return () => window.removeEventListener('starmap:hover', onHover);
  }, []);

  // 篩選寫進網址，回上一頁或把連結傳給別人時都還在
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get('f');
    if (f && items.some((c) => c.stage === f || c.keywords.includes(f))) setFilter(f);
  }, [items]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (filter) url.searchParams.set('f', filter);
    else url.searchParams.delete('f');
    window.history.replaceState(window.history.state, '', url);
    window.dispatchEvent(new CustomEvent('starmap:filter', { detail: filter ? shown.map((c) => c.id) : null }));
    return () => {
      window.dispatchEvent(new CustomEvent('starmap:filter', { detail: null }));
    };
    // shown 由 filter 決定
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const count = (v: string) => items.filter((c) => c.stage === v || c.keywords.includes(v)).length;
  // 0 筆的選項不能按，篩選就不會出現空白結果
  const chip = (value: string | null, label: string, extra?: React.ReactNode) => {
    const n = value ? count(value) : items.length;
    return (
      <button key={label} type="button" disabled={n === 0} className={`${styles.chip} ${filter === value ? styles.chipOn : ''}`} aria-pressed={filter === value} onClick={() => setFilter(filter === value ? null : value)}>
        {extra}
        {label}
        <span className={styles.chipCount}>{n}</span>
      </button>
    );
  };

  return (
    <>
      <div className={styles.filters} role="group" aria-label="依階段篩選；階段也是光點的亮度">
        <span className={styles.filterLabel}>光度＝作品階段</span>
        {chip(null, '全部')}
        {STAGES.map((s, i) =>
          chip(
            s,
            s,
            <span className={styles.light} aria-hidden>
              {STAGES.map((_, j) => (
                <i key={j} className={j <= i ? styles.lightOn : ''} />
              ))}
            </span>,
          ),
        )}
      </div>

      {keywords.length > 0 && (
        <details className={styles.keywordBox} open={filter !== null && keywords.includes(filter) ? true : undefined}>
          <summary>依關鍵字篩選</summary>
          <div className={styles.filters} role="group" aria-label="依關鍵字篩選">
            {keywords.map((k) => chip(k, k))}
          </div>
        </details>
      )}
      <p className={styles.srOnly} role="status">
        顯示 {shown.length} 件作品
      </p>

      <ol className={styles.rows} onPointerLeave={() => focus(null)}>
        {shown.map((c) => (
          <li
            key={c.id}
            className={`${styles.row} ${active === c.id ? styles.rowOn : ''}`}
            style={{ '--star': c.color } as React.CSSProperties}
            onPointerEnter={(e) => e.pointerType === 'mouse' && focus(c.id)}
            onFocus={() => focus(c.id)}
            onBlur={() => focus(null)}
          >
            <p className={styles.coords}>
              <span className={styles.code}>{c.code}</span>
              <span>{c.ra}</span>
              <span>{c.dec}</span>
            </p>
            <div className={styles.rowBody}>
              <h3 className={styles.rowName}>
                <Link href={`/cities/${c.id}/`} prefetch={false} className={styles.rowLink}>
                  <span className={styles.star} aria-hidden />
                  {c.name}
                </Link>
              </h3>
              <p className={styles.rowLine}>{c.oneLiner}</p>
              <dl className={styles.rowFacts}>
                <div>
                  <dt>探索者</dt>
                  <dd>{c.owner}</dd>
                </div>
                <div>
                  <dt>方向</dt>
                  <dd>{c.direction}</dd>
                </div>
                <div>
                  <dt>主攻</dt>
                  <dd>{c.competition}</dd>
                </div>
                <div>
                  <dt>站點</dt>
                  <dd>{c.stops}</dd>
                </div>
              </dl>
            </div>
            <div className={styles.rowStage}>
              <span className={styles.light} role="img" aria-label={`光度 ${c.light}，共 ${STAGES.length} 級`}>
                {STAGES.map((s, i) => (
                  <i key={s} className={i < c.light ? styles.lightOn : ''} />
                ))}
              </span>
              <span>{c.stage}</span>
              {c.showcaseUrl && (
                <a href={c.showcaseUrl} className={styles.showcase}>
                  展示頁 ↗
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
