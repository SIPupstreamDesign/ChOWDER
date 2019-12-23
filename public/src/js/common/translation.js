/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

"use strict";

let language = 'ja-JP';

function checkExistence(key, value) {
    if (!value || key === value) {
        console.error("not found translation key", key)
    }
}

class Translation 
{
    static translate(callback) {
        i18next
            .use(window.i18nextXHRBackend)
            .use(window.i18nextBrowserLanguageDetector)
            .init({
                fallbackLng: 'en-US',
                lng : language,
                backend: {
                    // for all available options read the backend's repository readme file
                    loadPath: '/locales/{{lng}}.json'
                },
                debug: false
            }, function (err, t) {
                let i, v;
                /*
                let elems = document.querySelectorAll('a');
                elems.forEach(function (v) {
                    if (v.dataset.key) {
                        v.text = i18next.t(v.dataset.key)
                    }
                });
                */
                let elems = document.querySelectorAll('li');
                for (i = 0; i < elems.length; ++i) {
                    v = elems[i];
                    if (v.dataset.key) {
                        v.innerText = i18next.t(v.dataset.key)
                        checkExistence(v.dataset.key, v.innerText);
                    }
                }
                elems = document.querySelectorAll('p');
                for (i = 0; i < elems.length; ++i) {
                    v = elems[i];
                    if (v.dataset.key) {
                        v.innerText = i18next.t(v.dataset.key)
                        checkExistence(v.dataset.key, v.innerText);
                    }
                }
                elems = document.querySelectorAll('h3');
                for (i = 0; i < elems.length; ++i) {
                    v = elems[i];
                    if (v.dataset.key) {
                        v.innerText = i18next.t(v.dataset.key)
                        checkExistence(v.dataset.key, v.innerText);
                    }
                }
                elems = document.querySelectorAll('h4');
                for (i = 0; i < elems.length; ++i) {
                    v = elems[i];
                    if (v.dataset.key) {
                        v.innerText = i18next.t(v.dataset.key)
                        checkExistence(v.dataset.key, v.innerText);
                    }
                }
                elems = document.querySelectorAll('span');
                for (i = 0; i < elems.length; ++i) {
                    v = elems[i];
                    if (v.dataset.key) {
                        v.innerText = i18next.t(v.dataset.key)
                        checkExistence(v.dataset.key, v.innerText);
                    }
                }
                elems = document.querySelectorAll('input');
                for (i = 0; i < elems.length; ++i) {
                    v = elems[i];
                    if (v.dataset.key) {
                        v.value = i18next.t(v.dataset.key)
                        checkExistence(v.dataset.key, v.value);
                    }
                }
                if (callback) { callback(); }
            });
    }

    static changeLanguage(lng) {
        language = lng;
    }
}

export default Translation;
