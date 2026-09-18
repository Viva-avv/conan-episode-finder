// Insert/update baris episodes dari scripts/youtube_links.json.
// Baris yg ep_number_int-nya sudah ada (dari seed.js) di-UPDATE title+youtube_url saja, sisanya di-INSERT baru.
const fs = require('fs');
const path = require('path');
const db = require(path.join(__dirname, '..', 'backend', 'db'));

const INPUT_PATH = path.join(__dirname, 'youtube_links.json');

function pickConanEntry(group) {
  // channel ini juga upload anime lain dg format judul "Eps N" yg sama (lihat check_duplicates.py) —
  // hanya proses entri yang benar-benar judulnya Detective Conan, sisanya diabaikan total
  return group.find((entry) => /conan/i.test(entry.title)) || null;
}

function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`File tidak ditemukan: ${INPUT_PATH}. Jalankan fetch_youtube_links.py dulu.`);
    process.exit(1);
  }

  const entries = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));

  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.ep_number)) {
      groups.set(entry.ep_number, []);
    }
    groups.get(entry.ep_number).push(entry);
  }

  const findStmt = db.prepare('SELECT id FROM episodes WHERE ep_number_int = ?');
  const updateStmt = db.prepare('UPDATE episodes SET title = ?, youtube_url = ? WHERE ep_number_int = ?');
  const insertStmt = db.prepare(
    'INSERT INTO episodes (ep_number_int, title, youtube_url) VALUES (?, ?, ?)'
  );

  let insertedCount = 0;
  let updatedCount = 0;
  const skippedNoConan = [];

  const run = db.transaction(() => {
    for (const [epNumber, group] of groups) {
      const chosen = pickConanEntry(group);

      if (!chosen) {
        // tidak ada judul "Detective Conan" utk ep_number ini (mis. episode gabungan
        // "Eps N-M" yg cuma nomor pertamanya kecatat) -> jangan tebak2, catat & lewati
        skippedNoConan.push({ ep_number: epNumber, titles: group.map((entry) => entry.title) });
        continue;
      }

      if (group.length > 1) {
        const discarded = group.filter((entry) => entry !== chosen).map((entry) => entry.title);
        console.warn(
          `ep_number ${epNumber}: ${group.length} entri ditemukan, pakai "${chosen.title}", abaikan: ${discarded.join(', ')}`
        );
      }

      const existing = findStmt.get(epNumber);

      if (existing) {
        updateStmt.run(chosen.title, chosen.youtube_url, epNumber);
        updatedCount += 1;
      } else {
        insertStmt.run(epNumber, chosen.title, chosen.youtube_url);
        insertedCount += 1;
      }
    }
  });

  run();

  if (skippedNoConan.length > 0) {
    console.warn(
      `\n${skippedNoConan.length} ep_number dilewati krn tidak ada judul "Detective Conan": ` +
        skippedNoConan.map((s) => s.ep_number).join(', ')
    );
  }

  console.log(`Total ep_number unik diproses: ${groups.size}`);
  console.log(`Baris baru ditambahkan: ${insertedCount}`);
  console.log(`Baris diupdate        : ${updatedCount}`);
}

main();
