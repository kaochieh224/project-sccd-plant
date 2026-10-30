import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import ShuttleHud from '@/components/ShuttleHud';
import SystemDock from '@/components/SystemDock';
import Universe from '@/components/Universe';
import { cities } from '@/generated/cities';
import { site } from '@/site.config';
import './globals.css';

export const metadata: Metadata = {
  title: `${site.title} ${site.titleEn}`,
  description: site.subtitle,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const world = cities.map(({ meta, plot }) => ({ meta, plot }));
  const dock = cities.map(({ meta: { id, name, color } }) => ({ id, name, color }));
  const scenes = Object.fromEntries(cities.map(({ meta }) => [meta.id, meta.scenes]));
  return (
    <html lang="zh-Hant-TW">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        {/* 背景：3D 星球放在 layout，整個網站只建立一次；換頁時鏡頭飛行、不重新載入 */}
        <Universe cities={world} hubName={site.hubName} />
        <div className="content">{children}</div>
        {/* 母 UI：穿梭機面板與城市導航，換城市時持續存在 */}
        <ShuttleHud scenes={scenes} />
        <SystemDock cities={dock} hubName={site.hubName} />
      </body>
    </html>
  );
}
