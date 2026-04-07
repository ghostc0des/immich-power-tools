import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import remotion from "@remotion/eslint-plugin";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([{
    extends: [...nextCoreWebVitals],

    plugins: {
        "@remotion": remotion,
    },

    rules: {
        "react-hooks/exhaustive-deps": "off",
        "@next/next/no-img-element": "off",
    },
}, {
    files: ["remotion/*.{ts,tsx}"],
    extends: [...compat.extends("plugin:@remotion/recommended")],
}]);