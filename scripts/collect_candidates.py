#!/usr/bin/env python3
"""Collect London news leads without pretending to edit the newspaper.

Uses only the Python standard library and writes a deduplicated, rolling
candidate file for the daily Codex research run.
"""

from __future__ import annotations

import html
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "rss_candidates.json"
MAX_PER_FEED = 15
RETENTION_DAYS = 14

SEARCHES = {
    "Near Home": [
        '"Hampstead Heath" when:3d',
        '(Hampstead OR "Belsize Park" OR "Swiss Cottage" OR NW3) London when:3d',
    ],
    "Near Work": [
        '("City of London" OR Bishopsgate OR Broadgate OR "Liverpool Street") when:3d',
    ],
    "London AI": [
        'London artificial intelligence AI when:3d',
        '(UCL OR Imperial OR "King\'s College London" OR "Queen Mary") AI when:7d',
    ],
    "London Technology": [
        'London technology science innovation when:3d',
    ],
    "Plan Ahead": [
        'London event tickets opening closing disruption when:7d',
    ],
}

PUBLISHER_FEEDS = [
    ("ianVisits", "https://www.ianvisits.co.uk/articles/feed/"),
]


def fetch_xml(url: str) -> ET.Element | None:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "BrianLondonDailyNews/1.0 (+GitHub Pages)"},
    )
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            return ET.fromstring(response.read())
    except Exception as exc:  # A broken feed should not block the other feeds.
        print(f"[warn] {url}: {exc}")
        return None


def clean_text(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value or "")
    return re.sub(r"\s+", " ", html.unescape(value).replace("\xa0", " ")).strip()


def normalise_title(value: str) -> str:
    return re.sub(r"\W+", " ", value.lower()).strip()


def parse_date(value: str) -> datetime | None:
    try:
        parsed = parsedate_to_datetime(value)
        return parsed.astimezone(timezone.utc)
    except (TypeError, ValueError):
        return None


def google_news(category: str, query: str, collected_at: str) -> list[dict]:
    encoded = urllib.parse.quote(query)
    url = (
        f"https://news.google.com/rss/search?q={encoded}"
        "&hl=en-GB&gl=GB&ceid=GB:en"
    )
    root = fetch_xml(url)
    if root is None:
        return []

    items = []
    for node in root.findall(".//item")[:MAX_PER_FEED]:
        title = clean_text(node.findtext("title") or "")
        link = clean_text(node.findtext("link") or "")
        if not title or not link:
            continue
        items.append(
            {
                "category_hint": category,
                "title": title,
                "link": link,
                "publisher": clean_text(node.findtext("source") or ""),
                "published_at": node.findtext("pubDate") or "",
                "summary": "",
                "discovered_at": collected_at,
                "discovery_source": "Google News RSS",
            }
        )
    return items


def publisher_feed(name: str, url: str, collected_at: str) -> list[dict]:
    root = fetch_xml(url)
    if root is None:
        return []

    london_terms = re.compile(
        r"\b(london|hampstead|camden|city of london|tfl|barbican|nw3)\b",
        re.IGNORECASE,
    )
    items = []
    for node in root.findall(".//item")[:40]:
        title = clean_text(node.findtext("title") or "")
        summary = clean_text(node.findtext("description") or "")
        link = clean_text(node.findtext("link") or "")
        if not title or not link or not london_terms.search(f"{title} {summary}"):
            continue
        items.append(
            {
                "category_hint": "London",
                "title": title,
                "link": link,
                "publisher": name,
                "published_at": node.findtext("pubDate") or "",
                "summary": summary[:600],
                "discovered_at": collected_at,
                "discovery_source": name,
            }
        )
        if len(items) >= MAX_PER_FEED:
            break
    return items


def load_existing() -> list[dict]:
    try:
        payload = json.loads(OUTPUT.read_text(encoding="utf-8"))
        return payload.get("items", []) if isinstance(payload, dict) else []
    except (OSError, json.JSONDecodeError):
        return []


def still_recent(item: dict, cutoff: datetime) -> bool:
    published = parse_date(item.get("published_at", ""))
    if published:
        return published >= cutoff
    try:
        discovered = datetime.fromisoformat(item["discovered_at"])
        return discovered >= cutoff
    except (KeyError, TypeError, ValueError):
        return False


def item_timestamp(item: dict) -> float:
    """Prefer the publisher's timestamp; fall back to discovery time."""
    published = parse_date(item.get("published_at", ""))
    if published:
        return published.timestamp()
    try:
        return datetime.fromisoformat(item["discovered_at"]).timestamp()
    except (KeyError, TypeError, ValueError):
        return 0.0


def deduplicate(items: list[dict]) -> list[dict]:
    seen_links: set[str] = set()
    seen_titles: set[str] = set()
    result = []
    for item in sorted(items, key=item_timestamp, reverse=True):
        link = item.get("link", "").strip()
        title_key = normalise_title(item.get("title", ""))
        if not link or not title_key or link in seen_links or title_key in seen_titles:
            continue
        seen_links.add(link)
        seen_titles.add(title_key)
        result.append(item)
    return result


def main() -> None:
    now = datetime.now(timezone.utc)
    collected_at = now.isoformat()
    fresh = []

    for category, queries in SEARCHES.items():
        for query in queries:
            print(f"Checking {category}: {query}")
            fresh.extend(google_news(category, query, collected_at))

    for name, url in PUBLISHER_FEEDS:
        print(f"Checking publisher: {name}")
        fresh.extend(publisher_feed(name, url, collected_at))

    cutoff = now - timedelta(days=RETENTION_DAYS)
    retained = [item for item in load_existing() if still_recent(item, cutoff)]
    items = deduplicate(fresh + retained)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(
            {"generated_at": collected_at, "count": len(items), "items": items},
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(items)} candidates to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
