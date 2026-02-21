import cloudinary from '../config/cloudinary.js';
import Patient from '../models/patient.model.js';
import Doctor from '../models/doctor.model.js';
import { HTTP_STATUS } from '../constants/index.js';

export const uploadProfileImage = async (req, res) => {
  try {
    const { croppedImage } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role || 'patient';

    if (!croppedImage) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'No image provided'
      });
    }

    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const Model = userRole === 'doctor' ? Doctor : Patient;
    const folder = userRole === 'doctor' ? 'doctors' : 'patients';

    const user = await Model.findById(userId);
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'User not found'
      });
    }

    if (user.profileImage) {
      try {
        
        const urlParts = user.profileImage.split('/');
        const publicIdWithExt = urlParts[urlParts.length - 1];
        const publicId = `${folder}/${publicIdWithExt.split('.')[0]}`;
        await cloudinary.uploader.destroy(publicId);
      } catch (err) {
        console.error('Error deleting old image:', err);
      }
    }

    const uploadResponse = await cloudinary.uploader.upload(croppedImage, {
      folder: `healora/${folder}`,
      transformation: [
        { width: 400, height: 400, crop: 'fill', gravity: 'face' },
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ]
    });

    user.profileImage = uploadResponse.secure_url;
    await user.save();

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Profile image updated successfully',
      imageUrl: uploadResponse.secure_url
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(HTTP_STATUS.SERVER_ERROR).json({
      success: false,
      error: 'Failed to upload image. Please try again.'
    });
  }
};

export const deleteProfileImage = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role || 'patient';

    if (!userId || !userRole) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const Model = userRole === 'doctor' ? Doctor : Patient;
    const folder = userRole === 'doctor' ? 'doctors' : 'patients';

    const user = await Model.findById(userId);
    if (!user || !user.profileImage) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'No profile image to delete'
      });
    }

    try {
      const urlParts = user.profileImage.split('/');
      const publicIdWithExt = urlParts[urlParts.length - 1];
      const publicId = `healora/${folder}/${publicIdWithExt.split('.')[0]}`;
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      console.error('Error deleting from Cloudinary:', err);
    }

    user.profileImage = '';
    await user.save();

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Profile image deleted successfully'
    });

  } catch (error) {
    console.error('Delete error:', error);
    return res.status(HTTP_STATUS.SERVER_ERROR).json({
      success: false,
      error: 'Failed to delete image'
    });
  }
};