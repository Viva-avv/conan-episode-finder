# Conan Episode Finder — Spesifikasi Proyek

## 1. Ringkasan
Web app sederhana untuk mencari episode Detective Conan berdasarkan **irisan kemunculan 2 atau lebih karakter** dalam episode yang sama. mendukung N karakter dari awal, filter arc/canon-filler, dan rencana auto-scraping data.

## 2. Fitur inti
1. User memilih 2–4 karakter (search-select/autocomplete)
2. Sistem mencari irisan episode di mana **semua** karakter yang dipilih muncul bersama
3. Hasil ditampilkan sebagai kartu episode: judul, nomor episode, status canon/filler, tombol **Tonton** (link YouTube)
4. Filter tambahan (opsional, v2): arc/kasus, rentang tahun tayang

## 3. Keputusan desain penting
- **Edogawa Conan dan Shinichi Kudo adalah entri karakter TERPISAH**, bukan alias yang digabung. Alasan: user mungkin hanya ingin melihat episode Shinichi versi dewasa, terpisah dari episode-episode Conan. Field `related_character_id` dipakai untuk menandai relasi identitas tanpa menggabungkan data appearance.
- Pola yang sama berlaku untuk karakter lain dengan identitas ganda (misal Kaito Kid vs Kaito Kuroba) — dipisah sebagai entri berbeda.
- Query intersection dirancang untuk mendukung N karakter sejak awal (bukan hardcode 2), pakai `GROUP BY episode_id HAVING COUNT(DISTINCT character_id) = jumlah_karakter_dipilih`.

## 4. Skema database

```sql
CREATE TABLE characters (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  related_character_id INTEGER REFERENCES characters(id), -- opsional, utk identitas ganda
  image_url TEXT
);

CREATE TABLE episodes (
  id INTEGER PRIMARY KEY,
  ep_number_jp INTEGER,
  ep_number_int INTEGER,
  title TEXT NOT NULL,
  arc_name TEXT,
  is_filler BOOLEAN DEFAULT FALSE,
  air_date DATE,
  youtube_url TEXT
);

CREATE TABLE character_appearances (
  character_id INTEGER REFERENCES characters(id),
  episode_id INTEGER REFERENCES episodes(id),
  role_type TEXT, -- main / cameo / mentioned
  PRIMARY KEY (character_id, episode_id)
);

CREATE INDEX idx_char_appear_char ON character_appearances(character_id);
CREATE INDEX idx_char_appear_ep ON character_appearances(episode_id);
```

## 5. Query intersection (contoh, N karakter)

```sql
SELECT e.*
FROM episodes e
JOIN character_appearances ca ON e.id = ca.episode_id
WHERE ca.character_id IN (?, ?, ?)  -- daftar id karakter yang dipilih
GROUP BY e.id
HAVING COUNT(DISTINCT ca.character_id) = ?  -- jumlah karakter yang dicari
```

## 6. Stack yang disarankan
- Backend: Node.js + Express (atau Python + FastAPI)
- Database: SQLite (awal) → PostgreSQL kalau data membesar
- Frontend: HTML/CSS/JS sederhana, atau React
- Data source: scraping dari Detective Conan Wiki (Fandom) via Python + BeautifulSoup

## 7. Alur UI (mobile-first, single column)
1. Header: nama app + tagline singkat
2. Card pencarian: 2–4 search-select karakter (autocomplete, penting karena karakter bisa ratusan) + tombol cari
3. Daftar hasil: kartu per episode (judul, nomor, badge canon/filler, tombol Tonton)
4. Empty state: pesan jelas kalau irisan kosong (bukan bug)
5. Loading state: skeleton/spinner saat query jalan

## 7a. Gaya visual (UI style)
Arah desain: **sederhana tapi playful** — bukan tema dark/serius seperti referensi "case file". Elemen strukturnya tetap minimal (single column, whitespace lega), tapi aksennya lewat ikon.

- **Ikon**: bergaya komik/kartun berwarna atau sketsa tangan, bukan ikon outline flat generik. Opsi sumber:
  - [Flaticon — koleksi "Stickers"](https://www.flaticon.com/stickers) — ikon berwarna gaya kartun, gratis dengan atribusi
  - [Icons8 — gaya "Cartoon" / "Doodle"](https://icons8.com/icons/cartoon) — ada versi berwarna dan sketsa
  - [unDraw](https://undraw.co/) — kalau mau ilustrasi karakter/adegan pendukung (bukan cuma ikon kecil), gaya flat tapi bisa dikustom warnanya
  - Alternatif: cari "sticker pack detective/mystery" di Flaticon buat nuansa investigasi yang tetap playful (kaca pembesar, jejak kaki, sidik jari — versi kartun)
- **Palet warna**: cerah dan ramah, bukan monokrom. Contoh dasar: krem/putih sebagai background, 1 warna aksen cerah (misal kuning mustard atau biru cerah) untuk tombol utama, warna-warni natural dari ikon itu sendiri sebagai penyegar visual.
- **Tipografi**: sans-serif membulat agar terasa santai (misal Poppins, Quicksand, atau Baloo 2 dari Google Fonts), bukan serif formal.
- **Kartu episode**: rounded corner lebih besar (16–20px) dan border tipis atau tanpa border, kasih 1 ikon kartun kecil di pojok kartu (misal ikon kamera film atau kaca pembesar) sebagai aksen, bukan dekorasi berlebihan.
- **Tombol Tonton**: ikon play bergaya sticker/kartun berwarna, bukan ikon monokrom polos.

## 8. Roadmap
- **v1**: irisan 2+ karakter (identitas dipisah sesuai §3), input data manual
- **v1.5**: tombol Tonton (link YouTube), filter canon/filler
- **v2**: filter arc/kasus dan rentang tahun, auto-scraping data appearance dari wiki

## 9. Hal yang perlu diantisipasi
- Parsing halaman wiki "List of Characters" per episode kemungkinan tidak konsisten strukturnya antar episode — perlu cleaning manual di beberapa kasus
- Data appearance untuk 1000+ episode cukup besar — pertimbangkan cache hasil query yang sering diakses
