export const USER_ROLES = {
  ADMIN:   'admin',
  DOCTOR:  'doctor',
  PATIENT: 'patient'
};

export const isValidRole = (role) => {
  return Object.values(USER_ROLES).includes(role);
};


export const getRoleDisplayName = (role) => {
  const displayNames = {
    [USER_ROLES.ADMIN]: 'Administrator',
    [USER_ROLES.SUPER_ADMIN]: 'Super Administrator',
    [USER_ROLES.DOCTOR]: 'Doctor',
    [USER_ROLES.PATIENT]: 'Patient'
  };
  return displayNames[role] || 'Unknown';
};
