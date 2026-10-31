/**
 * 主星零件（核心，同學不可修改，但可以在自己的 Page.tsx 引用）
 *
 *   import { Sky, Nameplate, WorkCard, Ground, SceneList, useShuttle, type PageProps } from '@/kit';
 *
 * - <Sky>           透明的天空窗，露出背後 3D 星圖上你的地塊；滑鼠可以穿透去拖曳環顧
 * - <Nameplate>     作品名牌（名稱、探索者、規模）
 * - <WorkCard>      標準作品卡，讀取 work.json
 * - <Ground>        白色實心區塊，放一般內容用
 * - <SceneList>     穿梭機站點清單，點一下就飛過去
 * - useShuttle()    讀取／控制穿梭機：目前第幾站、go(i)、next()、prev()（需要 'use client'）
 *
 * 用不用、怎麼排、放在哪裡，全部由你決定。
 */
import type { CSSProperties, ReactNode } from 'react';
import type { CityContext, CityFactory, CityFrameInfo, CityHandle, CityMeta, PageProps, Scene, Work } from '@/lib/types';
import styles from './kit.module.css';

export type { CityContext, CityFactory, CityFrameInfo, CityHandle, CityMeta, PageProps, Scene, Work };
export { useShuttle } from './shuttle';
export { default as SceneList } from './SceneList';
export { PLOT_RADIUS, MAX_HEIGHT } from '@/lib/world';

const SCALE_NAME = { house: '一棟房子', village: '村落', town: '城鎮', metropolis: '大都市' } as const;

const STAGES = ['前置期', '做到可玩', '做到展出', '送出去', '收成'] as const;

/** 透明天空窗：高度預設 60vh，露出背後的 3D 模型，裡面可以放任何東西 */
export function Sky({ height = '60vh', children, align = 'end' }: { height?: string; children?: ReactNode; align?: 'start' | 'center' | 'end' }) {
  return (
    <div data-sky className={styles.sky} style={{ minHeight: height, justifyContent: { start: 'flex-start', center: 'center', end: 'flex-end' }[align] }}>
      {children}
    </div>
  );
}

/** 白色實心區塊 */
export function Ground({ children, style, className }: { children?: ReactNode; style?: CSSProperties; className?: string }) {
  return (
    <div className={`${styles.ground} ${className ?? ''}`} style={style}>
      {children}
    </div>
  );
}

/** 作品名牌 */
export function Nameplate({ meta }: { meta: CityMeta }) {
  return (
    <div className={styles.nameplate}>
      <p className="label">
        {SCALE_NAME[meta.scale]}　/　@{meta.id}
      </p>
      <h1 className={styles.name}>{meta.name}</h1>
      <p className={styles.owner}>探索者　{meta.owner}</p>
    </div>
  );
}

/** 標準作品卡 */
export function WorkCard({ work, meta }: { work: Work; meta: CityMeta }) {
  const stageIndex = STAGES.indexOf(work.stage);
  return (
    <section className={styles.work} aria-label="作品卡">
      <div className={styles.workHead}>
        <p className="label">{work.direction}　作品卡</p>
        <h2 className={styles.workTitle}>{meta.oneLiner}</h2>
        {work.oneLinerEn && <p className={styles.workEn}>{work.oneLinerEn}</p>}
      </div>

      <dl className={styles.grid}>
        {(
          [
            ['觀眾', work.audience],
            ['觀眾怎麼參與', work.participation],
            ['架構差在哪裡', work.architecture],
            ['拿掉什麼就變回傳統', work.essence],
          ] as const
        ).map(([k, v]) => (
          <div key={k}>
            <dt className="label">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <div className={styles.lower}>
        <div>
          <p className="label">主攻賽事</p>
          <p className={styles.competition}>{work.competition}</p>
          {(work.showcaseUrl || work.repoUrl) && (
            <p className={styles.links}>
              {work.showcaseUrl && <a href={work.showcaseUrl}>展示頁 ↗</a>}
              {work.repoUrl && <a href={work.repoUrl}>GitHub repo ↗</a>}
            </p>
          )}
        </div>
        <div>
          <p className="label">階段</p>
          <ol className={styles.status} aria-label={`目前階段：${work.stage}`}>
            {STAGES.map((s, i) => (
              <li key={s} className={i <= stageIndex ? styles.done : undefined} aria-current={i === stageIndex ? 'step' : undefined}>
                {s}
              </li>
            ))}
          </ol>
          {meta.keywords.length > 0 && (
            <ul className={styles.keywords}>
              {meta.keywords.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
