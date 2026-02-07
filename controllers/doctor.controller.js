export const getDashboard = (req, res) => {
  res.render("doctor/dashboard", {
    user: req.user,
    title: `Dr. ${req.user.name}'s Dashboard - Healora`,
  });
};
