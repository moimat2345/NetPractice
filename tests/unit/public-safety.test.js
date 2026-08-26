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

  it.each([
    [
      'quoted hexadecimal HTML entity',
      'entity.html',
      '<script src="/&#x6e;et_practice/js/level10.js"></script>',
    ],
    [
      'quoted decimal HTML entity',
      'decimal-entity.html',
      '<script src="/&#110;et_practice/js/level10.js"></script>',
    ],
    [
      'unquoted HTML attribute',
      'unquoted.html',
      '<script src=/net_practice/js/level10.js></script>',
    ],
    [
      'percent encoding with query and fragment',
      'percent.html',
      '<script src="/%6eet_practice/js/level10.js?cache=1&amp;mode=test#release"></script>',
    ],
    [
      'double percent encoding',
      'double-percent.html',
      '<script src="/%256eet_practice/js/level10.js"></script>',
    ],
    [
      'encoded separator and path traversal',
      'separator.html',
      '<script src="/assets/..%2fnet_practice%2fjs%2flevel10.js"></script>',
    ],
    [
      'backslash path separators',
      'backslash.html',
      '<script src="\\\\net_practice\\\\js\\\\level10.js"></script>',
    ],
    [
      'encoded official subject link',
      'subject.html',
      '<a href="/en.subject%20_netpractice.pdf?download=1">subject</a>',
    ],
    [
      'CSS escaped import',
      'escaped.css',
      '@import "/\\6e et_practice/theme.css";',
    ],
    [
      'double-encoded CSS URL',
      'encoded.css',
      '.lesson { background: url("/%256eet_practice/art.png#card"); }',
    ],
    [
      'JavaScript hexadecimal escape',
      'static.mjs',
      'im' + 'port "/\\x6eet_practice/js/level10.js";',
    ],
    [
      'JavaScript Unicode escape',
      'dynamic.js',
      'im' + 'port("/\\u006eet_practice/js/level10.js?mode=test");',
    ],
    [
      'double-encoded new URL reference',
      'url.js',
      'new ' + 'URL("/%256eet_practice/js/level10.js", import.meta.url);',
    ],
    [
      'single-encoded question delimiter inside the path',
      'encoded-question.html',
      '<script src="/assets/%3F/net_practice/js/level10.js"></script>',
    ],
    [
      'double-encoded question delimiter inside the path',
      'double-question.html',
      '<script src="/assets/%253F/net_practice/js/level10.js"></script>',
    ],
    [
      'single-encoded fragment delimiter inside the path',
      'encoded-fragment.html',
      '<script src="/assets/%23/net_practice/js/level10.js"></script>',
    ],
    [
      'double-encoded fragment delimiter inside the path',
      'double-fragment.html',
      '<script src="/assets/%2523/net_practice/js/level10.js"></script>',
    ],
    [
      'constant template dynamic import',
      'template-import.js',
      'im' + 'port(`/\\x6eet_practice/js/level10.js`);',
    ],
    [
      'constant template new URL reference',
      'template-url.js',
      'new ' + 'URL(`/%256eet_practice/js/level10.js`, import.meta.url);',
    ],
    [
      'escaped CSS url identifier',
      'escaped-url.css',
      '.lesson { background: u\\72l("/net_practice/art.png"); }',
    ],
    [
      'escaped CSS import identifier with casing and whitespace',
      'escaped-import.css',
      '@\\69mport  U\\000052 L( "/net_practice/theme.css" );',
    ],
  ])('rejects %s and reports only its file name', (_case, fileName, content) => {
    const root = fixtureDirectory();
    writeFileSync(join(root, fileName), content);

    let message = '';
    try {
      assertExecutableReferencesSafe(listFilesRecursively(root));
    } catch (error) {
      message = error.message;
    }

    expect(message).toMatch(new RegExp(fileName.replace('.', '\\.')));
    expect(message).not.toContain('level10.js');
    expect(message).not.toContain('download=1');
  });

  it('tolerates malformed encodings and keeps clean references safe', () => {
    const root = fixtureDirectory();
    writeFileSync(join(root, 'index.html'), [
      '<script src="/assets/app.js?next=%E0%A4%A"></script>',
      '<a href="/guides/networking.html#net_practice-explained">Guide</a>',
    ].join('\n'));
    writeFileSync(join(root, 'theme.css'), '@import url("/assets/theme.css");');
    writeFileSync(join(root, 'app.js'), 'im' + 'port("/assets/module.js");');
    writeFileSync(join(root, 'escaped-clean.css'), [
      '.icon { background: u\\72l("/assets/icon.svg"); }',
      '@\\69mport "/assets/layout.css";',
    ].join('\n'));
    writeFileSync(join(root, 'templates.js'), [
      'im' + 'port(`/assets/module.js`);',
      'new ' + 'URL(`/assets/icon.svg`, import.meta.url);',
      'im' + 'port(`/assets/${theme}.js`);',
      'new ' + 'URL(`/assets/${name}.svg`, import.meta.url);',
    ].join('\n'));

    expect(() => assertExecutableReferencesSafe(listFilesRecursively(root))).not.toThrow();
  });
});
