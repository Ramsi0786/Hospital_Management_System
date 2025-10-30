exports.validatePatientSignup = (req, res, next) => {
  const { name, email, phone, password, confirmPassword } = req.body;

  // Check all fields
  if (!name || !email || !phone || !password || !confirmPassword) {
    return res.status(400).json({ message: "All fields are required!" });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Invalid email format!" });
  }

  // Validate phone number
  const phoneRegex = /^[0-9]{10}$/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({ message: "Phone number must be 10 digits!" });
  }

  // Password match
  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match!" });
  }

  next();
};
