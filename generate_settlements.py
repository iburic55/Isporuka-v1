# -*- coding: utf-8 -*-
"""
generate_settlements.py
Automatski generira listu SVIH hrvatskih naselja (5500+) iz OpenStreetMapa
preko Overpass API-ja (besplatno, legalno, bez kljuca).

Rezultat: settlements.json -> [{ "name", "lat", "lon", "type" }, ...]

Pokretanje:
    python generate_settlements.py
"""

import sys
import time

from utils import ROOT, get_session, save_json

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

# city, town, village, hamlet, isolated_dwelling -> sva naselja u RH
OVERPASS_QUERY = """
[out:json][timeout:300];
area["ISO3166-1"="HR"][admin_level=2]->.hr;
(
  node["place"~"^(city|town|village|hamlet|isolated_dwelling)$"](area.hr);
);
out body;
"""

OUT_FILE = ROOT / "settlements.json"


def fetch_settlements() -> list[dict]:
    session = get_session()
    last_err = None
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            print(f"[settlements] Dohvacam s {endpoint} ...")
            resp = session.post(endpoint, data={"data": OVERPASS_QUERY}, timeout=320)
            if resp.status_code != 200:
                last_err = f"HTTP {resp.status_code}"
                time.sleep(5)
                continue
            data = resp.json()
            return data.get("elements", [])
        except Exception as exc:  # noqa: BLE001
            last_err = str(exc)
            time.sleep(5)
    raise RuntimeError(f"Overpass nedostupan: {last_err}")


def main() -> None:
    elements = fetch_settlements()
    seen = set()
    settlements = []
    for el in elements:
        tags = el.get("tags", {})
        name = (tags.get("name") or "").strip()
        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        settlements.append(
            {
                "name": name,
                "lat": el.get("lat"),
                "lon": el.get("lon"),
                "type": tags.get("place"),
            }
        )

    settlements.sort(key=lambda x: x["name"])
    save_json(OUT_FILE, settlements)
    print(f"[settlements] Spremljeno {len(settlements)} naselja -> {OUT_FILE}")
    if len(settlements) < 1000:
        print("[settlements] UPOZORENJE: manje naselja od ocekivanog.", file=sys.stderr)


if __name__ == "__main__":
    main()
