"""Scrape data kemunculan karakter per episode dari Detective Conan Wiki (detectiveconanworld.com).

Isi tabel character_appearances (backend/data.sqlite) berdasarkan seksi "Cast" di halaman
wiki tiap episode. Cuma karakter yang SUDAH ada di tabel characters yang dicocokkan (tidak
membuat karakter baru otomatis) biar dropdown pilihan karakter di frontend tidak kebanjiran
ratusan nama tokoh sekali-muncul (korban/tersangka per kasus).

Lihat SPEC.md §6 (data source) & §9 (antisipasi struktur wiki tidak konsisten).
"""

import argparse
import json
import sqlite3
import sys
import time
from pathlib import Path
from urllib.parse import unquote

import requests
from bs4 import BeautifulSoup

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DB_PATH = PROJECT_ROOT / "backend" / "data.sqlite"

WIKI_BASE = "https://www.detectiveconanworld.com"
SEASON_COUNT = 31  # Season_1 .. Season_31 di situs saat ini, cek ulang kalau ada season baru
REQUEST_DELAY_SECONDS = 0.6  # jaga2 biar tidak membebani server wiki

UNMATCHED_EPISODES_PATH = SCRIPT_DIR / "unmatched_episodes.json"
UNMATCHED_CHARACTERS_PATH = SCRIPT_DIR / "unmatched_characters.json"

HEADERS = {"User-Agent": "conan-episode-finder-scraper/1.0 (personal project, low volume)"}

# alias utk perbedaan romanisasi nama antara wiki & data kita (lihat SPEC.md §3 soal identitas ganda)
NAME_ALIASES = {
    "kaito kid": "kaitou kid",
}


def normalize_name(name):
    key = name.lower().strip()
    key = NAME_ALIASES.get(key, key)
    return tuple(sorted(key.split()))


def slug_to_name(href):
    slug = href.split("/wiki/")[-1]
    return unquote(slug).replace("_", " ")


def fetch_soup(url):
    res = requests.get(url, timeout=30, headers=HEADERS)
    res.raise_for_status()
    return BeautifulSoup(res.text, "html.parser")


def build_episode_url_map():
    """Peta nomor episode Jepang (Jp#) -> URL wiki, dari tabel 'List of episodes' tiap season.

    Catatan: data kita di ep_number_int sebenarnya berisi nomor Jp# hasil scrape judul YouTube
    (lihat fetch_youtube_links.py), makanya di-mapping pakai kolom Jp# di wiki, bukan Int#.
    """
    url_map = {}
    for season in range(1, SEASON_COUNT + 1):
        url = f"{WIKI_BASE}/wiki/Season_{season}"
        try:
            soup = fetch_soup(url)
        except requests.RequestException as exc:
            print(f"  gagal ambil {url}: {exc}", file=sys.stderr)
            continue

        for row in soup.select("table tr"):
            cells = row.find_all("td")
            if len(cells) < 3:
                continue
            jp_text = cells[0].get_text(strip=True)
            if not jp_text.isdigit():
                continue
            link = cells[2].find("a")
            if not link or not link.get("href"):
                continue
            url_map[int(jp_text)] = WIKI_BASE + link["href"]

        time.sleep(REQUEST_DELAY_SECONDS)

    return url_map


def extract_cast_names(soup):
    heading = soup.find(id="Cast")
    if not heading:
        return []

    # skin wiki terbaru bungkus tiap heading dlm <div class="mw-heading mw-headingN">,
    # jadi konten seksi ada di div SETELAHNYA, bukan nested di dalam heading itu sendiri
    heading_div = heading.find_parent("div", class_="mw-heading") or heading

    names = []
    seen_hrefs = set()
    for sibling in heading_div.find_next_siblings():
        classes = sibling.get("class") or []
        if "mw-heading2" in classes:
            break  # sudah masuk seksi H2 berikutnya (mis. Plot)
        for link in sibling.find_all("a"):
            href = link.get("href", "")
            if not href.startswith("/wiki/"):
                continue
            if ":" in href.split("/wiki/")[-1]:  # skip File:, Category:, dst
                continue
            if href in seen_hrefs:
                continue
            seen_hrefs.add(href)
            names.append(slug_to_name(href))
    return names


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--limit", type=int, default=None, help="batasi jumlah episode yg diproses (utk testing)"
    )
    args = parser.parse_args()

    if not DB_PATH.exists():
        raise SystemExit(f"Database tidak ditemukan: {DB_PATH}")

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")

    characters = conn.execute("SELECT id, name FROM characters").fetchall()
    character_by_name = {normalize_name(name): char_id for char_id, name in characters}

    episodes = conn.execute(
        "SELECT id, ep_number_int, title FROM episodes ORDER BY ep_number_int"
    ).fetchall()
    if args.limit:
        episodes = episodes[: args.limit]

    print("Membangun peta episode -> URL wiki dari halaman season ...")
    url_map = build_episode_url_map()
    print(f"Ditemukan {len(url_map)} entri episode di wiki.\n")

    unmatched_episodes = []
    unmatched_characters = set()
    appearances_added = 0
    episodes_processed = 0

    insert_sql = (
        "INSERT OR IGNORE INTO character_appearances (character_id, episode_id, role_type) "
        "VALUES (?, ?, 'main')"
    )

    for ep_id, ep_number_int, title in episodes:
        wiki_url = url_map.get(ep_number_int)
        if not wiki_url:
            unmatched_episodes.append(
                {"episode_id": ep_id, "ep_number_int": ep_number_int, "title": title}
            )
            continue

        try:
            soup = fetch_soup(wiki_url)
        except requests.RequestException as exc:
            print(f"  gagal ambil {wiki_url}: {exc}", file=sys.stderr)
            unmatched_episodes.append(
                {"episode_id": ep_id, "ep_number_int": ep_number_int, "title": title}
            )
            continue

        for name in extract_cast_names(soup):
            char_id = character_by_name.get(normalize_name(name))
            if char_id is None:
                unmatched_characters.add(name)
                continue
            cursor = conn.execute(insert_sql, (char_id, ep_id))
            appearances_added += cursor.rowcount

        episodes_processed += 1
        print(f"  [{episodes_processed}/{len(episodes)}] ep {ep_number_int}: {title}")
        time.sleep(REQUEST_DELAY_SECONDS)

    conn.commit()
    conn.close()

    UNMATCHED_EPISODES_PATH.write_text(
        json.dumps(unmatched_episodes, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    UNMATCHED_CHARACTERS_PATH.write_text(
        json.dumps(sorted(unmatched_characters), indent=2, ensure_ascii=False), encoding="utf-8"
    )

    print(f"\nEpisode diproses        : {episodes_processed}")
    print(f"Appearance ditambahkan  : {appearances_added}")
    print(
        f"Episode tanpa halaman wiki (lihat {UNMATCHED_EPISODES_PATH.name}): {len(unmatched_episodes)}"
    )
    print(
        f"Nama karakter tak dikenal (lihat {UNMATCHED_CHARACTERS_PATH.name}): {len(unmatched_characters)}"
    )


if __name__ == "__main__":
    main()
