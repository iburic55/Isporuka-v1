/*
 * app.js — sučelje: unos smjena, zbrojevi, izvještaji, izvoz i sinkronizacija.
 */
(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);

    let settings = Store.getSettings();
    let editingId = null;
    let syncTimer = null;
    let syncing = false;

    const period = { type: 'week', anchor: new Date() };

    /* =============== pomoćne funkcije: datumi =============== */

    const pad = (n) => String(n).padStart(2, '0');

    /** Datum bez vremenske zone: 'YYYY-MM-DD' -> lokalni Date u podne. */
    function parseDate(iso) {
        const [y, m, d] = iso.split('-').map(Number);
        return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
    }

    function toIsoDate(date) {
        return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
    }

    function addDays(date, days) {
        const copy = new Date(date.getTime());
        copy.setDate(copy.getDate() + days);
        return copy;
    }

    /** Ponedjeljak tjedna u kojem je zadani datum. */
    function startOfWeek(date) {
        const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
        const weekday = (copy.getDay() + 6) % 7; // ponedjeljak = 0
        return addDays(copy, -weekday);
    }

    /** ISO 8601 broj tjedna. */
    function isoWeek(date) {
        const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
        copy.setDate(copy.getDate() + 3 - ((copy.getDay() + 6) % 7));
        const firstThursday = new Date(copy.getFullYear(), 0, 4, 12);
        firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
        return {
            week: 1 + Math.round((copy - firstThursday) / (7 * 24 * 3600 * 1000)),
            year: copy.getFullYear()
        };
    }

    const MONTHS = ['siječanj', 'veljača', 'ožujak', 'travanj', 'svibanj', 'lipanj',
        'srpanj', 'kolovoz', 'rujan', 'listopad', 'studeni', 'prosinac'];
    const WEEKDAYS = ['pon', 'uto', 'sri', 'čet', 'pet', 'sub', 'ned'];

    function formatDateShort(iso) {
        if (!iso) return '';
        const date = parseDate(iso);
        return WEEKDAYS[(date.getDay() + 6) % 7] + ' ' + date.getDate() + '.' + (date.getMonth() + 1) + '.';
    }

    /* =============== pomoćne funkcije: izračun =============== */

    /** Trajanje smjene u minutama; kraj prije početka znači rad preko ponoći. */
    function shiftMinutes(shift) {
        if (!shift.start || !shift.end) return 0;
        const [sh, sm] = shift.start.split(':').map(Number);
        const [eh, em] = shift.end.split(':').map(Number);
        let minutes = (eh * 60 + em) - (sh * 60 + sm);
        if (minutes < 0) minutes += 24 * 60;
        return Math.max(0, minutes - (shift.breakMinutes || 0));
    }

    function wageEarnings(shift) {
        return (shiftMinutes(shift) / 60) * (shift.hourlyRate || 0);
    }

    function formatHours(minutes) {
        const sign = minutes < 0 ? '-' : '';
        const abs = Math.abs(Math.round(minutes));
        return sign + Math.floor(abs / 60) + ':' + pad(abs % 60);
    }

    function money(value) {
        try {
            return new Intl.NumberFormat('hr-HR', {
                style: 'currency',
                currency: settings.currency || 'EUR',
                maximumFractionDigits: 2
            }).format(value || 0);
        } catch (err) {
            return (value || 0).toFixed(2) + ' ' + (settings.currency || '');
        }
    }

    function number(value, digits) {
        return new Intl.NumberFormat('hr-HR', {
            minimumFractionDigits: digits === undefined ? 2 : digits,
            maximumFractionDigits: digits === undefined ? 2 : digits
        }).format(value || 0);
    }

    function aggregate(shifts) {
        return shifts.reduce((acc, shift) => {
            const minutes = shiftMinutes(shift);
            acc.count += 1;
            acc.minutes += minutes;
            acc.wage += wageEarnings(shift);
            acc.tips += shift.tips || 0;
            return acc;
        }, { count: 0, minutes: 0, wage: 0, tips: 0 });
    }

    /* =============== dohvat smjena =============== */

    function shiftsInRange(from, to) {
        return Store.all().filter((shift) => {
            if (!shift.date) return false;
            if (from && shift.date < from) return false;
            if (to && shift.date > to) return false;
            return true;
        });
    }

    /** Prozor od 30 dana koji završava na zadanom datumu. */
    function last30Range(anchor) {
        const end = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 12);
        return { start: addDays(end, -29), end };
    }

    function currentPeriodRange() {
        const anchor = period.anchor;
        if (period.type === 'last30') {
            const span = last30Range(anchor);
            return { from: toIsoDate(span.start), to: toIsoDate(span.end) };
        }
        if (period.type === 'week') {
            const start = startOfWeek(anchor);
            return { from: toIsoDate(start), to: toIsoDate(addDays(start, 6)) };
        }
        if (period.type === 'month') {
            const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12);
            const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 12);
            return { from: toIsoDate(start), to: toIsoDate(end) };
        }
        if (period.type === 'year') {
            return { from: anchor.getFullYear() + '-01-01', to: anchor.getFullYear() + '-12-31' };
        }
        return { from: null, to: null };
    }

    function periodLabel() {
        const anchor = period.anchor;
        if (period.type === 'last30') {
            const span = last30Range(anchor);
            const isToday = toIsoDate(span.end) === toIsoDate(new Date());
            const range = span.start.getDate() + '.' + (span.start.getMonth() + 1) + '. – ' +
                span.end.getDate() + '.' + (span.end.getMonth() + 1) + '. ' + span.end.getFullYear();
            return (isToday ? 'Zadnjih 30 dana: ' : '') + range;
        }
        if (period.type === 'week') {
            const start = startOfWeek(anchor);
            const end = addDays(start, 6);
            const { week } = isoWeek(start);
            return start.getDate() + '.' + (start.getMonth() + 1) + '. – ' +
                end.getDate() + '.' + (end.getMonth() + 1) + '. ' + end.getFullYear() + ' (' + week + '. tj.)';
        }
        if (period.type === 'month') return MONTHS[anchor.getMonth()] + ' ' + anchor.getFullYear();
        if (period.type === 'year') return String(anchor.getFullYear());
        return 'Sve razdoblje';
    }

    /** Grupiranje unutar razdoblja: tjedan → dan, mjesec → tjedan, dalje → mjesec/godina. */
    function groupShifts(shifts) {
        const groups = new Map();

        const put = (key, label, sortKey, shift) => {
            if (!groups.has(key)) groups.set(key, { label, sortKey, shifts: [] });
            groups.get(key).shifts.push(shift);
        };

        shifts.forEach((shift) => {
            const date = parseDate(shift.date);
            if (period.type === 'week' || period.type === 'month' || period.type === 'last30') {
                put(shift.date, formatDateShort(shift.date), shift.date, shift);
            } else if (period.type === 'year') {
                const key = date.getFullYear() + '-' + pad(date.getMonth() + 1);
                put(key, MONTHS[date.getMonth()], key, shift);
            } else {
                const key = String(date.getFullYear());
                put(key, key, key, shift);
            }
        });

        return Array.from(groups.values()).sort((a, b) => (a.sortKey < b.sortKey ? -1 : 1));
    }

    /* =============== obavijesti =============== */

    /**
     * Potvrda u samoj stranici umjesto `window.confirm` — ugrađeni dijalog
     * preglednika zna biti blokiran kad stranica radi unutar okvira.
     */
    function askConfirm(message) {
        return new Promise((resolve) => {
            const overlay = $('confirmOverlay');
            $('confirmText').textContent = message;
            overlay.hidden = false;
            $('confirmOk').focus();

            const finish = (answer) => {
                overlay.hidden = true;
                $('confirmOk').removeEventListener('click', onOk);
                $('confirmCancel').removeEventListener('click', onCancel);
                overlay.removeEventListener('click', onBackdrop);
                document.removeEventListener('keydown', onKey);
                resolve(answer);
            };
            const onOk = () => finish(true);
            const onCancel = () => finish(false);
            const onBackdrop = (event) => { if (event.target === overlay) finish(false); };
            const onKey = (event) => { if (event.key === 'Escape') finish(false); };

            $('confirmOk').addEventListener('click', onOk);
            $('confirmCancel').addEventListener('click', onCancel);
            overlay.addEventListener('click', onBackdrop);
            document.addEventListener('keydown', onKey);
        });
    }

    let toastTimer = null;
    function toast(message, isError) {
        const el = $('toast');
        el.textContent = message;
        el.classList.toggle('toast--error', Boolean(isError));
        el.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { el.hidden = true; }, isError ? 6000 : 3000);
    }

    /* =============== forma za smjenu =============== */

    function readForm() {
        return {
            id: editingId,
            date: $('shiftDate').value,
            start: $('shiftStart').value,
            end: $('shiftEnd').value,
            breakMinutes: Number($('shiftBreak').value) || 0,
            hourlyRate: Number($('shiftRate').value) || 0,
            tips: Number($('shiftTips').value) || 0,
            note: $('shiftNote').value.trim()
        };
    }

    function validate(shift) {
        if (!shift.date) return 'Odaberi datum smjene.';
        if (!shift.start || !shift.end) return 'Upiši vrijeme početka i kraja.';
        if (shift.start === shift.end) return 'Početak i kraj ne mogu biti isti.';
        if (shift.breakMinutes < 0) return 'Pauza ne može biti negativna.';
        if (shift.hourlyRate < 0) return 'Satnica ne može biti negativna.';
        if (shift.tips < 0) return 'Bakšiš ne može biti negativan.';
        if (shiftMinutes(shift) <= 0) return 'Pauza je duža od trajanja smjene.';
        return null;
    }

    function updatePreview() {
        const shift = readForm();
        const el = $('shiftPreview');
        if (!shift.start || !shift.end) {
            el.textContent = 'Upiši početak i kraj smjene za izračun.';
            return;
        }
        const minutes = shiftMinutes(shift);
        const wage = wageEarnings(shift);
        const overnight = shift.end < shift.start ? ' (preko ponoći)' : '';
        el.textContent = 'Odrađeno ' + formatHours(minutes) + ' h' + overnight +
            ' · od sati ' + money(wage) +
            ' · bakšiš ' + money(shift.tips) +
            ' · ukupno ' + money(wage + shift.tips);
    }

    function resetForm() {
        editingId = null;
        $('shiftFormTitle').textContent = 'Nova smjena';
        $('shiftId').value = '';
        $('shiftDate').value = toIsoDate(new Date());
        $('shiftStart').value = '';
        $('shiftEnd').value = '';
        $('shiftBreak').value = '0';
        $('shiftRate').value = settings.hourlyRate ? String(settings.hourlyRate) : '';
        $('shiftTips').value = '0';
        $('shiftNote').value = '';
        $('shiftError').hidden = true;
        $('shiftCancelBtn').hidden = true;
        updatePreview();
    }

    function startEdit(id) {
        const shift = Store.get(id);
        if (!shift) return;
        editingId = shift.id;
        $('shiftFormTitle').textContent = 'Uredi smjenu';
        $('shiftId').value = shift.id;
        $('shiftDate').value = shift.date;
        $('shiftStart').value = shift.start;
        $('shiftEnd').value = shift.end;
        $('shiftBreak').value = String(shift.breakMinutes);
        $('shiftRate').value = String(shift.hourlyRate);
        $('shiftTips').value = String(shift.tips);
        $('shiftNote').value = shift.note;
        $('shiftError').hidden = true;
        $('shiftCancelBtn').hidden = false;
        updatePreview();
        $('shiftDate').focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /* =============== prikaz liste =============== */

    function filteredShifts() {
        return shiftsInRange($('filterFrom').value || null, $('filterTo').value || null);
    }

    function totalsMarkup(totals, options) {
        const hours = totals.minutes / 60;
        const perHour = hours > 0 ? totals.tips / hours : 0;
        const items = [
            { label: 'Smjena', value: String(totals.count) },
            { label: 'Sati', value: formatHours(totals.minutes) },
            { label: 'Od sati', value: money(totals.wage), cls: 'total__value--hours' },
            { label: 'Bakšiš', value: money(totals.tips), cls: 'total__value--tips' },
            { label: 'Ukupno', value: money(totals.wage + totals.tips) }
        ];
        if (options && options.extended) {
            items.push({ label: 'Bakšiš po satu', value: money(perHour) });
            items.push({ label: 'Prosjek po smjeni', value: money(totals.count ? (totals.wage + totals.tips) / totals.count : 0) });
        }
        return items.map((item) =>
            '<div class="total"><span class="total__label">' + item.label + '</span>' +
            '<span class="total__value ' + (item.cls || '') + '">' + item.value + '</span></div>'
        ).join('');
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (ch) => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
        ));
    }

    function renderShifts() {
        const shifts = filteredShifts();
        const body = $('shiftsBody');

        body.innerHTML = shifts.map((shift) => {
            const minutes = shiftMinutes(shift);
            const wage = wageEarnings(shift);
            const overnight = shift.end < shift.start ? ' <span class="cell-note">+1d</span>' : '';
            return '<tr>' +
                '<td>' + formatDateShort(shift.date) + '<br><span class="cell-note">' + shift.date + '</span></td>' +
                '<td>' + escapeHtml(shift.start) + '–' + escapeHtml(shift.end) + overnight +
                (shift.note ? '<br><span class="cell-note">' + escapeHtml(shift.note) + '</span>' : '') + '</td>' +
                '<td class="num">' + (shift.breakMinutes || 0) + '</td>' +
                '<td class="num">' + formatHours(minutes) + '</td>' +
                '<td class="num">' + number(shift.hourlyRate) + '</td>' +
                '<td class="num cell-hours">' + money(wage) + '</td>' +
                '<td class="num cell-tips">' + money(shift.tips) + '</td>' +
                '<td class="num cell-total">' + money(wage + shift.tips) + '</td>' +
                '<td><div class="row-actions">' +
                '<button type="button" class="icon-btn" data-edit="' + shift.id + '">Uredi</button>' +
                '<button type="button" class="icon-btn icon-btn--danger" data-delete="' + shift.id + '">Obriši</button>' +
                '</div></td>' +
                '</tr>';
        }).join('');

        $('shiftsEmpty').hidden = shifts.length > 0;
        $('shiftsSummary').innerHTML = totalsMarkup(aggregate(shifts));
    }

    /* =============== izvještaji =============== */

    function renderReport() {
        const range = currentPeriodRange();
        const shifts = shiftsInRange(range.from, range.to);
        const totals = aggregate(shifts);

        $('periodLabel').textContent = periodLabel();
        $('reportTotals').innerHTML = totalsMarkup(totals, { extended: true });

        const groupHeaders = { week: 'Dan', last30: 'Dan', month: 'Dan', year: 'Mjesec', all: 'Godina' };
        $('reportGroupHeader').textContent = groupHeaders[period.type];

        const groups = groupShifts(shifts);
        const maxTotal = groups.reduce((max, group) => {
            const sum = aggregate(group.shifts);
            return Math.max(max, sum.wage + sum.tips);
        }, 0);

        $('reportChart').innerHTML = groups.length
            ? groups.map((group) => {
                const sum = aggregate(group.shifts);
                const total = sum.wage + sum.tips;
                const scale = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
                const wageShare = total > 0 ? (sum.wage / total) * scale : 0;
                const tipShare = total > 0 ? (sum.tips / total) * scale : 0;
                return '<div class="chart__row">' +
                    '<span class="chart__label">' + escapeHtml(group.label) + '</span>' +
                    '<span class="chart__bars">' +
                    '<span class="chart__bar chart__bar--hours" style="width:' + wageShare.toFixed(2) + '%"></span>' +
                    '<span class="chart__bar chart__bar--tips" style="width:' + tipShare.toFixed(2) + '%"></span>' +
                    '</span>' +
                    '<span class="chart__value">' + money(total) + '</span>' +
                    '</div>';
            }).join('') +
            '<div class="legend">' +
            '<span class="legend__item"><span class="legend__swatch legend__swatch--hours"></span>zarada od sati</span>' +
            '<span class="legend__item"><span class="legend__swatch legend__swatch--tips"></span>bakšiš</span>' +
            '</div>'
            : '';

        // Kumulativa raste kroz razdoblje: svaki redak nosi zbroj svih dotad.
        let running = 0;
        $('reportBody').innerHTML = groups.map((group) => {
            const sum = aggregate(group.shifts);
            const groupTotal = sum.wage + sum.tips;
            running += groupTotal;
            return '<tr>' +
                '<td>' + escapeHtml(group.label) + '</td>' +
                '<td class="num">' + sum.count + '</td>' +
                '<td class="num">' + formatHours(sum.minutes) + '</td>' +
                '<td class="num cell-hours">' + money(sum.wage) + '</td>' +
                '<td class="num cell-tips">' + money(sum.tips) + '</td>' +
                '<td class="num cell-total">' + money(groupTotal) + '</td>' +
                '<td class="num cell-running">' + money(running) + '</td>' +
                '</tr>';
        }).join('');

        const totalLabels = {
            week: 'Ukupno tjedan',
            last30: 'Ukupno 30 dana',
            month: 'Ukupno mjesec',
            year: 'Ukupno godina',
            all: 'Ukupno'
        };
        $('reportFoot').innerHTML = groups.length
            ? '<tr>' +
                '<td>' + totalLabels[period.type] + '</td>' +
                '<td class="num">' + totals.count + '</td>' +
                '<td class="num">' + formatHours(totals.minutes) + '</td>' +
                '<td class="num cell-hours">' + money(totals.wage) + '</td>' +
                '<td class="num cell-tips">' + money(totals.tips) + '</td>' +
                '<td class="num cell-total">' + money(totals.wage + totals.tips) + '</td>' +
                '<td class="num cell-running">' + money(totals.wage + totals.tips) + '</td>' +
                '</tr>'
            : '';

        $('reportEmpty').hidden = groups.length > 0;
    }

    /* =============== „što ako radim svaki dan" =============== */

    /** Zadnji dan s unesenim smjenama, zbrojen (dnevnica + bakšiš tog dana). */
    function latestWorkedDay() {
        const shifts = Store.all();
        if (!shifts.length) return null;
        const date = shifts[0].date;
        const sum = aggregate(shifts.filter((shift) => shift.date === date));
        return { date, wage: sum.wage, tips: sum.tips };
    }

    function daysInCurrentMonth() {
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    }

    /** Spremljene vrijednosti; uz `reset` se ponovno uzimaju iz zadnjeg dana. */
    function whatIfValues(reset) {
        const last = latestWorkedDay();
        const stored = !reset && settings.whatIfWage !== null && settings.whatIfWage !== undefined;
        return {
            wage: stored ? settings.whatIfWage : (last ? last.wage : 0),
            tips: stored ? settings.whatIfTips : (last ? last.tips : 0),
            days: (!reset && settings.whatIfDays) ? settings.whatIfDays : daysInCurrentMonth()
        };
    }

    function fillWhatIfInputs(values) {
        $('whatIfWage').value = values.wage ? String(Number(values.wage.toFixed(2))) : '0';
        $('whatIfTips').value = values.tips ? String(Number(values.tips.toFixed(2))) : '0';
        $('whatIfDays').value = String(values.days);
    }

    function renderWhatIf() {
        const wage = Math.max(0, Number($('whatIfWage').value) || 0);
        const tips = Math.max(0, Number($('whatIfTips').value) || 0);
        const days = Math.max(1, Math.round(Number($('whatIfDays').value) || 1));
        const perDay = wage + tips;

        const items = [
            { label: 'Dana', value: String(days) },
            { label: 'Po danu', value: money(perDay) },
            { label: 'Od sati', value: money(wage * days), cls: 'total__value--hours' },
            { label: 'Bakšiš', value: money(tips * days), cls: 'total__value--tips' },
            { label: 'Ukupno', value: money(perDay * days) }
        ];
        $('whatIfTotals').innerHTML = items.map((item) =>
            '<div class="total"><span class="total__label">' + item.label + '</span>' +
            '<span class="total__value ' + (item.cls || '') + '">' + item.value + '</span></div>'
        ).join('');

        const last = latestWorkedDay();
        // Hrvatski: 1, 21, 31 dan — ostalo dana (osim 11).
        const dayWord = (days % 10 === 1 && days % 100 !== 11) ? ' dan × ' : ' dana × ';
        $('whatIfNote').textContent = days + dayWord +
            money(perDay) + ' = ' + money(perDay * days) + '.' +
            (last ? ' Zadnji odrađeni dan (' + formatDateShort(last.date) + '): dnevnica ' +
                money(last.wage) + ', bakšiš ' + money(last.tips) + '.' : '');
    }

    function saveWhatIf() {
        settings = Store.saveSettings({
            whatIfWage: Math.max(0, Number($('whatIfWage').value) || 0),
            whatIfTips: Math.max(0, Number($('whatIfTips').value) || 0),
            whatIfDays: Math.max(1, Math.round(Number($('whatIfDays').value) || 1))
        });
    }

    function bindWhatIf() {
        ['whatIfWage', 'whatIfTips', 'whatIfDays'].forEach((id) => {
            $(id).addEventListener('input', renderWhatIf);
            $(id).addEventListener('change', () => {
                saveWhatIf();
                scheduleSync();
            });
        });

        document.querySelectorAll('[data-whatif-days]').forEach((btn) => {
            btn.addEventListener('click', () => {
                $('whatIfDays').value = btn.dataset.whatifDays;
                renderWhatIf();
                saveWhatIf();
            });
        });

        $('whatIfMonthBtn').addEventListener('click', () => {
            $('whatIfDays').value = String(daysInCurrentMonth());
            renderWhatIf();
            saveWhatIf();
        });

        $('whatIfResetBtn').addEventListener('click', () => {
            fillWhatIfInputs(whatIfValues(true));
            renderWhatIf();
            saveWhatIf();
        });
    }

    function renderAll() {
        document.querySelectorAll('.currency-label').forEach((el) => {
            el.textContent = settings.currency || 'EUR';
        });
        renderShifts();
        renderReport();
        // Dok korisnik ne upiše svoje vrijednosti, „što ako" prati zadnji odrađeni dan.
        if (settings.whatIfWage === null || settings.whatIfWage === undefined) {
            fillWhatIfInputs(whatIfValues(false));
        }
        renderWhatIf();
        updateStorageStatus();
    }

    /* =============== izvoz =============== */

    function downloadFile(name, content, mime) {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /** CSV s točka-zarezom i BOM-om — tako ga Excel na hrvatskim postavkama otvori ispravno. */
    function toCsv(shifts) {
        const cell = (value) => '"' + String(value === undefined || value === null ? '' : value).replace(/"/g, '""') + '"';
        const rows = [[
            'Datum', 'Početak', 'Kraj', 'Pauza (min)', 'Sati (h:mm)', 'Sati (decimalno)',
            'Satnica', 'Zarada od sati', 'Bakšiš', 'Ukupno', 'Valuta', 'Napomena'
        ]];

        shifts.forEach((shift) => {
            const minutes = shiftMinutes(shift);
            const wage = wageEarnings(shift);
            rows.push([
                shift.date, shift.start, shift.end, shift.breakMinutes,
                formatHours(minutes), (minutes / 60).toFixed(2).replace('.', ','),
                shift.hourlyRate.toFixed(2).replace('.', ','),
                wage.toFixed(2).replace('.', ','),
                (shift.tips || 0).toFixed(2).replace('.', ','),
                (wage + shift.tips).toFixed(2).replace('.', ','),
                settings.currency || 'EUR',
                shift.note
            ]);
        });

        const totals = aggregate(shifts);
        rows.push([]);
        rows.push([
            'UKUPNO', '', '', '', formatHours(totals.minutes), (totals.minutes / 60).toFixed(2).replace('.', ','),
            '', totals.wage.toFixed(2).replace('.', ','),
            totals.tips.toFixed(2).replace('.', ','),
            (totals.wage + totals.tips).toFixed(2).replace('.', ','),
            settings.currency || 'EUR', ''
        ]);

        return '﻿' + rows.map((row) => row.map(cell).join(';')).join('\r\n');
    }

    /* =============== sinkronizacija =============== */

    function setSyncStatus(text, modifier) {
        const el = $('syncStatus');
        el.textContent = text;
        el.className = 'sync-status sync-status--' + modifier;
    }

    function configureDrive() {
        Drive.configure({ clientId: settings.driveClientId, fileName: settings.driveFileName });
    }

    async function sync(options) {
        const interactive = Boolean(options && options.interactive);
        if (!settings.driveClientId) {
            if (interactive) toast('Prvo upiši Google Client ID u Postavkama.', true);
            return;
        }
        if (syncing) return;

        syncing = true;
        setSyncStatus('Sinkroniziram…', 'busy');
        try {
            configureDrive();
            const remote = await Drive.pull();
            if (remote) Store.merge(remote);
            await Drive.push(Store.snapshot());

            settings = Store.getSettings();
            renderAll();
            setSyncStatus('Drive', 'on');
            if (interactive) toast('Podaci su sinkronizirani s Google Driveom.');
        } catch (err) {
            console.error(err);
            setSyncStatus('Greška', 'error');
            toast(err.message || 'Sinkronizacija nije uspjela.', true);
        } finally {
            syncing = false;
        }
    }

    /** Odgođena automatska sinkronizacija — skupi više izmjena u jedan zapis. */
    function scheduleSync() {
        if (!settings.autoSync || !settings.driveClientId || !Drive.isConnected()) return;
        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => sync({ interactive: false }), 2500);
    }

    /* =============== događaji =============== */

    function bindTabs() {
        document.querySelectorAll('.tab').forEach((tab) => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t === tab));
                document.querySelectorAll('.tab-panel').forEach((panel) => {
                    panel.classList.toggle('is-active', panel.id === 'tab-' + tab.dataset.tab);
                });
            });
        });
    }

    function bindShiftForm() {
        ['shiftDate', 'shiftStart', 'shiftEnd', 'shiftBreak', 'shiftRate', 'shiftTips'].forEach((id) => {
            $(id).addEventListener('input', updatePreview);
        });

        $('shiftForm').addEventListener('submit', (event) => {
            event.preventDefault();
            const shift = readForm();
            const error = validate(shift);
            if (error) {
                $('shiftError').textContent = error;
                $('shiftError').hidden = false;
                return;
            }
            Store.upsert(shift);
            const wasEditing = Boolean(editingId);
            const saveFailed = Boolean(Store.status().error);
            resetForm();
            renderAll();
            scheduleSync();
            toast(
                saveFailed
                    ? 'Smjena nije spremljena na uređaj — pogledaj upozorenje na vrhu stranice.'
                    : (wasEditing ? 'Smjena je ažurirana i spremljena na uređaj.' : 'Smjena je spremljena na uređaj.'),
                saveFailed
            );
        });

        $('shiftCancelBtn').addEventListener('click', () => {
            resetForm();
        });

        $('shiftsBody').addEventListener('click', async (event) => {
            const editId = event.target.getAttribute('data-edit');
            const deleteId = event.target.getAttribute('data-delete');
            if (editId) startEdit(editId);
            if (deleteId) {
                const shift = Store.get(deleteId);
                if (!shift) return;
                const confirmed = await askConfirm('Obrisati smjenu ' + shift.date +
                    ' (' + shift.start + '–' + shift.end + ')?');
                if (!confirmed) return;
                Store.remove(deleteId);
                if (editingId === deleteId) resetForm();
                renderAll();
                scheduleSync();
                toast('Smjena je obrisana.');
            }
        });

        $('filterFrom').addEventListener('change', renderShifts);
        $('filterTo').addEventListener('change', renderShifts);
        $('filterClearBtn').addEventListener('click', () => {
            $('filterFrom').value = '';
            $('filterTo').value = '';
            renderShifts();
        });

        $('exportCsvBtn').addEventListener('click', () => {
            const shifts = filteredShifts();
            if (!shifts.length) {
                toast('Nema smjena za izvoz.', true);
                return;
            }
            downloadFile('smjene-' + toIsoDate(new Date()) + '.csv', toCsv(shifts), 'text/csv;charset=utf-8');
        });
    }

    function bindReports() {
        document.querySelectorAll('.segmented__btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                period.type = btn.dataset.period;
                period.anchor = new Date();
                document.querySelectorAll('.segmented__btn').forEach((b) => b.classList.toggle('is-active', b === btn));
                const disabled = period.type === 'all';
                $('periodPrev').disabled = disabled;
                $('periodNext').disabled = disabled;
                renderReport();
            });
        });

        const shift = (direction) => {
            const anchor = period.anchor;
            if (period.type === 'last30') period.anchor = addDays(anchor, 30 * direction);
            else if (period.type === 'week') period.anchor = addDays(anchor, 7 * direction);
            else if (period.type === 'month') period.anchor = new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1, 12);
            else if (period.type === 'year') period.anchor = new Date(anchor.getFullYear() + direction, anchor.getMonth(), 1, 12);
            renderReport();
        };

        $('periodPrev').addEventListener('click', () => shift(-1));
        $('periodNext').addEventListener('click', () => shift(1));

        $('exportReportCsvBtn').addEventListener('click', () => {
            const range = currentPeriodRange();
            const shifts = shiftsInRange(range.from, range.to);
            if (!shifts.length) {
                toast('Nema smjena u odabranom razdoblju.', true);
                return;
            }
            const name = 'smjene-' + (range.from || 'sve') + '_' + (range.to || 'sve') + '.csv';
            downloadFile(name, toCsv(shifts), 'text/csv;charset=utf-8');
        });
    }

    function fillSettingsForm() {
        $('settingsRate').value = settings.hourlyRate ? String(settings.hourlyRate) : '';
        $('settingsCurrency').value = settings.currency || 'EUR';
        $('settingsClientId').value = settings.driveClientId || '';
        $('settingsFileName').value = settings.driveFileName || 'radno-vrijeme.json';
        $('settingsAutoSync').checked = settings.autoSync !== false;
    }

    function bindSettings() {
        $('settingsForm').addEventListener('submit', (event) => {
            event.preventDefault();
            settings = Store.saveSettings({
                hourlyRate: Number($('settingsRate').value) || 0,
                currency: $('settingsCurrency').value,
                driveClientId: $('settingsClientId').value.trim(),
                driveFileName: $('settingsFileName').value.trim() || 'radno-vrijeme.json',
                autoSync: $('settingsAutoSync').checked
            });
            configureDrive();
            if (!editingId && !$('shiftRate').value) $('shiftRate').value = settings.hourlyRate || '';
            renderAll();
            $('settingsMessage').textContent = 'Postavke su spremljene.';
            scheduleSync();
        });

        $('driveConnectBtn').addEventListener('click', async () => {
            settings = Store.saveSettings({
                driveClientId: $('settingsClientId').value.trim(),
                driveFileName: $('settingsFileName').value.trim() || 'radno-vrijeme.json'
            });
            configureDrive();
            if (!settings.driveClientId) {
                $('settingsMessage').textContent = 'Upiši Google OAuth Client ID pa pokušaj ponovno.';
                return;
            }
            try {
                setSyncStatus('Povezujem…', 'busy');
                await Drive.connect();
                $('settingsMessage').textContent = 'Povezano s Google Driveom.';
                await sync({ interactive: true });
            } catch (err) {
                setSyncStatus('Greška', 'error');
                $('settingsMessage').textContent = err.message || 'Povezivanje nije uspjelo.';
                toast(err.message || 'Povezivanje nije uspjelo.', true);
            }
        });

        $('driveDisconnectBtn').addEventListener('click', () => {
            Drive.disconnect();
            setSyncStatus('Lokalno', 'off');
            $('settingsMessage').textContent = 'Veza s Driveom je prekinuta. Podaci ostaju na ovom uređaju.';
        });

        $('exportJsonBtn').addEventListener('click', () => {
            downloadFile('radno-vrijeme-' + toIsoDate(new Date()) + '.json',
                JSON.stringify(Store.snapshot(), null, 2), 'application/json');
        });

        $('importJsonInput').addEventListener('change', (event) => {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    const data = JSON.parse(String(reader.result));
                    const confirmed = await askConfirm('Uvoz zamjenjuje sve podatke na ovom uređaju. Nastaviti?');
                    if (!confirmed) return;
                    Store.replace(data);
                    settings = Store.getSettings();
                    fillSettingsForm();
                    resetForm();
                    renderAll();
                    toast('Podaci su uvezeni.');
                } catch (err) {
                    toast('Datoteka nije ispravan JSON.', true);
                } finally {
                    event.target.value = '';
                }
            };
            reader.readAsText(file);
        });

        $('clearDataBtn').addEventListener('click', async () => {
            const confirmed = await askConfirm('Trajno obrisati sve smjene i postavke s ovog uređaja?');
            if (!confirmed) return;
            Store.clear();
            settings = Store.getSettings();
            fillSettingsForm();
            resetForm();
            renderAll();
            setSyncStatus('Lokalno', 'off');
            toast('Svi podaci su obrisani.');
        });
    }

    /* =============== pokretanje =============== */

    /**
     * Prikazuje stanje pohrane na uređaju: kad je zadnji put spremljeno i,
     * ako preglednik pohranu ne dopušta, izričito upozorenje umjesto tihog
     * gubitka podataka.
     */
    function updateStorageStatus() {
        const state = Store.status();
        const banner = $('storageWarning');
        const info = $('storageInfo');

        if (!state.available || state.error) {
            banner.hidden = false;
            banner.textContent = 'Ovaj preglednik ne dopušta spremanje podataka na uređaj' +
                (state.error ? ' (' + state.error + ')' : '') +
                '. Unosi će nestati zatvaranjem stranice — otvori datoteku preko punog file:/// puta ' +
                'ili instaliraj aplikaciju na početni zaslon, a podatke u međuvremenu spremi kroz Preuzmi JSON.';
            info.textContent = 'Spremanje na uređaj trenutno ne radi.';
            return;
        }

        banner.hidden = true;
        info.textContent = state.savedAt
            ? 'Zadnje spremanje na uređaj: ' + state.savedAt.toLocaleString('hr-HR') + '.'
            : 'Podaci se spremaju na ovaj uređaj čim uneseš ili izmijeniš smjenu.';
    }

    /**
     * Traži trajnu pohranu kako mobilni preglednik podatke ne bi izbacio kad
     * mu ponestane prostora. Odbijanje nije greška — pohrana i dalje radi.
     */
    function requestPersistentStorage() {
        if (!navigator.storage || typeof navigator.storage.persist !== 'function') return;
        navigator.storage.persisted()
            .then((already) => (already ? true : navigator.storage.persist()))
            .catch(() => {});
    }

    /**
     * Registracija service workera — nakon prvog otvaranja aplikacija radi
     * bez mreže i može se instalirati na početni zaslon. Traži sigurni
     * kontekst (https ili localhost); s file:// se preskače.
     */
    function registerServiceWorker() {
        if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
        navigator.serviceWorker.register('sw.js').catch((err) => {
            console.warn('Service worker nije registriran:', err);
        });
    }

    function init() {
        Store.load();
        settings = Store.getSettings();

        bindTabs();
        bindShiftForm();
        bindReports();
        bindWhatIf();
        bindSettings();

        $('syncNowBtn').addEventListener('click', () => sync({ interactive: true }));

        fillSettingsForm();
        fillWhatIfInputs(whatIfValues(false));
        resetForm();
        renderAll();
        setSyncStatus('Lokalno', 'off');
        requestPersistentStorage();
        registerServiceWorker();

        if (settings.driveClientId) {
            configureDrive();
            // Tiha prijava uspije samo ako je pristanak već dan; inače ostajemo lokalno.
            Drive.connectSilent()
                .then(() => sync({ interactive: false }))
                .catch(() => setSyncStatus('Lokalno', 'off'));
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
