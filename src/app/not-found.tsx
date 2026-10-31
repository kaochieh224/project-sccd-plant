import Link from 'next/link';
import { site } from '@/site.config';
import styles from './page.module.css';

export const metadata = { title: `找不到這個座標｜${site.title}` };

export default function NotFound() {
  return (
    <main>
      <section className={styles.sky}>
        <span />
        <header className={styles.header} data-hero-copy>
          <h1 className={styles.notFound}>這個座標上沒有光點</h1>
          <p className={styles.subtitle}>網址可能打錯了，或這件作品已經換了位置。</p>
          <Link href="/" className={styles.scroll}>
            <span aria-hidden>←</span> 回到{site.hubName}軌道
          </Link>
        </header>
      </section>
    </main>
  );
}
