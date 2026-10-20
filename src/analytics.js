/** OpenPanel's public /track API. No credentials or table contents are sent. */
export function createOpenPanelTransport({ clientId, apiUrl = 'http://localhost:3001/api', fetcher = globalThis.fetch } = {}) {
  return async (name, properties) => {
    if (!clientId) return false;
    try {
      const response = await fetcher(`${apiUrl.replace(/\/+$/, '')}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'openpanel-client-id': clientId },
        body: JSON.stringify({ type: 'track', payload: { name, properties } }),
        keepalive: true,
        credentials: 'omit',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      // Analytics must never interrupt navigation, forms or table operations.
      return false;
    }
  };
}

export function createPanelAnalytics(send) {
  let lastMenu;
  let lastTable;
  const emit = (name, menu, properties = {}) => {
    try {
      Promise.resolve(send(name, { menu, __path: `/${menu}`, ...properties })).catch(() => {});
    } catch { /* App functionality is independent of analytics availability. */ }
  };
  return {
    visit(menu) {
      if (lastMenu === menu) return;
      lastMenu = menu;
      // Invalidate table deduplication even if an intervening view was very brief.
      lastTable = undefined;
      emit('screen_view', menu, { __title: menu });
      emit('menu_view', menu);
    },
    button(menu, button) {
      emit('button_click', menu, { button });
    },
    table(view) {
      if (lastTable && JSON.stringify(lastTable) === JSON.stringify(view)) return;
      const previous = lastTable;
      const reason = !previous || previous.menu !== view.menu ? 'menu_enter'
        : previous.query !== view.query ? 'search'
        : previous.pageSize !== view.pageSize ? 'page_size'
        : previous.page !== view.page ? 'pagination' : 'data_change';
      lastTable = { ...view };
      emit('table_view', view.menu, {
        table: `${view.menu}_table`, reason,
        page: view.page + 1, page_size: view.pageSize,
        total_rows: view.totalRows,
        visible_rows: Math.max(0, Math.min(view.pageSize, view.totalRows - view.page * view.pageSize)),
        has_search: Boolean(view.query),
      });
    },
  };
}
