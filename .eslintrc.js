module.exports = {
    "env": {
        "node": true
    },
    "extends": "eslint:recommended",
    "rules": {
        "no-console": 0,
        "indent": [ "error", "tab" ],
        "linebreak-style": [ "error", "unix" ],
        "quotes": [ "error", "single" ],
        "semi": [ "error", "always" ],
        "no-unused-vars": [ "warn", { "args": "none" } ]
    }
};