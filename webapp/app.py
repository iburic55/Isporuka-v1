# -*- coding: utf-8 -*-
"""
app.py - Leadovi HR (MVP web-app za prodaju ugostiteljskih leadova)

Radi nad podacima koje proizvodi scraper (../data/allplacesclean.json).
Ako tih podataka nema, ucitava webapp/sample_data.json da app odmah radi.

Funkcije:
  - pretraga po nazivu, kategoriji, naselju
  - filtri: "ima email", "ima telefon"
  - statistika (ukupno / s emailom / s telefonom)
  - izvoz u CSV  ->  FREE: max FREE_EXPORT_LIMIT redaka
                     PRO : neograniceno (?pro=KEY)  <- mjesto naplate

Pokretanje:
    pip install flask
    python app.py
    -> http://127.0.0.1:5000
"""

import csv
import io
import json
import os
from pathlib import Path

from flask import Flask, Response, jsonify, render_template_string, request

ROOT = Path(__file__).resolve().parent
CLEAN_FILE = ROOT.parent / "data" / "allplacesclean.json"
SAMPLE_FILE = ROOT / "sample_data.json"

FREE_EXPORT_LIMIT = 25           # koliko redaka FREE korisnik smije izvesti
PRO_KEY = os.environ.get("PRO_KEY", "PRO-2026")  # u produkciji: prava naplata

FIELDS = ["name", "category", "settlement", "address",
          "phone", "email", "website", "lat", "lon", "source", "url"]

app = Flask(__name__)


def load_data() -> list[dict]:
    path = CLEAN_FILE if CLEAN_FILE.exists() else SAMPLE_FILE
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


DATA = load_data()
DATA_SOURCE = "produkcija (scraper)" if CLEAN_FILE.exists() else "uzorak (demo)"


def apply_filters(rows: list[dict], args) -> list[dict]:
    q = (args.get("q") or "").strip().lower()
    category = (args.get("category") or "").strip().lower()
    settlement = (args.get("settlement") or "").strip().lower()
    has_email = args.get("has_email") in ("1", "true", "on")
    has_phone = args.get("has_phone") in ("1", "true", "on")

    out = []
    for r in rows:
        if q and q not in (r.get("name") or "").lower():
            continue
        if category and (r.get("category") or "").lower() != category:
            continue
        if settlement and settlement not in (r.get("settlement") or "").lower():
            continue
        if has_email and not r.get("email"):
            continue
        if has_phone and not r.get("phone"):
            continue
        out.append(r)
    return out


@app.route("/")
def index():
    categories = sorted({r.get("category") for r in DATA if r.get("category")})
    return render_template_string(
        TEMPLATE,
        categories=categories,
        total=len(DATA),
        data_source=DATA_SOURCE,
        free_limit=FREE_EXPORT_LIMIT,
    )


@app.route("/api/search")
def api_search():
    rows = apply_filters(DATA, request.args)
    try:
        page = max(1, int(request.args.get("page", 1)))
    except ValueError:
        page = 1
    per = 20
    start = (page - 1) * per
    page_rows = rows[start:start + per]

    stats = {
        "total": len(rows),
        "with_email": sum(1 for r in rows if r.get("email")),
        "with_phone": sum(1 for r in rows if r.get("phone")),
        "with_website": sum(1 for r in rows if r.get("website")),
    }
    return jsonify({
        "stats": stats,
        "page": page,
        "pages": (len(rows) + per - 1) // per,
        "rows": page_rows,
    })


@app.route("/api/export")
def api_export():
    rows = apply_filters(DATA, request.args)
    is_pro = request.args.get("pro") == PRO_KEY
    capped = False
    if not is_pro and len(rows) > FREE_EXPORT_LIMIT:
        rows = rows[:FREE_EXPORT_LIMIT]
        capped = True

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=FIELDS, extrasaction="ignore")
    writer.writeheader()
    for r in rows:
        writer.writerow({k: r.get(k, "") for k in FIELDS})

    filename = "leadovi_pro.csv" if is_pro else "leadovi_free.csv"
    headers = {
        "Content-Disposition": f"attachment; filename={filename}",
        "X-Export-Capped": "1" if capped else "0",
    }
    return Response(buf.getvalue(), mimetype="text/csv; charset=utf-8", headers=headers)


