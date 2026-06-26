# -*- coding: utf-8 -*-
"""
scrape_places.py
1. korak pipelinea: prikupljanje URL-ova i osnovnih podataka ugostiteljskih
objekata po svim naseljima.

Izvori:
  - OpenStreetMap / Overpass  (primarni, besplatan, legalan; pokriva sve POI-jeve)
  - Google Maps               (best-effort lokalno parsiranje search stranice)
  - Gastronaut.hr             (best-effort, JSON-LD / linkovi)

Output: data/allplacesraw.json   (lista sirovih zapisa)
Ima checkpoint (resume) preko data/_places_progress.json kako se nakon
prekida ne bi ponovno radio vec obradeni posao -> minimalan usage.

Pokretanje:
    python scrape_places.py
    python scrape_places.py --limit 50        # samo prvih 50 naselja (test)
    python scrape_places.py --source overpass # samo jedan izvor
"""

import argparse
import json
import re
import urllib.parse

from utils import (
    DATA_DIR,
    ROOT,
    extract_coords,
    get_session,
    load_json,
    parse_jsonld,
    polite_get,
    save_json,
)

SETTLEMENTS_FILE = ROOT / "settlements.json"
RAW_FILE = DATA_DIR / "allplacesraw.json"
PROGRESS_FILE = DATA_DIR / "_places_progress.json"

# Kategorije ugostiteljskih objekata -> (Google upit, OSM filteri)
CATEGORIES = {
    "restoran": ["amenity=restaurant"],
    "kafic": ["amenity=cafe", "amenity=bar", "amenity=pub"],
    "konoba": ["amenity=restaurant", "cuisine=regional"],
    "fast_food": ["amenity=fast_food"],
    "apartman": ["tourism=apartment", "tourism=guest_house"],
    "hotel": ["tourism=hotel", "tourism=motel", "tourism=hostel"],
    "kamp": ["tourism=camp_site", "tourism=caravan_site"],
}

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]


# --------------------------------------------------------------------------- #
# Izvor: OpenStreetMap (Overpass) - primarni, pouzdani
# --------------------------------------------------------------------------- #
def overpass_places(session, settlement: dict) -> list[dict]:
    """Dohvati sve ugostiteljske POI-jeve u radijusu oko naselja."""
    lat, lon = settlement.get("lat"), settlement.get("lon")
    if lat is None or lon is None:
        return []
    radius = 4000  # m
    filters = []
    for osm_filters in CATEGORIES.values():
        for f in osm_filters:
            k, _, v = f.partition("=")
            filters.append(f'node["{k}"="{v}"](around:{radius},{lat},{lon});')
            filters.append(f'way["{k}"="{v}"](around:{radius},{lat},{lon});')
    query = f"[out:json][timeout:120];({''.join(filters)});out center tags;"

    for endpoint in OVERPASS_ENDPOINTS:
        try:
            resp = session.post(endpoint, data={"data": query}, timeout=140)
            if resp.status_code != 200:
                continue
            elements = resp.json().get("elements", [])
            break
        except Exception:  # noqa: BLE001
            continue
    else:
        return []

    out = []
    for el in elements:
        tags = el.get("tags", {})
        name = (tags.get("name") or "").strip()
        if not name:
            continue
        plat = el.get("lat") or (el.get("center") or {}).get("lat")
        plon = el.get("lon") or (el.get("center") or {}).get("lon")
        out.append(
            {
                "source": "openstreetmap",
                "settlement": settlement["name"],
                "name": name,
                "category": _osm_category(tags),
                "address": _osm_address(tags),
                "phone": tags.get("phone") or tags.get("contact:phone"),
                "email": tags.get("email") or tags.get("contact:email"),
                "website": tags.get("website") or tags.get("contact:website"),
                "lat": plat,
                "lon": plon,
                "url": f"https://www.openstreetmap.org/{el.get('type')}/{el.get('id')}",
            }
        )
    return out


def _osm_category(tags: dict) -> str:
    for cat, osm_filters in CATEGORIES.items():
        for f in osm_filters:
            k, _, v = f.partition("=")
            if tags.get(k) == v:
                return cat
    return "ostalo"


def _osm_address(tags: dict) -> str:
    parts = [
        tags.get("addr:street"),
        tags.get("addr:housenumber"),
        tags.get("addr:postcode"),
        tags.get("addr:city"),
    ]
    return " ".join(p for p in parts if p).strip()


# --------------------------------------------------------------------------- #
# Izvor: Google Maps (best-effort, lokalno parsiranje)
# --------------------------------------------------------------------------- #
GMAPS_PLACE_RE = re.compile(r'(https://www\.google\.com/maps/place/[^\\"\s]+)')


