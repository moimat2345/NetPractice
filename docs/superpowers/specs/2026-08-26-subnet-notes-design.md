# Subnet Notes - Design Specification

## 1. Purpose

Subnet Notes is a public, bilingual learning website for students preparing for the networking concepts assessed by 42's NetPractice project. It teaches through short explanations followed immediately by interactive practice, progressive hints, precise error feedback, and timed mock evaluations.

The site is an independent community resource. It is not affiliated with 42 and must not reproduce the official simulator, subject, level configurations, source code, artwork, or solutions.

## 2. Goals

- Rebuild the learner's IPv4 and subnetting knowledge through practice rather than long-form reading.
- Teach a repeatable method for diagnosing and configuring small networks.
- Progress from focused drills to multi-device topologies resembling the complexity of an evaluation without copying official exercises.
- Provide complete French and English content from the first public release.
- Run as a static site that can be deployed to Vercel with minimal configuration.
- Remain useful as a public GitHub resource for other NetPractice learners.

## 3. Non-goals

- Reproducing or embedding the official NetPractice simulator.
- Publishing the subject PDF or any official assets.
- Providing login-specific or level-by-level official answers.
- Requiring accounts, a backend, analytics, advertising, or cloud storage.
- Teaching networking beyond the concepts needed for small IPv4 networks and this style of evaluation.

## 4. Legal and Repository Boundaries

The local `net_practice/` directory contains a license that prohibits duplication, modification, public use, and open-source redistribution. The public repository and Vercel deployment must therefore exclude:

- `net_practice/`
- `en.subject _netpractice.pdf`
- temporary PDF renders and analysis files under `tmp/`
- brainstorming artifacts under `.superpowers/`
- operating-system files such as `.DS_Store`

The final project will include a `.gitignore` and a deployment exclusion check so these files cannot be published accidentally. All lessons, diagrams, generators, configurations, names, addresses, and artwork shipped by Subnet Notes will be original.

## 5. Audience and Learning Model

The primary learner remembers little subnetting theory and learns best by trying, observing failures, and correcting them. Every workshop therefore follows the same loop:

1. Present a micro-lesson of a few lines.
2. Ask the learner to manipulate a network value or topology.
3. Validate the attempt immediately.
4. Explain the exact cause of an incorrect result.
5. Offer up to three progressively stronger hints.
6. Show a reasoned correction only when requested.
7. Generate a fresh variation for another attempt.

Long passive chapters are deliberately avoided. Explanations appear immediately before or in response to an action.

## 6. Curriculum

The curriculum has six stages:

1. **IPv4 addresses** - octets, valid values, host identity, private ranges, and binary only where it supports a calculation.
2. **Masks and networks** - dotted masks, CIDR, network address, broadcast address, usable host range, block size, and forbidden host addresses.
3. **Local communication** - deciding whether two interfaces are neighbors and understanding the role of a switch.
4. **Routers and gateways** - router interfaces, directly connected networks, valid gateways, and packet forwarding.
5. **Routing tables** - route destination, prefix, next hop, default route, first matching route, and return paths.
6. **Complete missions and mock evaluations** - original multi-device networks followed by three advanced missions in 15 minutes.

The site may indicate that a learner is ready to attempt an official training level, but it must not reveal or recreate that level's solution.

## 7. Product Structure

The site is a static HTML, CSS, and JavaScript application with no frontend framework and no runtime backend. The proposed source structure is:

```text
index.html
assets/
  icons/
  styles/
    base.css
    components.css
    responsive.css
js/
  app.js
  router.js
  storage.js
  i18n.js
  network/
    ipv4.js
    subnet.js
    routing.js
  exercises/
    generators.js
    validators.js
    hints.js
    curriculum.js
content/
  fr.js
  en.js
tests/
README.md
vercel.json
```

The exact file split may be refined during implementation, but networking calculations, exercise generation, validation, hints, translations, UI rendering, and persistence must remain independently understandable and testable.

## 8. Visual Design

The approved visual direction is **Subnet Notes**, a calm notebook-like interface:

- warm paper and off-white surfaces;
- dark ink text;
- restrained terracotta accents for actions and editable values;
- sage green for network links;
- serif headings and readable system sans-serif text for controls;
- compact configuration panels rather than a sprawling simulation canvas.

The global header contains the Subnet Notes wordmark, saved-progress status, and a small `FR | EN` language toggle. Desktop layouts include a curriculum sidebar. The selected language and progress persist locally.

### Advanced topology layout

Advanced workshops use a compact topology overview followed by the configuration of the selected device:

1. The learner sees the whole network at once.
2. Clicking a host, switch, router, or Internet node selects it.
3. Its interfaces, masks, gateway, and routes appear in structured panels below the diagram.
4. Editable fields use the terracotta accent; fixed values remain visually neutral clues.

This retains the density of an advanced networking problem without scattering small forms across an oversized canvas.

### Responsive behavior

The diagram and its links share one bounded coordinate system. The topology has a maximum working width of 900 px and is centered on wider displays, preventing links from drifting away from nodes on ultra-wide screens.

