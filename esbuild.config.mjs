// esbuild.config.mjs  — ESM 版
import { build } from "esbuild";
import sveltePlugin from "esbuild-svelte";
import sveltePreprocess from "svelte-preprocess";

const isProd = process.env.BUILD === "production";

build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  outfile: "main.js",               // Obsidian はプラグイン直下の main.js を参照
  format: "cjs",                    // 出力は CJS（Obsidian 要件）
  platform: "node",
  target: ["es2020"],
  sourcemap: !isProd,
  minify: isProd,
  logLevel: "info",
  external: ["obsidian", "electron", "@codemirror/*", "fs", "path", "os"],
  plugins: [
    sveltePlugin({
      emitCss: false,
      compilerOptions: {
        dev: !isProd,
        css: true,          // 明示（デフォルトtrueだが念のため）
      },
      preprocess: sveltePreprocess({ typescript: true }),
    }),
  ],
  loader: { ".svg": "dataurl", ".png": "dataurl" },
}).catch(() => process.exit(1));
