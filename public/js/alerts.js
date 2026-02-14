const hideLoaderIfAny = () => {
  if (window.Loader && typeof Loader.hide === 'function') {
    Loader.hide();
  }
};

const Alert = {

  success: (message, title = 'Success!') => {
    hideLoaderIfAny();
    return Swal.fire({
      icon: 'success',
      title: title,
      html: message, 
      timer: 2000,
      showConfirmButton: false,
      toast: false,
      position: 'center',
      customClass: {
        container: 'swal-high-z-index'
      },
      didOpen: () => {
        const container = document.querySelector('.swal2-container');
        if (container) {
          container.style.zIndex = '99999';
        }
      }
    });
  },

  error: (message, title = 'Error!') => {
    hideLoaderIfAny();
    return Swal.fire({
      icon: 'error',
      title: title,
      html: message, 
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'OK',
      customClass: {
        container: 'swal-high-z-index'
      },
      didOpen: () => {
        const container = document.querySelector('.swal2-container');
        if (container) {
          container.style.zIndex = '99999';
        }
      }
    });
  },

  warning: (message, title = 'Warning!') => {
    hideLoaderIfAny();
    return Swal.fire({
      icon: 'warning',
      title: title,
      html: message, 
      confirmButtonColor: '#ffc107',
      confirmButtonText: 'OK',
      customClass: {
        container: 'swal-high-z-index'
      },
      didOpen: () => {
        const container = document.querySelector('.swal2-container');
        if (container) {
          container.style.zIndex = '99999';
        }
      }
    });
  },

  info: (message, title = 'Info') => {
    hideLoaderIfAny();
    return Swal.fire({
      icon: 'info',
      title: title,
      html: message, 
      confirmButtonColor: '#17a2b8',
      confirmButtonText: 'OK',
      customClass: {
        container: 'swal-high-z-index'
      },
      didOpen: () => {
        const container = document.querySelector('.swal2-container');
        if (container) {
          container.style.zIndex = '99999';
        }
      }
    });
  },

  confirm: (message, title = 'Are you sure?') => {
    hideLoaderIfAny();
    return Swal.fire({
      title: title,
      html: message, 
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, proceed!',
      cancelButtonText: 'Cancel',
      customClass: {
        container: 'swal-high-z-index'
      },
      didOpen: () => {
        const container = document.querySelector('.swal2-container');
        if (container) {
          container.style.zIndex = '99999';
        }
      }
    });
  },

  confirmDelete: (message = 'This action cannot be undone!', title = 'Delete?') => {
    hideLoaderIfAny();
    return Swal.fire({
      title: title,
      html: message,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
      customClass: {
        container: 'swal-high-z-index'
      },
      didOpen: () => {
        const container = document.querySelector('.swal2-container');
        if (container) {
          container.style.zIndex = '99999';
        }
      }
    });
  },

  confirmBlock: (userName) => {
    hideLoaderIfAny();
    return Swal.fire({
      title: 'Block User?',
      html: `${userName} will not be able to login anymore`, 
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, block!',
      cancelButtonText: 'Cancel',
      customClass: {
        container: 'swal-high-z-index'
      },
      didOpen: () => {
        const container = document.querySelector('.swal2-container');
        if (container) {
          container.style.zIndex = '99999';
        }
      }
    });
  },

  confirmUnblock: (userName) => {
    hideLoaderIfAny();
    return Swal.fire({
      title: 'Unblock User?',
      html: `${userName} will be able to login again`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, unblock!',
      cancelButtonText: 'Cancel',
      customClass: {
        container: 'swal-high-z-index'
      },
      didOpen: () => {
        const container = document.querySelector('.swal2-container');
        if (container) {
          container.style.zIndex = '99999';
        }
      }
    });
  },

  loading: (message = 'Processing...') => {
    Swal.fire({
      title: message,
      allowOutsideClick: false,
      allowEscapeKey: false,
      customClass: {
        container: 'swal-high-z-index'
      },
      didOpen: () => {
        Swal.showLoading();
        const container = document.querySelector('.swal2-container');
        if (container) {
          container.style.zIndex = '99999';
        }
      }
    });
  },

  close: () => {
    Swal.close();
  },
  
  toast: (message, icon = 'success') => {
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
      customClass: {
        container: 'swal-high-z-index'
      },
      didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
        const container = document.querySelector('.swal2-container');
        if (container) {
          container.style.zIndex = '99999';
        }
      }
    });

    Toast.fire({
      icon: icon,
      title: message
    });
  },

  successRedirect: (message, redirectUrl, delay = 1500) => {
    hideLoaderIfAny();
    Swal.fire({
      icon: 'success',
      title: 'Success!',
      html: message, 
      timer: delay,
      showConfirmButton: false,
      customClass: {
        container: 'swal-high-z-index'
      },
      didOpen: () => {
        const container = document.querySelector('.swal2-container');
        if (container) {
          container.style.zIndex = '99999';
        }
      }
    }).then(() => {
      window.location.href = redirectUrl;
    });
  },

  validationErrors: (errors) => {
    hideLoaderIfAny();
    const errorList = Object.values(errors)
      .map(err => `• ${err}`)
      .join('<br>');

    return Swal.fire({
      icon: 'error',
      title: 'Validation Error',
      html: errorList,
      confirmButtonColor: '#dc3545',
      customClass: {
        container: 'swal-high-z-index'
      },
      didOpen: () => {
        const container = document.querySelector('.swal2-container');
        if (container) {
          container.style.zIndex = '99999';
        }
      }
    });
  },

  networkError: () => {
    hideLoaderIfAny();
    return Swal.fire({
      icon: 'error',
      title: 'Network Error',
      html: 'Could not connect to server. Please check your internet connection.',
      confirmButtonColor: '#dc3545',
      customClass: {
        container: 'swal-high-z-index'
      },
      didOpen: () => {
        const container = document.querySelector('.swal2-container');
        if (container) {
          container.style.zIndex = '99999';
        }
      }
    });
  },

  sessionExpired: () => {
    hideLoaderIfAny();
    return Swal.fire({
      icon: 'warning',
      title: 'Session Expired',
      html: 'Your session has expired. Please login again.',
      confirmButtonColor: '#ffc107',
      allowOutsideClick: false,
      customClass: {
        container: 'swal-high-z-index'
      },
      didOpen: () => {
        const container = document.querySelector('.swal2-container');
        if (container) {
          container.style.zIndex = '99999';
        }
      }
    }).then(() => {
      window.location.href = '/login';
    });
  }
};

window.Alert = Alert;

window.showSuccess = (msg) => Alert.success(msg);
window.showError = (msg) => Alert.error(msg);
window.showConfirm = (msg) => Alert.confirm(msg);