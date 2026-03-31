import {
  WeeklyAvailability,
  MonthlyAvailability,
  DailyException
} from '../models/doctoravailability.model';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function generateSlots(duration = 30) {
  const slots  = [];
  const start  = 9 * 60;       
  const end    = 17 * 60 + 30;  
  const lunchS = 12 * 60 + 30; 
  const lunchE = 14 * 60;    

  for (let t = start; t < end; t += duration) {
    if (t >= lunchS && t < lunchE) continue;
    const h = String(Math.floor(t / 60)).padStart(2, '0');
    const m = String(t % 60).padStart(2, '0');
    slots.push(`${h}:${m}`);
  }
  return slots;
}

// ==================== WEEKLY ====================

export const getWeeklyAvailability = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const weekly = await WeeklyAvailability.findOne({ doctor: doctorId });
    const duration = weekly?.slotDuration || 30;
    res.json({ success: true, weekly: weekly || null, allSlots: generateSlots(duration), slotDuration: duration });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch weekly availability' });
  }
};

export const setWeeklyAvailability = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { schedule, slotDuration } = req.body; 

    const duration = [15, 30, 45, 60].includes(Number(slotDuration)) ? Number(slotDuration) : 30;

    for (const day of DAYS) {
      if (!schedule[day]) schedule[day] = { isWorking: false, slots: [] };
    }

    const weekly = await WeeklyAvailability.findOneAndUpdate(
      { doctor: doctorId },
      { doctor: doctorId, schedule, slotDuration: duration },
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

    const [monthly, weekly] = await Promise.all([
      MonthlyAvailability.findOne({ doctor: doctorId, month: parseInt(month), year: parseInt(year) }),
      WeeklyAvailability.findOne({ doctor: doctorId })
    ]);

    const duration = weekly?.slotDuration || 30;
    res.json({ success: true, monthly: monthly || null, allSlots: generateSlots(duration), slotDuration: duration });
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

    const [exceptions, weekly] = await Promise.all([
      DailyException.find(query).sort({ date: 1 }),
      WeeklyAvailability.findOne({ doctor: doctorId })
    ]);

    const duration = weekly?.slotDuration || 30;
    res.json({ success: true, exceptions, allSlots: generateSlots(duration), slotDuration: duration });
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