At narrower desktop and portrait widths, the curriculum sidebar disappears before it compresses the topology. The diagram uses the recovered width. At phone widths, the topology becomes an ordered vertical device list and hides the desktop SVG links rather than shrinking labels beyond readability. Configuration panels stack into one column.

The validated design targets at least:

- 2560 x 1000 ultra-wide desktop;
- 1440 x 1000 standard desktop;
- 1024 x 1366 portrait display;
- 360 px mobile width.

## 9. Exercise System

### Exercise types

- **Focused drills:** one concept, a small number of fields, and quick repetition.
- **Guided missions:** several devices and concepts, with hints and diagnostic feedback.
- **Mock evaluations:** three advanced original missions, a 15-minute timer, and no hints while the timer is active.

Every generated exercise uses a seed so a failed configuration can be reproduced for debugging. A new attempt may request a new seed.

### Originality constraints

Generators may use the same general networking concepts and device categories as the evaluation, but must use original topologies, device names, objectives, address patterns, editable-field combinations, and route layouts. No generator fixture may be copied from an official level file.

### Validation

The validation engine uses pure networking functions and reports specific errors, including:

- malformed or out-of-range IPv4 address;
- invalid or non-contiguous subnet mask;
- network or broadcast address used as a host;
- endpoints assigned to different local networks;
- gateway outside the sender's directly connected networks;
- missing or invalid default route;
- route destination that does not cover the intended target;
- next hop that is not directly reachable;
- absent return path;
- overlapping or contradictory generated subnets.

The learner receives a plain-language explanation in the active language. Feedback must describe the cause and the next reasoning step, not merely mark a field red.

### Progressive hints

Each exercise provides three hint levels:

1. **Observation:** points to the device, segment, or field family that deserves attention.
2. **Method:** names the calculation or packet-tracing step to perform.
3. **Near-solution:** performs most of the reasoning while leaving the learner one meaningful step.

The final correction traces the reasoning and packet path. It is not just a list of completed values.

## 10. Internationalization

French and English are complete first-release languages. UI labels, lessons, feedback, hints, exercise objectives, accessibility labels, and README usage examples must be translatable.

Networking data stays language-neutral. Content uses stable translation keys rather than duplicated validation logic. The language toggle updates the visible page without losing the current exercise and saves the preference in `localStorage`.

## 11. Persistence and Privacy

The browser stores only local learning state:

- selected language;
- completed workshops;
- hint usage;
- recent scores and best mock-evaluation time;
- current exercise seed when resuming is useful.

There is no account, cookie banner, remote database, analytics service, or transmission of learner answers.

Storage reads must tolerate missing, malformed, or older-version values. In those cases the site falls back to safe defaults without blocking access to lessons.

## 12. Accessibility

- All controls use semantic buttons, inputs, labels, and native keyboard order.
- Device selection works with keyboard and pointer input.
- Color is never the only signifier for editable fields, success, or failure.
- Dynamic validation uses an appropriate polite live region; blocking errors use an alert.
- Text and controls remain readable at 200% zoom and down to 360 px width.
- Motion is minimal and honors reduced-motion preferences.

## 13. Testing and Quality

Automated tests cover the pure networking and exercise modules:

- IPv4 parsing and formatting;
- CIDR and dotted-mask conversion;
- network, broadcast, usable range, and block-size boundaries;
- host-address validity;
- local-network membership;
- gateway reachability;
- route matching and default routes;
- forward and return packet paths;
- exercise-generator invariants across many seeds;
- French and English key completeness;
- persistence migration and corrupted-value fallback.

Browser-level tests cover the critical learning loop, language switching, hint progression, progress restoration, mock-exam timing, keyboard navigation, and topology responsiveness.

Responsive topology tests assert that link endpoints intersect their intended device bounds at the target desktop viewports. Phone tests assert the alternate stacked representation and absence of horizontal page overflow.

## 14. Deployment and Documentation

The root page and assets deploy as a static Vercel project. The deployment requires no secrets or server functions. A small `vercel.json` may define clean URLs, caching for hashed static assets, and security headers if needed.

The public English README includes:

- project purpose and non-affiliation notice;
- local development and test commands;
- Vercel deployment instructions;
- feature and curriculum summary;
- studied concepts: TCP/IP addressing, subnet masks, default gateways, routers, switches, routing tables, and relevant OSI layers;
- resources used;
- an honest description of how AI assisted with design, bilingual drafting, implementation support, and testing;
- a warning that official NetPractice files are intentionally excluded due to their license.

## 15. Acceptance Criteria

The first release is acceptable when:

1. A new learner can complete the six-stage path in French or English.
2. Every lesson contains an interactive action and progressive hints.
3. Generated exercises are valid, reproducible by seed, and independent of official level data.
4. Validation explains networking mistakes precisely in both languages.
5. Advanced missions include multiple hosts, switches, routers, routes, and Internet connectivity.
6. The 3-mission, 15-minute mock evaluation functions without external tools.
7. Progress and language survive a reload without a backend.
8. The approved responsive topology remains connected and readable at the target viewports.
9. Automated networking, generator, internationalization, persistence, and browser tests pass.
10. Vercel serves the static site successfully and the public repository contains no official NetPractice files or temporary design artifacts.
