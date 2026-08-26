import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const forbidden = [
  /(^|\/)net_practice(\/|$)/,
  /(^|\/)en\.subject _netpractice\.pdf$/,
  /(^|\/)\.superpowers(\/|$)/,
  /(^|\/)tmp(\/|$)/,
  /(^|\/)\.DS_Store$/,
];

export function assertPublicPathsSafe(paths) {
  const rejected = paths.filter((path) => forbidden.some((rule) => rule.test(path)));
  if (rejected.length > 0) {
    throw new Error(`Forbidden public paths:\n${rejected.join('\n')}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  assertPublicPathsSafe(tracked);
  console.log(`Public tree safe: ${tracked.length} tracked files checked.`);
}
