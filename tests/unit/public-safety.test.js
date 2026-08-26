import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertEmittedTextSafe,
  assertExecutableReferencesSafe,
  assertPublicPathsSafe,
  listFilesRecursively,
} from '../../scripts/public-safety.mjs';

const temporaryDirectories = [];

function fixtureDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'subnet-notes-public-safety-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
  }
});

describe('assertPublicPathsSafe', () => {
  it('rejects official and temporary material', () => {
    expect(() => assertPublicPathsSafe([
      'index.html',
      'net_practice/js/level10.js',
      'en.subject _netpractice.pdf',
      '.superpowers/brainstorm/mockup.html',
      'tmp/pdfs/page-01.png',
    ])).toThrow(/forbidden public paths/i);
  });

  it('accepts original site files', () => {
    expect(() => assertPublicPathsSafe([
      'index.html',
      'src/core/ipv4.js',
      'README.md',
    ])).not.toThrow();
  });

  it('checks emitted files recursively and reports only the unsafe file name', () => {
    const root = fixtureDirectory();
    mkdirSync(join(root, 'assets'));
    writeFileSync(join(root, 'index.html'), '<main>Original practice</main>');
    writeFileSync(
      join(root, 'assets', 'unsafe.js'),
      'const copied = "net_practice/js/level10.js"; const secret = "must-not-leak";',
    );

    const emitted = listFilesRecursively(root);
    expect(emitted.map((file) => file.relativePath)).toEqual([
      'assets/unsafe.js',
      'index.html',
    ]);
    expect(() => assertEmittedTextSafe(emitted)).toThrowError(/assets\/unsafe\.js/);
    try {
      assertEmittedTextSafe(emitted);
    } catch (error) {
      expect(error.message).not.toContain('must-not-leak');
      expect(error.message).not.toContain('level10.js');
    }

    writeFileSync(join(root, 'assets', 'unsafe.js'), 'const lesson = "original";');
    expect(() => assertEmittedTextSafe(listFilesRecursively(root))).not.toThrow();
  });

  it('checks executable references without rejecting explanatory markdown', () => {
    const root = fixtureDirectory();
    writeFileSync(
      join(root, 'README.md'),
      'The official net_practice directory and en.subject _netpractice.pdf are excluded.',
    );
    writeFileSync(join(root, 'index.html'), '<script src="/assets/app.js"></script>');

    const safeFiles = listFilesRecursively(root);
    expect(() => assertExecutableReferencesSafe(safeFiles)).not.toThrow();

    writeFileSync(join(root, 'index.html'), '<script src="/net_practice/js/level10.js"></script>');
    expect(() => assertExecutableReferencesSafe(listFilesRecursively(root)))
      .toThrowError(/index\.html/);
  });
});
