// middleware/auth.js
const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  // Look for token in Authorization header (Bearer <token>) OR query param
  const token = req.headers["authorization"]?.split(" ")[1] || req.query.token;

  if (!token) {
    // If no token, redirect back to login page
    return res.redirect("/doctor-login");
  }

  try {
    // Verify token with your secret key
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach doctor info from token to request
    req.user = decoded;

    // Allow access to the next route
    next();
  } catch (err) {
    // If token is invalid or expired → redirect to login
    return res.redirect("/doctor-login");
  }
}

module.exports = authMiddleware;
