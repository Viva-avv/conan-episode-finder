const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// health check sederhana, memastikan koneksi SQLite hidup
app.get('/api/health', (req, res) => {
  const row = db.prepare('SELECT 1 AS ok').get();
  res.json({ status: 'ok', db: row.ok === 1 });
});

app.listen(PORT, () => {
  console.log(`Conan Episode Finder backend jalan di http://localhost:${PORT}`);
});
