import Department from '../models/department.model.js';
import Doctor from '../models/doctor.model.js';
import Appointment from '../models/appointment.model.js';
import { HTTP_STATUS, PAGINATION, sanitizePagination } from '../constants/index.js';
import logger from '../utils/logger.js';

/* ==================== GET ALL DEPARTMENTS ==================== */
export const getAllDepartments = async (req, res) => {
  try {
    const {
      search = "",
      page,
      limit,
      includeDeleted,
      status = "active"
    } = req.query;

    const { page: pageNum, limit: limitNum, skip } = sanitizePagination(
      page,
      limit || PAGINATION.DEPARTMENTS_PER_PAGE
    );

    let query = {};

    if (includeDeleted === 'true') {
    } else if (status === 'deleted') {
      query.isDeleted = true;
    } else {
      query.isDeleted = false;
    }

    if (search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const total = await Department.countDocuments(query);

    const departments = await Department.find(query)
      .populate('departmentHead', 'name email specialization')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip)
      .lean();

    const departmentsWithCount = await Promise.all(
      departments.map(async (dept) => {
        const doctorCount = await Doctor.countDocuments({
          department: dept.name,
          status: { $ne: 'blocked' }
        });
        return { ...dept, doctorCount };
      })
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      departments: departmentsWithCount,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      }
    });
  } catch (error) {
    logger.error('Get departments error', 'Department', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to fetch departments'
    });
  }
};

/* ==================== GET SINGLE DEPARTMENT ==================== */
export const getDepartmentById = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('departmentHead', 'name email specialization experience consultationFee')
      .lean();

    if (!department) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Department not found'
      });
    }

    if (department.isDeleted) {
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        warning: 'This department has been deleted',
        department: {
          ...department,
          doctors: []
        }
      });
    }

    const doctors = await Doctor.find({
      department: department.name,
      status: { $ne: 'blocked' }
    })
      .select('_id name email phone specialization consultationFee experience')
      .lean();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      department: {
        ...department,
        doctors,
        doctorCount: doctors.length
      }
    });
  } catch (error) {
    logger.error('Get department error', 'Department', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to fetch department'
    });
  }
};

/* ==================== CREATE DEPARTMENT ==================== */
export const createDepartment = async (req, res) => {
  try {
    const { name, description, icon, departmentHead } = req.body;

    if (!name || name.trim().length < 3) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        errors: { name: 'Department name must be at least 3 characters' }
      });
    }

    if (!description || description.trim().length < 10) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        errors: { description: 'Description must be at least 10 characters' }
      });
    }

    const existing = await Department.findOne({
      name: { $regex: `^${name.trim()}$`, $options: 'i' }
    });

    if (existing) {
      if (existing.isDeleted) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          errors: {
            name: 'A department with this name was previously deleted. Please restore it instead.'
          },
          canRestore: true,
          departmentId: existing._id
        });
      }

      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        errors: { name: 'Department already exists' }
      });
    }

    const department = await Department.create({
      name: name.trim(),
      description: description.trim(),
      icon: icon || 'fa-hospital',
      departmentHead: departmentHead || null
    });

    logger.info(`Department created: ${name}`, 'Department');

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Department created successfully',
      department
    });
  } catch (error) {
    logger.error('Create department error', 'Department', error);

    if (error.code === 11000) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        errors: { name: 'Department already exists' }
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to create department'
    });
  }
};

/* ==================== UPDATE DEPARTMENT ==================== */
export const updateDepartment = async (req, res) => {
  try {
    const { name, description, icon, departmentHead } = req.body;

    const department = await Department.findById(req.params.id);

    if (!department) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Department not found'
      });
    }

    if (department.isDeleted) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Cannot update a deleted department. Please restore it first.'
      });
    }

    if (name && name !== department.name) {
      const existing = await Department.findOne({
        _id: { $ne: req.params.id },
        name: { $regex: `^${name.trim()}$`, $options: 'i' },
        isDeleted: false
      });

      if (existing) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          errors: { name: 'Department name already exists' }
        });
      }
    }

    const oldName = department.name;
    const newName = name?.trim() || department.name;

    department.name = newName;
    department.description = description?.trim() || department.description;
    department.icon = icon || department.icon;
    department.departmentHead = departmentHead || department.departmentHead;

    await department.save();

    if (oldName !== newName) {
      await Promise.all([
        Doctor.updateMany(
          { department: oldName },
          { $set: { department: newName } }
        ),
        Appointment.updateMany(
          { department: oldName },
          { $set: { department: newName } }
        )
      ]);

      logger.info(`Department renamed: ${oldName} → ${newName}`, 'Department');
    }

    logger.info(`Department updated: ${newName}`, 'Department');

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Department updated successfully',
      department
    });
  } catch (error) {
    logger.error('Update department error', 'Department', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to update department'
    });
  }
};

/* ==================== DELETE DEPARTMENT (Soft) ==================== */
export const deleteDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);

    if (!department) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Department not found'
      });
    }

    if (department.isDeleted) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Department is already deleted'
      });
    }

    const doctorCount = await Doctor.countDocuments({
      department: department.name,
      status: { $ne: 'blocked' }
    });

    if (doctorCount > 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: `Cannot delete department with ${doctorCount} active doctor(s). Please reassign doctors first.`
      });
    }

    department.isDeleted = true;
    department.isActive = false;
    department.deletedAt = new Date();
    department.deletedBy = req.admin?._id || null;
    await department.save();

    logger.info(`Department soft deleted: ${department.name}`, 'Department');

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Department deleted successfully'
    });
  } catch (error) {
    logger.error('Delete department error', 'Department', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to delete department'
    });
  }
};

/* ==================== RESTORE DEPARTMENT ==================== */
export const restoreDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);

    if (!department) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Department not found'
      });
    }

    if (!department.isDeleted) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Department is not deleted'
      });
    }

    department.isDeleted = false;
    department.isActive = true;
    department.deletedAt = null;
    department.deletedBy = null;
    department.deletedReason = null;

    await department.save();

    logger.info(`Department restored: ${department.name}`, 'Department');

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Department restored successfully',
      department
    });
  } catch (error) {
    logger.error('Restore department error', 'Department', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to restore department'
    });
  }
};

/* ==================== PERMANENTLY DELETE DEPARTMENT ==================== */
export const permanentlyDeleteDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);

    if (!department) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Department not found'
      });
    }

    const [doctorCount, appointmentCount] = await Promise.all([
      Doctor.countDocuments({ department: department.name }),
      Appointment.countDocuments({ department: department.name })
    ]);

    if (doctorCount > 0 || appointmentCount > 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: `Cannot permanently delete: ${doctorCount} doctor(s) and ${appointmentCount} appointment(s) reference this department.`
      });
    }

    await Department.findByIdAndDelete(req.params.id);

    logger.info(`Department permanently deleted: ${department.name}`, 'Department');

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Department permanently deleted'
    });
  } catch (error) {
    logger.error('Permanent delete error', 'Department', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to permanently delete department'
    });
  }
};

/* ==================== TOGGLE DEPARTMENT STATUS ==================== */
export const toggleDepartmentStatus = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);

    if (!department || department.isDeleted) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Department not found'
      });
    }

    department.isActive = !department.isActive;
    await department.save();

    logger.info(
      `Department ${department.isActive ? 'activated' : 'deactivated'}: ${department.name}`,
      'Department'
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `Department ${department.isActive ? 'activated' : 'deactivated'} successfully`,
      department
    });
  } catch (error) {
    logger.error('Toggle status error', 'Department', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to toggle department status'
    });
  }
};