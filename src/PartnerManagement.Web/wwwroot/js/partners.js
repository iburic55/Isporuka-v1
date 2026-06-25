// Lista partnera: detalji u modalu + AJAX unos police s ažuriranjem oznake "*".
(function () {
    'use strict';

    function antiforgeryToken() {
        var el = document.getElementById('RequestVerificationToken');
        return el ? el.value : '';
    }

    function formatAmount(value) {
        var n = Number(value);
        if (isNaN(n)) { return value; }
        return n.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // --- Detalji partnera (klik na redak) ---
    function setField(modal, name, value) {
        var el = modal.querySelector('[data-field="' + name + '"]');
        if (el) { el.textContent = (value === undefined || value === null || value === '') ? '-' : value; }
    }

    function openDetails(row) {
        var modal = document.getElementById('partnerDetailsModal');
        var d = row.dataset;

        setField(modal, 'fullname', d.fullname);
        setField(modal, 'address', d.address);
        setField(modal, 'partnernumber', d.partnernumber);
        setField(modal, 'oib', d.oib);
        setField(modal, 'type', d.type);
        setField(modal, 'created', d.created);
        setField(modal, 'createby', d.createby);
        setField(modal, 'foreign', d.foreign);
        setField(modal, 'externalcode', d.externalcode);
        setField(modal, 'gender', d.gender);
        setField(modal, 'policycount', d.policycount);
        setField(modal, 'policytotal', formatAmount(d.policytotal));

        $('#partnerDetailsModal').modal('show');
    }

    document.querySelectorAll('#partnersTable tbody tr.partner-row').forEach(function (row) {
        row.addEventListener('click', function () { openDetails(row); });
    });

    // --- Ažuriranje oznake "*" u stvarnom vremenu ---
    function updateMarker(result) {
        var row = document.querySelector('tr.partner-row[data-partner-id="' + result.partnerId + '"]');
        if (!row) { return; }

        row.dataset.policycount = result.policyCount;
        row.dataset.policytotal = result.policyTotal;
        row.dataset.highlighted = result.isHighlighted ? 'true' : 'false';

        var marker = row.querySelector('.highlight-marker');
        if (marker) { marker.textContent = result.isHighlighted ? '* ' : ''; }
    }

    // --- AJAX unos police ---
    function clearPolicyErrors(form) {
        form.querySelectorAll('[data-error-for]').forEach(function (el) {
            el.textContent = '';
            el.classList.add('d-none');
        });
        var box = document.getElementById('policyError');
        box.textContent = '';
        box.classList.add('d-none');
    }

    function showPolicyErrors(errors) {
        var generic = [];
        Object.keys(errors).forEach(function (key) {
            var target = document.querySelector('[data-error-for="' + key + '"]');
            var message = (errors[key] || []).join(' ');
            if (target) {
                target.textContent = message;
                target.classList.remove('d-none');
            } else {
                generic.push(message);
            }
        });
        if (generic.length) {
            var box = document.getElementById('policyError');
            box.textContent = generic.join(' ');
            box.classList.remove('d-none');
        }
    }

    var policyForm = document.getElementById('policyForm');
    if (policyForm) {
        policyForm.addEventListener('submit', function (e) {
            e.preventDefault();
            clearPolicyErrors(policyForm);

            var submitBtn = document.getElementById('policySubmit');
            submitBtn.disabled = true;

            var data = new URLSearchParams(new FormData(policyForm));

            fetch(window.policyCreateUrl, {
                method: 'POST',
                headers: {
                    'RequestVerificationToken': antiforgeryToken(),
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: data.toString()
            })
            .then(function (response) {
                return response.json().then(function (json) {
                    return { ok: response.ok, body: json };
                });
            })
            .then(function (res) {
                if (res.ok) {
                    updateMarker(res.body);
                    $('#policyModal').modal('hide');
                    policyForm.reset();
                } else {
                    showPolicyErrors(res.body.errors || { '': ['Spremanje police nije uspjelo.'] });
                }
            })
            .catch(function () {
                var box = document.getElementById('policyError');
                box.textContent = 'Greška u komunikaciji sa serverom.';
                box.classList.remove('d-none');
            })
            .finally(function () {
                submitBtn.disabled = false;
            });
        });
    }
})();
