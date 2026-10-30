/**
 * 主星零件（核心，同學不可修改，但可以在自己的 Page.tsx 引用）
 *
 *   import { Sky, Nameplate, ProposalBoard, Ground, SceneList, useShuttle, type PageProps } from '@/kit';
 *
 * - <Sky>           透明的天空窗，露出背後 3D 星球上你的城市；滑鼠可以穿透去拖曳環顧
 * - <Nameplate>     城市名牌（名稱、市長、規模）
 * - <ProposalBoard> 標準企劃看板，讀取 proposal.json
 * - <Ground>        白色實心區塊，放一般內容用
 * - <SceneList>     穿梭機站點清單，點一下就飛過去
 * - useShuttle()    讀取／控制穿梭機：目前第幾站、go(i)、next()、prev()（需要 'use client'）
 *
 * 用不用、怎麼排、放在哪裡，全部由你決定。
 */
import type { CSSProperties, ReactNode } from 'react';
import type { CityContext, CityFactory, CityFrameInfo, CityHandle, CityMeta, PageProps, Proposal, Scene } from '@/lib/types';
import styles from './kit.module.css';

export type { CityContext, CityFactory, CityFrameInfo, CityHandle, CityMeta, PageProps, Proposal, Scene };
export { useShuttle } from './shuttle';
export { default as SceneList } from './SceneList';
export { PLOT_RADIUS, MAX_HEIGHT } from '@/lib/world';

const SCALE_NAME = { house: '一棟房子', village: '村落', town: '城鎮', metropolis: '大都市' } as const;

const STATUS = ['構想', '原型', '測試', '完成'] as const;

/** 透明天空窗：高度預設 60vh，露出背後的 3D 城市，裡面可以放任何東西 */
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

/** 城市名牌 */
export function Nameplate({ meta }: { meta: CityMeta }) {
  return (
    <div className={styles.nameplate}>
      <p className="label">
        {SCALE_NAME[meta.scale]}　/　@{meta.id}
      </p>
      <h1 className={styles.name}>{meta.name}</h1>
      <p className={styles.owner}>市長　{meta.owner}</p>
    </div>
  );
}

/** 標準企劃看板 */
export function ProposalBoard({ proposal, meta }: { proposal: Proposal; meta: CityMeta }) {
  const statusIndex = STATUS.indexOf(proposal.status);
  return (
    <section className={styles.proposal} aria-label="善意企劃">
      <div className={styles.proposalHead}>
        <p className="label">善意企劃</p>
        <h2 className={styles.proposalTitle}>{proposal.title}</h2>
        <p className={styles.signal}>
          <span className={styles.signalMark} aria-hidden />
          {meta.goodwill}
        </p>
      </div>

      <dl className={styles.grid}>
        {(
          [
            ['對象', proposal.audience],
            ['觀察到的問題', proposal.problem],
            ['我的行動', proposal.action],
            ['期待的改變', proposal.impact],
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
          <p className="label">執行步驟</p>
          <ol className={styles.steps}>
            {proposal.steps.map((s, i) => (
              <li key={i}>
                <span className={styles.stepNum}>{String(i + 1).padStart(2, '0')}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>
        <div>
          <p className="label">進度</p>
          <ol className={styles.status} aria-label={`目前進度：${proposal.status}`}>
            {STATUS.map((s, i) => (
              <li key={s} className={i <= statusIndex ? styles.done : undefined} aria-current={i === statusIndex ? 'step' : undefined}>
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
