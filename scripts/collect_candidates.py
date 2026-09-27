#!/usr/bin/env python3
"""Collect London news leads without pretending to edit the newspaper.

Uses only the Python standard library and writes a deduplicated, rolling
candidate file for the daily Codex research run.
"""

from __future__ import annotations

import html
import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from threading import BoundedSemaphore


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "rss_candidates.json"
MAX_PER_FEED = 15
RETENTION_DAYS = 14
MAX_WORKERS = 4
MAX_PER_HOST = 2

SEARCHES = {
    # Preserve independent queries in every section; ranking is not reporting.
    "Near Home": [
        '"Hampstead Heath" when:3d',
        '(Hampstead OR "Belsize Park" OR "Swiss Cottage" OR NW3) London when:3d',
        '(Gospel Oak OR "Finchley Road" OR "South End Green") London when:3d',
    ],
    "Near Work": [
        '("City of London" OR Bishopsgate OR Broadgate OR "Liverpool Street") when:3d',
        '(Spitalfields OR "Square Mile" OR Moorgate OR Barbican) London when:3d',
    ],
    "London AI": [
        'London artificial intelligence AI when:3d',
        '(UCL OR Imperial OR "King\'s College London" OR "Queen Mary") AI when:7d',
    ],
    "London Technology": [
        'London technology science innovation when:3d',
        '(London startup OR "London tech" OR robotics OR quantum OR biotech) when:5d',
    ],
    "Plan Ahead": [
        'London event tickets opening closing disruption when:7d',
        '(London exhibition OR festival OR "ticket release") when:10d',
    ],
}

PUBLISHER_FEEDS = [
    ("ianVisits", "https://www.ianvisits.co.uk/articles/feed/"),
]


def fetch_xml(url: str) -> ET.Element:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "BrianLondonDailyNews/1.0 (+GitHub Pages)"},
    )
    with urllib.request.urlopen(request, timeout=25) as response:
        root = ET.fromstring(response.read())
    if root.tag != "rss":
        raise ValueError("Expected an RSS document")
    return root


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


def google_news_url(query: str) -> str:
    encoded = urllib.parse.quote(query)
    return (
        f"https://news.google.com/rss/search?q={encoded}"
        "&hl=en-GB&gl=GB&ceid=GB:en"
    )


def google_news(category: str, query: str, collected_at: str, fetcher=fetch_xml) -> list[dict]:
    root = fetcher(google_news_url(query))

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
                "publisher_url": node.find("source").get("url", "") if node.find("source") is not None else "",
                "published_at": node.findtext("pubDate") or "",
                "summary": "",
                "discovered_at": collected_at,
                "discovery_source": "Google News RSS",
            }
        )
    return items


def publisher_feed(name: str, url: str, collected_at: str, fetcher=fetch_xml) -> list[dict]:
    root = fetcher(url)

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


def load_existing(output: Path = OUTPUT) -> dict:
    try:
        payload = json.loads(output.read_text(encoding="utf-8"))
        return payload if isinstance(payload, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


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


def collect(existing: dict, now: datetime, fetcher=fetch_xml,
            workers: int = MAX_WORKERS, per_host: int = MAX_PER_HOST) -> dict:
    """Fetch in parallel, then merge in configured order regardless of completion order."""
    if workers < 1 or per_host < 1:
        raise ValueError("Concurrency limits must be positive")
    collected_at = now.isoformat()
    jobs = [(google_news_url(query), category, query, True)
            for category, queries in SEARCHES.items() for query in queries]
    jobs.extend((url, name, url, False) for name, url in PUBLISHER_FEEDS)
    gates = {urllib.parse.urlsplit(url).hostname: BoundedSemaphore(per_host)
             for url, *_ in jobs}
    previous = {feed["url"]: feed for feed in existing.get("feeds", [])}

    def run(job):
        url, name, query, is_search = job
        health = {"url": url, "name": name, "attempted_at": collected_at,
                  "last_success_at": previous.get(url, {}).get("last_success_at")}
        try:
            with gates[urllib.parse.urlsplit(url).hostname]:
                items = (google_news(name, query, collected_at, fetcher) if is_search
                         else publisher_feed(name, url, collected_at, fetcher))
            health.update(status="ok", last_success_at=collected_at, item_count=len(items))
            return items, health
        except Exception as exc:  # One failed feed must not suppress the others.
            health.update(status="error", item_count=0, error=str(exc))
            return [], health

    with ThreadPoolExecutor(max_workers=workers) as executor:
        results = list(executor.map(run, jobs))
    fresh = [item for items, _ in results for item in items]
    feeds = [health for _, health in results]
    cutoff = now - timedelta(days=RETENTION_DAYS)
    retained = [item for item in existing.get("items", []) if still_recent(item, cutoff)]
    items = deduplicate(fresh + retained)
    successes = sum(feed["status"] == "ok" for feed in feeds)
    return {"generated_at": collected_at,
            "last_success_at": collected_at if successes else existing.get("last_success_at"),
            "collection_status": "ok" if successes == len(feeds) else "partial" if successes else "failed",
            "feeds": feeds, "count": len(items), "items": items}


def main() -> int:
    started = time.perf_counter()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    payload = collect(load_existing(args.output), datetime.now(timezone.utc))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(
            payload,
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    for feed in payload["feeds"]:
        if feed["status"] == "error":
            print(f"[warn] {feed['url']}: {feed['error']}", file=sys.stderr)
    print(f"Wrote {payload['count']} candidates to {args.output}; collection {payload['collection_status']} in {time.perf_counter() - started:.2f}s")
    return 1 if payload["collection_status"] == "failed" else 0


if __name__ == "__main__":
    sys.exit(main())
