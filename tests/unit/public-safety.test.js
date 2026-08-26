import {
  closeSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
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

function errorMessage(action) {
  try {
    action();
    return '';
  } catch (error) {
    return error.message;
  }
}

function raceFixture() {
  const fixture = fixtureDirectory();
  const allowedRoot = join(fixture, 'public');
  const parent = join(allowedRoot, 'assets');
  const outside = join(fixture, 'outside');
  mkdirSync(parent, { recursive: true });
  mkdirSync(outside);
  writeFileSync(join(parent, 'app.js'), 'export const source = "inside";');
  writeFileSync(join(outside, 'app.js'), 'export const source = "outside";');
  return {
    allowedRoot,
    file: {
      absolutePath: join(parent, 'app.js'),
      relativePath: 'assets/app.js',
      rootPath: allowedRoot,
    },
    fixture,
    outside,
    parent,
  };
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

  it('rejects emitted symlinks without following or naming their target', () => {
    const root = fixtureDirectory();
    writeFileSync(join(root, 'clean-target.js'), 'export const lesson = "original";');
    symlinkSync('clean-target.js', join(root, 'linked-asset.js'));

    const message = errorMessage(() => listFilesRecursively(root));

    expect(message).toMatch(/linked-asset\.js/);
    expect(message).not.toContain('clean-target.js');
    expect(message).not.toContain('original');
  });

  it('rejects a directory where a regular file record is expected', () => {
    const root = fixtureDirectory();
    mkdirSync(join(root, 'unexpected-entry'));

    const message = errorMessage(() => assertExecutableReferencesSafe([{
      absolutePath: join(root, 'unexpected-entry'),
      relativePath: 'assets/app.js',
      rootPath: root,
    }]));

    expect(message).toMatch(/assets\/app\.js/);
    expect(message).not.toContain(root);
  });

  it('fails closed on an injected recursive stat error and reports only the path', () => {
    const root = fixtureDirectory();
    writeFileSync(join(root, 'app.js'), 'export const safe = true;');

    const message = errorMessage(() => listFilesRecursively(root, {
      lstatSync(path) {
        if (path.endsWith('app.js')) throw new Error('must-not-leak-stat-details');
        return lstatSync(path);
      },
    }));

    expect(message).toMatch(/app\.js/);
    expect(message).not.toContain('must-not-leak-stat-details');
    expect(message).not.toContain(root);
  });

  it('fails closed on an injected read error and reports only the file name', () => {
    const root = fixtureDirectory();
    writeFileSync(join(root, 'app.js'), 'export const safe = true;');
    const files = listFilesRecursively(root);

    const message = errorMessage(() => assertExecutableReferencesSafe(files, {
      readFileSync() {
        throw new Error('must-not-leak-read-details');
      },
    }));

    expect(message).toMatch(/app\.js/);
    expect(message).not.toContain('must-not-leak-read-details');
    expect(message).not.toContain(root);
  });

  it('allows an absent build directory and ordinary regular files', () => {
    const root = fixtureDirectory();
    const absent = join(root, 'dist');
    expect(listFilesRecursively(absent)).toEqual([]);

    writeFileSync(join(root, 'index.html'), '<script src="/assets/app.js"></script>');
    const files = listFilesRecursively(root);
    expect(() => assertExecutableReferencesSafe(files)).not.toThrow();
  });

  it('rejects a parent directory replaced by a symlink before open', () => {
    const { file, fixture, outside, parent } = raceFixture();
    const savedParent = join(fixture, 'saved-assets');

    const message = errorMessage(() => assertExecutableReferencesSafe([file], {
      beforeOpen() {
        renameSync(parent, savedParent);
        symlinkSync(outside, parent);
      },
    }));

    expect(message).toMatch(/assets\/app\.js/);
    expect(message).not.toContain('outside');
    expect(message).not.toContain(fixture);
  });

  it('rejects a parent symlink race restored after open', () => {
    const { file, fixture, outside, parent } = raceFixture();
    const savedParent = join(fixture, 'saved-assets');

    const message = errorMessage(() => assertExecutableReferencesSafe([file], {
      beforeOpen() {
        renameSync(parent, savedParent);
        symlinkSync(outside, parent);
      },
      afterOpen() {
        unlinkSync(parent);
        renameSync(savedParent, parent);
      },
    }));

    expect(message).toMatch(/assets\/app\.js/);
    expect(message).not.toContain('outside');
    expect(message).not.toContain(fixture);
  });

  it('rejects an allowed-root symlink race restored after open', () => {
    const { allowedRoot, file, fixture, outside } = raceFixture();
    const savedRoot = join(fixture, 'saved-public');
    mkdirSync(join(outside, 'assets'));
    writeFileSync(join(outside, 'assets', 'app.js'), 'export const source = "outside-root";');

    const message = errorMessage(() => assertExecutableReferencesSafe([file], {
      beforeOpen() {
        renameSync(allowedRoot, savedRoot);
        symlinkSync(outside, allowedRoot);
      },
      afterOpen() {
        unlinkSync(allowedRoot);
        renameSync(savedRoot, allowedRoot);
      },
    }));

    expect(message).toMatch(/assets\/app\.js/);
    expect(message).not.toContain('outside-root');
    expect(message).not.toContain(fixture);
  });

  it('rejects a final file replaced by a symlink without O_NOFOLLOW support', () => {
    const { file, fixture, outside, parent } = raceFixture();
    const savedFile = join(fixture, 'saved-app.js');

    const message = errorMessage(() => assertExecutableReferencesSafe([file], {
      noFollowFlag: 0,
      beforeOpen() {
        renameSync(file.absolutePath, savedFile);
        symlinkSync(join(outside, 'app.js'), join(parent, 'app.js'));
      },
    }));

    expect(message).toMatch(/assets\/app\.js/);
    expect(message).not.toContain('outside');
    expect(message).not.toContain(fixture);
  });

  it('rejects a final regular file swapped between preflight and open', () => {
    const { file, fixture } = raceFixture();
    const savedFile = join(fixture, 'saved-app.js');

    const message = errorMessage(() => assertExecutableReferencesSafe([file], {
      noFollowFlag: 0,
      beforeOpen() {
        renameSync(file.absolutePath, savedFile);
        writeFileSync(file.absolutePath, 'export const source = "replacement";');
      },
    }));

    expect(message).toMatch(/assets\/app\.js/);
    expect(message).not.toContain('replacement');
    expect(message).not.toContain(fixture);
  });

  it('keeps a stable regular file safe without O_NOFOLLOW support', () => {
    const { file } = raceFixture();
    expect(() => assertExecutableReferencesSafe([file], { noFollowFlag: 0 })).not.toThrow();
  });

  it('rejects lexical escapes and a symlink used as the allowed root', () => {
    const fixture = fixtureDirectory();
    const allowedRoot = join(fixture, 'public');
    const outside = join(fixture, 'outside');
    mkdirSync(allowedRoot);
    mkdirSync(outside);
    writeFileSync(join(outside, 'app.js'), 'export const safe = true;');

    const escapedMessage = errorMessage(() => assertExecutableReferencesSafe([{
      absolutePath: join(outside, 'app.js'),
      relativePath: '../outside/app.js',
      rootPath: allowedRoot,
    }]));
    expect(escapedMessage).toMatch(/outside\/app\.js/);
    expect(escapedMessage).not.toContain(fixture);

    const linkedRoot = join(fixture, 'linked-public');
    symlinkSync(outside, linkedRoot);
    const linkedMessage = errorMessage(() => assertExecutableReferencesSafe([{
      absolutePath: join(linkedRoot, 'app.js'),
      relativePath: 'app.js',
      rootPath: linkedRoot,
    }]));
    expect(linkedMessage).toMatch(/app\.js/);
    expect(linkedMessage).not.toContain('outside');
    expect(linkedMessage).not.toContain(fixture);
  });

  it('fails closed on injected readdir, open, fstat, and close errors', () => {
    const fixture = fixtureDirectory();
    const root = join(fixture, 'public');
    mkdirSync(root);
    writeFileSync(join(root, 'app.js'), 'export const safe = true;');

    const readdirMessage = errorMessage(() => listFilesRecursively(root, {
      readdirSync() {
        throw new Error('must-not-leak-readdir-details');
      },
    }));
    expect(readdirMessage).toMatch(/public/);
    expect(readdirMessage).not.toContain('must-not-leak-readdir-details');
    expect(readdirMessage).not.toContain(fixture);

    const files = listFilesRecursively(root);
    for (const [operation, implementation] of [
      ['openSync', () => { throw new Error('must-not-leak-open-details'); }],
      ['fstatSync', () => { throw new Error('must-not-leak-fstat-details'); }],
      ['closeSync', (descriptor) => {
        closeSync(descriptor);
        throw new Error('must-not-leak-close-details');
      }],
    ]) {
      const message = errorMessage(() => assertExecutableReferencesSafe(files, {
        [operation]: implementation,
      }));
      expect(message).toMatch(/app\.js/);
      expect(message).not.toContain('must-not-leak');
      expect(message).not.toContain(fixture);
    }
  });
});
