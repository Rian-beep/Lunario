import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".next-*/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Pinned upstream Google Draco decoder; preserve the distributed source and license.
      "public/data/equipment/draco/draco_decoder.js",
      // Original, hash-pinned Lunario loader; retain upstream source bytes.
      "public/branding/lunario/loader/loader.js",
    ],
  },
];

export default eslintConfig;
