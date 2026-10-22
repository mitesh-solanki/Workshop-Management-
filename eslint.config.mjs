import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "coverage/**"]),
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    ignores: ["src/**/repo.ts", "src/lib/db.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/db",
              message:
                "Only repo.ts (and src/lib/db.ts) may import the Prisma client. Put database access in modules/*/repo.ts.",
            },
            {
              name: "@prisma/client",
              importNames: ["PrismaClient"],
              message:
                "Only repo.ts (and src/lib/db.ts) may import PrismaClient. Put database access in modules/*/repo.ts.",
            },
          ],
          patterns: [
            {
              group: ["**/lib/db", "**/lib/db/*"],
              message:
                "Only repo.ts (and src/lib/db.ts) may import the Prisma client. Put database access in modules/*/repo.ts.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["prisma/**/*.{js,ts}"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    // Flag hard-coded English in app route JSX; prefer next-intl keys.
    files: ["src/app/**/*.{jsx,tsx}"],
    rules: {
      "react/jsx-no-literals": [
        "warn",
        {
          noStrings: true,
          allowedStrings: ["", " ", ":", "|", "·", "—", "–", "…", "/", "-"],
          ignoreProps: true,
        },
      ],
    },
  },
]);

export default eslintConfig;
