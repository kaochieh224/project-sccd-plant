'use client';

/**
 * 子 UI 的防護罩（核心）：同學的 Page.tsx 出錯時，只有那一塊顯示錯誤，
 * 3D 星球、導覽列和穿梭機都照常運作。
 */
import { Component, type ReactNode } from 'react';

export default class CityErrorBoundary extends Component<{ name: string; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.warn(`[${this.props.name}] Page.tsx 發生錯誤：`, error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        style={{
          margin: '40vh var(--gutter) 40px',
          padding: '20px 24px',
          background: '#fff',
          border: '3px solid var(--ink)',
          borderRadius: 'var(--radius)',
          boxShadow: '0 5px 0 var(--ink)',
          maxWidth: 560,
        }}
      >
        <p style={{ margin: 0, fontWeight: 900, fontSize: 20 }}>這座城市的頁面暫時壞掉了 🚧</p>
        <p style={{ margin: '8px 0 0', color: 'var(--ink-2)' }}>
          {this.props.name} 的 Page.tsx 出現錯誤。市長：把下面這段訊息貼給 Claude Code，請它幫你修。
        </p>
        <pre style={{ margin: '12px 0 0', whiteSpace: 'pre-wrap', fontSize: 13, background: 'var(--cream)', padding: 12, borderRadius: 12 }}>
          {this.state.error.message}
        </pre>
      </div>
    );
  }
}
