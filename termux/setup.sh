#!/data/data/com.termux/files/usr/bin/bash
# Termux setup za Leadovi HR (scraper + web app)
# Pokretanje:  bash termux/setup.sh
set -e

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

echo "==> [1/5] Aktualizacija Termux paketa"
pkg update -y && pkg upgrade -y

echo "==> [2/5] Instalacija Pythona i gita"
pkg install -y python git

echo "==> [3/5] Dozvola za pohranu (za spremanje CSV-a u ~/storage)"
termux-setup-storage || echo "   (preskoceno - odobri dozvolu rucno ako zatreba)"

echo "==> [4/5] Nadogradnja pip-a"
python -m pip install --upgrade pip

echo "==> [5/5] Python ovisnosti"
python -m pip install -r "$ROOT/requirements.txt"
python -m pip install flask

echo ""
echo "GOTOVO. Sljedece:"
echo "  Web app:   bash termux/run-web.sh"
echo "  Scraper:   bash termux/run-scraper.sh --limit 50"
