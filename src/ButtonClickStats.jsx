import { useEffect, useId, useState } from 'react';
import { Paper, Popper, Typography } from '@mui/material';

const menuNames = { dashboard: '대시보드', users: '사용자 관리', products: '상품 관리' };

/** Uses the same stable button IDs as click tracking, including portal dialogs. */
export function ButtonClickStats({ active }) {
  const tooltipId = useId();
  const [target, setTarget] = useState(null);
  const [stats, setStats] = useState({ status: 'loading' });

  useEffect(() => {
    if (!target) return;
    const previous = target.element.getAttribute('aria-describedby');
    target.element.setAttribute('aria-describedby', [previous, tooltipId].filter(Boolean).join(' '));
    return () => {
      if (previous) target.element.setAttribute('aria-describedby', previous);
      else target.element.removeAttribute('aria-describedby');
    };
  }, [target, tooltipId]);

  useEffect(() => {
    setTarget(null);
    const show = event => {
      const element = event.target.closest?.('[data-analytics-button]');
      if (!element) return;
      setTarget(previous => previous?.element === element ? previous : {
        element, button: element.dataset.analyticsButton, menu: active,
      });
    };
    const hide = event => {
      const element = event.target.closest?.('[data-analytics-button]');
      if (element && !element.contains(event.relatedTarget)) setTarget(null);
    };
    const escape = event => { if (event.key === 'Escape') setTarget(null); };
    const clear = () => setTarget(null);
    document.addEventListener('pointerover', show);
    document.addEventListener('pointerout', hide);
    document.addEventListener('focusin', show);
    document.addEventListener('focusout', hide);
    document.addEventListener('keydown', escape);
    document.addEventListener('click', clear, true);
    window.addEventListener('blur', clear);
    return () => {
      document.removeEventListener('pointerover', show);
      document.removeEventListener('pointerout', hide);
      document.removeEventListener('focusin', show);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('keydown', escape);
      document.removeEventListener('click', clear, true);
      window.removeEventListener('blur', clear);
    };
  }, [active]);

  useEffect(() => {
    if (!target) return;
    let disposed = false;
    let controller;
    setStats({ status: 'loading' });
    const load = async () => {
      controller?.abort();
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      try {
        const response = await fetch('/api/button-click-counts', { signal: controller.signal });
        if (!response.ok) throw new Error('Unavailable');
        const result = await response.json();
        const count = result.counts?.[target.menu]?.[target.button] ?? 0;
        if (!Number.isFinite(count) || count < 0) throw new Error('Invalid count');
        if (!disposed) setStats({ status: 'ready', count });
      } catch {
        if (!disposed) setStats({ status: 'error' });
      } finally { clearTimeout(timeout); }
    };
    load();
    const interval = setInterval(load, 5000);
    return () => { disposed = true; clearInterval(interval); controller?.abort(); };
  }, [target]);

  return <Popper id={tooltipId} open={Boolean(target?.element.isConnected)} anchorEl={target?.element} placement="top"
    modifiers={[{ name: 'offset', options: { offset: [0, 10] } }]}
    sx={{ zIndex: 1600, pointerEvents: 'none' }}>
    <Paper elevation={6} sx={{ px: 1.75, py: 1.25, bgcolor: '#17243b', color: '#fff', borderRadius: 2, maxWidth: 260 }}>
      <Typography fontSize={11} sx={{ color: '#b9c6de', mb: 0.5 }}>{menuNames[target?.menu]} · 전체 기간</Typography>
      <Typography fontSize={13} fontWeight={700} aria-live="polite">
        {stats.status === 'ready' ? `누적 클릭 ${stats.count.toLocaleString('ko-KR')}회`
          : stats.status === 'error' ? '통계 조회 불가' : '클릭 횟수 조회 중…'}
      </Typography>
      <Typography fontSize={10} sx={{ color: '#b9c6de', mt: 0.5 }}>OpenPanel 집계 · 반영 지연 가능</Typography>
    </Paper>
  </Popper>;
}
