'use client';

import { useEffect, useState } from 'react';

/** 捲到看不見 3D 的地方了：穿梭機面板這時沒有回饋，還會蓋住同學的內容，要收起來 */
export function useScrolledPast3D() {
  const [past, setPast] = useState(false);
  useEffect(() => {
    // 手機的面板和導航佔了畫面底部兩成，一開始捲就要讓開
    const onScroll = () => setPast(window.scrollY > window.innerHeight * (window.innerWidth <= 640 ? 0.1 : 0.45));
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return past;
}
