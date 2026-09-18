// Seed data contoh untuk uji query intersection (lihat SPEC.md §3 & §5).
// Dijalankan otomatis oleh db.js kalau tabel characters masih kosong,
// atau manual lewat: node seed.js

function isEmpty(db) {
  const row = db.prepare('SELECT COUNT(*) AS count FROM characters').get();
  return row.count === 0;
}

function seed(db) {
  const insertCharacter = db.prepare(
    'INSERT INTO characters (id, name, related_character_id, image_url) VALUES (?, ?, NULL, ?)'
  );
  const linkRelated = db.prepare(
    'UPDATE characters SET related_character_id = ? WHERE id = ?'
  );
  const insertEpisode = db.prepare(
    `INSERT INTO episodes (id, ep_number_jp, ep_number_int, title, arc_name, is_filler, air_date, youtube_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertAppearance = db.prepare(
    'INSERT INTO character_appearances (character_id, episode_id, role_type) VALUES (?, ?, ?)'
  );

  const run = db.transaction(() => {
    const characters = [
      [1, 'Edogawa Conan', null],
      [2, 'Kudo Shinichi', null],
      [3, 'Mouri Ran', null],
      [4, 'Mouri Kogoro', null],
      [5, 'Hattori Heiji', null],
      [6, 'Haibara Ai', null],
      [7, 'Kaitou Kid', null],
      [8, 'Kuroba Kaito', null],
      [9, 'Agasa Hiroshi', null],
    ];
    for (const [id, name, imageUrl] of characters) {
      insertCharacter.run(id, name, imageUrl);
    }

    // entri terpisah, dihubungkan via related_character_id (bukan digabung — lihat SPEC.md §3)
    linkRelated.run(2, 1); // Edogawa Conan -> Kudo Shinichi
    linkRelated.run(1, 2); // Kudo Shinichi -> Edogawa Conan
    linkRelated.run(8, 7); // Kaitou Kid -> Kuroba Kaito
    linkRelated.run(7, 8); // Kuroba Kaito -> Kaitou Kid

    const episodes = [
      [1, 1, 1, 'Roller Coaster Murder Case', 'Jimigray Kidnapping Case', 0, '1996-01-08', 'https://youtube.com/watch?v=ep1'],
      [2, 2, 2, 'The Mysterious Note in the Box', 'Jimigray Kidnapping Case', 0, '1996-01-15', 'https://youtube.com/watch?v=ep2'],
      [3, 5, 5, 'Soccer Star Kidnapping Case', null, 1, '1996-02-05', 'https://youtube.com/watch?v=ep3'],
      [4, 42, 40, 'Osaka Dual Suspension Murder Case', 'Heiji Introduction', 0, '1997-02-24', 'https://youtube.com/watch?v=ep4'],
      [5, 76, 72, 'The Weathercock Mansion Case', null, 0, '1997-06-16', 'https://youtube.com/watch?v=ep5'],
      [6, 219, 149, 'The Magician Under the Moonlit Sky', 'Kaitou Kid Arc', 0, '2000-04-22', 'https://youtube.com/watch?v=ep6'],
      [7, 88, 84, 'Fanta G Vending Machine Case', null, 1, '1997-09-08', 'https://youtube.com/watch?v=ep7'],
      [8, 305, 218, 'Conan vs Kid', 'Kaitou Kid Arc', 0, '2002-06-22', 'https://youtube.com/watch?v=ep8'],
      [9, 130, 123, 'The Beginning', 'Shinichi Flashback', 0, '1998-11-16', 'https://youtube.com/watch?v=ep9'],
      [10, 400, 300, 'Case Closed Reunion', null, 0, '2005-01-01', 'https://youtube.com/watch?v=ep10'],
    ];
    for (const ep of episodes) {
      insertEpisode.run(...ep);
    }

    const appearances = [
      [1, 1, 'main'], [3, 1, 'main'], [4, 1, 'main'], [9, 1, 'cameo'],
      [1, 2, 'main'], [3, 2, 'main'], [9, 2, 'cameo'],
      [1, 3, 'main'], [3, 3, 'main'], [6, 3, 'main'],
      [1, 4, 'main'], [5, 4, 'main'], [3, 4, 'cameo'],
      [1, 5, 'main'], [5, 5, 'main'], [7, 5, 'main'],
      [1, 6, 'main'], [7, 6, 'main'],
      [1, 7, 'cameo'], [6, 7, 'main'], [9, 7, 'main'],
      [1, 8, 'main'], [5, 8, 'cameo'], [7, 8, 'main'],
      [2, 9, 'main'], [3, 9, 'main'],
      [1, 10, 'main'], [3, 10, 'main'], [4, 10, 'cameo'], [5, 10, 'main'], [8, 10, 'cameo'], [9, 10, 'mentioned'],
    ];
    for (const [characterId, episodeId, roleType] of appearances) {
      insertAppearance.run(characterId, episodeId, roleType);
    }
  });

  run();
}

function seedIfEmpty(db) {
  if (!isEmpty(db)) {
    return false;
  }
  seed(db);
  return true;
}

module.exports = { seed, seedIfEmpty, isEmpty };

if (require.main === module) {
  const db = require('./db');
  const wasSeeded = seedIfEmpty(db);
  console.log(
    wasSeeded
      ? 'Seed data berhasil ditambahkan: 9 karakter, 10 episode.'
      : 'Database sudah berisi data, seed dilewati.'
  );
}
