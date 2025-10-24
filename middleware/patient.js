exports.protectPatient = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.redirect("/patient/login");  // ← here
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "patient") return res.redirect("/patient/login");  // ← and here
    req.user = decoded;
    next();
  } catch (err) {
    res.redirect("/patient/login"); // ← and here
  }
};
