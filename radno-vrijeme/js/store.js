/*
 * store.js — model podataka, lokalna pohrana i spajanje (merge) stanja.
 *
 * Stanje se drži u localStorage-u pa aplikacija radi i bez interneta.
 * Svaki zapis nosi `updatedAt` i „nadgrobni" zapis (`deleted`) kako bi se
 * lokalno i Drive stanje mogla spojiti bez gubitka podataka.
 */
const Store = (() => {
    const STORAGE_KEY = 'radnoVrijeme.v1';
    const VERSION = 1;

    const nowIso = () => new Date().toISOString();

    const newId = () => {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }
        return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    };

    const defaultSettings = () => ({
        hourlyRate: 0,
        currency: 'EUR',
        driveClientId: '',
        driveFileName: 'radno-vrijeme.json',
        autoSync: true,
        updatedAt: nowIso()
    });

    const emptyState = () => ({
        version: VERSION,
        shifts: {},
        settings: defaultSettings()
    });

    let state = emptyState();

    /** Normalizira zapis smjene (obrana od ručno uređenog JSON-a). */
    function normalizeShift(raw) {
        if (!raw || typeof raw !== 'object' || !raw.id) return null;
        return {
            id: String(raw.id),
            date: String(raw.date || ''),
            start: String(raw.start || ''),
            end: String(raw.end || ''),
            breakMinutes: Number(raw.breakMinutes) || 0,
            hourlyRate: Number(raw.hourlyRate) || 0,
            tips: Number(raw.tips) || 0,
            note: String(raw.note || ''),
            deleted: raw.deleted === true,
            updatedAt: String(raw.updatedAt || nowIso())
        };
    }

    function normalizeState(raw) {
        const result = emptyState();
        if (!raw || typeof raw !== 'object') return result;

        const shifts = raw.shifts;
        if (shifts && typeof shifts === 'object') {
            const list = Array.isArray(shifts) ? shifts : Object.values(shifts);
            list.forEach((item) => {
                const shift = normalizeShift(item);
                if (shift) result.shifts[shift.id] = shift;
            });
        }

        if (raw.settings && typeof raw.settings === 'object') {
            result.settings = Object.assign(defaultSettings(), raw.settings, {
                hourlyRate: Number(raw.settings.hourlyRate) || 0,
                autoSync: raw.settings.autoSync !== false,
                updatedAt: String(raw.settings.updatedAt || nowIso())
            });
        }
        return result;
    }

    let lastSavedAt = null;
    let lastError = null;

    function persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            lastSavedAt = new Date();
            lastError = null;
            return true;
        } catch (err) {
            // Tiho gubljenje podataka je najgori ishod — greška se prosljeđuje sučelju.
            lastError = err && err.message ? err.message : String(err);
            console.error('Spremanje na uređaj nije uspjelo', err);
            return false;
        }
    }

    /** Provjerava smije li se uopće pisati u pohranu ovog preglednika. */
    function storageAvailable() {
        try {
            const probe = STORAGE_KEY + '.probe';
            localStorage.setItem(probe, '1');
            localStorage.removeItem(probe);
            return true;
        } catch (err) {
            return false;
        }
    }

    function status() {
        return {
            available: storageAvailable(),
            savedAt: lastSavedAt,
            error: lastError
        };
    }

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            state = raw ? normalizeState(JSON.parse(raw)) : emptyState();
        } catch (err) {
            console.error('Čitanje lokalnih podataka nije uspjelo, krećem od praznog stanja', err);
            state = emptyState();
        }
        return state;
    }

    /** Sve smjene bez obrisanih, najnovije prve. */
    function all() {
        return Object.values(state.shifts)
            .filter((s) => !s.deleted)
            .sort((a, b) => {
                if (a.date !== b.date) return a.date < b.date ? 1 : -1;
                return (a.start || '') < (b.start || '') ? 1 : -1;
            });
    }

    function get(id) {
        const shift = state.shifts[id];
        return shift && !shift.deleted ? Object.assign({}, shift) : null;
    }

    function upsert(input) {
        // `id` ide zadnji: novi zapis nosi prazan id koji ovdje dobiva vrijednost.
        const shift = normalizeShift(Object.assign({}, input, { id: input.id || newId() }));
        shift.updatedAt = nowIso();
        shift.deleted = false;
        state.shifts[shift.id] = shift;
        persist();
        return shift;
    }

    /** Brisanje ostavlja nadgrobni zapis da se smjena ne vrati kroz sinkronizaciju. */
    function remove(id) {
        const existing = state.shifts[id];
        if (!existing) return;
        state.shifts[id] = Object.assign({}, existing, { deleted: true, updatedAt: nowIso() });
        persist();
    }

    function getSettings() {
        return Object.assign({}, state.settings);
    }

    function saveSettings(patch) {
        state.settings = Object.assign({}, state.settings, patch, { updatedAt: nowIso() });
        persist();
        return getSettings();
    }

    function snapshot() {
        return JSON.parse(JSON.stringify(state));
    }

    /**
     * Spaja udaljeno stanje s lokalnim: za svaki zapis pobjeđuje noviji
     * `updatedAt`. Vraća true ako se lokalno stanje promijenilo.
     */
    function merge(remoteRaw) {
        const remote = normalizeState(remoteRaw);
        let changed = false;

        Object.values(remote.shifts).forEach((remoteShift) => {
            const local = state.shifts[remoteShift.id];
            if (!local || remoteShift.updatedAt > local.updatedAt) {
                state.shifts[remoteShift.id] = remoteShift;
                changed = true;
            }
        });

        if (remote.settings.updatedAt > state.settings.updatedAt) {
            // Client ID i naziv datoteke su postavke ovog uređaja/preglednika.
            const local = state.settings;
            state.settings = Object.assign({}, remote.settings, {
                driveClientId: local.driveClientId || remote.settings.driveClientId,
                driveFileName: local.driveFileName || remote.settings.driveFileName
            });
            changed = true;
        }

        if (changed) persist();
        return changed;
    }

    /** Potpuna zamjena stanja (uvoz sigurnosne kopije). */
    function replace(rawState) {
        const incoming = normalizeState(rawState);
        // Postavke Drive veze su vezane uz ovaj preglednik pa ih zadržavamo.
        incoming.settings.driveClientId = state.settings.driveClientId || incoming.settings.driveClientId;
        state = incoming;
        persist();
        return state;
    }

    function clear() {
        state = emptyState();
        persist();
    }

    return {
        load, all, get, upsert, remove,
        getSettings, saveSettings,
        snapshot, merge, replace, clear, newId,
        status, storageAvailable
    };
})();
