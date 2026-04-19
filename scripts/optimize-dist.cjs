const fs = require("node:fs");
const path = require("node:path");
const fg = require("fast-glob");
const CleanCSS = require("clean-css");
const JavaScriptObfuscator = require("javascript-obfuscator");
const { minify } = require("@minify-html/node");

function envFlag(name, fallback = false) {
  const raw = process.env[name];
  if (raw == null) return fallback;
  return String(raw).toLowerCase() === "true";
}

function shouldSkipMinified(filePath) {
  return filePath.endsWith(".min.css") || filePath.endsWith(".min.js");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shortName(index) {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let n = index;
  let out = "";
  do {
    out = alphabet[n % alphabet.length] + out;
    n = Math.floor(n / alphabet.length) - 1;
  } while (n >= 0);
  return `c${out}`;
}

function buildClassMap(cssFiles, htmlFiles) {
  const classNames = new Set();
  const cssClassRegex = /(^|[^a-zA-Z0-9_-])\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g;
  const htmlClassRegex = /class\s*=\s*["']([^"']+)["']/g;

  for (const filePath of cssFiles) {
    const text = fs.readFileSync(filePath, "utf8");
    let match;
    while ((match = cssClassRegex.exec(text)) !== null) {
      classNames.add(match[2]);
    }
  }

  for (const filePath of htmlFiles) {
    const text = fs.readFileSync(filePath, "utf8");
    let match;
    while ((match = htmlClassRegex.exec(text)) !== null) {
      for (const token of match[1].split(/\s+/).filter(Boolean)) {
        classNames.add(token);
      }
    }
  }

  const filtered = [...classNames].filter((name) => !name.startsWith("js-")).sort();
  const mapping = new Map();
  filtered.forEach((name, i) => mapping.set(name, shortName(i)));
  return mapping;
}

function applyClassMapToCss(text, classMap) {
  let out = text;
  for (const [from, to] of classMap) {
    const rx = new RegExp(`\\.${escapeRegExp(from)}(?![a-zA-Z0-9_-])`, "g");
    out = out.replace(rx, `.${to}`);
  }
  return out;
}

function applyClassMapToHtml(text, classMap) {
  return text.replace(/class\s*=\s*(["'])([^"']*)\1/g, (whole, quote, classes) => {
    const mapped = classes
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => classMap.get(token) || token)
      .join(" ");
    return `class=${quote}${mapped}${quote}`;
  });
}

function replaceSelectorClasses(selectorText, classMap) {
  let out = selectorText;
  for (const [from, to] of classMap) {
    const rx = new RegExp(`\\.${escapeRegExp(from)}(?![a-zA-Z0-9_-])`, "g");
    out = out.replace(rx, `.${to}`);
  }
  return out;
}

function applyClassMapToJs(text, classMap) {
  let out = text;

  out = out.replace(
    /(querySelector(?:All)?\s*\(\s*(['"`]))([\s\S]*?)(\2\s*\))/g,
    (whole, prefix, quote, selector, suffix) => `${prefix}${replaceSelectorClasses(selector, classMap)}${suffix}`
  );

  out = out.replace(
    /(className\s*=\s*(['"`]))([\s\S]*?)(\2)/g,
    (whole, prefix, quote, value, suffix) => {
      const mapped = value
        .split(/\s+/)
        .filter(Boolean)
        .map((token) => classMap.get(token) || token)
        .join(" ");
      return `${prefix}${mapped}${suffix}`;
    }
  );

  out = out.replace(
    /(classList\.(?:add|remove|toggle|contains|replace)\s*\()([\s\S]*?)(\))/g,
    (whole, prefix, argsText, suffix) => {
      const replacedArgs = argsText.replace(/(['"`])([^'"`]+)\1/g, (m, q, token) => {
        return `${q}${classMap.get(token) || token}${q}`;
      });
      return `${prefix}${replacedArgs}${suffix}`;
    }
  );

  return out;
}

function runSelectorObfuscation(htmlFiles, cssFiles, jsFiles) {
  const classMap = buildClassMap(cssFiles, htmlFiles);
  if (classMap.size === 0) return;

  for (const filePath of cssFiles) {
    const input = fs.readFileSync(filePath, "utf8");
    fs.writeFileSync(filePath, applyClassMapToCss(input, classMap), "utf8");
  }

  for (const filePath of htmlFiles) {
    const input = fs.readFileSync(filePath, "utf8");
    fs.writeFileSync(filePath, applyClassMapToHtml(input, classMap), "utf8");
  }

  for (const filePath of jsFiles) {
    const input = fs.readFileSync(filePath, "utf8");
    fs.writeFileSync(filePath, applyClassMapToJs(input, classMap), "utf8");
  }
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
      stringArrayEncoding: ['base64'],
      identifierNamesGenerator: "hexadecimal",
      target: "browser",
      transformObjectKeys: true,
      unicodeEscapeSequence: false,
      renameGlobals: true,
      numbersToExpressions: true,
      deadCodeInjection: true,
      deadCodeInjectionThreshold: 50,
      splitStrings: true, 
      selfDefending: true,
      stringArrayIndexShift: true,
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
    runSelectorObfuscation(htmlFiles, cssFiles, jsFiles);
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
