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
      text: message,
      timer: 2000,
      showConfirmButton: false,
      toast: false,
      position: 'center'
    });
  },

  error: (message, title = 'Error!') => {
    hideLoaderIfAny();
    return Swal.fire({
      icon: 'error',
      title: title,
      text: message,
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'OK'
    });
  },

  warning: (message, title = 'Warning!') => {
    hideLoaderIfAny();
    return Swal.fire({
      icon: 'warning',
      title: title,
      text: message,
      confirmButtonColor: '#ffc107',
      confirmButtonText: 'OK'
    });
  },

  info: (message, title = 'Info') => {
    hideLoaderIfAny();
    return Swal.fire({
      icon: 'info',
      title: title,
      text: message,
      confirmButtonColor: '#17a2b8',
      confirmButtonText: 'OK'
    });
  },

  confirm: (message, title = 'Are you sure?') => {
    hideLoaderIfAny();
    return Swal.fire({
      title: title,
      text: message,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, proceed!',
      cancelButtonText: 'Cancel'
    });
  },

  confirmDelete: (message = 'This action cannot be undone!', title = 'Delete?') => {
    hideLoaderIfAny();
    return Swal.fire({
      title: title,
      text: message,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    });
  },

 
  confirmBlock: (userName) => {
    hideLoaderIfAny();
    return Swal.fire({
      title: 'Block User?',
      text: `${userName} will not be able to login anymore`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, block!',
      cancelButtonText: 'Cancel'
    });
  },


  confirmUnblock: (userName) => {
    hideLoaderIfAny();
    return Swal.fire({
      title: 'Unblock User?',
      text: `${userName} will be able to login again`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, unblock!',
      cancelButtonText: 'Cancel'
    });
  },

  loading: (message = 'Processing...') => {
    Swal.fire({
      title: message,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
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
      didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
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
      text: message,
      timer: delay,
      showConfirmButton: false
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
      confirmButtonColor: '#dc3545'
    });
  },

  networkError: () => {
    hideLoaderIfAny();
    return Swal.fire({
      icon: 'error',
      title: 'Network Error',
      text: 'Could not connect to server. Please check your internet connection.',
      confirmButtonColor: '#dc3545'
    });
  },

 
  sessionExpired: () => {
    hideLoaderIfAny();
    return Swal.fire({
      icon: 'warning',
      title: 'Session Expired',
      text: 'Your session has expired. Please login again.',
      confirmButtonColor: '#ffc107',
      allowOutsideClick: false
    }).then(() => {
      window.location.href = '/login';
    });
  }
};

window.Alert = Alert;

window.showSuccess = (msg) => Alert.success(msg);
window.showError = (msg) => Alert.error(msg);
window.showConfirm = (msg) => Alert.confirm(msg);