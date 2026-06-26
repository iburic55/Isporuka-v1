#!/data/data/com.termux/files/usr/bin/bash
# Pokrece web app na telefonu. Otvori http://127.0.0.1:5000 u pregledniku.
# Za pristup s drugog uredaja na istoj Wi-Fi mrezi: HOST=0.0.0.0 bash termux/run-web.sh
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE/../webapp"

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-5000}"
export HOST PORT

echo "=================================================="
echo " Leadovi HR — web app"
if [ "$HOST" = "0.0.0.0" ]; then
  IP="$(ip route get 1 2>/dev/null | awk '{print $7; exit}')"
  echo " Na ovom telefonu:  http://127.0.0.1:$PORT"
  echo " S druge naprave:   http://${IP:-<IP-telefona>}:$PORT"
else
  echo " Otvori u pregledniku:  http://127.0.0.1:$PORT"
fi
echo " (Ctrl+C za prekid)"
echo "=================================================="
python app.py
