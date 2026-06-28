# Pokretanje na webu (besplatno)

## Opcija 1 — Render.com (cijela Flask app, preporuka)

1. Otvori **https://render.com** → **Sign in with GitHub**.
2. Klikni **New +** → **Web Service**.
3. Odaberi repo **`iburic55/Isporuka-v1`** (dopusti pristup ako pita).
4. Postavi polja:
   - **Branch:** `claude/croatia-hospitality-scraper-19mnt1`
   - **Root Directory:** `croatia-hospitality-scraper/webapp`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app --bind 0.0.0.0:$PORT`
   - **Instance Type:** Free
5. **Create Web Service.** Za minutu-dvije dobiješ javni link tipa
   `https://leadovi-hr.onrender.com` — otvori ga na bilo kojem uređaju.

> Free plan "zaspi" nakon neaktivnosti pa se prvo otvaranje učita ~30 s. Normalno.

## Opcija 2 — samo statična verzija (PWA), bez servera

Mapa `mobile/` je čista statična aplikacija. Možeš je objaviti na:
- **Netlify** (netlify.com → Add new site → Import from GitHub → Base directory `croatia-hospitality-scraper/mobile`), ili
- **Vercel** / **Cloudflare Pages** (isti princip, output = `mobile/`).

Dobiješ HTTPS link; PWA se onda može i "instalirati" na telefon.

## Napomena o podacima
Web verzija prikazuje demo uzorak (`webapp/sample_data.json`). Za prave podatke
pokreni scraper (lokalno ili na računalu) da nastane `data/allplacesclean.json`,
pa ga commitaj — app ga automatski preferira nad uzorkom.
