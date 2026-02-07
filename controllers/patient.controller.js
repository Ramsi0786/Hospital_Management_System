export const getDashboard = (req, res) => {
  res.render("patient/dashboard", {
    user: req.user,
    title: `${req.user.name}'s Dashboard - Healora`,
    showPasswordSetupBanner: req.session.showPasswordSetupBanner || false
  });
  delete req.session.showPasswordSetupBanner;
};
