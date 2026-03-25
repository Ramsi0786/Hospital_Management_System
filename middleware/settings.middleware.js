import Settings from '../models/settings.model.js';

const DEFAULTS = {
  hospital_email:                  'support@healora.com',
  hospital_phone:                  '+91 12345 67890',
  hospital_address:                'Healora Hospital, Medical District',
  hospital_tagline:                'Your Health, Our Priority',
  stats_experience:                10,
  stats_awards:                    15,
  booking_window_days:             7,
  slot_duration_minutes:           30,
  cancellation_refund_percentage:  90,
  cancellation_window_hours:       12,
  wallet_min_topup:                10,
  wallet_max_topup:                50000,
  email_booking_confirmed:         true,
  email_appointment_cancelled:     true,
  email_refund_processed:          true,
  email_appointment_reminder:      true
};

export const attachSettings = async (req, res, next) => {
  try {
    const rows = await Settings.find({});
    const map  = { ...DEFAULTS };
    rows.forEach(s => { map[s.key] = s.value; });
    res.locals.siteSettings = map;
  } catch {
    res.locals.siteSettings = { ...DEFAULTS };
  }
  next();
};