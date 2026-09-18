const express = require('express');
const db = require('../db');

const router = express.Router();

const MIN_CHARACTERS = 2;
const MAX_CHARACTERS = 4;

// POST /api/search — irisan episode utk N karakter (lihat SPEC.md bagian 5)
router.post('/search', (req, res) => {
  const { character_ids } = req.body || {};

  if (!Array.isArray(character_ids)) {
    return res.status(400).json({ error: 'character_ids harus berupa array' });
  }

  const ids = character_ids.map((id) => Number(id));
  if (ids.some((id) => !Number.isInteger(id))) {
    return res.status(400).json({ error: 'character_ids harus berisi angka id yang valid' });
  }

  if (ids.length < MIN_CHARACTERS || ids.length > MAX_CHARACTERS) {
    return res.status(400).json({
      error: `character_ids harus berisi minimal ${MIN_CHARACTERS} dan maksimal ${MAX_CHARACTERS} id`,
    });
  }

  const placeholders = ids.map(() => '?').join(', ');
  const rows = db
    .prepare(
      `SELECT e.id, e.title, e.ep_number_jp, e.ep_number_int, e.arc_name, e.is_filler, e.youtube_url
       FROM episodes e
       JOIN character_appearances ca ON e.id = ca.episode_id
       WHERE ca.character_id IN (${placeholders})
       GROUP BY e.id
       HAVING COUNT(DISTINCT ca.character_id) = ?`
    )
    .all(...ids, ids.length);

  res.json(rows);
});

module.exports = router;
