module.exports = {
  "parser": "babel-eslint",
  "extends": [
    "eslint:recommended",
    "plugin:react/recommended",
  ],
  "env": {
    "browser": true,
    "commonjs": true,
    "es6": true,
  },
  "plugins": [
    "react",
  ],
  "rules": {
    "arrow-body-style": "error",
    "arrow-parens": ["error", "as-needed"],
    "brace-style": ["error", "1tbs", { "allowSingleLine": true }],
    "camelcase": "error",
    "comma-dangle": ["error", "only-multiline"],
    "computed-property-spacing": "error",
    "dot-location": ["error", "property"],
    "eqeqeq": "error",
    "indent": ["error", 2],
    "no-var": "error",
    "prefer-const": "error",
    "no-unused-vars": [
      "error", {
        "varsIgnorePattern": "^_",
        "argsIgnorePattern": "^_"
      }
    ],
    "object-curly-spacing": ["error", "always"],
    "react/no-unescaped-entities": "off",
  },
};
