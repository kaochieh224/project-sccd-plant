import Link from 'next/link';
import { cities } from '@/generated/cities';
import { site } from '@/site.config';
import styles from './page.module.css';

/**
 * 首頁＝主星軌道。第一個畫面是透明的，讓背後常駐的 3D 星球露出來；
 * 往下捲動是全班的作品名冊。
 */
export default function Home() {
  const keywords = [...new Set(cities.flatMap((c) => c.meta.keywords))];
  const sorted = [...cities].sort((a, b) => a.meta.name.localeCompare(b.meta.name, 'zh-Hant'));

  return (
    <main>
      <section className={styles.sky}>
        <header className={styles.header}>
          <p className="label">{site.course}</p>
          <h1 className={styles.title} aria-label={site.title}>
            {[...site.title].map((ch, i) => (
              <span key={i} className={styles.titleChar} aria-hidden>
                {ch}
              </span>
            ))}
            <span className={styles.titleEn}>{site.titleEn}</span>
          </h1>
          <p className={styles.subtitle}>{site.subtitle}</p>
        </header>
        <a href="#cities" className={`label ${styles.scroll}`}>
          ↓ 作品名冊
        </a>
      </section>

      <div className={`solid ${styles.ground}`}>
        <section className={styles.section} id="cities">
          <div className={styles.sectionHead}>
            <h2>作品名冊</h2>
            <p className="label">Works — {cities.length}</p>
          </div>
          {sorted.length === 0 ? (
            <p className={styles.empty}>星圖上還沒有作品。成為第一位探索者吧。</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>作品</th>
                  <th>探索者</th>
                  <th>一句話／主攻賽事</th>
                  <th>階段</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(({ meta, plot, work }) => (
                  <tr key={meta.id}>
                    <td className={styles.num}>{String(plot + 1).padStart(2, '0')}</td>
                    <td>
                      <Link href={`/cities/${meta.id}/`} className={styles.bodyLink}>
                        <span className={styles.swatchSquare} style={{ background: meta.color }} />
                        {meta.name}
                      </Link>
                      <span className={styles.kind}>
                        {work.direction}・{meta.scenes.length} 站
                      </span>
                    </td>
                    <td>{meta.owner}</td>
                    <td>
                      {meta.oneLiner}
                      <span className={styles.kind}>主攻　{work.competition}</span>
                    </td>
                    <td>
                      <span className={styles.status}>{work.stage}</span>
                      {work.showcaseUrl && (
                        <a href={work.showcaseUrl} className={styles.showcase}>
                          展示頁 ↗
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {keywords.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2>作品關鍵字</h2>
              <p className="label">Keywords — {keywords.length}</p>
            </div>
            <ul className={styles.keywords}>
              {keywords.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          </section>
        )}

        <footer className={styles.footer}>
          <p>
            想加入星圖？閱讀 <a href={`${site.repoUrl}/blob/${site.branch}/docs/00-從零開始.md`}>從零開始</a>，用 Claude Code 把你的作品放上來並送出 Pull Request。
          </p>
          <p className="label">
            <a href={site.repoUrl}>GitHub repository</a>
          </p>
        </footer>
      </div>
    </main>
  );
}
