const fs = require("fs");
const path = require("path");

const root = process.argv[2] || "dist";

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

function isMinifiedFile(filePath) {
  return filePath.endsWith(".min.css") || filePath.endsWith(".min.js");
}

function uniqueSorted(set) {
  return Array.from(set).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function createMap(items, prefix) {
  const map = new Map();
  items.forEach((item, index) => {
    map.set(item, `${prefix}${index.toString(36)}`);
  });
  return map;
}

const classAttrRe = /\bclass\s*=\s*(['"])(.*?)\1/gi;
const idAttrRe = /\bid\s*=\s*(['"])(.*?)\1/gi;
const cssClassRe = /\.([A-Za-z_][\w-]*)/g;
const cssIdRe = /#([A-Za-z_][\w-]*)/g;
const getElementByIdRe = /getElementById\(\s*(['"])([^'"]+)\1\s*\)/g;
const selectorCallRe =
  /(querySelector(?:All)?|matches|closest)\(\s*(['"])([^'"]+)\2\s*\)/g;
const getElementsByClassNameRe =
  /getElementsByClassName\(\s*(['"])([^'"]+)\1\s*\)/g;
const classNameAssignRe = /\.className\s*=\s*(['"])([^'"]+)\1/g;
const setAttributeClassRe =
  /setAttribute\(\s*(['"])class\1\s*,\s*(['"])([^'"]*)\2\s*\)/g;
const setAttributeIdRe =
  /setAttribute\(\s*(['"])id\1\s*,\s*(['"])([^'"]*)\2\s*\)/g;
const classListCallRe = /classList\.(add|remove|toggle|contains)\(([^)]*)\)/g;
const idRefAttrRe =
  /\b(for|aria-controls|aria-labelledby|aria-describedby)\s*=\s*(['"])(.*?)\2/gi;
const hrefHashRe = /\b(href|xlink:href)\s*=\s*(['"])#([^'"]+)\2/gi;

const allFiles = walk(root);
const htmlFiles = allFiles.filter((f) => f.endsWith(".html"));
const cssFiles = allFiles.filter((f) => f.endsWith(".css") && !isMinifiedFile(f));
const jsFiles = allFiles.filter((f) => f.endsWith(".js") && !isMinifiedFile(f));

const classes = new Set();
const ids = new Set();

for (const file of htmlFiles) {
  const content = fs.readFileSync(file, "utf8");
  let match;
  while ((match = classAttrRe.exec(content))) {
    const raw = match[2].trim();
    if (!raw) continue;
    raw.split(/\s+/).forEach((name) => classes.add(name));
  }
  while ((match = idAttrRe.exec(content))) {
    const name = match[2].trim();
    if (name) ids.add(name);
  }
}

const classList = uniqueSorted(classes);
const idList = uniqueSorted(ids);
const classMap = createMap(classList, "c");
const idMap = createMap(idList, "i");

function mapClassNames(value) {
  return value
    .trim()
    .split(/\s+/)
    .map((name) => classMap.get(name) || name)
    .join(" ");
}

function mapSelectorString(selector) {
  let out = selector.replace(cssClassRe, (m, name) =>
    classMap.has(name) ? `.${classMap.get(name)}` : m
  );
  out = out.replace(cssIdRe, (m, name) =>
    idMap.has(name) ? `#${idMap.get(name)}` : m
  );
  return out;
}

for (const file of htmlFiles) {
  let content = fs.readFileSync(file, "utf8");
  content = content.replace(classAttrRe, (m, quote, value) => {
    const mapped = mapClassNames(value);
    return `class=${quote}${mapped}${quote}`;
  });
  content = content.replace(idAttrRe, (m, quote, value) => {
    const mapped = idMap.get(value) || value;
    return `id=${quote}${mapped}${quote}`;
  });
  content = content.replace(idRefAttrRe, (m, attr, quote, value) => {
    const mapped = value
      .trim()
      .split(/\s+/)
      .map((name) => idMap.get(name) || name)
      .join(" ");
    return `${attr}=${quote}${mapped}${quote}`;
  });
  content = content.replace(hrefHashRe, (m, attr, quote, value) => {
    const mapped = idMap.get(value);
    return mapped ? `${attr}=${quote}#${mapped}${quote}` : m;
  });
  fs.writeFileSync(file, content);
}

for (const file of cssFiles) {
  let content = fs.readFileSync(file, "utf8");
  content = content.replace(cssClassRe, (m, name) =>
    classMap.has(name) ? `.${classMap.get(name)}` : m
  );
  content = content.replace(cssIdRe, (m, name) => {
    if (/^[0-9a-fA-F]{3,8}$/.test(name)) return m;
    return idMap.has(name) ? `#${idMap.get(name)}` : m;
  });
  fs.writeFileSync(file, content);
}

for (const file of jsFiles) {
  let content = fs.readFileSync(file, "utf8");
  content = content.replace(getElementByIdRe, (m, quote, value) => {
    const mapped = idMap.get(value);
    return mapped ? `getElementById(${quote}${mapped}${quote})` : m;
  });
  content = content.replace(getElementsByClassNameRe, (m, quote, value) => {
    const mapped = mapClassNames(value);
    return `getElementsByClassName(${quote}${mapped}${quote})`;
  });
  content = content.replace(selectorCallRe, (m, fn, quote, value) => {
    const mapped = mapSelectorString(value);
    return `${fn}(${quote}${mapped}${quote})`;
  });
  content = content.replace(classNameAssignRe, (m, quote, value) => {
    const mapped = mapClassNames(value);
    return `.className = ${quote}${mapped}${quote}`;
  });
  content = content.replace(setAttributeClassRe, (m, q1, q2, value) => {
    const mapped = mapClassNames(value);
    return `setAttribute(${q1}class${q1}, ${q2}${mapped}${q2})`;
  });
  content = content.replace(setAttributeIdRe, (m, q1, q2, value) => {
    const mapped = idMap.get(value) || value;
    return `setAttribute(${q1}id${q1}, ${q2}${mapped}${q2})`;
  });
  content = content.replace(classListCallRe, (m, fn, args) => {
    const updated = args.replace(/(['"])([^'"]+)\1/g, (ms, q, val) => {
      const mapped = mapClassNames(val);
      return `${q}${mapped}${q}`;
    });
    return `classList.${fn}(${updated})`;
  });
  fs.writeFileSync(file, content);
}
