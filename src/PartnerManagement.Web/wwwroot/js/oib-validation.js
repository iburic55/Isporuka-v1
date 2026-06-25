// Klijentski adapter za validaciju hrvatskog OIB-a (jQuery unobtrusive).
// Povezuje se s atributom data-val-croatianpin koji generira CroatianPinAttribute.
(function ($) {
    'use strict';

    if (!$ || !$.validator) {
        return;
    }

    // Provjera kontrolne znamenke OIB-a po algoritmu ISO 7064, MOD 11,10.
    function isValidOib(value) {
        if (value === null || value === undefined) {
            return true; // neobavezno
        }
        var oib = String(value).trim();
        if (oib.length === 0) {
            return true; // neobavezno polje
        }
        if (!/^\d{11}$/.test(oib)) {
            return false;
        }

        var remainder = 10;
        for (var i = 0; i < 10; i++) {
            remainder = (remainder + parseInt(oib.charAt(i), 10)) % 10;
            if (remainder === 0) {
                remainder = 10;
            }
            remainder = (remainder * 2) % 11;
        }

        var checkDigit = 11 - remainder;
        if (checkDigit === 10) {
            checkDigit = 0;
        }
        return checkDigit === parseInt(oib.charAt(10), 10);
    }

    // jQuery validator pravilo.
    $.validator.addMethod('croatianpin', function (value, element) {
        return this.optional(element) || isValidOib(value);
    });

    // Unobtrusive adapter (bez dodatnih parametara).
    $.validator.unobtrusive.adapters.addBool('croatianpin');
})(window.jQuery);
