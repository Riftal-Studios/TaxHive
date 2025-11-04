import nextPlugin from "eslint-config-next";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

const config = [
  {
    ignores: ["lib/init.js", ".next/**", "node_modules/**", "out/**", "build/**"],
  },
  ...nextPlugin,
  // JavaScript files - no TypeScript parser
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off", // Not applicable to JS files
      "@typescript-eslint/no-explicit-any": "off", // Not applicable to JS files
    },
  },
  // Test files - more lenient rules
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "**/tests/**/*.{ts,tsx}"],
    plugins: {
      "@typescript-eslint": typescriptEslint,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off", // Allow unused vars in test files
      "@typescript-eslint/no-explicit-any": "off", // Allow any in test files for mocks
    },
  },
  // TypeScript source files - strict rules
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "**/tests/**/*.{ts,tsx}"],
    plugins: {
      "@typescript-eslint": typescriptEslint,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error", // Strict: no any in source files
    },
  },
];

export default config;
