import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cities } from '@/generated/cities';
import CityErrorBoundary from '@/components/CityErrorBoundary';
import { starCoords } from '@/lib/starCatalog';
import { site } from '@/site.config';
import styles from './shell.module.css';

export const dynamicParams = false;

export function generateStaticParams() {
  // 星球上還沒有城市時，仍需回傳一個值讓靜態輸出成功
  return cities.length ? cities.map((c) => ({ id: c.meta.id })) : [{ id: '_empty' }];
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const c = cities.find((x) => x.meta.id === id);
  return c ? { title: `${c.meta.name}｜${site.title}`, description: c.meta.oneLiner } : {};
}

/**
 * 母 UI（核心，同學不可修改）：頂部導覽列＋底部鄰近作品。
 * 中間的 <Page /> 是子 UI——降落後的整個畫面都由探索者設計。
 * 背後的 3D 星球、穿梭機面板與城市導航在 root layout，換頁時不會重新載入。
 */
export default async function CityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const index = cities.findIndex((c) => c.meta.id === id);
  if (index < 0) notFound();
  const { meta, plot, work, Page } = cities[index];
  const prev = cities[(index - 1 + cities.length) % cities.length];
  const next = cities[(index + 1) % cities.length];

  return (
    <div className={styles.shell}>
      <nav className={`solid ${styles.bar}`} aria-label="星球導覽">
        <Link href="/" className={styles.home}>
          <span className={styles.hubDot} aria-hidden /> 回到{site.hubName}軌道
        </Link>
        <span className={styles.meta}>
          <span>{meta.name}</span>
          <span>{starCoords(plot).code}</span>
          {work.showcaseUrl && <a href={work.showcaseUrl}>展示頁 ↗</a>}
          <a href={work.repoUrl ?? `${site.repoUrl}/tree/${site.branch}/cities/${meta.id}`}>原始碼</a>
        </span>
      </nav>

      {/* ↓↓↓ 子 UI：探索者的自由空間 ↓↓↓ */}
      <div className={styles.child}>
        <CityErrorBoundary name={meta.name}>
          <Page meta={meta} work={work} plot={plot} />
        </CityErrorBoundary>
      </div>
      {/* ↑↑↑ 子 UI 結束 ↑↑↑ */}

      {cities.length > 1 && (
        <nav className={`solid ${styles.neighbors}`} aria-label="鄰近作品">
          <Link href={`/cities/${prev.meta.id}/`} prefetch={false}>
            <span className="label">← 上一件作品</span>
            {prev.meta.name}
          </Link>
          <Link href={`/cities/${next.meta.id}/`} prefetch={false} className={styles.right}>
            <span className="label">下一件作品 →</span>
            {next.meta.name}
          </Link>
        </nav>
      )}
    </div>
  );
}
