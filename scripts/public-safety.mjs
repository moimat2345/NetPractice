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

function executableReferences(text, extension) {
  const patterns = [];
  if (['.html', '.svg', '.xml'].includes(extension)) {
    patterns.push(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi);
  }
  if (extension === '.css') {
    patterns.push(/@import\s+(?:url\()?\s*["']?([^"')\s;]+)["']?/gi);
    patterns.push(/url\(\s*["']?([^"')]+)["']?\s*\)/gi);
  }
  if (['.js', '.mjs'].includes(extension)) {
    patterns.push(/\b(?:import|export)\s+(?:[\s\S]*?\sfrom\s*)?["']([^"']+)["']/g);
    patterns.push(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g);
    patterns.push(/\bnew\s+URL\s*\(\s*["']([^"']+)["']/g);
  }

  return patterns.flatMap((pattern) => [...text.matchAll(pattern)].map((match) => match[1]));
}

function isForbiddenReference(reference) {
  const normalized = String(reference).split(/[?#]/, 1)[0].replaceAll('\\', '/');
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
