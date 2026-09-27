"""Offline regression tests for collection coverage, concurrency and failures."""
import importlib.util
from pathlib import Path
import threading
import time
import unittest
from unittest.mock import patch
from datetime import datetime, timezone
import xml.etree.ElementTree as ET

spec = importlib.util.spec_from_file_location("collector", Path(__file__).parents[1] / "scripts/collect_candidates.py")
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)
NOW = datetime(2026, 9, 27, 8, tzinfo=timezone.utc)


def feed(url):
    root = ET.Element("rss")
    node = ET.SubElement(ET.SubElement(root, "channel"), "item")
    for key, value in {"title": "London activity " + url, "link": url,
                       "pubDate": "Sun, 27 Sep 2026 07:00:00 GMT",
                       "source": "Official source"}.items():
        ET.SubElement(node, key).text = value
    node.find("source").set("url", "https://example.gov.uk")
    return root


class CollectorTests(unittest.TestCase):
    def test_concurrent_output_is_identical_and_host_limits_hold(self):
        lock = threading.Lock()
        active = {}
        maximum = {}

        def monitored(url):
            host = collector.urllib.parse.urlsplit(url).hostname
            with lock:
                active[host] = active.get(host, 0) + 1
                maximum[host] = max(maximum.get(host, 0), active[host])
            time.sleep(0.005)
            try:
                return feed(url)
            finally:
                with lock:
                    active[host] -= 1

        serial = collector.collect({}, NOW, feed, workers=1)
        parallel = collector.collect({}, NOW, monitored)
        self.assertEqual(serial, parallel)
        self.assertEqual(len(parallel["feeds"]), sum(map(len, collector.SEARCHES.values())) + len(collector.PUBLISHER_FEEDS))
        self.assertTrue(all(value <= collector.MAX_PER_HOST for value in maximum.values()))
        self.assertEqual(maximum["news.google.com"], 2)
        self.assertEqual(parallel["collection_status"], "ok")
        self.assertEqual(parallel["items"][0]["publisher_url"], "https://example.gov.uk")

    def test_all_failures_preserve_last_success_and_retained_leads(self):
        previous = collector.collect({}, NOW, feed)
        later = datetime(2026, 9, 28, 8, tzinfo=timezone.utc)

        def fail(_):
            raise TimeoutError("fixture timeout")

        current = collector.collect(previous, later, fail)
        self.assertEqual(current["collection_status"], "failed")
        self.assertEqual(current["items"], previous["items"])
        self.assertEqual(current["last_success_at"], previous["last_success_at"])
        self.assertNotEqual(current["generated_at"], current["last_success_at"])
        self.assertTrue(all(f["last_success_at"] == NOW.isoformat() for f in current["feeds"]))

    def test_partial_failure_is_distinct_from_empty_success(self):
        def partial(url):
            if "news.google.com" in url:
                raise ValueError("broken XML")
            return ET.fromstring("<rss><channel /></rss>")
        payload = collector.collect({}, NOW, partial)
        self.assertEqual(payload["collection_status"], "partial")
        self.assertEqual(payload["count"], 0)
        self.assertEqual(payload["feeds"][-1]["status"], "ok")
        self.assertEqual(payload["feeds"][0]["status"], "error")

    def test_sort_prefers_publication_and_deduplicates(self):
        old = {"title": "London old", "link": "https://old.example", "published_at": "Sat, 26 Sep 2026 07:00:00 GMT", "discovered_at": NOW.isoformat()}
        new = {**old, "title": "London new", "link": "https://new.example", "published_at": "Sun, 27 Sep 2026 07:00:00 GMT"}
        self.assertEqual(collector.deduplicate([old, new, dict(old)]), [new, old])
        self.assertFalse(collector.still_recent(old, NOW))


if __name__ == "__main__":
    unittest.main()
