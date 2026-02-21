
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const TIME = {
  // Basic units
  SECOND,
  MINUTE,
  HOUR,
  DAY,
  WEEK: 7 * DAY,
  MONTH: 30 * DAY,

  // JWT Token expiry
  ACCESS_TOKEN_EXPIRY: 15 * MINUTE,        // 15 minutes
  REFRESH_TOKEN_EXPIRY: 7 * DAY,            // 7 days
  ADMIN_TOKEN_EXPIRY: 8 * HOUR,             // 8 hours
  
  // Session expiry
  SESSION_EXPIRY: 10 * MINUTE,              // 10 minutes
  OTP_EXPIRY: 5 * MINUTE,                   // 5 minutes (300 seconds)
  PASSWORD_RESET_EXPIRY: 10 * MINUTE,       // 10 minutes (600 seconds)
  
  // Cookie expiry
  REMEMBER_ME_COOKIE: 30 * DAY,             // 30 days for "remember me"
  DEFAULT_COOKIE: 12 * HOUR,                // 12 hours default
  REFRESH_COOKIE: 7 * DAY,                  // 7 days for refresh token
};


export const msToSeconds = (ms) => Math.floor(ms / 1000);
export const msToMinutes = (ms) => Math.floor(ms / (60 * 1000));
export const msToHours = (ms) => Math.floor(ms / (60 * 60 * 1000));
export const msToDays = (ms) => Math.floor(ms / (24 * 60 * 60 * 1000));
