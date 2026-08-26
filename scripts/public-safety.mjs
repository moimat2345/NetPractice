import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const forbidden = [
  /(^|\/)net_practice(\/|$)/,
  /(^|\/)en\.subject _netpractice\.pdf$/,
  /(^|\/)\.superpowers(\/|$)/,
  /(^|\/)tmp(\/|$)/,
  /(^|\/)\.DS_Store$/,
];

const emittedTextExtensions = new Set([
  '.css', '.html', '.js', '.json', '.map', '.mjs', '.svg', '.txt', '.webmanifest', '.xml',
]);

function normalizedRelativePath(root, path) {
  return relative(root, path).split(sep).join('/');
}

function fileRecord(path, root) {
  return { absolutePath: path, relativePath: normalizedRelativePath(root, path) };
}

export function listFilesRecursively(rootPath) {
  const root = resolve(rootPath);
  if (!existsSync(root)) return [];
  const files = [];

  function visit(path) {
    const entry = lstatSync(path);
    if (entry.isSymbolicLink()) return;
    if (entry.isDirectory()) {
      readdirSync(path).sort().forEach((name) => visit(resolve(path, name)));
      return;
    }
    if (entry.isFile()) files.push(fileRecord(path, root));
  }

  visit(root);
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function decodedCodePoint(raw, fallback) {
  const value = Number.parseInt(raw, fallback);
  if (!Number.isInteger(value) || value < 0 || value > 0x10ffff) return null;
  try {
    return String.fromCodePoint(value);
  } catch {
    return null;
  }
}

function decodeHtmlCharacterReferences(value) {
  return value
    .replace(/&#(?:x([0-9a-f]{1,6})|([0-9]{1,7}));?/gi, (match, hex, decimal) =>
      decodedCodePoint(hex ?? decimal, hex ? 16 : 10) ?? match)
    .replace(/&amp;/gi, '&');
}

function decodeCssEscapes(value) {
  return value
    .replace(/\\([0-9a-f]{1,6})(?:\r\n|[\t\n\f\r ])?/gi, (match, hex) =>
      decodedCodePoint(hex, 16) ?? match)
    .replace(/\\(?:\r\n|[\n\f\r])/g, '')
    .replace(/\\([^\n\f\r])/g, '$1');
}

function decodeJavaScriptEscapes(value) {
  return value
    .replace(/\\x([0-9a-f]{2})/gi, (match, hex) => decodedCodePoint(hex, 16) ?? match)
    .replace(/\\u\{([0-9a-f]{1,6})\}/gi, (match, hex) => decodedCodePoint(hex, 16) ?? match)
    .replace(/\\u([0-9a-f]{4})/gi, (match, hex) => decodedCodePoint(hex, 16) ?? match)
    .replace(/\\(?:\r\n|[\n\r])/g, '')
    .replace(/\\(["'`\\/])/g, '$1');
}

function decodePercentEscapes(value) {
  let decoded = value;
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const next = decoded.replace(/%([0-9a-f]{2})/gi, (_match, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16)));
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

function firstDefined(values) {
  return values.find((value) => value !== undefined) ?? '';
}

function executableReferences(text, extension) {
  const references = [];
  if (['.html', '.svg', '.xml'].includes(extension)) {
    const attributes = /\b(src|href|srcset|action|formaction|poster|data)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+))/gi;
    for (const match of text.matchAll(attributes)) {
      const values = match[1].toLowerCase() === 'srcset'
        ? firstDefined(match.slice(2)).split(',').map((candidate) => candidate.trim().split(/\s+/, 1)[0])
        : [firstDefined(match.slice(2))];
      values.filter(Boolean).forEach((value) => references.push({ syntax: 'html', value }));
    }
  }
  if (extension === '.css') {
    const patterns = [
      /@import\s+(?:url\(\s*)?(?:"((?:\\[\s\S]|[^"])*)"|'((?:\\[\s\S]|[^'])*)'|([^"')\s;]+))/gi,
      /url\(\s*(?:"((?:\\[\s\S]|[^"])*)"|'((?:\\[\s\S]|[^'])*)'|([^"')\s]+))\s*\)/gi,
    ];
    patterns.forEach((pattern) => {
      for (const match of text.matchAll(pattern)) {
        references.push({ syntax: 'css', value: firstDefined(match.slice(1)) });
      }
    });
  }
  if (['.js', '.mjs'].includes(extension)) {
    const patterns = [
      /\b(?:import|export)\s+(?:[\s\S]*?\sfrom\s*)?["']((?:\\.|[^"'])+)["']/g,
      /\bimport\s*\(\s*["']((?:\\.|[^"'])+)["']\s*\)/g,
      /\bnew\s+URL\s*\(\s*["']((?:\\.|[^"'])+)["']/g,
    ];
    patterns.forEach((pattern) => {
      for (const match of text.matchAll(pattern)) references.push({ syntax: 'javascript', value: match[1] });
    });
  }

  return references;
}

function normalizedReference(reference) {
  let normalized = String(reference.value);
  if (reference.syntax === 'html') normalized = decodeHtmlCharacterReferences(normalized);
  if (reference.syntax === 'css') normalized = decodeCssEscapes(normalized);
  if (reference.syntax === 'javascript') normalized = decodeJavaScriptEscapes(normalized);
  normalized = decodePercentEscapes(normalized)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replaceAll('\\', '/');
  return normalized.split(/[?#]/, 1)[0];
}

function isForbiddenReference(reference) {
  const normalized = normalizedReference(reference);
  return /(^|\/)net_practice(\/|$)/.test(normalized)
    || /(^|\/)en\.subject _netpractice\.pdf$/.test(normalized);
}

function rejectedFileNames(files, predicate) {
  return files.filter((file) => {
    try {
      return predicate(readFileSync(file.absolutePath, 'utf8'), extname(file.relativePath).toLowerCase());
    } catch {
      return false;
    }
  }).map((file) => file.relativePath);
}

export function assertPublicPathsSafe(paths) {
  const rejected = paths.filter((path) => forbidden.some((rule) => rule.test(path)));
  if (rejected.length > 0) {
    throw new Error(`Forbidden public paths:\n${rejected.join('\n')}`);
  }
}

export function assertExecutableReferencesSafe(files) {
  const rejected = rejectedFileNames(files, (text, extension) =>
    executableReferences(text, extension).some(isForbiddenReference));
  if (rejected.length > 0) {
    throw new Error(`Forbidden executable references in:\n${rejected.join('\n')}`);
  }
}

export function assertEmittedTextSafe(files) {
  const rejected = rejectedFileNames(files, (text, extension) =>
    emittedTextExtensions.has(extension)
      && (text.includes('net_practice') || text.includes('en.subject _netpractice.pdf')));
  if (rejected.length > 0) {
    throw new Error(`Forbidden official names in emitted files:\n${rejected.join('\n')}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  assertPublicPathsSafe(tracked);
  const trackedFiles = tracked
    .map((path) => ({ absolutePath: resolve(root, path), relativePath: path }))
    .filter((file) => existsSync(file.absolutePath));
  assertExecutableReferencesSafe(trackedFiles);

  const emittedFiles = listFilesRecursively(resolve(root, 'dist'));
  assertPublicPathsSafe(emittedFiles.map((file) => `dist/${file.relativePath}`));
  assertExecutableReferencesSafe(emittedFiles);
  assertEmittedTextSafe(emittedFiles);

  const emittedSummary = emittedFiles.length > 0
    ? ` ${emittedFiles.length} emitted files checked.`
    : ' No dist directory present; emitted-file checks will run after build.';
  console.log(`Public tree safe: ${tracked.length} tracked files checked.${emittedSummary}`);
}
