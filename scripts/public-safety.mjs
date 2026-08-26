import { execFileSync } from 'node:child_process';
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { basename, extname, relative, resolve, sep } from 'node:path';
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

function reportedPath(root, path) {
  return normalizedRelativePath(root, path) || basename(root);
}

function throwUnsafeFilesystemEntries(paths) {
  const uniquePaths = [...new Set(paths)].sort();
  throw new Error(`Unsafe public filesystem entries:\n${uniquePaths.join('\n')}`);
}

export function listFilesRecursively(rootPath, operations = {}) {
  const root = resolve(rootPath);
  const inspect = operations.lstatSync ?? lstatSync;
  const list = operations.readdirSync ?? readdirSync;
  const files = [];
  const unsafe = [];

  let rootEntry;
  try {
    rootEntry = inspect(root);
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throwUnsafeFilesystemEntries([basename(root)]);
  }

  function visit(path, knownEntry) {
    let entry = knownEntry;
    if (!entry) {
      try {
        entry = inspect(path);
      } catch {
        unsafe.push(reportedPath(root, path));
        return;
      }
    }
    if (entry.isSymbolicLink()) {
      unsafe.push(reportedPath(root, path));
      return;
    }
    if (entry.isDirectory()) {
      let names;
      try {
        names = list(path);
      } catch {
        unsafe.push(reportedPath(root, path));
        return;
      }
      names.sort().forEach((name) => visit(resolve(path, name)));
      return;
    }
    if (entry.isFile()) {
      files.push(fileRecord(path, root));
      return;
    }
    unsafe.push(reportedPath(root, path));
  }

  visit(root, rootEntry);
  if (unsafe.length > 0) throwUnsafeFilesystemEntries(unsafe);
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

function hasTemplateInterpolation(value) {
  for (let index = value.indexOf('${'); index !== -1; index = value.indexOf('${', index + 2)) {
    let backslashes = 0;
    for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) backslashes += 1;
    if (backslashes % 2 === 0) return true;
  }
  return false;
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
    const decodedSyntax = decodeCssEscapes(text);
    const patterns = [
      /@import\s+(?:url\(\s*)?(?:"((?:\\[\s\S]|[^"])*)"|'((?:\\[\s\S]|[^'])*)'|([^"')\s;]+))/gi,
      /url\(\s*(?:"((?:\\[\s\S]|[^"])*)"|'((?:\\[\s\S]|[^'])*)'|([^"')\s]+))\s*\)/gi,
    ];
    patterns.forEach((pattern) => {
      for (const match of decodedSyntax.matchAll(pattern)) {
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
    const templatePatterns = [
      /\bimport\s*\(\s*`((?:\\.|[^`])*)`\s*\)/g,
      /\bnew\s+URL\s*\(\s*`((?:\\.|[^`])*)`\s*,\s*import\.meta\.url\s*\)/g,
    ];
    templatePatterns.forEach((pattern) => {
      for (const match of text.matchAll(pattern)) {
        if (!hasTemplateInterpolation(match[1])) {
          references.push({ syntax: 'javascript', value: match[1] });
        }
      }
    });
  }

  return references;
}

function normalizedReference(reference) {
  let normalized = String(reference.value);
  if (reference.syntax === 'html') normalized = decodeHtmlCharacterReferences(normalized);
  if (reference.syntax === 'css') normalized = decodeCssEscapes(normalized);
  if (reference.syntax === 'javascript') normalized = decodeJavaScriptEscapes(normalized);
  const rawPath = normalized.split(/[?#]/, 1)[0];
  normalized = decodePercentEscapes(rawPath)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replaceAll('\\', '/');
  return normalized;
}

function isForbiddenReference(reference) {
  const normalized = normalizedReference(reference);
  return /(^|\/)net_practice(\/|$)/.test(normalized)
    || /(^|\/)en\.subject _netpractice\.pdf$/.test(normalized);
}

function readableFileRecords(files, operations = {}) {
  const inspect = operations.lstatSync ?? lstatSync;
  const open = operations.openSync ?? openSync;
  const inspectOpenFile = operations.fstatSync ?? fstatSync;
  const read = operations.readFileSync ?? readFileSync;
  const close = operations.closeSync ?? closeSync;
  const records = [];
  const unsafe = [];

  files.forEach((file) => {
    let entry;
    try {
      entry = inspect(file.absolutePath);
    } catch {
      unsafe.push(file.relativePath);
      return;
    }
    if (!entry.isFile() || entry.isSymbolicLink()) {
      unsafe.push(file.relativePath);
      return;
    }

    let descriptor;
    let text;
    let failed = false;
    try {
      descriptor = open(file.absolutePath, constants.O_RDONLY | constants.O_NOFOLLOW);
      if (!inspectOpenFile(descriptor).isFile()) {
        failed = true;
      } else {
        text = read(descriptor, 'utf8');
      }
    } catch {
      failed = true;
    } finally {
      if (descriptor !== undefined) {
        try {
          close(descriptor);
        } catch {
          failed = true;
        }
      }
    }

    if (failed) {
      unsafe.push(file.relativePath);
      return;
    }
    records.push({ ...file, text });
  });

  if (unsafe.length > 0) throwUnsafeFilesystemEntries(unsafe);
  return records;
}

function rejectedFileNames(files, predicate, operations) {
  return readableFileRecords(files, operations)
    .filter((file) => predicate(file.text, extname(file.relativePath).toLowerCase()))
    .map((file) => file.relativePath);
}

export function assertPublicPathsSafe(paths) {
  const rejected = paths.filter((path) => forbidden.some((rule) => rule.test(path)));
  if (rejected.length > 0) {
    throw new Error(`Forbidden public paths:\n${rejected.join('\n')}`);
  }
}

export function assertExecutableReferencesSafe(files, operations = {}) {
  const rejected = rejectedFileNames(files, (text, extension) =>
    executableReferences(text, extension).some(isForbiddenReference), operations);
  if (rejected.length > 0) {
    throw new Error(`Forbidden executable references in:\n${rejected.join('\n')}`);
  }
}

export function assertEmittedTextSafe(files, operations = {}) {
  const rejected = rejectedFileNames(files, (text, extension) =>
    emittedTextExtensions.has(extension)
      && (text.includes('net_practice') || text.includes('en.subject _netpractice.pdf')), operations);
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
    .map((path) => ({ absolutePath: resolve(root, path), relativePath: path }));
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
