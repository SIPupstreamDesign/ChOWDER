(function () {
    "use strict";

    function translate() {
        i18next
            .use(window.i18nextBrowserLanguageDetector)
            .init({
                fallbackLng: 'en',
                resources: {
                    en: {
                        translation: {
                            Controller: 'Hello World'
                        }
                    },
                    ja: {
                        translation: {
                            Controller: 'こんにちは、世界'
                        }
                    }
                },
                debug: true
            }, function (err, t) {
                /*
                var elems = document.querySelectorAll('a');
                elems.forEach(function (v) {
                    if (v.dataset.key) {
                        v.text = i18next.t(v.dataset.key)
                    }
                });
                */
                var elems = document.querySelectorAll('li');
                elems.forEach(function (v) {
                    if (v.dataset.key) {
                        v.text = i18next.t(v.dataset.key)
                    }
                });
            });
    }

    window.Translation = translate;
}())