// Example: Admin controller (expand as needed)
exports.getDashboard = (req, res) => {
  res.render("admin/dashboard", {
    user: req.user,
    title: `${req.user.name}'s Admin Dashboard - Healora`,
  });
};

// Add additional admin logic as needed here.
