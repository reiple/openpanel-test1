import { useEffect, useRef } from 'react';
import { createOpenPanelTransport, createPanelAnalytics } from './analytics';

export function usePanelAnalytics({ active, search, page, rowsPerPage, totalRows, records }) {
  const analyticsRef = useRef(null);
  if (!analyticsRef.current) {
    analyticsRef.current = createPanelAnalytics(createOpenPanelTransport({
      clientId: import.meta.env.VITE_OPENPANEL_CLIENT_ID,
      apiUrl: import.meta.env.VITE_OPENPANEL_API_URL,
    }));
  }
  const analytics = analyticsRef.current;
  const dataRef = useRef(records);
  const revisionRef = useRef(0);

  useEffect(() => { analytics.visit(active); }, [active, analytics]);

  useEffect(() => {
    if (dataRef.current !== records) {
      dataRef.current = records;
      revisionRef.current += 1;
    }
    // Cleanup cancels StrictMode's first effect and unfinished search input.
    const timer = setTimeout(() => analytics.table({
      menu: active, query: search, page, pageSize: rowsPerPage,
      totalRows, revision: revisionRef.current,
    }), search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [active, search, page, rowsPerPage, totalRows, records, analytics]);

  useEffect(() => {
    const trackClick = event => {
      const button = event.target.closest?.('[data-analytics-button]');
      if (button && !button.disabled && button.getAttribute('aria-disabled') !== 'true') {
        analytics.button(active, button.dataset.analyticsButton);
      }
    };
    // Capture preserves the source menu even when navigation changes the view.
    document.addEventListener('click', trackClick, true);
    return () => document.removeEventListener('click', trackClick, true);
  }, [active, analytics]);
}
