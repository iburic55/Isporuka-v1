#!/data/data/com.termux/files/usr/bin/bash
# Pokrece cijeli scraping pipeline na telefonu (mreza u Termuxu radi).
# Primjeri:
#   bash termux/run-scraper.sh --limit 50          # test na 50 naselja
#   bash termux/run-scraper.sh --source overpass   # samo OpenStreetMap
#   bash termux/run-scraper.sh                      # puni run (dugo traje!)
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE/.."

echo "Pokrecem pipeline... (rezultati u data/: allplacesclean.json, final_output.csv)"
python pipeline.py "$@"

# Kopiraj CSV u dijeljenu pohranu da ga vidis u Files app-u (ako je dozvola dana)
if [ -d "$HOME/storage/downloads" ] && [ -f "data/final_output.csv" ]; then
  cp data/final_output.csv "$HOME/storage/downloads/leadovi_hr.csv"
  echo "CSV kopiran u: Download/leadovi_hr.csv"
fi
