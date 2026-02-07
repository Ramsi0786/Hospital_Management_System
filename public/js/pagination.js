

const Pagination = {
  currentPage: 1,
  totalPages: 1,
  totalItems: 0,
  limit: 10,
  onPageChange: null, 

  init(config = {}) {
    this.totalItems = config.totalItems || 0;
    this.limit = config.limit || 10;
    this.currentPage = config.currentPage || 1;
    this.onPageChange = config.onPageChange || null;
    this.totalPages = Math.ceil(this.totalItems / this.limit);
  },

  update(totalItems, currentPage = null) {
    this.totalItems = totalItems;
    this.totalPages = Math.ceil(totalItems / this.limit);
    if (currentPage !== null) {
      this.currentPage = currentPage;
    }

    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = 1;
    }
  },

  render(containerId = 'pagination') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (this.totalPages <= 1) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }

    container.style.display = 'flex';

    const pages = this.getPageNumbers();
    const startItem = (this.currentPage - 1) * this.limit + 1;
    const endItem = Math.min(this.currentPage * this.limit, this.totalItems);

    let html = `
      <div class="pagination-container">
        <div class="pagination-info">
          Showing ${startItem}-${endItem} of ${this.totalItems}
        </div>
        <div class="pagination-buttons">
          <button class="pagination-btn" 
            ${this.currentPage === 1 ? 'disabled' : ''}
            onclick="Pagination.goToPage(1)"
            title="First Page">
            <i class="fas fa-angles-left"></i>
          </button>
          
          <button class="pagination-btn" 
            ${this.currentPage === 1 ? 'disabled' : ''}
            onclick="Pagination.goToPage(${this.currentPage - 1})"
            title="Previous">
            <i class="fas fa-chevron-left"></i>
          </button>
    `;

    pages.forEach(page => {
      if (page === '...') {
        html += `<span class="pagination-ellipsis">...</span>`;
      } else {
        html += `
          <button class="pagination-btn ${page === this.currentPage ? 'active' : ''}"
            onclick="Pagination.goToPage(${page})">
            ${page}
          </button>
        `;
      }
    });

    html += `
          <button class="pagination-btn" 
            ${this.currentPage === this.totalPages ? 'disabled' : ''}
            onclick="Pagination.goToPage(${this.currentPage + 1})"
            title="Next">
            <i class="fas fa-chevron-right"></i>
          </button>
          
          <button class="pagination-btn" 
            ${this.currentPage === this.totalPages ? 'disabled' : ''}
            onclick="Pagination.goToPage(${this.totalPages})"
            title="Last Page">
            <i class="fas fa-angles-right"></i>
          </button>
        </div>
      </div>
    `;

    container.innerHTML = html;
  },

  getPageNumbers() {
    const pages = [];
    const current = this.currentPage;
    const total = this.totalPages;

    pages.push(1);

    if (total <= 7) {
      for (let i = 2; i <= total; i++) {
        pages.push(i);
      }
    } else {
      if (current <= 3) {
        for (let i = 2; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(total);
      } else if (current >= total - 2) {
        pages.push('...');
        for (let i = total - 3; i <= total; i++) pages.push(i);
      } else {
        pages.push('...');
        pages.push(current - 1);
        pages.push(current);
        pages.push(current + 1);
        pages.push('...');
        pages.push(total);
      }
    }

    return pages;
  },

  goToPage(page) {
    if (page < 1 || page > this.totalPages || page === this.currentPage) {
      return;
    }

    this.currentPage = page;
    this.render();

    if (typeof this.onPageChange === 'function') {
      this.onPageChange(page);
    }
  },

  getOffset() {
    return (this.currentPage - 1) * this.limit;
  },

  reset() {
    this.currentPage = 1;
    this.render();
  }
};

window.Pagination = Pagination;