# -*- coding: utf-8 -*-
"""
pipeline.py
Pokrece sve korake redom:
    1) generate_settlements.py  -> settlements.json   (preskace se ako vec postoji)
    2) scrape_places.py         -> data/allplacesraw.json
    3) scrape_details.py        -> obogacuje allplacesraw.json
    4) cleaner.py               -> data/allplacesclean.json + data/final_output.csv

Pokretanje:
    python pipeline.py
    python pipeline.py --limit 50       # test na 50 naselja
    python pipeline.py --source overpass
    python pipeline.py --skip-details   # preskoci 2. korak (brze)
"""

import argparse

import cleaner
import generate_settlements
import scrape_details
import scrape_places
from utils import ROOT, load_json


def step(title: str) -> None:
    print("\n" + "=" * 60)
    print(f">> {title}")
    print("=" * 60)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--source", default="all")
    parser.add_argument("--skip-details", action="store_true")
    parser.add_argument("--regen-settlements", action="store_true")
    args = parser.parse_args()

    # 1) naselja
    step("1/4  Generiranje liste naselja")
    if args.regen_settlements or not (ROOT / "settlements.json").exists():
        generate_settlements.main()
    else:
        n = len(load_json(ROOT / "settlements.json", default=[]))
        print(f"settlements.json vec postoji ({n} naselja) - preskacem.")

    # 2) prikupljanje objekata
    step("2/4  Prikupljanje objekata (scrape_places)")
    import sys

    sys.argv = ["scrape_places", "--source", args.source]
    if args.limit:
        sys.argv += ["--limit", str(args.limit)]
    scrape_places.main()

    # 3) detalji
    if not args.skip_details:
        step("3/4  Dohvat detalja (scrape_details)")
        sys.argv = ["scrape_details"]
        scrape_details.main()
    else:
        step("3/4  Detalji preskoceni (--skip-details)")

    # 4) ciscenje
    step("4/4  Ciscenje i deduplikacija (cleaner)")
    cleaner.main()

    print("\nPIPELINE ZAVRSEN.")
    print("Rezultati u mapi data/:")
    print("  - allplacesraw.json")
    print("  - allplacesclean.json")
    print("  - final_output.csv")


if __name__ == "__main__":
    main()
