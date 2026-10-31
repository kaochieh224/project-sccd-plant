import { cities } from '@/generated/cities';
import { luminosity, starCoords } from '@/lib/starCatalog';
import { PLOT_COUNT } from '@/lib/world';
import { site } from '@/site.config';
import Catalogue from './Catalogue';
import Timeline from './Timeline';
import styles from './page.module.css';

/**
 * 首頁＝主星軌道。第一個畫面是透明的，讓背後常駐的 3D 星球露出來；
 * 往下捲動是全班的星表，星球留在右邊，跟著你看的那一列轉動。
 */
export default function Home() {
  const items = [...cities]
    .sort((a, b) => a.plot - b.plot)
    .map(({ meta, plot, work }) => ({
      id: meta.id,
      name: meta.name,
      owner: meta.owner,
      color: meta.color,
      oneLiner: meta.oneLiner,
      competition: work.competition,
      direction: work.direction,
      stage: work.stage,
      light: luminosity(work.stage),
      stops: meta.scenes.length,
      keywords: meta.keywords,
      showcaseUrl: work.showcaseUrl,
      ...starCoords(plot),
    }));

  return (
    <main>
      <section className={styles.sky}>
        <p className={styles.top}>
          <span>{site.course}</span>
          <span className={styles.count}>
            {String(cities.length).padStart(2, '0')} / {PLOT_COUNT} 光點
          </span>
        </p>
        <header className={styles.header} data-hero-copy>
          <h1 className={styles.title} aria-label={site.title}>
            {[...site.title].map((ch, i) => (
              <span key={i} className={styles.titleChar} style={{ '--i': i } as React.CSSProperties} aria-hidden>
                {ch}
              </span>
            ))}
          </h1>
          <p className={styles.titleEn}>{site.titleEn}</p>
          <p className={styles.subtitle}>{site.subtitle}</p>
          <a href="#cities" className={styles.scroll}>
            <span aria-hidden>↓</span> 打開星表
          </a>
        </header>
      </section>

      <div className={styles.ground}>
        <section className={styles.section} id="cities">
          <h2 className={styles.heading}>星表</h2>
          {items.length === 0 ? <p className={styles.empty}>星圖上還沒有作品。成為第一位探索者吧。</p> : <Catalogue items={items} />}
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>這是什麼</h2>
          <p className={styles.about}>探索者計畫是媒傳系創意媒體專題設計的 studio。每位同學做一件非傳統類型的作品，一路做到 2027 年底，一般的網站和一般的遊戲都不算。</p>
          <p className={styles.about}>星圖上每個光點是一件作品，作品走得越遠，光點越亮。作品本體放在同學自己的展示頁和 GitHub repo，這裡是全班的入口。</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>這學期的時程</h2>
          <Timeline />
        </section>

        <footer className={styles.footer} id="join">
          <p>
            想加入星圖？閱讀 <a href={`${site.repoUrl}/blob/${site.branch}/docs/00-從零開始.md`}>從零開始</a>，用 Claude Code 把你的作品放上來，送出 Pull Request。
          </p>
          <p>
            <a href={site.repoUrl}>GitHub repository ↗</a>
          </p>
        </footer>
      </div>
    </main>
  );
}
