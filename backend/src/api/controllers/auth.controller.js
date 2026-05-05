const authService = require("../../application/services/auth.service");

async function login(req, res) {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  res.json({ data: result });
}

async function register(req, res) {
  const { name, email, password, role } = req.body;
  const user = await authService.register({ name, email, password, role });
  res.status(201).json({ data: user });
}

async function me(req, res) {
  res.json({ data: req.user });
}

async function getProfile(req, res) {
  const profile = authService.getAdminProfile(req.user.userId);
  res.json({ data: profile });
}

async function updateProfile(req, res) {
  const profile = authService.updateAdminProfile(req.user.userId, req.body || {});
  res.json({ data: profile });
}

async function changePassword(req, res) {
  await authService.changeAdminPassword(req.user.userId, req.body || {});
  res.status(204).end();
}

module.exports = { login, register, me, getProfile, updateProfile, changePassword };
