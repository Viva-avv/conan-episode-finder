const express = require('express');
const path = require('path');
const db = require('./db');
const searchRoutes = require('./routes/search');
const charactersRoutes = require('./routes/characters');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// sajikan frontend statis dari sini biar fetch ke /api/* same-origin (tanpa perlu CORS)
app.use(express.static(path.join(__dirname, '../frontend')));

// health check sederhana, memastikan koneksi SQLite hidup
app.get('/api/health', (req, res) => {
  const row = db.prepare('SELECT 1 AS ok').get();
  res.json({ status: 'ok', db: row.ok === 1 });
});

app.use('/api', searchRoutes);
app.use('/api', charactersRoutes);

app.listen(PORT, () => {
  console.log(`Det Kudo backend jalan di http://localhost:${PORT}`);
});
