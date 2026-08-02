/*
 * drive.js — sinkronizacija podataka s Google Driveom.
 *
 * Koristi Google Identity Services (token client) i Drive REST API v3 uz
 * opseg `drive.file`: aplikacija vidi isključivo datoteku koju je sama
 * kreirala. Nema tajni u kodu — korisnik u Postavkama upiše svoj OAuth
 * Client ID, a pristupni token živi samo u memoriji kartice.
 */
const Drive = (() => {
    const SCOPE = 'https://www.googleapis.com/auth/drive.file';
    const API = 'https://www.googleapis.com/drive/v3';
    const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

    let clientId = '';
    let fileName = 'radno-vrijeme.json';
    let tokenClient = null;
    let accessToken = null;
    let tokenExpiresAt = 0;
    let fileId = null;

    function isConfigured() {
        return Boolean(clientId);
    }

    function isConnected() {
        return Boolean(accessToken) && Date.now() < tokenExpiresAt;
    }

    function configure(options) {
        const nextClientId = (options.clientId || '').trim();
        if (nextClientId !== clientId) {
            // Promjena aplikacije znači da stari token i pronađena datoteka više ne vrijede.
            tokenClient = null;
            accessToken = null;
            tokenExpiresAt = 0;
            fileId = null;
        }
        clientId = nextClientId;
        if (options.fileName) {
            const nextName = options.fileName.trim();
            if (nextName !== fileName) fileId = null;
            fileName = nextName || fileName;
        }
    }

    function gisReady() {
        return Boolean(window.google && window.google.accounts && window.google.accounts.oauth2);
    }

    /** Čeka da se GIS skripta učita (do 10 s) prije prve prijave. */
    function waitForGis() {
        if (gisReady()) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const started = Date.now();
            const timer = setInterval(() => {
                if (gisReady()) {
                    clearInterval(timer);
                    resolve();
                } else if (Date.now() - started > 10000) {
                    clearInterval(timer);
                    reject(new Error('Google skripta za prijavu nije se učitala. Provjeri internetsku vezu.'));
                }
            }, 100);
        });
    }

    /**
     * Dohvaća pristupni token. Uz `interactive === false` pokušava tiho
     * (bez skočnog prozora) što radi samo ako je korisnik već dao pristanak.
     */
    async function ensureToken(interactive) {
        if (!isConfigured()) {
            throw new Error('Nedostaje Google Client ID — upiši ga u Postavkama.');
        }
        if (isConnected()) return accessToken;

        await waitForGis();

        if (!tokenClient) {
            tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: SCOPE,
                callback: () => {} // postavlja se po pozivu
            });
        }

        return new Promise((resolve, reject) => {
            tokenClient.callback = (response) => {
                if (response.error) {
                    reject(new Error(describeAuthError(response.error)));
                    return;
                }
                accessToken = response.access_token;
                // Malo ranije od stvarnog isteka da ne uhvatimo 401 usred spremanja.
                tokenExpiresAt = Date.now() + (Number(response.expires_in) || 3600) * 1000 - 60000;
                resolve(accessToken);
            };
            tokenClient.error_callback = (err) => {
                reject(new Error(describeAuthError((err && err.type) || 'unknown')));
            };
            try {
                tokenClient.requestAccessToken({ prompt: interactive ? 'consent' : '' });
            } catch (err) {
                reject(err);
            }
        });
    }

    function describeAuthError(code) {
        switch (code) {
            case 'popup_closed':
            case 'popup_closed_by_user':
                return 'Prozor za prijavu je zatvoren prije dovršetka.';
            case 'popup_failed_to_open':
                return 'Preglednik je blokirao skočni prozor za prijavu — dopusti popup za ovu stranicu.';
            case 'access_denied':
                return 'Pristup Google Driveu nije odobren.';
            default:
                return 'Prijava na Google nije uspjela (' + code + ').';
        }
    }

    async function connect() {
        await ensureToken(false).catch(() => ensureToken(true));
        return true;
    }

    /** Prijava bez skočnog prozora — koristi se pri učitavanju stranice. */
    async function connectSilent() {
        await ensureToken(false);
        return true;
    }

    function disconnect() {
        if (accessToken && gisReady()) {
            window.google.accounts.oauth2.revoke(accessToken, () => {});
        }
        accessToken = null;
        tokenExpiresAt = 0;
        fileId = null;
    }

    async function apiFetch(url, options) {
        const token = await ensureToken(false).catch(() => ensureToken(true));
        const config = Object.assign({}, options);
        config.headers = Object.assign({}, config.headers, { Authorization: 'Bearer ' + token });

        let response = await fetch(url, config);
        if (response.status === 401) {
            // Token je istekao ili opozvan — jednom ponovi uz novu prijavu.
            accessToken = null;
            tokenExpiresAt = 0;
            const fresh = await ensureToken(true);
            config.headers.Authorization = 'Bearer ' + fresh;
            response = await fetch(url, config);
        }
        if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new Error('Google Drive greška ' + response.status + (body ? ': ' + body.slice(0, 200) : ''));
        }
        return response;
    }

    /** Pronalazi ID datoteke s podacima; vraća null ako još ne postoji. */
    async function findFileId() {
        if (fileId) return fileId;
        const query = encodeURIComponent("name = '" + fileName.replace(/'/g, "\\'") + "' and trashed = false");
        const url = API + '/files?q=' + query + '&spaces=drive&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc';
        const response = await apiFetch(url, { method: 'GET' });
        const data = await response.json();
        fileId = (data.files && data.files.length) ? data.files[0].id : null;
        return fileId;
    }

    /** Dohvaća stanje s Drivea ili null ako datoteka još ne postoji. */
    async function pull() {
        const id = await findFileId();
        if (!id) return null;
        const response = await apiFetch(API + '/files/' + id + '?alt=media', { method: 'GET' });
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (err) {
            throw new Error('Datoteka na Driveu nije ispravan JSON.');
        }
    }

    /** Zapisuje stanje na Drive (kreira datoteku pri prvom spremanju). */
    async function push(state) {
        const body = JSON.stringify(state, null, 2);
        const id = await findFileId();

        if (id) {
            await apiFetch(UPLOAD_API + '/files/' + id + '?uploadType=media', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body
            });
            return id;
        }

        const boundary = 'radno-vrijeme-' + Date.now();
        const metadata = { name: fileName, mimeType: 'application/json' };
        const multipart =
            '--' + boundary + '\r\n' +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(metadata) + '\r\n' +
            '--' + boundary + '\r\n' +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            body + '\r\n' +
            '--' + boundary + '--';

        const response = await apiFetch(UPLOAD_API + '/files?uploadType=multipart&fields=id', {
            method: 'POST',
            headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
            body: multipart
        });
        const data = await response.json();
        fileId = data.id;
        return fileId;
    }

    return { configure, isConfigured, isConnected, connect, connectSilent, disconnect, pull, push };
})();
