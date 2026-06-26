# -*- coding: utf-8 -*-
"""
utils.py
Zajednicki alati za cijeli scraping projekt:
- HTTP sesija s rotacijom User-Agenta, retry/backoff i throttlingom
- lokalni cache odgovora (manji broj zahtjeva = minimalan usage)
- lokalno parsiranje HTML-a (JSON-LD, meta tagovi, regex za tel/email/koordinate)
- pomocne funkcije za citanje/pisanje JSON / JSONL
"""

import hashlib
import json
import random
import re
import time
from pathlib import Path

import requests

# --------------------------------------------------------------------------- #
# Putanje
# --------------------------------------------------------------------------- #
ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
CACHE_DIR = DATA_DIR / "cache"
DATA_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# --------------------------------------------------------------------------- #
# HTTP
# --------------------------------------------------------------------------- #
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
]

DEFAULT_HEADERS = {
    "Accept-Language": "hr-HR,hr;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Globalni throttle (sekunde izmedu zahtjeva). Drzimo se pristojnih brzina.
MIN_DELAY = 1.0
MAX_DELAY = 2.5
_last_request_ts = 0.0


def get_session() -> requests.Session:
    s = requests.Session()
    s.headers.update(DEFAULT_HEADERS)
    s.headers["User-Agent"] = random.choice(USER_AGENTS)
    return s


def _throttle() -> None:
    global _last_request_ts
    elapsed = time.time() - _last_request_ts
    wait = random.uniform(MIN_DELAY, MAX_DELAY) - elapsed
    if wait > 0:
        time.sleep(wait)
    _last_request_ts = time.time()


def _cache_path(url: str) -> Path:
    key = hashlib.sha256(url.encode("utf-8")).hexdigest()[:32]
    return CACHE_DIR / f"{key}.html"


def polite_get(
    session: requests.Session,
    url: str,
    *,
    params: dict | None = None,
    use_cache: bool = True,
    retries: int = 4,
    timeout: int = 30,
) -> str | None:
    """
    Dohvati URL uz throttle, retry s eksponencijalnim backoffom i lokalni cache.
    Vraca tekst odgovora ili None.
    """
    full_url = url
    if params:
        sep = "&" if "?" in url else "?"
        full_url = url + sep + "&".join(f"{k}={v}" for k, v in params.items())

    cache_file = _cache_path(full_url)
    if use_cache and cache_file.exists():
        return cache_file.read_text(encoding="utf-8", errors="ignore")

    backoff = 2
    for attempt in range(retries):
        try:
            _throttle()
            session.headers["User-Agent"] = random.choice(USER_AGENTS)
            resp = session.get(url, params=params, timeout=timeout)
            if resp.status_code == 200 and resp.text:
                if use_cache:
                    cache_file.write_text(resp.text, encoding="utf-8")
                return resp.text
            if resp.status_code in (429, 503):
                time.sleep(backoff)
                backoff *= 2
                continue
            return None
        except requests.RequestException:
            time.sleep(backoff)
            backoff *= 2
    return None


# --------------------------------------------------------------------------- #
# JSON / JSONL I/O
# --------------------------------------------------------------------------- #
def load_json(path: Path, default=None):
    if Path(path).exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return default


def save_json(path: Path, data) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def append_jsonl(path: Path, record: dict) -> None:
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def read_jsonl(path: Path) -> list[dict]:
    out = []
    if not Path(path).exists():
        return out
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    out.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    return out


# --------------------------------------------------------------------------- #
# Lokalno parsiranje
# --------------------------------------------------------------------------- #
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
# Hrvatski telefonski brojevi (+385 / 00385 / 0...)
PHONE_RE = re.compile(
    r"(?:\+385|00385|0)\s*\(?\d{1,2}\)?[\s\-/.]?\d{3}[\s\-/.]?\d{3,4}"
)
# Koordinate iz Google Maps URL-ova: @45.81,15.97 ili !3d45.81!4d15.97
COORD_AT_RE = re.compile(r"@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)")
COORD_3D4D_RE = re.compile(r"!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)")


def extract_emails(text: str) -> list[str]:
    found = set()
    for m in EMAIL_RE.findall(text or ""):
        if not m.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".webp")):
            found.add(m.lower())
    return sorted(found)


def extract_phones(text: str) -> list[str]:
    found = set()
    for m in PHONE_RE.findall(text or ""):
        cleaned = re.sub(r"[^\d+]", "", m)
        if len(re.sub(r"\D", "", cleaned)) >= 8:
            found.add(cleaned)
    return sorted(found)


def extract_coords(text: str) -> tuple[float, float] | None:
    for rx in (COORD_3D4D_RE, COORD_AT_RE):
        m = rx.search(text or "")
        if m:
            return float(m.group(1)), float(m.group(2))
    return None


def parse_jsonld(html_text: str) -> list[dict]:
    """Izvuci sve JSON-LD blokove iz HTML-a."""
    blocks = []
    pattern = re.compile(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        re.DOTALL | re.IGNORECASE,
    )
    for raw in pattern.findall(html_text or ""):
        raw = raw.strip()
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if isinstance(data, list):
            blocks.extend([d for d in data if isinstance(d, dict)])
        elif isinstance(data, dict):
            if "@graph" in data and isinstance(data["@graph"], list):
                blocks.extend([d for d in data["@graph"] if isinstance(d, dict)])
            else:
                blocks.append(data)
    return blocks


META_RE = re.compile(
    r'<meta[^>]+(?:property|name)=["\']([^"\']+)["\'][^>]+content=["\']([^"\']*)["\']',
    re.IGNORECASE,
)


def parse_meta_tags(html_text: str) -> dict:
    meta = {}
    for name, content in META_RE.findall(html_text or ""):
        meta[name.lower()] = content.strip()
    return meta


TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.DOTALL | re.IGNORECASE)


def parse_title(html_text: str) -> str | None:
    m = TITLE_RE.search(html_text or "")
    if m:
        return re.sub(r"\s+", " ", m.group(1)).strip()
    return None
