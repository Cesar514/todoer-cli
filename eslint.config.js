const jsFiles = ["src/**/*.js", "test/**/*.js", "eslint.config.js"];

module.exports = [
  {
    files: jsFiles,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
    },
    rules: {
      "no-console": "off",
      "no-unused-vars": ["error", { args: "none" }],
    },
  },
];
