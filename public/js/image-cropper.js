class ImageCropper {
  constructor(options) {
    this.inputElement = document.getElementById(options.inputId);
    this.previewElement = document.getElementById(options.previewId);
    this.onCropCallback = options.onCrop || (() => {});
    this.aspectRatio = options.aspectRatio || 1; // 1 = square, 16/9 = widescreen
    this.minWidth = options.minWidth || 200;
    this.minHeight = options.minHeight || 200;
    
    this.cropperInstance = null;
    this.originalImage = null;
    
    this.init();
  }

  init() {
    if (!this.inputElement || !this.previewElement) {
      console.error('ImageCropper: Required elements not found');
      return;
    }

    this.inputElement.addEventListener('change', (e) => this.handleFileSelect(e));
  }

  handleFileSelect(event) {
    const file = event.target.files[0];
    
    if (!file) return;

    if (!file.type.match('image.*')) {
      Alert.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      Alert.error('Image size must be less than 5MB');
      this.inputElement.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.originalImage = e.target.result;
      this.showCropper(e.target.result);
    };
    reader.readAsDataURL(file);
  }

  showCropper(imageData) {
    if (this.cropperInstance) {
      this.cropperInstance.destroy();
    }

    this.previewElement.src = imageData;
    this.previewElement.style.display = 'block';

    this.cropperInstance = new Cropper(this.previewElement, {
      aspectRatio: this.aspectRatio,
      viewMode: 2,
      dragMode: 'move',
      autoCropArea: 1,
      restore: false,
      guides: true,
      center: true,
      highlight: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
      minContainerWidth: 300,
      minContainerHeight: 300,
      responsive: true,
      modal: true,
      background: false,
      zoomable: true,
      zoomOnWheel: true,
      wheelZoomRatio: 0.1,
      ready: () => {
        console.log('Cropper ready');
      }
    });
  }

  getCroppedImage(callback) {
    if (!this.cropperInstance) {
      Alert.error('No image selected');
      return;
    }

    const canvas = this.cropperInstance.getCroppedCanvas({
      width: 400,
      height: 400,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high'
    });

    if (!canvas) {
      Alert.error('Failed to crop image');
      return;
    }

    const croppedBase64 = canvas.toDataURL('image/jpeg', 0.9);

    if (canvas.width < this.minWidth || canvas.height < this.minHeight) {
      Alert.error(`Image must be at least ${this.minWidth}x${this.minHeight}px`);
      return;
    }

    if (callback) {
      callback(croppedBase64);
    }
    
    this.onCropCallback(croppedBase64);
  }

  reset() {
    if (this.cropperInstance) {
      this.cropperInstance.destroy();
      this.cropperInstance = null;
    }
    this.previewElement.src = '';
    this.previewElement.style.display = 'none';
    this.inputElement.value = '';
    this.originalImage = null;
  }

  rotate(degrees) {
    if (this.cropperInstance) {
      this.cropperInstance.rotate(degrees);
    }
  }

  zoom(ratio) {
    if (this.cropperInstance) {
      this.cropperInstance.zoom(ratio);
    }
  }

  flip(horizontal = true) {
    if (this.cropperInstance) {
      if (horizontal) {
        this.cropperInstance.scaleX(-this.cropperInstance.getData().scaleX || -1);
      } else {
        this.cropperInstance.scaleY(-this.cropperInstance.getData().scaleY || -1);
      }
    }
  }

  destroy() {
    if (this.cropperInstance) {
      this.cropperInstance.destroy();
    }
  }
}

window.ImageCropper = ImageCropper;
