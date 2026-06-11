const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, wrap } = require('../db');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

async function ensureAdminExists() {
  const row = await db.get('SELECT COUNT(*) AS c FROM users');
  if (parseInt(row.c) === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    await db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', ['admin', hash]);
    console.log('Usuario inicial creado: admin / admin123 — cambia la contraseña luego');
  }
}
ensureAdminExists().catch(console.error);

router.post('/login', wrap(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });

  const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: '7d' });
  res.json({ token, username: user.username });
}));

router.post('/change-password', require('../middleware/auth'), wrap(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Campos requeridos' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Contraseña actual incorrecta' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
  res.json({ ok: true });
}));

router.get('/me', require('../middleware/auth'), (req, res) => {
  res.json({ id: req.user.id, username: req.user.username });
});

module.exports = router;
