import Department from '../models/department.model.js';
import Doctor from '../models/doctor.model.js';
import Appointment from '../models/appointment.model.js';

// =================== Get all departments =====================
export const getAllDepartments = async (req, res) => {
  try {
    const { search, includeDeleted } = req.query;

    let query = { isDeleted: false };

    if (includeDeleted === 'true') {
      query = {}; 
    }
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    
    const departments = await Department.find(query)
      .populate('departmentHead', 'name email specialization')
      .sort({ createdAt: -1 })
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
    
    res.json({
      success: true,
      departments: departmentsWithCount
    });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch departments'
    });
  }
};

export const getDepartmentById = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('departmentHead', 'name email specialization experience consultationFee')
      .lean();
    
    if (!department) {
      return res.status(404).json({
        success: false,
        error: 'Department not found'
      });
    }

    if (department.isDeleted) {
      return res.status(200).json({
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
    
    res.json({
      success: true,
      department: {
        ...department,
        doctors,
        doctorCount: doctors.length
      }
    });
  } catch (error) {
    console.error('Get department error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch department'
    });
  }
};

export const createDepartment = async (req, res) => {
  try {
    const { name, description, icon, departmentHead } = req.body;
    
    if (!name || name.trim().length < 3) {
      return res.status(400).json({
        success: false,
        errors: { name: 'Department name must be at least 3 characters' }
      });
    }
    
    if (!description || description.trim().length < 10) {
      return res.status(400).json({
        success: false,
        errors: { description: 'Description must be at least 10 characters' }
      });
    }
 
    const existing = await Department.findOne({ 
      name: { $regex: `^${name.trim()}$`, $options: 'i' }
    });
    
    if (existing) {
      if (existing.isDeleted) {
        return res.status(400).json({
          success: false,
          errors: { 
            name: 'A department with this name was previously deleted. Please restore it instead.' 
          },
          canRestore: true,
          departmentId: existing._id
        });
      }
      
      return res.status(400).json({
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
    
    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      department
    });
  } catch (error) {
    console.error('Create department error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        errors: { name: 'Department already exists' }
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create department'
    });
  }
};

export const updateDepartment = async (req, res) => {
  try {
    const { name, description, icon, departmentHead } = req.body;
    
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({
        success: false,
        error: 'Department not found'
      });
    }

    if (department.isDeleted) {
      return res.status(400).json({
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
        return res.status(400).json({
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
      await Doctor.updateMany(
        { department: oldName },
        { $set: { department: newName } }
      );

      await Appointment.updateMany(
        { department: oldName },
        { $set: { department: newName } }
      );
    }
    
    res.json({
      success: true,
      message: 'Department updated successfully',
      department
    });
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update department'
    });
  }
};

export const deleteDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({
        success: false,
        error: 'Department not found'
      });
    }

    if (department.isDeleted) {
      return res.status(400).json({
        success: false,
        error: 'Department is already deleted'
      });
    }

    const doctorCount = await Doctor.countDocuments({
      department: department.name,
      status: { $ne: 'blocked' }
    });
    
    if (doctorCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete department with ${doctorCount} active doctor(s). Please reassign doctors first.`
      });
    }

    department.isDeleted = true;
    department.isActive = false;
    department.deletedAt = new Date();
    department.deletedBy = req.admin?._id || null; 
    await department.save();
    
    res.json({
      success: true,
      message: 'Department deleted successfully'
    });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete department'
    });
  }
};

export const restoreDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({
        success: false,
        error: 'Department not found'
      });
    }

    if (!department.isDeleted) {
      return res.status(400).json({
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
    
    res.json({
      success: true,
      message: 'Department restored successfully',
      department
    });
  } catch (error) {
    console.error('Restore department error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restore department'
    });
  }
};

export const permanentlyDeleteDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({
        success: false,
        error: 'Department not found'
      });
    }

    const [doctorCount, appointmentCount] = await Promise.all([
      Doctor.countDocuments({ department: department.name }),
      Appointment.countDocuments({ department: department.name })
    ]);
    
    if (doctorCount > 0 || appointmentCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot permanently delete: ${doctorCount} doctor(s) and ${appointmentCount} appointment(s) reference this department.`
      });
    }

    await Department.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Department permanently deleted'
    });
  } catch (error) {
    console.error('Permanent delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to permanently delete department'
    });
  }
};

export const toggleDepartmentStatus = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    
    if (!department || department.isDeleted) {
      return res.status(404).json({
        success: false,
        error: 'Department not found'
      });
    }
    
    department.isActive = !department.isActive;
    await department.save();
    
    res.json({
      success: true,
      message: `Department ${department.isActive ? 'activated' : 'deactivated'} successfully`,
      department
    });
  } catch (error) {
    console.error('Toggle status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle department status'
    });
  }
};
