'use client';

/** 這學期的里程碑（和 npm run mission 讀同一份）。今天要在瀏覽器算，靜態網站的 build 日期不算數。 */
import { useEffect, useState } from 'react';
import milestones from '@/milestones.json';
import styles from './page.module.css';

export default function Timeline() {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(new Date().toLocaleDateString('sv')), []);
  const next = today && milestones.find(([d]) => d >= today)?.[0];

  return (
    <ol className={styles.timeline}>
      {milestones.map(([date, text]) => (
        <li key={date} className={date === next ? styles.timeNext : today && date < today ? styles.timePast : ''}>
          <span className={styles.timeDate}>{date.replaceAll('-', '.')}</span>
          <span>{text}</span>
        </li>
      ))}
    </ol>
  );
}
