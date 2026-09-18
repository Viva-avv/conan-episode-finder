const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/characters — daftar karakter utk dropdown search-select di frontend
router.get('/characters', (req, res) => {
  const rows = db
    .prepare('SELECT id, name, related_character_id, image_url FROM characters ORDER BY name ASC')
    .all();
  res.json(rows);
});

module.exports = router;
