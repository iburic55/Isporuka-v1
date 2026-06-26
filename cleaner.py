# -*- coding: utf-8 -*-
"""
cleaner.py
3. korak pipelinea: ciscenje, normalizacija i deduplikacija.

Ulaz : data/allplacesraw.json
Izlaz: data/allplacesclean.json
       data/final_output.csv

Pravila deduplikacije:
  - kljuc 1: normalizirano (naziv + naselje)
  - kljuc 2: zaokruzene koordinate (~11 m) ako su dostupne
  - kod duplikata se zapisi spajaju (popunjavaju se prazna polja)

Pokretanje:
    python cleaner.py
"""

import csv
import re
import unicodedata

from utils import DATA_DIR, load_json, save_json

RAW_FILE = DATA_DIR / "allplacesraw.json"
CLEAN_FILE = DATA_DIR / "allplacesclean.json"
CSV_FILE = DATA_DIR / "final_output.csv"

FIELDS = [
    "name",
    "category",
    "settlement",
    "address",
    "phone",
    "email",
    "website",
    "lat",
    "lon",
    "source",
    "url",
]


def strip_accents(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def norm_name(name: str | None) -> str:
    if not name:
        return ""
    name = strip_accents(name.lower())
    name = re.sub(r"\b(restoran|caffe|cafe|bar|konoba|pizzeria|hotel|apartmani?)\b", "", name)
    name = re.sub(r"[^a-z0-9]+", " ", name)
    return name.strip()


def norm_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    digits = re.sub(r"[^\d+]", "", str(phone))
    if digits.startswith("00385"):
        digits = "+385" + digits[5:]
    elif digits.startswith("0") and not digits.startswith("00"):
        digits = "+385" + digits[1:]
    return digits or None


def norm_website(url: str | None) -> str | None:
    if not url:
        return None
    url = str(url).strip()
    if not url.startswith("http"):
        url = "http://" + url
    return url.rstrip("/")


def clean_record(r: dict) -> dict:
    return {
        "name": (r.get("name") or "").strip() or None,
        "category": r.get("category") or "ostalo",
        "settlement": (r.get("settlement") or "").strip() or None,
        "address": (r.get("address") or "").strip() or None,
        "phone": norm_phone(r.get("phone")),
        "email": (str(r.get("email")).strip().lower() if r.get("email") else None),
        "website": norm_website(r.get("website")),
        "lat": _to_float(r.get("lat")),
        "lon": _to_float(r.get("lon")),
        "source": r.get("source"),
        "url": r.get("url"),
    }


def _to_float(v):
    try:
        return round(float(v), 7)
    except (TypeError, ValueError):
        return None


def dedup_key(r: dict) -> str:
    if r["lat"] is not None and r["lon"] is not None:
        return f"geo:{round(r['lat'], 4)},{round(r['lon'], 4)}"
    return f"name:{norm_name(r['name'])}|{norm_name(r['settlement'])}"


def merge(dst: dict, src: dict) -> None:
    for k in FIELDS:
        if not dst.get(k) and src.get(k):
            dst[k] = src[k]


def main() -> None:
    raw = load_json(RAW_FILE, default=[])
    if not raw:
        raise SystemExit("Nema data/allplacesraw.json -> pokreni scrape_places.py")

    merged: dict[str, dict] = {}
    dropped = 0
    for r in raw:
        rec = clean_record(r)
        if not rec["name"]:
            dropped += 1
            continue
        key = dedup_key(rec)
        if key in merged:
            merge(merged[key], rec)
        else:
            merged[key] = rec

    clean = sorted(
        merged.values(),
        key=lambda x: (x.get("settlement") or "", x.get("name") or ""),
    )

    save_json(CLEAN_FILE, clean)

    with open(CSV_FILE, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        for rec in clean:
            writer.writerow({k: rec.get(k, "") for k in FIELDS})

    print(f"[cleaner] Ulaz: {len(raw)} | Bez naziva (odbaceno): {dropped}")
    print(f"[cleaner] Jedinstvenih objekata: {len(clean)}")
    print(f"[cleaner] -> {CLEAN_FILE}")
    print(f"[cleaner] -> {CSV_FILE}")


if __name__ == "__main__":
    main()
