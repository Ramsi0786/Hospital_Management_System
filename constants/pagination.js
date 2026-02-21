export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
  
  // Specific page sizes
  PATIENTS_PER_PAGE: 10,
  DOCTORS_PER_PAGE: 10,
  DEPARTMENTS_PER_PAGE: 20,
  APPOINTMENTS_PER_PAGE: 10,
};

export const LIMITS = {
  MAX_OTP_ATTEMPTS: 5,
  MAX_RESEND_ATTEMPTS: 3,
  
  MIN_PASSWORD_LENGTH: 6,
  MAX_PASSWORD_LENGTH: 128,

  MIN_NAME_LENGTH: 3,
  MAX_NAME_LENGTH: 100,
  
  PHONE_LENGTH: 10,
  
  MIN_DEPARTMENT_NAME: 3,
  MAX_DEPARTMENT_NAME: 50,
  MIN_DEPARTMENT_DESC: 10,
  MAX_DEPARTMENT_DESC: 500,
  
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_IMAGE_SIZE: 2 * 1024 * 1024, // 2MB
};

export const VALIDATION = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^[0-9]{10}$/,
  NAME_REGEX: /^[a-zA-Z\s]+$/,
  ALPHANUMERIC_REGEX: /^[a-zA-Z0-9\s]+$/,
};


export const getOffset = (page, limit) => {
  return (page - 1) * limit;
};


export const getTotalPages = (totalItems, limit) => {
  return Math.ceil(totalItems / limit);
};

export const sanitizePagination = (page, limit) => {
  const sanitizedPage = Math.max(1, parseInt(page) || PAGINATION.DEFAULT_PAGE);
  const sanitizedLimit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(1, parseInt(limit) || PAGINATION.DEFAULT_LIMIT)
  );
  
  return {
    page: sanitizedPage,
    limit: sanitizedLimit,
    skip: getOffset(sanitizedPage, sanitizedLimit)
  };
};