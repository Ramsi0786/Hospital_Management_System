exports.getDashboard = (req, res) => {
  res.render("patient/dashboard", {
    user: req.user,
    title: `${req.user.name}'s Dashboard - Healora`,
  });
};

// Add more patient controller functions as needed.
