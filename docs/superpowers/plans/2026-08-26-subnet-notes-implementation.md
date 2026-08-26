# Subnet Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a bilingual, practice-first static learning site that teaches the IPv4, subnetting, gateway, and routing skills needed for NetPractice-style evaluations without redistributing official material.

**Architecture:** A framework-free browser application is bundled by Vite and split into pure networking modules, deterministic exercise generators, language-neutral diagnostics, bilingual content, local persistence, and DOM-based views. Vitest exercises pure modules and Playwright verifies the complete learning loop, accessibility, timer behavior, and responsive topology geometry.

**Tech Stack:** Semantic HTML5, modern CSS, JavaScript ES modules with JSDoc types, Vite, Vitest, Playwright, browser `localStorage`, static Vercel hosting.

**Spec:** `docs/superpowers/specs/2026-08-26-subnet-notes-design.md`

## Global Constraints

- Do not copy, publish, import, or derive fixtures from `net_practice/`, `en.subject _netpractice.pdf`, or any official NetPractice source or asset.
- Keep all shipped lessons, diagrams, names, configurations, address patterns, and artwork original.
- Ship complete French and English UI, lessons, diagnostics, hints, objectives, and accessibility labels in the first release.
- Use no frontend framework, backend, account system, analytics, advertising, remote database, or learner-answer transmission.
- Persist only language, progress, hint usage, scores, best mock-evaluation time, and resumable exercise seed in `localStorage`.
- Generate exercises deterministically from a seed and keep networking calculations language-neutral.
- Keep the advanced topology at a maximum working width of 900 px; hide the curriculum sidebar before it compresses the topology; use a stacked device representation at phone widths.
- Support 2560x1000, 1440x1000, 1024x1366, and 360 px-wide viewports without detached links or horizontal page overflow.
- Follow test-driven development: observe each focused test fail for the intended reason before adding the corresponding implementation.
- End every task with its focused tests, the relevant broader suite, `npm run build`, and a small commit.

---

## Planned File Map

```text
.gitignore                         Excludes official, temporary, build, and local files
package.json                       Development, test, and build scripts
package-lock.json                  Reproducible dependency versions
vite.config.js                     Static Vite build configuration
playwright.config.js               Responsive browser-test projects
vercel.json                        Static deployment and security headers
index.html                         Accessible application mount document
scripts/public-safety.mjs          Rejects forbidden paths in the public tree
src/main.js                        Application bootstrap
src/app.js                         Route-to-view orchestration
src/styles/base.css                Design tokens, typography, reset, focus states
src/styles/layout.css              Header, sidebar, course, and responsive layout
src/styles/components.css          Exercises, feedback, topology, and controls
src/core/ipv4.js                   IPv4 parsing and formatting primitives
src/core/subnet.js                 Masks, ranges, host validity, and membership
src/core/routing.js                Route matching and forward/return packet traces
src/exercises/random.js            Seed hashing and deterministic random generator
src/exercises/schema.js            Runtime exercise-shape assertions and JSDoc types
src/exercises/generators.js        Focused drills and advanced original missions
src/exercises/validators.js        Submission diagnostics and goal validation
src/exercises/hints.js             Three-level language-neutral hint selection
src/i18n/index.js                  Locale selection, lookup, and interpolation
src/i18n/fr.js                     Complete French message bundle
src/i18n/en.js                     Complete English message bundle
src/storage/progress.js            Versioned local progress and recovery
src/content/curriculum.js          Six-stage language-neutral curriculum manifest
src/content/lessons.fr.js          French micro-lessons and workshop objectives
src/content/lessons.en.js          English micro-lessons and workshop objectives
src/ui/shell.js                    Header, language toggle, sidebar, route outlet
src/ui/home.js                     Progress overview and resume action
src/ui/workshop.js                 Micro-lesson, attempt, hints, and correction loop
src/ui/topology.js                 Responsive selectable topology and live connectors
src/ui/device-config.js            Selected-device interfaces and routing controls
src/ui/feedback.js                 Accessible diagnostics, success, and hints
src/ui/exam.js                     Three-mission timer and result summary
src/ui/dom.js                      Small safe DOM construction helpers
tests/unit/*.test.js               Pure module and content contract tests
tests/e2e/*.spec.js                Browser learning-loop and responsive tests
README.md                          Public English project documentation
```

## Task 1: Public-Safe Project Foundation

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `vite.config.js`
- Create: `playwright.config.js`
- Create: `index.html`
- Create: `src/main.js`
- Create: `scripts/public-safety.mjs`
- Create: `tests/unit/public-safety.test.js`

**Interfaces:**
- Consumes: Only repository paths; no application modules.
- Produces: `assertPublicPathsSafe(paths: string[]): void`, Vite entry point `src/main.js`, and npm scripts used by every later task.

- [ ] **Step 1: Write the failing public-safety test**

```js
// tests/unit/public-safety.test.js
import { describe, expect, it } from 'vitest';
import { assertPublicPathsSafe } from '../../scripts/public-safety.mjs';

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
});
```

- [ ] **Step 2: Create the package scripts, install the test tool, and verify RED**

```bash
npm init -y
npm install --save-dev vite vitest @playwright/test
npm pkg set type=module
npm pkg set scripts.dev="vite"
npm pkg set scripts.build="vite build"
npm pkg set scripts.preview="vite preview"
npm pkg set scripts.test="vitest run"
npm pkg set scripts.test:watch="vitest"
npm pkg set scripts.test:e2e="playwright test"
npm pkg set scripts.check:public="node scripts/public-safety.mjs"
npm pkg set scripts.verify="npm run check:public && npm test && npm run build && npm run test:e2e"
npm test -- tests/unit/public-safety.test.js
```

Expected: FAIL because `scripts/public-safety.mjs` does not exist.

- [ ] **Step 3: Implement the path guard**

```js
// scripts/public-safety.mjs
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
```

- [ ] **Step 4: Add repository exclusions before any site file can be staged**

```gitignore
# Official local training material - never publish
net_practice/
en.subject _netpractice.pdf

# Local analysis and design companions
.superpowers/
tmp/
.DS_Store

# Dependencies and generated output
node_modules/
dist/
coverage/
playwright-report/
test-results/
```

- [ ] **Step 5: Add the minimal Vite document and bootstrap**

```html
<!-- index.html -->
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Interactive IPv4 and routing practice for NetPractice learners.">
    <title>Subnet Notes</title>
  </head>
  <body>
    <a href="#app" class="skip-link">Skip to content</a>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

```js
// src/main.js
const root = document.querySelector('#app');
root.textContent = 'Subnet Notes';
```

```js
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  build: { outDir: 'dist', sourcemap: true },
  test: { environment: 'node', coverage: { reporter: ['text', 'html'] } },
});
```

- [ ] **Step 6: Add Playwright projects for the approved viewports**

```js
// playwright.config.js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  webServer: { command: 'npm run dev -- --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  projects: [
    { name: 'ultrawide', use: { viewport: { width: 2560, height: 1000 } } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'portrait', use: { viewport: { width: 1024, height: 1366 } } },
    { name: 'mobile', use: { viewport: { width: 360, height: 800 } } },
  ],
});
```

- [ ] **Step 7: Verify foundation and commit**

```bash
npm test -- tests/unit/public-safety.test.js
npm run check:public
npm run build
git add .gitignore package.json package-lock.json vite.config.js playwright.config.js index.html src/main.js scripts/public-safety.mjs tests/unit/public-safety.test.js
git commit -m "chore: create public-safe site foundation"
```

Expected: two unit tests pass, the public check reports no forbidden tracked path, and Vite creates `dist/`.

## Task 2: IPv4 Primitives

**Files:**
- Create: `src/core/ipv4.js`
- Create: `tests/unit/ipv4.test.js`

**Interfaces:**
- Consumes: Decimal IPv4 strings and unsigned 32-bit values.
- Produces: `parseIPv4(input): number | null`, `formatIPv4(value): string`, `isValidIPv4(input): boolean`, and `toOctets(value): number[]`.

- [ ] **Step 1: Write boundary-first failing tests**

```js
// tests/unit/ipv4.test.js
import { describe, expect, it } from 'vitest';
import { formatIPv4, isValidIPv4, parseIPv4, toOctets } from '../../src/core/ipv4.js';

