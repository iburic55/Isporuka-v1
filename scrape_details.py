# -*- coding: utf-8 -*-
"""
scrape_details.py
2. korak pipelinea: za zapise koji imaju website/URL dohvaca stranicu i
lokalno parsira meta podatke:
naziv, adresa, telefon, email, web, lat, lon.

Izvor podataka: JSON-LD + OpenGraph/meta tagovi + regex (tel/email/koordinate).
Sve se radi LOKALNO nad vec preuzetim HTML-om (minimalan usage, s cacheom).

Ulaz : data/allplacesraw.json
Izlaz: data/allplacesraw.json  (obogaceni zapisi - upisuje natrag)

Pokretanje:
    python scrape_details.py
    python scrape_details.py --limit 100
"""

import argparse

from utils import (
    DATA_DIR,
    extract_coords,
    extract_emails,
    extract_phones,
    get_session,
    load_json,
    parse_jsonld,
    parse_meta_tags,
    parse_title,
    polite_get,
    save_json,
)

RAW_FILE = DATA_DIR / "allplacesraw.json"


def enrich_from_html(record: dict, html: str) -> dict:
    """Popuni prazna polja zapisa iz HTML-a (ne prepisuje postojece vrijednosti)."""
    meta = parse_meta_tags(html)
    jsonld = parse_jsonld(html)

    # naziv
    if not record.get("name"):
        record["name"] = (
            meta.get("og:title")
            or _first_jsonld(jsonld, "name")
            or parse_title(html)
        )

    # adresa
    if not record.get("address"):
        addr = _first_jsonld(jsonld, "address")
        if isinstance(addr, dict):
            parts = [
                addr.get("streetAddress"),
                addr.get("postalCode"),
                addr.get("addressLocality"),
            ]
            record["address"] = " ".join(p for p in parts if p) or None
        elif isinstance(addr, str):
            record["address"] = addr
        elif meta.get("og:street-address"):
            record["address"] = meta.get("og:street-address")

    # telefon
    if not record.get("phone"):
        record["phone"] = (
            _first_jsonld(jsonld, "telephone")
            or (extract_phones(html)[:1] or [None])[0]
        )

    # email
    if not record.get("email"):
        record["email"] = (
            _first_jsonld(jsonld, "email")
            or (extract_emails(html)[:1] or [None])[0]
        )

    # web
    if not record.get("website"):
        record["website"] = _first_jsonld(jsonld, "url") or meta.get("og:url")

    # koordinate
    if not record.get("lat") or not record.get("lon"):
        geo = _first_jsonld(jsonld, "geo")
        if isinstance(geo, dict) and geo.get("latitude"):
            record["lat"] = geo.get("latitude")
            record["lon"] = geo.get("longitude")
        else:
            coords = extract_coords(html)
            if coords:
                record["lat"], record["lon"] = coords

    return record


def _first_jsonld(blocks: list[dict], key: str):
    for b in blocks:
        if key in b and b[key]:
            return b[key]
    return None


def needs_details(record: dict) -> bool:
    """Treba detalje ako fali bitno polje, a imamo gdje dohvatiti."""
    has_target = record.get("website") or record.get("url")
    missing = not all(
        record.get(k) for k in ("name", "phone", "email", "address", "lat", "lon")
    )
    return bool(has_target and missing)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    raw = load_json(RAW_FILE, default=[])
    if not raw:
        raise SystemExit("Nema data/allplacesraw.json -> pokreni scrape_places.py")

    session = get_session()
    processed = 0
    targets = [r for r in raw if needs_details(r)]
    if args.limit:
        targets = targets[: args.limit]

    total = len(targets)
    print(f"[details] Obradujem {total} zapisa kojima fale podaci ...")

    for i, record in enumerate(targets, 1):
        target_url = record.get("website") or record.get("url")
        html = polite_get(session, target_url)
        if html:
            enrich_from_html(record, html)
            processed += 1
        if i % 20 == 0 or i == total:
            save_json(RAW_FILE, raw)
            print(f"  [{i}/{total}] obogaceno (spremljeno)")

    save_json(RAW_FILE, raw)
    print(f"[details] Gotovo. Obogaceno zapisa: {processed} -> {RAW_FILE}")


if __name__ == "__main__":
    main()
