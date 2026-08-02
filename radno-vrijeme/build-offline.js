/*
 * build-offline.js — sastavlja jednu samostalnu HTML datoteku za mobitel.
 *
 * Pokretanje:  node build-offline.js
 * Rezultat:    offline/radno-vrijeme.html
 *
 * Datoteka u sebi nosi sav CSS i JavaScript pa radi otvorena izravno s
 * uređaja, bez poslužitelja i bez interneta. Google Drive dio je izostavljen
 * jer Google prijava zahtijeva http(s) adresu — prijenos podataka ide kroz
 * izvoz i uvoz JSON-a.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

let html = read('index.html');
const css = read('css/styles.css');
const store = read('js/store.js');
let app = read('js/app.js');

/** Uklanja sve dijelove označene s <!-- drive:start --> … <!-- drive:end -->. */
function stripDriveBlocks(source) {
    const pattern = /[ \t]*<!-- drive:start -->[\s\S]*?<!-- drive:end -->\n?/g;
    const hits = source.match(pattern);
    if (!hits || hits.length < 3) {
        throw new Error('Očekivane su oznake drive:start/drive:end u index.html (nađeno: ' + (hits ? hits.length : 0) + ')');
    }
    return source.replace(pattern, '');
}

function replaceOnce(source, from, to, label) {
    const parts = source.split(from);
    if (parts.length !== 2) {
        throw new Error('Očekivan točno jedan pogodak za: ' + label + ' (nađeno: ' + (parts.length - 1) + ')');
    }
    return parts.join(to);
}

html = stripDriveBlocks(html);

// Bez poslužitelja nema ni service workera ni manifesta.
app = replaceOnce(app, '        registerServiceWorker();\n', '', 'poziv registerServiceWorker');
html = replaceOnce(html, '    <link rel="manifest" href="manifest.webmanifest">\n', '', 'poveznica na manifest');
html = replaceOnce(html,
    '    <link rel="icon" href="icons/icon-192.png" sizes="192x192">\n    <link rel="apple-touch-icon" href="icons/icon-192.png">',
    '    <link rel="icon" href="data:image/svg+xml,' +
    "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ctext y='26' font-size='26'%3E⏱️%3C/text%3E%3C/svg%3E\">",
    'ikone aplikacije');

// CSS ide u stranicu.
html = replaceOnce(html,
    '    <link rel="stylesheet" href="css/styles.css">',
    '    <style>\n' + css + '\n    </style>',
    'poveznica na stilove');

// Elementi Drive sučelja uklonjeni su, ali ih zajednički app.js i dalje čita.
const hiddenControls = `
<!-- Sinkronizacija ne postoji u ovoj verziji; skriveni elementi drže zajednički
     app.js nepromijenjenim u odnosu na verziju s poslužiteljem. -->
<div hidden>
    <button type="button" id="syncNowBtn"></button>
    <input type="text" id="settingsClientId" value="">
    <input type="text" id="settingsFileName" value="radno-vrijeme.json">
    <input type="checkbox" id="settingsAutoSync">
    <button type="button" id="driveConnectBtn"></button>
    <button type="button" id="driveDisconnectBtn"></button>
</div>
`;
html = replaceOnce(html, '</header>\n', '</header>\n' + hiddenControls, 'kraj zaglavlja');

// Umjesto oznake „Lokalno" stoji poruka koja opisuje ovu verziju.
const statusHits = app.split("setSyncStatus('Lokalno', 'off')").length - 1;
if (statusHits < 1) throw new Error('Nije pronađen poziv setSyncStatus s oznakom "Lokalno"');
app = app.split("setSyncStatus('Lokalno', 'off')").join("setSyncStatus('Spremljeno na uređaju', 'on')");

const driveStub = `/*
 * Zamjena za drive.js: prijava na Google zahtijeva http(s) adresu, pa je u
 * jednodatotečnoj verziji sinkronizacija isključena.
 */
const Drive = {
    configure() {},
    isConfigured: () => false,
    isConnected: () => false,
    connect: () => Promise.reject(new Error('Sinkronizacija nije dostupna u offline verziji.')),
    connectSilent: () => Promise.reject(new Error('Sinkronizacija nije dostupna u offline verziji.')),
    disconnect() {},
    pull: () => Promise.resolve(null),
    push: () => Promise.resolve(null)
};`;

html = replaceOnce(html,
    '<script src="js/store.js"></script>\n<script src="js/app.js"></script>',
    '<script>\n' + store + '\n' + driveStub + '\n' + app + '\n</script>',
    'poveznice na skripte');

const outDir = path.join(ROOT, 'offline');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'radno-vrijeme.html');
fs.writeFileSync(outFile, html);
console.log('Zapisano: ' + outFile + ' (' + Math.round(html.length / 1024) + ' KB)');
