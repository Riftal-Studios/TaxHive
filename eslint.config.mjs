import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    "lib/init.js",
  ]),
  // JavaScript files - no TypeScript rules
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Test files - more lenient rules
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "**/tests/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // TypeScript source files - strict rules
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "**/tests/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
]);

export default eslintConfig;