def google_maps_places(session, settlement: dict) -> list[dict]:
    """
    Best-effort: dohvati Google Maps search stranicu i izvuci linkove na
    objekte + koordinate iz ugradenog stanja stranice. Bez sluzbenog API-ja,
    pa je rezultat ovisan o strukturi stranice (moze biti prazan ako Google
    servira consent/captcha).
    """
    out = []
    for category in CATEGORIES:
        q = urllib.parse.quote(f"{category} {settlement['name']} Hrvatska")
        url = f"https://www.google.com/maps/search/{q}/"
        html = polite_get(session, url, params={"hl": "hr", "gl": "hr"})
        if not html:
            continue
        urls = set(GMAPS_PLACE_RE.findall(html))
        for purl in urls:
            purl = purl.replace("\\u0026", "&")
            coords = extract_coords(purl)
            name = _gmaps_name_from_url(purl)
            if not name:
                continue
            out.append(
                {
                    "source": "google_maps",
                    "settlement": settlement["name"],
                    "name": name,
                    "category": category,
                    "address": None,
                    "phone": None,
                    "email": None,
                    "website": None,
                    "lat": coords[0] if coords else None,
                    "lon": coords[1] if coords else None,
                    "url": purl,
                }
            )
    return out


def _gmaps_name_from_url(url: str) -> str | None:
    m = re.search(r"/maps/place/([^/]+)/", url)
    if not m:
        return None
    name = urllib.parse.unquote(m.group(1)).replace("+", " ")
    return name.strip() or None


# --------------------------------------------------------------------------- #
# Izvor: Gastronaut.hr (best-effort)
# --------------------------------------------------------------------------- #
GASTRONAUT_LINK_RE = re.compile(r'href="(/[^"]*(?:restoran|objekt|mjesto)[^"]*)"', re.I)


def gastronaut_places(session, settlement: dict) -> list[dict]:
    """
    Best-effort pretraga Gastronaut.hr po nazivu naselja. Parsira JSON-LD ako
    postoji, inace skuplja linkove na objekte (detalji se vade u 2. koraku).
    """
    out = []
    q = urllib.parse.quote(settlement["name"])
    url = f"https://www.gastronaut.hr/pretraga?q={q}"
    html = polite_get(session, url)
    if not html:
        return out

    for block in parse_jsonld(html):
        if block.get("@type") in ("Restaurant", "FoodEstablishment", "LocalBusiness"):
            out.append(
                {
                    "source": "gastronaut",
                    "settlement": settlement["name"],
                    "name": block.get("name"),
                    "category": "restoran",
                    "address": _jsonld_address(block),
                    "phone": block.get("telephone"),
                    "email": block.get("email"),
                    "website": block.get("url"),
                    "lat": (block.get("geo") or {}).get("latitude"),
                    "lon": (block.get("geo") or {}).get("longitude"),
                    "url": block.get("url"),
                }
            )

    for path in set(GASTRONAUT_LINK_RE.findall(html)):
        out.append(
            {
                "source": "gastronaut",
                "settlement": settlement["name"],
                "name": None,  # naziv se dohvaca u scrape_details.py
                "category": "restoran",
                "address": None,
                "phone": None,
                "email": None,
                "website": None,
                "lat": None,
                "lon": None,
                "url": urllib.parse.urljoin("https://www.gastronaut.hr", path),
            }
        )
    return out


def _jsonld_address(block: dict) -> str | None:
    addr = block.get("address")
    if isinstance(addr, str):
        return addr
    if isinstance(addr, dict):
        parts = [
            addr.get("streetAddress"),
            addr.get("postalCode"),
            addr.get("addressLocality"),
        ]
        return " ".join(p for p in parts if p) or None
    return None


# --------------------------------------------------------------------------- #
# Glavni tok
# --------------------------------------------------------------------------- #
SOURCES = {
    "overpass": overpass_places,
    "google": google_maps_places,
    "gastronaut": gastronaut_places,
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="broj naselja (0=sva)")
    parser.add_argument(
        "--source",
        choices=list(SOURCES) + ["all"],
        default="all",
        help="koji izvor koristiti",
    )
    args = parser.parse_args()

    settlements = load_json(SETTLEMENTS_FILE, default=[])
    if not settlements:
        raise SystemExit("Nema settlements.json -> pokreni: python generate_settlements.py")
    if args.limit:
        settlements = settlements[: args.limit]

    progress = set(load_json(PROGRESS_FILE, default=[]))
    raw = load_json(RAW_FILE, default=[])
    session = get_session()

    active = list(SOURCES) if args.source == "all" else [args.source]

    total = len(settlements)
    for i, settlement in enumerate(settlements, 1):
        sid = settlement["name"]
        if sid in progress:
            continue
        collected = []
        for src in active:
            try:
                collected.extend(SOURCES[src](session, settlement))
            except Exception as exc:  # noqa: BLE001
                print(f"  ! {src} greska za {sid}: {exc}")
        raw.extend(collected)
        progress.add(sid)

        print(f"[{i}/{total}] {sid}: +{len(collected)} (ukupno {len(raw)})")

        # periodicno spremanje (otporno na prekid)
        if i % 25 == 0 or i == total:
            save_json(RAW_FILE, raw)
            save_json(PROGRESS_FILE, sorted(progress))

    save_json(RAW_FILE, raw)
    save_json(PROGRESS_FILE, sorted(progress))
    print(f"\nGotovo. Sirovih zapisa: {len(raw)} -> {RAW_FILE}")


if __name__ == "__main__":
    main()
