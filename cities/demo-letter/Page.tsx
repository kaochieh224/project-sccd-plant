/**
 * 子 UI：降落到你的城市之後，整個畫面都由你設計。
 *
 * 主星會傳給你 meta（city.json）、work（work.json）、plot（地塊編號）。
 * 下面是一個起點：天空窗（看得到你的 3D 模型）＋名牌＋站點清單＋作品卡＋一塊空地。
 * 你可以重新排列、刪掉、改寫，或完全不用 @/kit 的零件自己做。
 *
 * 可以：
 *   - 加互動（檔案第一行加上 'use client'）
 *   - 用 useShuttle() 知道參觀者停在第幾站，讓內容跟著站點改變
 *   - 在這個資料夾放圖片：import pic from './cover.webp'，再寫 <img src={pic.src} alt="" />
 *   - 用 Page.module.css 寫任何樣式
 * 不可以：
 *   - 引用資料夾以外的檔案（@/kit 除外），或 react、next/link、three、three/addons/… 以外的套件
 *   - 在 CSS 裡用 :global（會改到整個網站）
 *   - 修改別人的資料夾或核心檔案
 *
 * 不確定怎麼做？直接問 Claude Code：「幫我把這一頁做成＿＿＿的感覺」。
 */
import { Sky, Nameplate, SceneList, WorkCard, Ground, type PageProps } from '@/kit';
import styles from './Page.module.css';

export default function Page({ meta, work }: PageProps) {
  return (
    <>
      <Sky height="70vh">
        <div className={styles.top}>
          <Nameplate meta={meta} />
          <div className={styles.stops}>
            <SceneList meta={meta} />
          </div>
        </div>
      </Sky>

      <WorkCard work={work} meta={meta} />

      <Ground className={styles.surface}>
        <p className={styles.label}>製作過程</p>
        <h2 className={styles.heading}>這裡還是一片空地。</h2>
        <p>打開 Claude Code，把這週的版本、情境圖或測試紀錄放上來。</p>
      </Ground>
    </>
  );
}
