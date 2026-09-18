// Import youtube_url dari scripts/youtube_links.json ke tabel episodes (backend/data.sqlite).
// Reuse backend/db.js biar skema & koneksi konsisten dengan aplikasi utama.
const fs = require('fs');
const path = require('path');
const db = require(path.join(__dirname, '..', 'backend', 'db'));

const INPUT_PATH = path.join(__dirname, 'youtube_links.json');
const SKIPPED_PATH = path.join(__dirname, 'skipped.json');

function pickBestEntry(group) {
  // channel ini juga upload anime lain dg format judul "Eps N" yg sama (lihat check_duplicates.py) —
  // kalau ep_number tabrakan, prioritaskan entri yang benar-benar judulnya Detective Conan
  const conanEntries = group.filter((entry) => /conan/i.test(entry.title));
  return conanEntries.length > 0 ? conanEntries[0] : group[0];
}

function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`File tidak ditemukan: ${INPUT_PATH}. Jalankan fetch_youtube_links.py dulu.`);
    process.exit(1);
  }

  const entries = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
  const updateStmt = db.prepare('UPDATE episodes SET youtube_url = ? WHERE ep_number_int = ?');

  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.ep_number)) {
      groups.set(entry.ep_number, []);
    }
    groups.get(entry.ep_number).push(entry);
  }

  const skipped = [];
  let updatedCount = 0;

  for (const [epNumber, group] of groups) {
    const chosen = pickBestEntry(group);

    if (group.length > 1) {
      const discarded = group.filter((entry) => entry !== chosen).map((entry) => entry.title);
      console.warn(
        `ep_number ${epNumber}: ${group.length} entri ditemukan, pakai "${chosen.title}", abaikan: ${discarded.join(', ')}`
      );
    }

    const result = updateStmt.run(chosen.youtube_url, epNumber);

    if (result.changes === 0) {
      skipped.push({ ep_number: epNumber, title: chosen.title, youtube_url: chosen.youtube_url });
      continue;
    }

    updatedCount += 1;
  }

  fs.writeFileSync(SKIPPED_PATH, JSON.stringify(skipped, null, 2), 'utf8');

  console.log(`Total ep_number unik diproses: ${groups.size}`);
  console.log(`Berhasil diupdate  : ${updatedCount}`);
  console.log(`Di-skip (lihat ${path.basename(SKIPPED_PATH)}): ${skipped.length}`);
}

main();
