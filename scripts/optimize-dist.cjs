const fs = require("node:fs");
const path = require("node:path");
const fg = require("fast-glob");
const CleanCSS = require("clean-css");
const JavaScriptObfuscator = require("javascript-obfuscator");
const rcs = require("rename-css-selectors");
const { minify } = require("@minify-html/node");

function envFlag(name, fallback = false) {
  const raw = process.env[name];
  if (raw == null) return fallback;
  return String(raw).toLowerCase() === "true";
}

function shouldSkipMinified(filePath) {
  return filePath.endsWith(".min.css") || filePath.endsWith(".min.js");
}

function runSelectorObfuscation(distDir) {
  const distRel = path.relative(process.cwd(), distDir) || ".";
  const globs = [
    path.join(distRel, "**/*.css").replace(/\\/g, "/"),
    path.join(distRel, "**/*.html").replace(/\\/g, "/"),
    path.join(distRel, "**/*.js").replace(/\\/g, "/"),
  ];

  rcs.process.autoSync(globs);
}

function runHtmlMinification(htmlFiles) {
  for (const filePath of htmlFiles) {
    const input = fs.readFileSync(filePath);
    const output = minify(input, {
      keep_comments: false,
      keep_closing_tags: true,
      minify_css: true,
      minify_js: true,
    });
    fs.writeFileSync(filePath, output);
  }
}

function runCssMinification(cssFiles) {
  const cleaner = new CleanCSS({ level: 2 });
  for (const filePath of cssFiles) {
    const input = fs.readFileSync(filePath, "utf8");
    const result = cleaner.minify(input);
    if (result.errors && result.errors.length > 0) {
      throw new Error(`CSS minify failed for ${filePath}: ${result.errors.join("; ")}`);
    }
    fs.writeFileSync(filePath, result.styles, "utf8");
  }
}

function runJsObfuscation(jsFiles) {
  for (const filePath of jsFiles) {
    const input = fs.readFileSync(filePath, "utf8");
    const obfuscated = JavaScriptObfuscator.obfuscate(input, {
      compact: true,
      simplify: true,
      stringArray: true,
      stringArrayRotate: true,
      stringArrayShuffle: true,
      stringArrayThreshold: 0.75,
      identifierNamesGenerator: "hexadecimal",
      target: "browser",
      transformObjectKeys: true,
      unicodeEscapeSequence: false,
    }).getObfuscatedCode();
    fs.writeFileSync(filePath, obfuscated, "utf8");
  }
}

function main() {
  const distDir = path.resolve(process.argv[2] || "dist");
  if (!fs.existsSync(distDir)) {
    throw new Error(`Dist directory not found: ${distDir}`);
  }

  const htmlFiles = fg.sync([`${distDir.replace(/\\/g, "/")}/**/*.html`], { onlyFiles: true });
  const cssFiles = fg.sync([`${distDir.replace(/\\/g, "/")}/**/*.css`], { onlyFiles: true })
    .filter((filePath) => !shouldSkipMinified(filePath));
  const jsFiles = fg.sync([`${distDir.replace(/\\/g, "/")}/**/*.js`], { onlyFiles: true })
    .filter((filePath) => !shouldSkipMinified(filePath));

  if (envFlag("OBFUSCATE_SELECTORS", false)) {
    runSelectorObfuscation(distDir);
  }

  runHtmlMinification(htmlFiles);
  runCssMinification(cssFiles);

  if (envFlag("OBFUSCATE_JS", true)) {
    runJsObfuscation(jsFiles);
  }

  const summary = [
    `HTML: ${htmlFiles.length}`,
    `CSS: ${cssFiles.length}`,
    `JS: ${jsFiles.length}`,
    `OBFUSCATE_SELECTORS=${envFlag("OBFUSCATE_SELECTORS", false)}`,
    `OBFUSCATE_JS=${envFlag("OBFUSCATE_JS", true)}`,
  ].join(" | ");
  console.log(`[optimize-dist] ${summary}`);
}

main();
