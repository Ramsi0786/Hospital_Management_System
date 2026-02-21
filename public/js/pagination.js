/**
 * Pagination Utility
 * Works with backend-driven pagination — no frontend filtering.
 * Always visible as long as there is at least 1 result.
 * Page buttons are disabled when on a single page.
 */

const Pagination = (() => {
  let config = {
    totalItems: 0,
    limit: 10,
    currentPage: 1,
    onPageChange: null,
    maxVisiblePages: 5
  };

  function init(options) {
    config = { ...config, ...options };
  }

  function getTotalPages() {
    return Math.max(1, Math.ceil(config.totalItems / config.limit));
  }

  function getPageRange() {
    const totalPages = getTotalPages();
    const half = Math.floor(config.maxVisiblePages / 2);

    let start = Math.max(1, config.currentPage - half);
    let end = Math.min(totalPages, start + config.maxVisiblePages - 1);

    if (end - start + 1 < config.maxVisiblePages) {
      start = Math.max(1, end - config.maxVisiblePages + 1);
    }

    const pages = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return { pages, totalPages };
  }

  /**
   * Always visible when totalItems > 0.
   * Buttons are disabled (not hidden) on a single page.
   */
  function render(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Hide only when no results
    if (config.totalItems === 0) {
      container.innerHTML = '';
      return;
    }

    const tp = getTotalPages();
    const { pages } = getPageRange();
    const current = config.currentPage;
    const singlePage = tp === 1;

    let html = '<div class="pagination-wrapper">';
    html += '<nav class="pagination-nav">';

    // Prev — disabled on page 1
    html += `
      <button class="page-btn page-prev ${current === 1 ? 'disabled' : ''}"
        onclick="Pagination._goToPage(${current - 1})"
        ${current === 1 ? 'disabled' : ''}
        title="Previous page">
        <i class="fas fa-chevron-left"></i>
      </button>`;

    // First + ellipsis
    if (!singlePage && pages[0] > 1) {
      html += `<button class="page-btn" onclick="Pagination._goToPage(1)">1</button>`;
      if (pages[0] > 2) html += `<span class="page-ellipsis">...</span>`;
    }

    // Page buttons
    pages.forEach(page => {
      html += `
        <button class="page-btn ${page === current ? 'active' : ''}"
          onclick="Pagination._goToPage(${page})"
          ${singlePage ? 'disabled' : ''}>
          ${page}
        </button>`;
    });

    // Last + ellipsis
    if (!singlePage && pages[pages.length - 1] < tp) {
      if (pages[pages.length - 1] < tp - 1) html += `<span class="page-ellipsis">...</span>`;
      html += `<button class="page-btn" onclick="Pagination._goToPage(${tp})">${tp}</button>`;
    }

    // Next — disabled on last page
    html += `
      <button class="page-btn page-next ${current === tp ? 'disabled' : ''}"
        onclick="Pagination._goToPage(${current + 1})"
        ${current === tp ? 'disabled' : ''}
        title="Next page">
        <i class="fas fa-chevron-right"></i>
      </button>`;

    html += '</nav>';

    // Info line — always shown
    html += `<div class="page-info">Page ${current} of ${tp} &nbsp;·&nbsp; ${config.totalItems} total</div>`;

    html += '</div>';
    container.innerHTML = html;
  }

  function _goToPage(page) {
    const totalPages = getTotalPages();
    if (page < 1 || page > totalPages) return;
    if (page === config.currentPage) return;

    config.currentPage = page;
    if (typeof config.onPageChange === 'function') {
      config.onPageChange(page);
    }
  }

  return { init, render, _goToPage };
})();