describe('IPv4 primitives', () => {
  it.each([
    ['0.0.0.0', 0],
    ['192.168.1.42', 3232235818],
    ['255.255.255.255', 4294967295],
  ])('parses %s', (input, expected) => expect(parseIPv4(input)).toBe(expected));

  it('rejects malformed values explicitly', () => {
    for (const input of ['1.2.3', '1.2.3.4.5', '1.2.3.-1', '1.2.3.256', '01.2.3.4', 'x.2.3.4', '']) {
      expect(parseIPv4(input)).toBeNull();
      expect(isValidIPv4(input)).toBe(false);
    }
  });

  it('round-trips unsigned values', () => {
    expect(formatIPv4(3232235818)).toBe('192.168.1.42');
    expect(toOctets(3232235818)).toEqual([192, 168, 1, 42]);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

```bash
npm test -- tests/unit/ipv4.test.js
```

Expected: FAIL because `src/core/ipv4.js` does not exist.

- [ ] **Step 3: Implement strict decimal parsing and unsigned formatting**

```js
// src/core/ipv4.js
export function parseIPv4(input) {
  if (typeof input !== 'string') return null;
  const parts = input.split('.');
  if (parts.length !== 4) return null;
  if (parts.some((part) => !/^(0|[1-9]\d{0,2})$/.test(part))) return null;
  const octets = parts.map(Number);
  if (octets.some((octet) => octet > 255)) return null;
  return octets.reduce((value, octet) => ((value << 8) | octet) >>> 0, 0);
}

export function toOctets(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new RangeError('IPv4 value must be an unsigned 32-bit integer');
  }
  return [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
}

export function formatIPv4(value) {
  return toOctets(value).join('.');
}

export function isValidIPv4(input) {
  return parseIPv4(input) !== null;
}
```

- [ ] **Step 4: Verify and commit**

```bash
npm test -- tests/unit/ipv4.test.js
npm test
npm run build
git add src/core/ipv4.js tests/unit/ipv4.test.js
git commit -m "feat: add IPv4 parsing primitives"
```

Expected: IPv4 tests and the complete unit suite pass.

## Task 3: Subnet and Mask Calculations

**Files:**
- Create: `src/core/subnet.js`
- Create: `tests/unit/subnet.test.js`

**Interfaces:**
- Consumes: `parseIPv4`, `formatIPv4`, numeric IPs, prefixes, and dotted masks.
- Produces: `prefixToMask(prefix): number`, `maskToPrefix(mask): number | null`, `parseMask(input): { prefix: number, mask: number } | null`, `networkOf(ip, prefix): number`, `broadcastOf(ip, prefix): number`, `usableRange(ip, prefix): { first: number, last: number, count: number } | null`, `isUsableHost(ip, prefix): boolean`, and `sameSubnet(a, b, prefix): boolean`.

- [ ] **Step 1: Write failing subnet examples and boundaries**

```js
// tests/unit/subnet.test.js
import { describe, expect, it } from 'vitest';
import { parseIPv4 } from '../../src/core/ipv4.js';
import { broadcastOf, isUsableHost, networkOf, parseMask, sameSubnet, usableRange } from '../../src/core/subnet.js';

const ip = (value) => parseIPv4(value);

describe('subnet calculations', () => {
  it('parses CIDR and contiguous dotted masks', () => {
    expect(parseMask('/27')).toEqual({ prefix: 27, mask: 4294967264 });
    expect(parseMask('255.255.255.224')).toEqual({ prefix: 27, mask: 4294967264 });
    expect(parseMask('255.0.255.0')).toBeNull();
    expect(parseMask('/33')).toBeNull();
  });

  it('finds a /27 network, broadcast, and usable range', () => {
    expect(networkOf(ip('192.168.12.77'), 27)).toBe(ip('192.168.12.64'));
    expect(broadcastOf(ip('192.168.12.77'), 27)).toBe(ip('192.168.12.95'));
    expect(usableRange(ip('192.168.12.77'), 27)).toEqual({ first: ip('192.168.12.65'), last: ip('192.168.12.94'), count: 30 });
  });

  it('rejects network and broadcast host addresses', () => {
    expect(isUsableHost(ip('192.168.12.64'), 27)).toBe(false);
    expect(isUsableHost(ip('192.168.12.95'), 27)).toBe(false);
    expect(isUsableHost(ip('192.168.12.65'), 27)).toBe(true);
  });

  it('compares two interfaces using the same prefix', () => {
    expect(sameSubnet(ip('10.0.0.1'), ip('10.0.0.2'), 30)).toBe(true);
    expect(sameSubnet(ip('10.0.0.1'), ip('10.0.0.5'), 30)).toBe(false);
  });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- tests/unit/subnet.test.js
```

Expected: FAIL because `src/core/subnet.js` does not exist.

- [ ] **Step 3: Implement contiguous masks and subnet boundaries**

```js
// src/core/subnet.js
import { parseIPv4 } from './ipv4.js';

export function prefixToMask(prefix) {
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) throw new RangeError('Prefix must be between 0 and 32');
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

export function maskToPrefix(mask) {
  if (!Number.isInteger(mask) || mask < 0 || mask > 0xffffffff) return null;
  const inverted = (~mask) >>> 0;
  if (((inverted + 1) & inverted) !== 0) return null;
  return mask === 0 ? 0 : 32 - Math.log2(inverted + 1);
}

export function parseMask(input) {
  if (typeof input !== 'string') return null;
  if (/^\/(0|[1-9]|[12]\d|3[0-2])$/.test(input)) {
    const prefix = Number(input.slice(1));
    return { prefix, mask: prefixToMask(prefix) };
  }
  const mask = parseIPv4(input);
  if (mask === null) return null;
  const prefix = maskToPrefix(mask);
  return prefix === null ? null : { prefix, mask };
}

export const networkOf = (ip, prefix) => (ip & prefixToMask(prefix)) >>> 0;
export const broadcastOf = (ip, prefix) => (networkOf(ip, prefix) | (~prefixToMask(prefix))) >>> 0;

export function usableRange(ip, prefix) {
  if (prefix >= 31) return null;
  const network = networkOf(ip, prefix);
  const broadcast = broadcastOf(ip, prefix);
  return { first: network + 1, last: broadcast - 1, count: broadcast - network - 1 };
}

export function isUsableHost(ip, prefix) {
  const range = usableRange(ip, prefix);
  return range !== null && ip >= range.first && ip <= range.last;
}

export const sameSubnet = (a, b, prefix) => networkOf(a, prefix) === networkOf(b, prefix);
```

- [ ] **Step 4: Add explicit `/0`, `/30`, `/31`, and `/32` tests, then verify and commit**

```js
it('defines point-to-point and host-only ranges explicitly', () => {
  expect(usableRange(ip('10.0.0.1'), 30)?.count).toBe(2);
  expect(usableRange(ip('10.0.0.1'), 31)).toBeNull();
  expect(usableRange(ip('10.0.0.1'), 32)).toBeNull();
  expect(networkOf(ip('203.0.113.4'), 0)).toBe(0);
});
```

```bash
npm test -- tests/unit/subnet.test.js
npm test
npm run build
git add src/core/subnet.js tests/unit/subnet.test.js
git commit -m "feat: add subnet calculations"
```

## Task 4: Ordered Routing and Packet Traces

**Files:**
- Create: `src/core/routing.js`
- Create: `tests/unit/routing.test.js`

**Interfaces:**
- Consumes: topology devices with interfaces and ordered routes, numeric destinations, and subnet helpers.
- Produces: `isDirectlyReachable(device, targetIp): boolean`, `selectRoute(routes, destinationIp): Route | null`, `tracePacket(topology, sourceId, destinationIp): TraceResult`, and `validateRoundTrip(topology, sourceId, destinationId): RoundTripResult`.

- [ ] **Step 1: Write a failing ordered-route and return-path test**

```js
// tests/unit/routing.test.js
import { describe, expect, it } from 'vitest';
import { parseIPv4 } from '../../src/core/ipv4.js';
import { selectRoute, validateRoundTrip } from '../../src/core/routing.js';

const ip = (value) => parseIPv4(value);
const routes = [
  { destination: ip('10.0.0.0'), prefix: 8, gateway: ip('192.168.1.2') },
  { destination: 0, prefix: 0, gateway: ip('192.168.1.1') },
];

describe('routing', () => {
  it('uses the first matching ordered route', () => {
    expect(selectRoute(routes, ip('10.42.0.9'))).toBe(routes[0]);
    expect(selectRoute(routes, ip('8.8.8.8'))).toBe(routes[1]);
  });

  it('requires a valid forward and return path', () => {
    const topology = {
      devices: [
        { id: 'a', kind: 'host', interfaces: [{ id: 'a1', address: ip('192.168.1.2'), prefix: 24 }], routes: [{ destination: 0, prefix: 0, gateway: ip('192.168.1.1') }] },
        { id: 'r', kind: 'router', interfaces: [{ id: 'r1', address: ip('192.168.1.1'), prefix: 24 }, { id: 'r2', address: ip('10.0.0.1'), prefix: 24 }], routes: [] },
        { id: 'b', kind: 'host', interfaces: [{ id: 'b1', address: ip('10.0.0.2'), prefix: 24 }], routes: [{ destination: 0, prefix: 0, gateway: ip('10.0.0.1') }] },
      ],
      links: [{ a: 'a1', b: 'r1' }, { a: 'r2', b: 'b1' }],
    };
    expect(validateRoundTrip(topology, 'a', 'b').ok).toBe(true);
    topology.devices[2].routes = [];
    expect(validateRoundTrip(topology, 'a', 'b')).toMatchObject({ ok: false, failedDirection: 'return' });
  });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- tests/unit/routing.test.js
```

Expected: FAIL because `src/core/routing.js` does not exist.

- [ ] **Step 3: Implement route selection and an immutable hop trace**

```js
// src/core/routing.js
import { networkOf, sameSubnet } from './subnet.js';

export function selectRoute(routes, destinationIp) {
  return routes.find((route) => networkOf(destinationIp, route.prefix) === networkOf(route.destination, route.prefix)) ?? null;
}

export function isDirectlyReachable(device, targetIp) {
  return device.interfaces.some((entry) => sameSubnet(entry.address, targetIp, entry.prefix));
}

function findLayer2Peers(topology, startInterfaceId) {
  const ownerByInterface = new Map();
  const interfaceById = new Map();
  for (const device of topology.devices) {
    for (const entry of device.interfaces) {
      ownerByInterface.set(entry.id, device);
      interfaceById.set(entry.id, entry);
    }
  }
  const queue = [startInterfaceId];
  const visited = new Set(queue);
  const peers = [];
  while (queue.length > 0) {
    const currentInterfaceId = queue.shift();
    const connected = topology.links
      .filter((link) => link.a === currentInterfaceId || link.b === currentInterfaceId)
      .map((link) => link.a === currentInterfaceId ? link.b : link.a);
    for (const peerId of connected) {
      if (visited.has(peerId)) continue;
      visited.add(peerId);
      const owner = ownerByInterface.get(peerId);
      if (owner.kind === 'switch') {
        for (const switchPort of owner.interfaces) {
          if (!visited.has(switchPort.id)) queue.push(switchPort.id);
        }
      } else {
        peers.push({ device: owner, interface: interfaceById.get(peerId) });
      }
    }
  }
  return peers;
}

export function tracePacket(topology, sourceId, destinationIp) {
  const devices = new Map(topology.devices.map((device) => [device.id, device]));
  const visited = new Set();
  const hops = [];
  let current = devices.get(sourceId);

  while (current && hops.length <= topology.devices.length * 2) {
    if (current.interfaces.some((entry) => entry.address === destinationIp)) return { ok: true, hops };
    const direct = current.interfaces.find((entry) => sameSubnet(entry.address, destinationIp, entry.prefix));
    const route = direct ? null : selectRoute(current.routes, destinationIp);
    const nextHop = direct ? destinationIp : route?.gateway;
    if (nextHop === undefined || nextHop === null) return { ok: false, reason: 'missing-route', deviceId: current.id, hops };
    if (!isDirectlyReachable(current, nextHop)) return { ok: false, reason: 'unreachable-gateway', deviceId: current.id, hops };
    const outgoing = current.interfaces.find((entry) => sameSubnet(entry.address, nextHop, entry.prefix));
    const layer2Peers = findLayer2Peers(topology, outgoing.id);
    const peer = layer2Peers.find((candidate) => candidate.interface.address === nextHop);
    if (!peer) return { ok: false, reason: 'missing-link', deviceId: current.id, hops };
    const nextDeviceId = peer.device.id;
    const visitKey = `${current.id}:${nextDeviceId}:${destinationIp}`;
    if (visited.has(visitKey)) return { ok: false, reason: 'routing-loop', deviceId: current.id, hops };
    visited.add(visitKey);
    hops.push({ deviceId: current.id, outgoingInterfaceId: outgoing.id, nextHop, route });
    current = devices.get(nextDeviceId);
  }
  return { ok: false, reason: 'hop-limit', deviceId: current?.id ?? null, hops };
}

export function validateRoundTrip(topology, sourceId, destinationId) {
  const source = topology.devices.find((device) => device.id === sourceId);
  const destination = topology.devices.find((device) => device.id === destinationId);
  const forward = tracePacket(topology, sourceId, destination.interfaces[0].address);
  if (!forward.ok) return { ok: false, failedDirection: 'forward', forward, return: null };
  const back = tracePacket(topology, destinationId, source.interfaces[0].address);
  return back.ok
    ? { ok: true, failedDirection: null, forward, return: back }
    : { ok: false, failedDirection: 'return', forward, return: back };
}
```

- [ ] **Step 4: Add tests for unreachable gateways, loops, and first-match ordering**

```js
it('does not skip an earlier matching route', () => {
  const ordered = [
    { destination: 0, prefix: 0, gateway: ip('192.168.1.1') },
    { destination: ip('10.0.0.0'), prefix: 8, gateway: ip('192.168.1.2') },
  ];
  expect(selectRoute(ordered, ip('10.42.0.9'))).toBe(ordered[0]);
});

it('crosses a layer-2 switch without requiring a route on the switch', () => {
  const topology = makeSwitchedLanTopology();
  expect(validateRoundTrip(topology, 'host-a', 'router').ok).toBe(true);
});
```

`makeSwitchedLanTopology` is a test fixture declared in `tests/unit/routing.test.js`. It contains two IP endpoints and a switch with three port interfaces; each endpoint connects to one switch port. The switch has no IP address and no routes, proving that the trace traverses the layer-2 broadcast domain rather than treating the switch as a router.

- [ ] **Step 5: Verify and commit**

```bash
npm test -- tests/unit/routing.test.js
npm test
npm run build
git add src/core/routing.js tests/unit/routing.test.js
git commit -m "feat: trace ordered network routes"
```

## Task 5: Deterministic Exercise Schema and Generators

**Files:**
- Create: `src/exercises/random.js`
- Create: `src/exercises/schema.js`
- Create: `src/exercises/generators.js`
- Create: `tests/unit/generators.test.js`

**Interfaces:**
- Consumes: seed strings, concept identifiers, difficulty values, and core networking functions.
- Produces: `createRandom(seed): RandomSource`, `assertExercise(exercise): void`, `generateFocusedExercise(options): Exercise`, `generateMission(options): Exercise`, and internal `buildOriginalMission(options): Exercise`.

- [ ] **Step 1: Write failing reproducibility and invariant tests**

```js
// tests/unit/generators.test.js
import { describe, expect, it } from 'vitest';
import { generateFocusedExercise, generateMission } from '../../src/exercises/generators.js';
import { assertExercise } from '../../src/exercises/schema.js';

describe('exercise generators', () => {
  it('reproduces the same mission from the same seed', () => {
    expect(generateMission({ seed: 'atlas-42', difficulty: 3 }))
      .toEqual(generateMission({ seed: 'atlas-42', difficulty: 3 }));
  });

  it('changes address data for another seed', () => {
    expect(generateMission({ seed: 'atlas-42', difficulty: 3 }).solution)
      .not.toEqual(generateMission({ seed: 'cedar-43', difficulty: 3 }).solution);
  });

  it('produces valid exercises across many seeds', () => {
    for (let index = 0; index < 250; index += 1) {
      expect(() => assertExercise(generateMission({ seed: `mission-${index}`, difficulty: 3 }))).not.toThrow();
      expect(() => assertExercise(generateFocusedExercise({ seed: `mask-${index}`, concept: 'subnet-range', difficulty: 2 }))).not.toThrow();
    }
  });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- tests/unit/generators.test.js
```

Expected: FAIL because the exercise modules do not exist.

- [ ] **Step 3: Implement a deterministic random source**

```js
// src/exercises/random.js
function hashSeed(seed) {
  let value = 2166136261;
  for (const character of seed) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

export function createRandom(seed) {
  let state = hashSeed(String(seed));
  const next = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    integer(min, max) { return Math.floor(next() * (max - min + 1)) + min; },
    pick(values) { return values[this.integer(0, values.length - 1)]; },
  };
}
```

- [ ] **Step 4: Define and enforce the exercise contract**

```js
// src/exercises/schema.js
/**
 * @typedef {{ id:string, address:number|null, prefix:number|null, editable:{address:boolean,prefix:boolean} }} NetworkInterface
 * @typedef {{ id:string, destination:number, prefix:number, gateway:number, editable:{destination:boolean,prefix:boolean,gateway:boolean} }} Route
 * @typedef {{ id:string, kind:'host'|'router'|'switch'|'internet', labelKey:string, interfaces:NetworkInterface[], routes:Route[], position:{x:number,y:number} }} Device
 * @typedef {{ id:string, seed:string, type:'focused'|'mission', concept:string, difficulty:number, devices:Device[], links:{a:string,b:string}[], goals:{sourceId:string,destinationId:string}[], editableFields:string[], initial:Record<string,string>, solution:Record<string,string> }} Exercise
 */

export function assertExercise(exercise) {
  if (!exercise || !exercise.id || !exercise.seed) throw new TypeError('Exercise identity is required');
  if (!['focused', 'mission'].includes(exercise.type)) throw new TypeError('Exercise type is invalid');
  if (!Array.isArray(exercise.devices) || exercise.devices.length < 2) throw new TypeError('Exercise requires devices');
  const deviceIds = new Set(exercise.devices.map((device) => device.id));
  if (deviceIds.size !== exercise.devices.length) throw new TypeError('Device ids must be unique');
  const interfaceIds = new Set(exercise.devices.flatMap((device) => device.interfaces.map((entry) => entry.id)));
  for (const link of exercise.links) if (!interfaceIds.has(link.a) || !interfaceIds.has(link.b)) throw new TypeError('Link references an unknown interface');
  for (const goal of exercise.goals) if (!deviceIds.has(goal.sourceId) || !deviceIds.has(goal.destinationId)) throw new TypeError('Goal references an unknown device');
  for (const field of exercise.editableFields) if (!(field in exercise.solution)) throw new TypeError(`Editable field ${field} lacks a solution`);
}
```

- [ ] **Step 5: Implement one focused generator and one original advanced topology**

Implement `generateFocusedExercise` for `host-range`, `same-subnet`, and `gateway` concepts. Implement `generateMission` with the original structure Internet -> Atlas router -> Boréal router -> LAN B and Atlas router -> Orme switch -> LAN A. Derive all network, broadcast, usable-host, and gateway values through `src/core` functions; never paste official addresses or level data.

```js
export function generateMission({ seed, difficulty }) {
  const random = createRandom(seed);
  const secondOctet = random.integer(16, 200);
  const lanAThird = random.integer(1, 120);
  const lanBThird = random.integer(130, 220);
  const lanAPrefix = random.pick([26, 27, 28]);
  const lanBPrefix = random.pick([27, 28]);
  return buildOriginalMission({ seed, difficulty, secondOctet, lanAThird, lanBThird, lanAPrefix, lanBPrefix, random });
}
```

`buildOriginalMission({ seed, difficulty, secondOctet, lanAThird, lanBThird, lanAPrefix, lanBPrefix, random })` is defined in the same module. It returns every field from the `Exercise` schema, chooses only usable host values, rejects overlapping networks before returning, includes at least one bidirectional reachability goal, marks 6-10 values editable at difficulty 3, calls `assertExercise(exercise)`, and returns the checked exercise.

- [ ] **Step 6: Verify invariants and commit**

```bash
npm test -- tests/unit/generators.test.js
npm test
npm run build
git add src/exercises/random.js src/exercises/schema.js src/exercises/generators.js tests/unit/generators.test.js
git commit -m "feat: generate deterministic network exercises"
```

## Task 6: Diagnostics, Validation, and Progressive Hints

**Files:**
- Create: `src/exercises/validators.js`
- Create: `src/exercises/hints.js`
- Create: `tests/unit/validators.test.js`
- Create: `tests/unit/hints.test.js`

**Interfaces:**
- Consumes: `Exercise`, submission values, packet traces, and a hint level from 1 to 3.
- Produces: `classifyHostAddress(address, prefix): DiagnosticCode | null`, `validateGateway(interfaceEntry, gateway): Diagnostic | null`, `validateSubmission(exercise, submission): ValidationResult`, and `getHint(exercise, validation, level): HintDescriptor` where descriptors contain language-neutral keys and parameters.

- [ ] **Step 1: Write failing diagnostic tests**

```js
// tests/unit/validators.test.js
import { describe, expect, it } from 'vitest';
import { generateFocusedExercise } from '../../src/exercises/generators.js';
import { classifyHostAddress, validateGateway, validateSubmission } from '../../src/exercises/validators.js';

describe('validateSubmission', () => {
  it('identifies malformed exercise input', () => {
    const exercise = generateFocusedExercise({ seed: 'diagnostic-1', concept: 'gateway', difficulty: 2 });
    expect(validateSubmission(exercise, { ...exercise.initial, [exercise.editableFields[0]]: '999.1.1.1' }).diagnostics[0].code).toBe('invalid-ip');
  });

  it('classifies forbidden host boundaries', () => {
    expect(classifyHostAddress('192.168.12.64', 27)).toBe('network-address');
    expect(classifyHostAddress('192.168.12.95', 27)).toBe('broadcast-address');
    expect(classifyHostAddress('192.168.12.65', 27)).toBeNull();
  });

  it('identifies a gateway outside the local interface network', () => {
    expect(validateGateway({ address: '192.168.12.65', prefix: 27 }, '192.168.13.1'))
      .toMatchObject({ code: 'unreachable-gateway' });
  });
});
```

- [ ] **Step 2: Write the failing progressive-hint test**

```js
// tests/unit/hints.test.js
import { expect, it } from 'vitest';
import { getHint } from '../../src/exercises/hints.js';

it('strengthens hints without returning the completed answer early', () => {
  const validation = { ok: false, diagnostics: [{ code: 'unreachable-gateway', deviceId: 'a', field: 'a.gateway', params: { prefix: 27 } }] };
  const exercise = { id: 'hint-test', solution: { 'a.gateway': '192.168.12.65' } };
  expect(getHint(exercise, validation, 1)).toEqual({ key: 'hint.gateway.observe', params: { deviceId: 'a' } });
  expect(getHint(exercise, validation, 2)).toEqual({ key: 'hint.gateway.method', params: { prefix: 27 } });
  expect(getHint(exercise, validation, 3)).toMatchObject({ key: 'hint.gateway.nearSolution' });
});
```

- [ ] **Step 3: Run both tests and verify RED**

```bash
npm test -- tests/unit/validators.test.js tests/unit/hints.test.js
```

Expected: FAIL because validators and hints do not exist.

- [ ] **Step 4: Implement validation as ordered, language-neutral diagnostics**

```js
// src/exercises/validators.js
export function validateSubmission(exercise, submission) {
  const parsed = parseEditableFields(exercise, submission);
  if (parsed.diagnostics.length > 0) return { ok: false, diagnostics: parsed.diagnostics, traces: [] };
  const configured = applySubmission(exercise, parsed.values);
  const hostDiagnostics = validateHostAddresses(configured);
  const gatewayDiagnostics = validateGateways(configured);
  const routeDiagnostics = validateRoutes(configured);
  const traces = configured.goals.map((goal) => validateRoundTrip(configured, goal.sourceId, goal.destinationId));
  const pathDiagnostics = diagnosticsFromTraces(traces);
  const diagnostics = [...hostDiagnostics, ...gatewayDiagnostics, ...routeDiagnostics, ...pathDiagnostics];
  return { ok: diagnostics.length === 0, diagnostics, traces };
}
```

Create one stable diagnostic code for every error in spec section 9: `invalid-ip`, `invalid-mask`, `network-address`, `broadcast-address`, `different-subnet`, `unreachable-gateway`, `missing-default-route`, `wrong-route-destination`, `unreachable-next-hop`, `missing-return-path`, and `overlapping-subnets`. Each diagnostic includes `messageKey`, `deviceId`, `field`, and concrete params.

- [ ] **Step 5: Implement the three hint levels from the first diagnostic**

```js
// src/exercises/hints.js
const hintKeys = {
  'unreachable-gateway': ['hint.gateway.observe', 'hint.gateway.method', 'hint.gateway.nearSolution'],
  'different-subnet': ['hint.subnet.observe', 'hint.subnet.method', 'hint.subnet.nearSolution'],
  'missing-return-path': ['hint.return.observe', 'hint.return.method', 'hint.return.nearSolution'],
};

export function getHint(exercise, validation, level) {
  if (![1, 2, 3].includes(level)) throw new RangeError('Hint level must be 1, 2, or 3');
  const diagnostic = validation.diagnostics[0];
  const keys = hintKeys[diagnostic.code] ?? ['hint.generic.observe', 'hint.generic.method', 'hint.generic.nearSolution'];
  const params = level === 1
    ? { deviceId: diagnostic.deviceId }
    : level === 2
      ? diagnostic.params
      : { ...diagnostic.params, expectedShape: describeExpectedShape(exercise, diagnostic.field) };
  return { key: keys[level - 1], params };
}
```

- [ ] **Step 6: Verify and commit**

```bash
npm test -- tests/unit/validators.test.js tests/unit/hints.test.js
npm test
npm run build
git add src/exercises/validators.js src/exercises/hints.js tests/unit/validators.test.js tests/unit/hints.test.js
git commit -m "feat: explain network configuration errors"
```

## Task 7: Complete Bilingual Message System

**Files:**
- Create: `src/i18n/index.js`
- Create: `src/i18n/fr.js`
- Create: `src/i18n/en.js`
- Create: `tests/unit/i18n.test.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: stable translation keys, interpolation params, and locale `fr | en`.
- Produces: `createI18n(initialLocale): { locale, setLocale, t, subscribe }` and two bundles with identical deep key sets.

- [ ] **Step 1: Write failing completeness and interpolation tests**

```js
// tests/unit/i18n.test.js
import { describe, expect, it } from 'vitest';
import { createI18n, flattenKeys } from '../../src/i18n/index.js';
import { en } from '../../src/i18n/en.js';
import { fr } from '../../src/i18n/fr.js';

describe('i18n', () => {
  it('keeps French and English key sets identical', () => {
    expect(flattenKeys(fr)).toEqual(flattenKeys(en));
  });

  it('interpolates diagnostic values and switches without reload', () => {
    const i18n = createI18n('fr');
    expect(i18n.t('diagnostic.invalidIp', { value: '999.1.1.1' })).toContain('999.1.1.1');
    i18n.setLocale('en');
    expect(i18n.t('diagnostic.invalidIp', { value: '999.1.1.1' })).toMatch(/invalid/i);
  });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- tests/unit/i18n.test.js
```

Expected: FAIL because the i18n modules do not exist.

- [ ] **Step 3: Implement locale switching and safe interpolation**

```js
// src/i18n/index.js
import { en } from './en.js';
import { fr } from './fr.js';

const bundles = { en, fr };

export function flattenKeys(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === 'object' ? flattenKeys(child, path) : [path];
  }).sort();
}

function lookup(bundle, key) {
  return key.split('.').reduce((value, segment) => value?.[segment], bundle);
}

export function createI18n(initialLocale) {
  let locale = initialLocale in bundles ? initialLocale : 'fr';
  const listeners = new Set();
  return {
    get locale() { return locale; },
    setLocale(next) {
      if (!(next in bundles) || next === locale) return;
      locale = next;
      document.documentElement.lang = next;
      listeners.forEach((listener) => listener(next));
    },
    t(key, params = {}) {
      const template = lookup(bundles[locale], key);
      if (typeof template !== 'string') throw new Error(`Missing translation: ${locale}.${key}`);
      return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`));
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}
```

- [ ] **Step 4: Write the complete key contract in both bundles**

Both bundles must include `app`, `nav`, `course`, `workshop`, `device`, `field`, `action`, `feedback`, `diagnostic`, `hint`, `exam`, `result`, and `accessibility` groups. Add every diagnostic and hint key from Task 6. Use natural learner-facing prose, not literal word-for-word translations.

```js
export const fr = {
  app: { name: 'Subnet Notes', nonOfficial: 'Ressource communautaire non officielle' },
  action: { check: 'Tester le réseau', hint: 'Voir l’indice {level} sur 3', newExercise: 'Nouvel exercice' },
  diagnostic: { invalidIp: '« {value} » n’est pas une adresse IPv4 valide.' },
};
```

```js
export const en = {
  app: { name: 'Subnet Notes', nonOfficial: 'Unofficial community resource' },
  action: { check: 'Test the network', hint: 'Show hint {level} of 3', newExercise: 'New exercise' },
  diagnostic: { invalidIp: '“{value}” is not a valid IPv4 address.' },
};
```

- [ ] **Step 5: Verify, update the document default copy, and commit**

```bash
npm test -- tests/unit/i18n.test.js
npm test
npm run build
git add src/i18n/index.js src/i18n/fr.js src/i18n/en.js tests/unit/i18n.test.js index.html
git commit -m "feat: add complete French and English messages"
```

## Task 8: Versioned Local Progress

**Files:**
- Create: `src/storage/progress.js`
- Create: `tests/unit/progress.test.js`

**Interfaces:**
- Consumes: Storage-compatible object with `getItem`, `setItem`, and `removeItem`.
- Produces: `loadProgress(storage): Progress`, `saveProgress(storage, progress): void`, `completeWorkshop(progress, workshopId, result): Progress`, and `recordExam(progress, result): Progress`.

- [ ] **Step 1: Write failing recovery and immutability tests**

```js
// tests/unit/progress.test.js
import { describe, expect, it } from 'vitest';
import { completeWorkshop, loadProgress, recordExam, saveProgress } from '../../src/storage/progress.js';

function memoryStorage(initial = null) {
  let value = initial;
  return { getItem: () => value, setItem: (_, next) => { value = next; }, removeItem: () => { value = null; } };
}

describe('progress storage', () => {
  it('recovers from missing and corrupted data', () => {
    expect(loadProgress(memoryStorage())).toMatchObject({ version: 1, locale: 'fr', completed: {} });
    expect(loadProgress(memoryStorage('{broken'))).toMatchObject({ version: 1, locale: 'fr', completed: {} });
  });

  it('records completion and the best exam time immutably', () => {
    const initial = loadProgress(memoryStorage());
    const completed = completeWorkshop(initial, 'subnet-1', { attempts: 2, hints: 1 });
    const firstExam = recordExam(completed, { passed: true, seconds: 780, score: 3 });
    const fasterExam = recordExam(firstExam, { passed: true, seconds: 690, score: 3 });
    expect(initial.completed).toEqual({});
    expect(completed.completed['subnet-1']).toMatchObject({ attempts: 2, hints: 1 });
    expect(fasterExam.bestExamSeconds).toBe(690);
  });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- tests/unit/progress.test.js
```

Expected: FAIL because `src/storage/progress.js` does not exist.

- [ ] **Step 3: Implement schema version 1 and safe fallbacks**

```js
// src/storage/progress.js
const KEY = 'subnet-notes-progress';
const defaults = () => ({ version: 1, locale: 'fr', completed: {}, current: null, exams: [], bestExamSeconds: null });

export function loadProgress(storage = localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(KEY));
    if (!parsed || parsed.version !== 1 || typeof parsed.completed !== 'object') return defaults();
    return { ...defaults(), ...parsed };
  } catch {
    return defaults();
  }
}

export function saveProgress(storage, progress) {
  storage.setItem(KEY, JSON.stringify(progress));
}

export function completeWorkshop(progress, workshopId, result) {
  return { ...progress, completed: { ...progress.completed, [workshopId]: { ...result, completedAt: new Date().toISOString() } } };
}

export function recordExam(progress, result) {
  const best = result.passed && (progress.bestExamSeconds === null || result.seconds < progress.bestExamSeconds)
    ? result.seconds
    : progress.bestExamSeconds;
  return { ...progress, exams: [...progress.exams, result], bestExamSeconds: best };
}
```

- [ ] **Step 4: Add save/load round-trip and future-version fallback tests, then commit**

```bash
npm test -- tests/unit/progress.test.js
npm test
npm run build
git add src/storage/progress.js tests/unit/progress.test.js
git commit -m "feat: persist local learning progress"
```

## Task 9: Subnet Notes Shell and Visual System

**Files:**
- Create: `src/styles/base.css`
- Create: `src/styles/layout.css`
- Create: `src/styles/components.css`
- Create: `src/ui/dom.js`
- Create: `src/ui/shell.js`
- Create: `src/ui/home.js`
- Create: `src/app.js`
- Modify: `src/main.js`
- Create: `tests/e2e/shell.spec.js`

**Interfaces:**
- Consumes: `i18n`, `Progress`, and route callbacks.
- Produces: `createShell(options): Shell`, `renderHome(options): HTMLElement`, and `createApp(root, dependencies): AppController`.

- [ ] **Step 1: Write a failing browser test for shell, language, and navigation**

```js
// tests/e2e/shell.spec.js
import { expect, test } from '@playwright/test';

test('shows the learning path and switches language without reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('banner')).toContainText('Subnet Notes');
  await expect(page.getByRole('navigation', { name: /parcours/i })).toBeVisible();
  await page.getByRole('button', { name: 'EN' }).click();
  await expect(page.getByRole('navigation', { name: /learning path/i })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
```

- [ ] **Step 2: Install the Playwright browser if absent and verify RED**

```bash
npx playwright install chromium
npm run test:e2e -- tests/e2e/shell.spec.js --project=desktop
```

Expected: FAIL because the current page contains only the bootstrap text.

- [ ] **Step 3: Implement safe DOM helpers and the shell contract**

```js
// src/ui/dom.js
export function element(tag, attributes = {}, children = []) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (name === 'className') node.className = value;
    else if (name.startsWith('on') && typeof value === 'function') node.addEventListener(name.slice(2).toLowerCase(), value);
    else if (value !== false && value !== null && value !== undefined) node.setAttribute(name, String(value));
  }
  for (const child of children) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}
```

`createShell` builds one banner, the `FR | EN` control, a labeled curriculum navigation, progress indicator, main route outlet, and a non-affiliation footer. It returns `{ outlet, renderNavigation, destroy }` and rerenders translated labels when the locale changes.

- [ ] **Step 4: Implement the approved paper design and responsive shell**

```css
:root {
  --paper: #f5f0e6;
  --sheet: #fffdf8;
  --ink: #2d302a;
  --muted-ink: #777365;
  --rule: #ddd2bd;
  --accent: #d7623d;
  --accent-soft: #f6e2d9;
  --network-link: #416a5b;
  color: var(--ink);
  background: var(--paper);
  font-family: ui-sans-serif, system-ui, sans-serif;
}

h1, h2, h3, .wordmark { font-family: Georgia, 'Times New Roman', serif; }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
```

Use the approved header, warm surfaces, terracotta editable state, sage links, sidebar, skip link, 44 px minimum primary controls, and reduced-motion query. Hide the sidebar below `1180px` when a topology/workshop view is active; do not hide the learning path on the home view until `760px`.

- [ ] **Step 5: Wire `createApp` and rerender without losing locale or progress**

```js
// src/main.js
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import { createApp } from './app.js';
import { createI18n } from './i18n/index.js';
import { loadProgress } from './storage/progress.js';

const root = document.querySelector('#app');
const progress = loadProgress(localStorage);
createApp(root, { i18n: createI18n(progress.locale), progress, storage: localStorage });
```

- [ ] **Step 6: Verify visual shell and commit**

```bash
npm run test:e2e -- tests/e2e/shell.spec.js --project=desktop
npm test
npm run build
git add src/styles src/ui/dom.js src/ui/shell.js src/ui/home.js src/app.js src/main.js tests/e2e/shell.spec.js
git commit -m "feat: build Subnet Notes learning shell"
```

## Task 10: Interactive Workshop Loop

**Files:**
- Create: `src/ui/workshop.js`
- Create: `src/ui/feedback.js`
- Create: `src/content/curriculum.js`
- Create: `tests/e2e/workshop.spec.js`
- Modify: `src/app.js`
- Modify: `src/i18n/fr.js`
- Modify: `src/i18n/en.js`

**Interfaces:**
- Consumes: curriculum manifest, focused exercise generator, validator, hints, i18n, and persistence actions.
- Produces: `renderWorkshop(options): WorkshopController` with `element`, `getState()`, and `destroy()`.

- [ ] **Step 1: Write a failing learning-loop test**

```js
// tests/e2e/workshop.spec.js
import { expect, test } from '@playwright/test';

test('explains an error, reveals progressive hints, and generates another attempt', async ({ page }) => {
  await page.goto('/#/workshops/subnet-range-1?seed=e2e-range');
  await page.getByLabel(/network address|adresse réseau/i).fill('192.168.12.77');
  await page.getByRole('button', { name: /check|vérifier/i }).click();
  await expect(page.getByRole('alert')).toContainText(/network|réseau/i);
  await page.getByRole('button', { name: /hint 1|indice 1/i }).click();
  await expect(page.getByRole('status')).toBeVisible();
  await page.getByRole('button', { name: /hint 2|indice 2/i }).click();
  await expect(page.getByRole('status')).toContainText(/mask|masque/i);
  const firstSeed = await page.locator('[data-exercise-seed]').getAttribute('data-exercise-seed');
  await page.getByRole('button', { name: /new exercise|nouvel exercice/i }).click();
  await expect(page.locator('[data-exercise-seed]')).not.toHaveAttribute('data-exercise-seed', firstSeed);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npm run test:e2e -- tests/e2e/workshop.spec.js --project=desktop
```

Expected: FAIL because the workshop route and UI do not exist.

- [ ] **Step 3: Define the six-stage curriculum manifest**

```js
// src/content/curriculum.js
export const curriculum = [
  { id: 'ipv4', titleKey: 'course.ipv4.title', workshops: ['ipv4-validity-1', 'ipv4-octets-2'] },
  { id: 'subnets', titleKey: 'course.subnets.title', workshops: ['mask-conversion-1', 'subnet-range-1', 'usable-host-2', 'same-subnet-3'] },
  { id: 'local', titleKey: 'course.local.title', workshops: ['neighbors-1', 'switch-segment-2'] },
  { id: 'gateways', titleKey: 'course.gateways.title', workshops: ['router-interface-1', 'valid-gateway-2', 'direct-network-3'] },
  { id: 'routing', titleKey: 'course.routing.title', workshops: ['route-parts-1', 'default-route-2', 'packet-path-3', 'return-path-4', 'routing-mission-5'] },
  { id: 'exam', titleKey: 'course.exam.title', workshops: ['guided-mission-1', 'guided-mission-2', 'mock-exam'] },
];
```

- [ ] **Step 4: Implement the workshop state machine**

Use explicit states `ready`, `incorrect`, `correct`, and `correction`. Keep `hintLevel` from 0 to 3, `attempts`, `submission`, and `seed`. The check action calls `validateSubmission`; incorrect attempts render the first diagnostic in a `role="alert"`; hints render in `role="status"`; correct attempts record progress and enable a fresh variation. Changing language rerenders copy without replacing the exercise or clearing values.

```js
const state = { phase: 'ready', hintLevel: 0, attempts: 0, seed, submission: { ...exercise.initial }, validation: null };
function check() {
  state.attempts += 1;
  state.validation = validateSubmission(exercise, state.submission);
  state.phase = state.validation.ok ? 'correct' : 'incorrect';
  render();
}
```

- [ ] **Step 5: Render reasoned correction steps, never only completed values**

The correction panel contains ordered translated steps derived from the exercise: identify the relevant segment, compute network and broadcast, choose usable values, confirm gateway membership, trace forward routes, and trace the return path. Each step includes the concrete values used in that generated exercise.

- [ ] **Step 6: Verify and commit**

```bash
npm run test:e2e -- tests/e2e/workshop.spec.js --project=desktop
npm test
npm run build
git add src/ui/workshop.js src/ui/feedback.js src/content/curriculum.js src/app.js src/i18n/fr.js src/i18n/en.js tests/e2e/workshop.spec.js
git commit -m "feat: add interactive workshop loop"
```

## Task 11: Responsive Selectable Topology and Device Configuration

**Files:**
- Create: `src/ui/topology.js`
- Create: `src/ui/device-config.js`
- Create: `tests/unit/topology-geometry.test.js`
- Create: `tests/e2e/topology.spec.js`
- Modify: `src/ui/workshop.js`
- Modify: `src/styles/components.css`
- Modify: `src/styles/layout.css`

**Interfaces:**
- Consumes: exercise devices with normalized `position`, links, current submission, selected device id, and change callbacks.
- Produces: `createTopology(options): TopologyController`, `nearestEdgePoints(aRect, bRect, canvasRect): { start, end }`, and `renderDeviceConfig(options): HTMLElement`.

- [ ] **Step 1: Write the failing geometry unit test**

```js
// tests/unit/topology-geometry.test.js
import { expect, it } from 'vitest';
import { nearestEdgePoints } from '../../src/ui/topology.js';

it('anchors a horizontal link to the actual node edges', () => {
  const canvas = { left: 100, top: 50 };
  const a = { left: 130, right: 230, top: 100, bottom: 160, width: 100, height: 60 };
  const b = { left: 430, right: 530, top: 100, bottom: 160, width: 100, height: 60 };
  expect(nearestEdgePoints(a, b, canvas)).toEqual({ start: { x: 130, y: 80 }, end: { x: 330, y: 80 } });
});
```

- [ ] **Step 2: Write failing responsive browser assertions**

```js
// tests/e2e/topology.spec.js
import { expect, test } from '@playwright/test';

for (const project of ['ultrawide', 'desktop', 'portrait']) {
  test(`keeps every topology link attached in ${project}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== project);
    await page.goto('/#/workshops/guided-mission-1?seed=responsive');
    const metrics = await page.locator('[data-topology]').evaluate((canvas) => {
      const nodes = new Map([...canvas.querySelectorAll('[data-device-id]')].map((node) => [node.dataset.deviceId, node.getBoundingClientRect()]));
      return [...canvas.querySelectorAll('[data-link]')].map((path) => {
        const source = nodes.get(path.dataset.source);
        const target = nodes.get(path.dataset.target);
        const values = path.getAttribute('data-endpoints').split(',').map(Number);
        const distance = (x, y, rect) => Math.hypot(Math.max(rect.left - x, 0, x - rect.right), Math.max(rect.top - y, 0, y - rect.bottom));
        return { start: distance(values[0], values[1], source), end: distance(values[2], values[3], target) };
      });
    });
    expect(metrics.every((link) => link.start <= 1 && link.end <= 1)).toBe(true);
  });
}

test('uses a stacked device list without horizontal overflow on mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await page.goto('/#/workshops/guided-mission-1?seed=responsive');
  await expect(page.locator('[data-topology-mode="stacked"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
```

- [ ] **Step 3: Run both tests and verify RED**

```bash
npm test -- tests/unit/topology-geometry.test.js
npm run test:e2e -- tests/e2e/topology.spec.js
```

Expected: FAIL because topology rendering and geometry functions do not exist.

- [ ] **Step 4: Implement one coordinate model and live link positioning**

Place devices from normalized percentages inside a centered canvas with `width: min(100%, 900px)`. Render links in an SVG overlay. After the DOM lays out, compute start and end points from the live node rectangles relative to the canvas. Set each path's `d` and a `data-endpoints` attribute containing viewport coordinates for the browser regression test. Recompute with one `ResizeObserver` attached to the canvas, not one observer per node.

```js
export function nearestEdgePoints(a, b, canvas) {
  const aCenter = { x: (a.left + a.right) / 2, y: (a.top + a.bottom) / 2 };
  const bCenter = { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 };
  const horizontal = Math.abs(bCenter.x - aCenter.x) >= Math.abs(bCenter.y - aCenter.y);
  const startViewport = horizontal
    ? { x: bCenter.x >= aCenter.x ? a.right : a.left, y: aCenter.y }
    : { x: aCenter.x, y: bCenter.y >= aCenter.y ? a.bottom : a.top };
  const endViewport = horizontal
    ? { x: bCenter.x >= aCenter.x ? b.left : b.right, y: bCenter.y }
    : { x: bCenter.x, y: bCenter.y >= aCenter.y ? b.top : b.bottom };
  return {
    start: { x: startViewport.x - canvas.left, y: startViewport.y - canvas.top },
    end: { x: endViewport.x - canvas.left, y: endViewport.y - canvas.top },
  };
}
```

- [ ] **Step 5: Implement keyboard-selectable devices and the compact editor**

Each node is a real `<button>` with an accessible label. Selecting a device updates a below-diagram panel containing only that device's interfaces and ordered routes. Inputs use explicit labels and preserve current submission state when switching devices. Switches show their connected segment but no fake IP fields.

- [ ] **Step 6: Implement portrait and mobile reflow**

At viewport widths below `1180px`, remove the curriculum sidebar in workshop routes. Below `600px`, change the topology root to `data-topology-mode="stacked"`, hide the SVG, order devices along packet flow, and stack configuration panels. Do not scale text or controls below the base size.

- [ ] **Step 7: Verify all target viewports and commit**

```bash
npm test -- tests/unit/topology-geometry.test.js
npm run test:e2e -- tests/e2e/topology.spec.js
npm test
npm run build
git add src/ui/topology.js src/ui/device-config.js src/ui/workshop.js src/styles/components.css src/styles/layout.css tests/unit/topology-geometry.test.js tests/e2e/topology.spec.js
git commit -m "feat: add responsive network topology"
```

## Task 12: Complete Six-Stage Bilingual Curriculum

**Files:**
- Create: `src/content/lessons.fr.js`
- Create: `src/content/lessons.en.js`
- Create: `tests/unit/curriculum.test.js`
- Modify: `src/content/curriculum.js`
- Modify: `src/exercises/generators.js`
- Modify: `src/ui/workshop.js`

**Interfaces:**
- Consumes: curriculum workshop ids, focused/mission concepts, and translation-neutral step descriptors.
- Produces: complete `lessonsFr`, `lessonsEn`, and a resolvable generator definition for every workshop id.

- [ ] **Step 1: Write the failing curriculum contract test**

```js
// tests/unit/curriculum.test.js
import { expect, it } from 'vitest';
import { curriculum } from '../../src/content/curriculum.js';
import { lessonsEn } from '../../src/content/lessons.en.js';
import { lessonsFr } from '../../src/content/lessons.fr.js';
import { getWorkshopGenerator } from '../../src/exercises/generators.js';

it('resolves bilingual content and a generator for every workshop', () => {
  const ids = curriculum.flatMap((stage) => stage.workshops);
  expect(ids.length).toBeGreaterThanOrEqual(18);
  for (const id of ids) {
    expect(lessonsFr[id]).toMatchObject({ title: expect.any(String), microLesson: expect.any(String), objective: expect.any(String) });
    expect(lessonsEn[id]).toMatchObject({ title: expect.any(String), microLesson: expect.any(String), objective: expect.any(String) });
    expect(getWorkshopGenerator(id)).toEqual(expect.any(Function));
  }
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- tests/unit/curriculum.test.js
```

Expected: FAIL because lesson modules and several generator mappings do not exist.

- [ ] **Step 3: Write short French and English content for every manifest id**

Each entry contains `title`, `microLesson` limited to roughly 60 words, `objective`, `methodSteps`, and `readinessLabel`. Cover IPv4, CIDR/dotted masks, block size, network/broadcast, local neighbors, switches, router interfaces, gateway membership, ordered routes, default routes, packet tracing, and return paths. The English text is idiomatic and complete, not a machine-like literal translation.

```js
export const lessonsFr = {
  'subnet-range-1': {
    title: 'Trouve les limites du réseau',
    microLesson: 'Le masque découpe le dernier octet en blocs. Pour un /27, chaque bloc contient 32 adresses : 0-31, 32-63, 64-95, puis ainsi de suite.',
    objective: 'Trouve le réseau, le broadcast et la plage utilisable.',
    methodSteps: ['Trouve la taille du bloc.', 'Repère le bloc contenant l’adresse.', 'Retire le réseau et le broadcast des hôtes utilisables.'],
    readinessLabel: 'Prêt pour les premiers niveaux de masques',
  },
};
```

- [ ] **Step 4: Map every workshop to an original generator and correction strategy**

Focused workshop generators change addresses and prefixes by seed. Guided mission 1 uses two routers, one switch, three hosts, and Internet; guided mission 2 uses a different original topology and editable-field pattern. Keep all topology definitions in this repository's source and document their originality in comments without referencing official level files.

- [ ] **Step 5: Verify both languages and commit**

```bash
npm test -- tests/unit/curriculum.test.js tests/unit/i18n.test.js tests/unit/generators.test.js
npm test
npm run build
git add src/content/lessons.fr.js src/content/lessons.en.js src/content/curriculum.js src/exercises/generators.js src/ui/workshop.js tests/unit/curriculum.test.js
git commit -m "feat: complete bilingual networking curriculum"
```

## Task 13: Three-Mission, Fifteen-Minute Mock Evaluation

**Files:**
- Create: `src/ui/exam.js`
- Create: `tests/unit/exam-state.test.js`
- Create: `tests/e2e/exam.spec.js`
- Modify: `src/app.js`
- Modify: `src/storage/progress.js`
- Modify: `src/i18n/fr.js`
- Modify: `src/i18n/en.js`

**Interfaces:**
- Consumes: deterministic advanced mission generator, validator, clock dependency, progress recorder, and i18n.
- Produces: `createExamState(options): ExamStateController` and `renderExam(options): ExamController`.

- [ ] **Step 1: Write a failing clock-independent state test**

```js
// tests/unit/exam-state.test.js
import { expect, it } from 'vitest';
import { createExamState } from '../../src/ui/exam.js';

it('runs exactly three missions and expires at fifteen minutes', () => {
  let now = 1_000_000;
  const clock = { now: () => now };
  const exam = createExamState({ seed: 'exam-42', clock, durationSeconds: 900, missionCount: 3 });
  expect(exam.snapshot()).toMatchObject({ index: 0, remainingSeconds: 900, status: 'running' });
  now += 899_000;
  expect(exam.snapshot()).toMatchObject({ remainingSeconds: 1, status: 'running' });
  now += 1_000;
  expect(exam.snapshot()).toMatchObject({ remainingSeconds: 0, status: 'expired' });
  expect(exam.missions).toHaveLength(3);
});
```

- [ ] **Step 2: Write a failing browser test for exam restrictions and results**

```js
// tests/e2e/exam.spec.js
import { expect, test } from '@playwright/test';

test('hides hints during the timed exam and shows a three-mission result', async ({ page }) => {
  await page.clock.install();
  await page.goto('/#/exam?seed=e2e-exam');
  await expect(page.getByRole('timer')).toContainText('15:00');
  await expect(page.getByRole('button', { name: /hint|indice/i })).toHaveCount(0);
  await page.clock.fastForward('15:00');
  await expect(page.getByRole('heading', { name: /result|résultat/i })).toBeVisible();
  await expect(page.locator('[data-mission-result]')).toHaveCount(3);
});
```

- [ ] **Step 3: Run both tests and verify RED**

```bash
npm test -- tests/unit/exam-state.test.js
npm run test:e2e -- tests/e2e/exam.spec.js --project=desktop
```

Expected: FAIL because exam state and UI do not exist.

- [ ] **Step 4: Implement elapsed-time state without interval drift**

Store `startedAt` and derive `remainingSeconds` from `clock.now()` on every snapshot. The UI may use an interval only to request a rerender; it must not decrement stored seconds. Generate exactly three advanced missions from `${seed}:0`, `${seed}:1`, and `${seed}:2`. Disable hint and correction actions until completion or expiry.

```js
export function createExamState({ seed, clock = Date, durationSeconds = 900, missionCount = 3 }) {
  const startedAt = clock.now();
  const missions = Array.from({ length: missionCount }, (_, index) => generateMission({ seed: `${seed}:${index}`, difficulty: 3 }));
  const results = Array(missionCount).fill(null);
  return {
    missions,
    submit(index, validation) { if (validation.ok && results[index] === null) results[index] = { passed: true, completedAt: clock.now() }; },
    snapshot() {
      const elapsed = Math.floor((clock.now() - startedAt) / 1000);
      const remainingSeconds = Math.max(0, durationSeconds - elapsed);
      const complete = results.every(Boolean);
      return { index: results.findIndex((value) => value === null), remainingSeconds, status: complete ? 'complete' : remainingSeconds === 0 ? 'expired' : 'running', results: [...results] };
    },
  };
}
```

- [ ] **Step 5: Render accessible timer, navigation, and post-exam explanations**

Use `role="timer"` with visible `MM:SS`, announce only the five-minute and one-minute thresholds, and provide no hint buttons while running. After completion or expiry, show three mission statuses, elapsed time, diagnostic summaries, and links back to the specific curriculum stages needing practice. Record only final result and best passed time.

- [ ] **Step 6: Verify and commit**

```bash
npm test -- tests/unit/exam-state.test.js
npm run test:e2e -- tests/e2e/exam.spec.js --project=desktop
npm test
npm run build
git add src/ui/exam.js src/app.js src/storage/progress.js src/i18n/fr.js src/i18n/en.js tests/unit/exam-state.test.js tests/e2e/exam.spec.js
git commit -m "feat: add timed mock evaluation"
```

## Task 14: Accessibility, End-to-End Learning Paths, and Release

**Files:**
- Create: `tests/e2e/accessibility.spec.js`
- Create: `tests/e2e/learning-path.spec.js`
- Create: `README.md`
- Create: `vercel.json`
- Modify: `index.html`
- Modify: `src/styles/base.css`
- Modify: `scripts/public-safety.mjs`

**Interfaces:**
- Consumes: the complete site and every prior public interface.
- Produces: a deployable `dist/`, documented public project, and full verification command.

- [ ] **Step 1: Write failing keyboard, locale persistence, and complete-path tests**

```js
// tests/e2e/accessibility.spec.js
import { expect, test } from '@playwright/test';

test('supports keyboard device selection and visible focus', async ({ page }) => {
  await page.goto('/#/workshops/guided-mission-1?seed=keyboard');
  const firstDevice = page.getByRole('button', { name: /router|routeur/i }).first();
  await firstDevice.focus();
  await expect(firstDevice).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/selected device|appareil sélectionné/i)).toBeVisible();
  const outline = await firstDevice.evaluate((node) => getComputedStyle(node).outlineStyle);
  expect(outline).not.toBe('none');
});

test('keeps language and progress after reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'EN' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
```

```js
// tests/e2e/learning-path.spec.js
import { expect, test } from '@playwright/test';

for (const locale of ['fr', 'en']) {
  test(`opens every curriculum stage in ${locale}`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: locale.toUpperCase() }).click();
    const links = page.locator('[data-workshop-link]');
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(18);
    for (let index = 0; index < count; index += 1) {
      const href = await links.nth(index).getAttribute('href');
      await page.goto(href);
      await expect(page.locator('[data-workshop]')).toBeVisible();
      await expect(page.locator('[data-micro-lesson]')).not.toBeEmpty();
    }
  });
}
```

- [ ] **Step 2: Run release browser tests and verify any missing behavior fails**

```bash
npm run test:e2e -- tests/e2e/accessibility.spec.js tests/e2e/learning-path.spec.js
```

Expected before release fixes: at least one assertion fails if focus, persistence, content reachability, or responsive navigation is incomplete. Fix only the observed gaps and rerun until all projects pass.

- [ ] **Step 3: Add static Vercel configuration and security headers**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    }
  ]
}
```

- [ ] **Step 4: Write the English public README required by the spec**

At the start of this task, ask the user to confirm their exact 42 login; do not infer it from the GitHub remote or Git configuration. Use that confirmed value in the required italicized first line stating that the project was created as part of the 42 curriculum. Include Description, Features, Curriculum, Local Development, Testing, Vercel Deployment, Privacy, Non-affiliation and Licensing, Resources, and AI Usage sections. Explicitly explain TCP/IP addressing, masks, gateways, routers, switches, routing tables, and relevant OSI layers. State that official files are excluded because their license forbids redistribution.

```markdown
## AI usage

AI was used as a learning and development assistant to help structure the curriculum, draft bilingual explanations, review networking edge cases, and design automated tests. Every generated explanation and implementation was reviewed and validated against the project's own tests. No official NetPractice level data was used to generate the exercises.
```

- [ ] **Step 5: Extend the public-safety check to inspect the build output**

Add `listFilesRecursively('dist')` and run `assertPublicPathsSafe` on both tracked paths and emitted paths. Also scan emitted text files for the exact official directory name and subject filename. The scanner reports file names, never file contents.

- [ ] **Step 6: Run the complete fresh release verification**

```bash
npm run check:public
npm test
npm run build
npm run check:public
npm run test:e2e
git status --short
```

Expected: public safety passes before and after build, all unit and browser tests pass in four viewport projects, Vite exits 0, and only intentional source/documentation changes remain.

- [ ] **Step 7: Inspect the built site manually at the four approved viewports**

Use `npm run preview -- --host 127.0.0.1`, open the built site, and verify: no detached links, no clipped controls, no horizontal page overflow, readable French and English text, correct keyboard focus, working device selection, correct timer transition, and no browser console errors.

- [ ] **Step 8: Commit the release-ready site**

```bash
git add README.md vercel.json index.html src/styles/base.css scripts/public-safety.mjs tests/e2e/accessibility.spec.js tests/e2e/learning-path.spec.js
git commit -m "docs: prepare Subnet Notes release"
```

Do not push or deploy until the user has reviewed the local release and explicitly requests the external action.
