import json
import collections
from pathlib import Path

path = Path(__file__).resolve().parent / "youtube_links.json"
data = json.loads(path.read_text(encoding="utf-8"))

groups = collections.defaultdict(list)
for item in data:
    groups[item["ep_number"]].append(item)

dupes = {ep: items for ep, items in groups.items() if len(items) > 1}

print(f"Total ep_number unik: {len(groups)}")
print(f"ep_number dengan duplikat: {len(dupes)}")
print()

for ep in sorted(dupes):
    items = dupes[ep]
    print(f"--- ep_number {ep} ({len(items)}x) ---")
    for it in items:
        print(f"  title: {it['title']}")
        print(f"  url:   {it['youtube_url']}")
    print()
