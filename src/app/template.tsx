import type { ReactNode } from 'react';
import styles from './template.module.css';

/**
 * template 會在每次換頁時重新掛載，用來做「降落」轉場。
 * 換頁本身由 Next.js 在瀏覽器端完成，不會重新載入整個網頁。
 */
export default function Template({ children }: { children: ReactNode }) {
  return <div className={styles.land}>{children}</div>;
}
