import jwt from "jsonwebtoken";

export const generateToken = (payload, expiresIn = null) => {
  let defaultExpiry;
  
  if (payload.role === 'patient') {
    defaultExpiry = "7d"; 
  } else if (payload.role === 'doctor') {
    defaultExpiry = "12h"; 
  } else if (payload.role === 'admin') {
    defaultExpiry = "8h";
  } else {
    defaultExpiry = "1d";
  }

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: expiresIn || defaultExpiry,
  });
};