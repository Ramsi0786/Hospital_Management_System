const Loader = {

  show: (message = 'Loading...') => {
    const loader = document.getElementById('globalLoader');
    if (!loader) {
      console.error('Loader element not found. Include loading.ejs partial!');
      return;
    }
    
    const text = loader.querySelector('.loader-text');
    if (text) {
      text.textContent = message;
    }
    
    loader.classList.add('show');

    document.body.style.overflow = 'hidden';
  },

  hide: () => {
    const loader = document.getElementById('globalLoader');
    if (loader) {
      loader.classList.remove('show');
    }

    document.body.style.overflow = '';
  },


  showInElement: (elementId, message = 'Loading...') => {
    const element = document.getElementById(elementId);
    if (!element) {
      console.error(`Element ${elementId} not found`);
      return;
    }

    element.innerHTML = `
      <div class="text-center py-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-2 text-muted">${message}</p>
      </div>
    `;
  },


  showInTable: (tableBodyId, colspan = 7) => {
    const tbody = document.getElementById(tableBodyId);
    if (!tbody) {
      console.error(`Table body ${tableBodyId} not found`);
      return;
    }

    tbody.innerHTML = `
      <tr>
        <td colspan="${colspan}" class="text-center py-4">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="mt-2 text-muted">Loading data...</p>
        </td>
      </tr>
    `;
  },

  buttonLoading: (button, text = 'Processing...') => {
    const btn = typeof button === 'string' 
      ? document.getElementById(button) 
      : button;
    
    if (!btn) {
      console.error('Button not found');
      return;
    }

    btn.dataset.originalContent = btn.innerHTML;

    btn.disabled = true;
  
    btn.innerHTML = `
      <span class="spinner-border spinner-border-sm me-2" role="status"></span>
      ${text}
    `;
  },


  buttonReset: (button) => {
    const btn = typeof button === 'string' 
      ? document.getElementById(button) 
      : button;
    
    if (!btn) {
      console.error('Button not found');
      return;
    }

    if (btn.dataset.originalContent) {
      btn.innerHTML = btn.dataset.originalContent;
      delete btn.dataset.originalContent;
    }
  
    btn.disabled = false;
  },

  showSkeleton: (containerId, rows = 3) => {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container ${containerId} not found`);
      return;
    }

    let skeletonHTML = '';
    for (let i = 0; i < rows; i++) {
      skeletonHTML += `
        <div class="skeleton-item mb-3">
          <div class="skeleton-line skeleton-title"></div>
          <div class="skeleton-line skeleton-text"></div>
          <div class="skeleton-line skeleton-text short"></div>
        </div>
      `;
    }

    container.innerHTML = skeletonHTML;
  }
};

window.Loader = Loader;

window.withLoader = async (asyncFn, message = 'Loading...') => {
  try {
    Loader.show(message);
    const result = await asyncFn();
    Loader.hide();
    return result;
  } catch (error) {
    Loader.hide();
    throw error;
  }
};

window.fetchWithLoader = async (url, options = {}, message = 'Loading...') => {
  try {
    Loader.show(message);
    const response = await fetch(url, options);
    Loader.hide();
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response;
  } catch (error) {
    Loader.hide();
    Alert.error('Network error. Please try again.');
    throw error;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Loader.hide();
});