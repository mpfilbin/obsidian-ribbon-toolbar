import esbuild from "esbuild";
import esbuildSvelte from "esbuild-svelte";
import process from "process";

const production = process.argv[2] === "production";

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/*"],
  format: "cjs",
  target: "es2020",
  logLevel: "info",
  sourcemap: production ? false : "inline",
  treeShaking: false,
  outfile: "main.js",
  plugins: [
    esbuildSvelte({
      compilerOptions: { css: "injected" },
    }),
  ],
});

if (production) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
