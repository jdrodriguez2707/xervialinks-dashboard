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

module.exports = { login, register, me };
