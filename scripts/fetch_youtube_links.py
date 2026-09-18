"""Ambil daftar video dari channel YouTube @popsanimeindonesia dan cocokkan nomor episode.

Lihat SPEC.md §6 (data source) & §9 (antisipasi parsing tidak konsisten).
"""

import json
import re
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv
import os

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
ENV_PATH = PROJECT_ROOT / "backend" / ".env"

CHANNEL_HANDLE = "@popsanimeindonesia"
API_BASE_URL = "https://www.googleapis.com/youtube/v3"

# pola judul di channel ini biasanya "... Eps 12: ..." (lihat SPEC.md §9 soal ketidakkonsistenan)
EPISODE_PATTERN = re.compile(r"Eps\s*(\d+)", re.IGNORECASE)

OUTPUT_MATCHED = SCRIPT_DIR / "youtube_links.json"
OUTPUT_UNMATCHED = SCRIPT_DIR / "unmatched.json"


def load_api_key() -> str:
    load_dotenv(ENV_PATH)
    api_key = os.getenv("YOUTUBE_API_KEY")
    if not api_key:
        raise SystemExit(
            f"YOUTUBE_API_KEY tidak ditemukan. Pastikan {ENV_PATH} berisi baris "
            "YOUTUBE_API_KEY=<key-kamu>"
        )
    return api_key


def api_get(path: str, params: dict) -> dict:
    try:
        res = requests.get(f"{API_BASE_URL}/{path}", params=params, timeout=30)
    except requests.RequestException as exc:
        raise SystemExit(f"Gagal menghubungi YouTube API ({path}): {exc}") from exc

    if not res.ok:
        raise SystemExit(
            f"YouTube API mengembalikan error {res.status_code} di {path}: {res.text}"
        )
    return res.json()


def get_uploads_playlist_id(api_key: str, handle: str) -> str:
    data = api_get(
        "channels",
        {"part": "contentDetails", "forHandle": handle, "key": api_key},
    )
    items = data.get("items") or []
    if not items:
        raise SystemExit(f"Channel dengan handle {handle} tidak ditemukan.")

    return items[0]["contentDetails"]["relatedPlaylists"]["uploads"]


def iter_playlist_items(api_key: str, playlist_id: str):
    page_token = None
    while True:
        params = {
            "part": "snippet",
            "playlistId": playlist_id,
            "maxResults": 50,
            "key": api_key,
        }
        if page_token:
            params["pageToken"] = page_token

        data = api_get("playlistItems", params)
        for item in data.get("items", []):
            snippet = item.get("snippet", {})
            video_id = snippet.get("resourceId", {}).get("videoId")
            title = snippet.get("title")
            if video_id and title:
                yield title, video_id

        page_token = data.get("nextPageToken")
        if not page_token:
            break


def parse_episode_number(title: str):
    match = EPISODE_PATTERN.search(title)
    if not match:
        return None
    return int(match.group(1))


def main():
    api_key = load_api_key()

    print(f"Mencari channel {CHANNEL_HANDLE} ...")
    playlist_id = get_uploads_playlist_id(api_key, CHANNEL_HANDLE)
    print(f"Uploads playlist: {playlist_id}")

    matched = []
    unmatched = []

    for title, video_id in iter_playlist_items(api_key, playlist_id):
        ep_number = parse_episode_number(title)
        youtube_url = f"https://youtube.com/watch?v={video_id}"

        if ep_number is None:
            unmatched.append({"title": title, "youtube_url": youtube_url})
            continue

        matched.append(
            {"ep_number": ep_number, "title": title, "youtube_url": youtube_url}
        )

    matched.sort(key=lambda ep: ep["ep_number"])

    OUTPUT_MATCHED.write_text(
        json.dumps(matched, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    OUTPUT_UNMATCHED.write_text(
        json.dumps(unmatched, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    print(f"Selesai: {len(matched)} video cocok -> {OUTPUT_MATCHED.name}")
    print(f"{len(unmatched)} video tidak cocok pola regex -> {OUTPUT_UNMATCHED.name}")


if __name__ == "__main__":
    try:
        main()
    except SystemExit as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