TEMPLATE = """<!doctype html>
<html lang="hr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Leadovi HR — ugostiteljski objekti</title>
<style>
 :root{--b:#0f62fe;--bg:#f4f5f7;--ink:#161616}
 *{box-sizing:border-box} body{font-family:system-ui,Segoe UI,Arial;margin:0;background:var(--bg);color:var(--ink)}
 header{background:#fff;border-bottom:1px solid #e0e0e0;padding:16px 24px}
 h1{margin:0;font-size:20px} .sub{color:#6f6f6f;font-size:13px;margin-top:4px}
 .wrap{max-width:1100px;margin:0 auto;padding:20px 24px}
 .card{background:#fff;border:1px solid #e0e0e0;border-radius:10px;padding:16px;margin-bottom:16px}
 .filters{display:grid;grid-template-columns:2fr 1fr 1fr auto auto;gap:10px;align-items:center}
 input,select{padding:9px 10px;border:1px solid #c6c6c6;border-radius:8px;font-size:14px;width:100%}
 label.chk{display:flex;gap:6px;align-items:center;font-size:13px;white-space:nowrap}
 .stats{display:flex;gap:18px;flex-wrap:wrap;margin:10px 0}
 .stat{background:#eef1ff;border-radius:8px;padding:8px 12px;font-size:13px}
 .stat b{font-size:18px;display:block}
 button{background:var(--b);color:#fff;border:0;border-radius:8px;padding:9px 14px;font-size:14px;cursor:pointer}
 button.sec{background:#fff;color:var(--ink);border:1px solid #c6c6c6}
 table{width:100%;border-collapse:collapse;font-size:13px}
 th,td{text-align:left;padding:9px 8px;border-bottom:1px solid #eee;vertical-align:top}
 th{color:#525252;font-weight:600} tr:hover td{background:#fafafa}
 .tag{background:#e8f5e9;color:#1b5e20;border-radius:20px;padding:2px 8px;font-size:11px}
 .pager{display:flex;gap:10px;align-items:center;justify-content:center;margin-top:12px}
 a{color:var(--b);text-decoration:none}
 .pro{background:#fff8e1;border:1px solid #ffe082;border-radius:8px;padding:10px 12px;font-size:13px;margin-top:10px}
</style></head><body>
<header>
 <h1>Leadovi HR — ugostiteljski objekti</h1>
 <div class="sub">Baza: {{total}} objekata · izvor: {{data_source}} · FREE izvoz do {{free_limit}} redaka</div>
</header>
<div class="wrap">
 <div class="card">
  <div class="filters">
   <input id="q" placeholder="Pretraga po nazivu…">
   <select id="category"><option value="">Sve kategorije</option>
     {% for c in categories %}<option value="{{c}}">{{c}}</option>{% endfor %}
   </select>
   <input id="settlement" placeholder="Naselje…">
   <label class="chk"><input type="checkbox" id="has_email"> ima email</label>
   <label class="chk"><input type="checkbox" id="has_phone"> ima tel.</label>
  </div>
  <div class="stats" id="stats"></div>
  <div style="display:flex;gap:10px;flex-wrap:wrap">
   <button onclick="exportCsv(false)">⬇ Izvezi CSV (FREE)</button>
   <button class="sec" onclick="exportCsv(true)">★ Izvezi sve (PRO)</button>
  </div>
  <div class="pro">💡 <b>Monetizacija:</b> FREE izvoz je ograničen na {{free_limit}} redaka.
   Puni izvoz svih filtriranih leadova je PRO (pretplata / jednokratno).</div>
 </div>
 <div class="card">
  <table><thead><tr>
    <th>Naziv</th><th>Kat.</th><th>Naselje</th><th>Telefon</th><th>Email</th><th>Web</th>
  </tr></thead><tbody id="rows"></tbody></table>
  <div class="pager">
   <button class="sec" onclick="go(-1)">‹ Prev</button>
   <span id="pageinfo"></span>
   <button class="sec" onclick="go(1)">Next ›</button>
  </div>
 </div>
</div>
<script>
let page=1, pages=1;
function params(){
 const p=new URLSearchParams();
 p.set('q',q.value); p.set('category',category.value); p.set('settlement',settlement.value);
 if(has_email.checked)p.set('has_email','1'); if(has_phone.checked)p.set('has_phone','1');
 return p;
}
async function load(){
 const p=params(); p.set('page',page);
 const r=await fetch('/api/search?'+p.toString()); const d=await r.json();
 pages=d.pages||1;
 stats.innerHTML=
  `<div class="stat"><b>${d.stats.total}</b>rezultata</div>`+
  `<div class="stat"><b>${d.stats.with_email}</b>s emailom</div>`+
  `<div class="stat"><b>${d.stats.with_phone}</b>s telefonom</div>`+
  `<div class="stat"><b>${d.stats.with_website}</b>s webom</div>`;
 rows.innerHTML=d.rows.map(x=>`<tr>
   <td><b>${x.name||''}</b></td>
   <td><span class="tag">${x.category||''}</span></td>
   <td>${x.settlement||''}</td>
   <td>${x.phone||'—'}</td>
   <td>${x.email?('<a href="mailto:'+x.email+'">'+x.email+'</a>'):'—'}</td>
   <td>${x.website?('<a href="'+x.website+'" target="_blank">link</a>'):'—'}</td>
 </tr>`).join('')||'<tr><td colspan=6>Nema rezultata.</td></tr>';
 pageinfo.textContent=`Stranica ${d.page} / ${pages}`;
}
function go(d){ page=Math.min(pages,Math.max(1,page+d)); load(); }
function exportCsv(pro){
 const p=params();
 if(pro){ const k=prompt('Unesi PRO ključ (demo: PRO-2026):'); if(!k)return; p.set('pro',k); }
 window.location='/api/export?'+p.toString();
}
['q','category','settlement','has_email','has_phone'].forEach(id=>{
 document.getElementById(id).addEventListener('input',()=>{page=1;load();});
});
load();
</script>
</body></html>"""


if __name__ == "__main__":
    # HOST=0.0.0.0 za pristup s drugih uredaja na istoj mrezi (npr. iz Termuxa)
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "5000"))
    app.run(host=host, port=port, debug=False)
