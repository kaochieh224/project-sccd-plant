'use client';

/**
 * 燈塔港：老師的示範城市。
 * 示範子 UI 可以怎麼「自己編排」：
 *   ① 不用 <Nameplate>，天空窗裡放自己設計的標題，文字跟著穿梭機的站點改變（useShuttle）
 *   ② 企劃不用 <ProposalBoard>，改成自己的排法（資料一樣來自 proposal.json）
 *   ③ 一個用 useState 做的互動
 */
import { useState } from 'react';
import { Sky, Ground, useShuttle, type PageProps } from '@/kit';
import styles from './Page.module.css';

const HINTS = [
  '錯誤訊息不是在罵你，是在告訴你下一步。',
  '看不懂的時候，把它整段貼給 Claude Code 問。',
  '先讓它動起來，再讓它變漂亮。',
  '每一次 commit，都是一次存檔。',
  'Pull Request 是邀請別人看你的作品，不是交考卷。',
];

export default function Page({ meta, proposal }: PageProps) {
  const { scene, go } = useShuttle();
  const [count, setCount] = useState(0);
  const stop = meta.scenes[scene] ?? meta.scenes[0];

  return (
    <>
      {/* ① 天空窗：標題跟著站點改變 */}
      <Sky height="72vh">
        <div className={styles.title}>
          <p className={styles.kicker}>
            HARBOR 01 — STOP {String(scene + 1).padStart(2, '0')}
          </p>
          <h1>{stop.name}</h1>
          <p className={styles.note}>{stop.note}</p>
          <div className={styles.chips}>
            {meta.scenes.map((s, i) => (
              <button key={s.name} type="button" onClick={() => go(i)} className={i === scene ? styles.chipOn : styles.chip}>
                {s.name}
              </button>
            ))}
          </div>
        </div>
      </Sky>

      {/* ② 自己排的企劃：左欄大標，右欄問題 → 行動 → 改變 */}
      <Ground className={styles.proposal}>
        <div className={styles.left}>
          <p className={styles.kicker}>善意企劃／{proposal.status}</p>
          <h2>{proposal.title}</h2>
          <p className={styles.audience}>給 {proposal.audience}</p>
        </div>
        <ol className={styles.flow}>
          <li><span>問題</span>{proposal.problem}</li>
          <li><span>行動</span>{proposal.action}</li>
          <li><span>改變</span>{proposal.impact}</li>
        </ol>
      </Ground>

      {/* ③ 互動 */}
      <Ground className={styles.console}>
        <div>
          <p className={styles.kicker}>已送出的光</p>
          <p className={styles.count}>{String(count).padStart(3, '0')}</p>
        </div>
        <div>
          <p className={styles.message} aria-live="polite">
            {count === 0 ? '按下按鈕，向整顆星球送出一道光。' : HINTS[(count - 1) % HINTS.length]}
          </p>
          <button type="button" className={styles.button} onClick={() => setCount((c) => c + 1)}>
            送出一道光
          </button>
        </div>
      </Ground>
    </>
  );
}
