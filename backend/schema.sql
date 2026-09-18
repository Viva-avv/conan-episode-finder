-- Skema database Conan Episode Finder (lihat SPEC.md bagian 4)

CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  -- opsional: menandai relasi identitas ganda (mis. Edogawa Conan <-> Shinichi Kudo)
  -- TANPA menggabungkan data appearance kedua entri
  related_character_id INTEGER REFERENCES characters(id),
  image_url TEXT
);

CREATE TABLE IF NOT EXISTS episodes (
  id INTEGER PRIMARY KEY,
  ep_number_jp INTEGER,
  ep_number_int INTEGER,
  title TEXT NOT NULL,
  arc_name TEXT,
  is_filler BOOLEAN DEFAULT FALSE,
  air_date DATE,
  youtube_url TEXT
);

CREATE TABLE IF NOT EXISTS character_appearances (
  character_id INTEGER REFERENCES characters(id),
  episode_id INTEGER REFERENCES episodes(id),
  role_type TEXT, -- main / cameo / mentioned
  PRIMARY KEY (character_id, episode_id)
);

CREATE INDEX IF NOT EXISTS idx_char_appear_char ON character_appearances(character_id);
CREATE INDEX IF NOT EXISTS idx_char_appear_ep ON character_appearances(episode_id);
