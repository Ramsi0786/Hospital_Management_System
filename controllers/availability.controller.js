import {
  WeeklyAvailability,
  MonthlyAvailability,
  DailyException
} from '../models/doctorAvailability.model.js';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const ALL_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30',
  '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30'
];

// ==================== WEEKLY ====================

export const getWeeklyAvailability = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const weekly = await WeeklyAvailability.findOne({ doctor: doctorId });
    res.json({ success: true, weekly: weekly || null, allSlots: ALL_SLOTS });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch weekly availability' });
  }
};

export const setWeeklyAvailability = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { schedule } = req.body;

    for (const day of DAYS) {
      if (!schedule[day]) {
        schedule[day] = { isWorking: false, slots: [] };
      }
    }

    const weekly = await WeeklyAvailability.findOneAndUpdate(
      { doctor: doctorId },
      { doctor: doctorId, schedule },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Weekly availability saved', weekly });
  } catch (err) {
    console.error('Set weekly error:', err);
    res.status(500).json({ success: false, error: 'Failed to save weekly availability' });
  }
};

// ==================== MONTHLY ====================

export const getMonthlyAvailability = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { month, year } = req.query;

    const monthly = await MonthlyAvailability.findOne({
      doctor: doctorId,
      month: parseInt(month),
      year: parseInt(year)
    });

    res.json({ success: true, monthly: monthly || null, allSlots: ALL_SLOTS });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch monthly availability' });
  }
};

export const setMonthlyAvailability = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { month, year, schedule } = req.body;

    for (const day of DAYS) {
      if (!schedule[day]) {
        schedule[day] = { isWorking: false, slots: [] };
      }
    }

    const monthly = await MonthlyAvailability.findOneAndUpdate(
      { doctor: doctorId, month, year },
      { doctor: doctorId, month, year, schedule },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Monthly availability saved', monthly });
  } catch (err) {
    console.error('Set monthly error:', err);
    res.status(500).json({ success: false, error: 'Failed to save monthly availability' });
  }
};

// ==================== DAILY EXCEPTIONS ====================

export const getDailyExceptions = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { month, year } = req.query;

    let query = { doctor: doctorId };

    if (month && year) {
      const monthStr = String(parseInt(month)).padStart(2, '0');
      query.date = { $regex: `^${year}-${monthStr}` };
    }

    const exceptions = await DailyException.find(query).sort({ date: 1 });
    res.json({ success: true, exceptions, allSlots: ALL_SLOTS });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch exceptions' });
  }
};

export const setDailyException = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date, isWorking, slots, reason } = req.body;

    if (!date) {
      return res.status(400).json({ success: false, error: 'Date is required' });
    }

    const exception = await DailyException.findOneAndUpdate(
      { doctor: doctorId, date },
      { doctor: doctorId, date, isWorking: isWorking || false, slots: slots || [], reason: reason || '' },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Exception saved', exception });
  } catch (err) {
    console.error('Set daily exception error:', err);
    res.status(500).json({ success: false, error: 'Failed to save exception' });
  }
};

export const deleteDailyException = async (req, res) => {
  try {
    const { doctorId, date } = req.params;

    await DailyException.findOneAndDelete({ doctor: doctorId, date });
    res.json({ success: true, message: 'Exception removed' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete exception' });
  }
};


// ==================== RESOLVE SLOTS ====================

export const getAvailableSlots = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query; 

    if (!date) {
      return res.status(400).json({ success: false, error: 'Date is required' });
    }

    const slots = await resolveSlots(doctorId, date);

    res.json({ success: true, date, slots });
  } catch (err) {
    console.error('Get available slots error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch slots' });
  }
};

export const resolveSlots = async (doctorId, date) => {

  const dateObj   = new Date(date);
  const dayOfWeek = DAYS[dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1]; // Mon=0
  const month     = dateObj.getMonth() + 1;
  const year      = dateObj.getFullYear();

  const exception = await DailyException.findOne({ doctor: doctorId, date });
  if (exception) {
    return {
      isWorking: exception.isWorking,
      slots: exception.isWorking ? exception.slots : [],
      source: 'exception',
      reason: exception.reason || ''
    };
  }

  const monthly = await MonthlyAvailability.findOne({ doctor: doctorId, month, year });
  if (monthly && monthly.schedule[dayOfWeek]) {
    const daySchedule = monthly.schedule[dayOfWeek];
    return {
      isWorking: daySchedule.isWorking,
      slots: daySchedule.isWorking ? daySchedule.slots : [],
      source: 'monthly'
    };
  }

  const weekly = await WeeklyAvailability.findOne({ doctor: doctorId });
  if (weekly && weekly.schedule[dayOfWeek]) {
    const daySchedule = weekly.schedule[dayOfWeek];
    return {
      isWorking: daySchedule.isWorking,
      slots: daySchedule.isWorking ? daySchedule.slots : [],
      source: 'weekly'
    };
  }

  return { isWorking: false, slots: [], source: 'none' };
};