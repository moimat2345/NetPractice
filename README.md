*This project was created by matnusko as part of the 42 curriculum.*

# Subnet Notes

## Description

Subnet Notes is an independent, bilingual learning site for practising the IPv4, subnetting, gateway, and routing reasoning used in small-network exercises. It favours short explanations followed immediately by interactive work, precise diagnostics, progressive hints, and a timed mock evaluation.

The application is framework-free, static, and entirely client-side. French and English are available from the same interface.

## Features

- Nineteen original workshops arranged as a practice-first learning path.
- Deterministic exercises that can be reproduced from a seed.
- Immediate bilingual diagnostics and three progressive hint levels.
- Responsive, keyboard-selectable network topologies with device configuration panels.
- A fifteen-minute mock evaluation containing three original advanced missions.
- Local progress, locale, and exam history without an account or backend.

## Curriculum

1. IPv4 addresses: valid notation, octets, and private ranges.
2. Masks and networks: dotted masks, CIDR prefixes, subnet boundaries, and usable hosts.
3. Local communication: direct neighbours and switched segments.
4. Routers and gateways: connected interfaces and reachable next hops.
5. Routing tables: route components, default routes, forward paths, and return paths.
6. Complete missions: guided multi-device networks and a three-mission mock evaluation.

Every workshop follows the same loop: read a micro-lesson, attempt the configuration, use the diagnostic to identify the mistake, reveal a hint only when needed, and retry with a new variation.

## Networking concepts

Subnet Notes focuses on IPv4 inside the TCP/IP model. An IPv4 address identifies an interface; a subnet mask or CIDR prefix separates its network bits from its host bits. From that boundary, the learner calculates the network address, broadcast address, and usable host range.

On a local segment, a switch forwards frames at OSI layer 2 and does not choose an IP route. A router works at OSI layer 3: each of its interfaces belongs to a connected IP network, and it forwards packets between networks. A host's default gateway must be a directly reachable router interface. Routing tables associate destination prefixes with next hops; a successful exchange requires both a forward path and a return path.

## Local Development

Requirements: a current Node.js release and npm.

```bash
npm ci
npx playwright install chromium
npm run dev
```

Vite prints the local URL. The site requires no environment variables, secrets, database, or server functions.

## Testing

```bash
npm run check:public
npm test
npm run build
npm run test:e2e
```

`npm run check:public` checks tracked public paths, executable asset references, and any existing `dist/` output. Unit tests cover networking calculations, generators, validators, translations, persistence, and exam state. Playwright exercises the complete learning path at ultra-wide, desktop, portrait, and mobile viewports.

## Vercel Deployment

The repository includes [`vercel.json`](./vercel.json) with the build command, static output directory, and baseline security headers. To deploy it:

1. Import the repository into a new Vercel project.
2. Keep the detected build command as `npm run build`.
3. Keep the output directory as `dist`.
4. deploy without adding environment variables.

Run the full test sequence locally before publishing. No deployment is performed automatically by this repository.

## Privacy

The application has no accounts, analytics, advertising, remote database, or learner-answer transmission. It stores only the selected language, completed workshops, hint usage, scores, resumable seeds, exam history, and best exam time in the browser's `localStorage`. Clearing site data removes that local progress.

## Non-affiliation and Licensing

Subnet Notes is an unofficial community resource and is not affiliated with, endorsed by, or maintained by 42.

The official NetPractice simulator directory, subject PDF, and level data are deliberately excluded because their license forbids redistribution. No official content was used to generate the lessons, exercises, diagrams, fixtures, or solutions shipped here; all published learning material and network configurations are original.

This repository currently contains no standalone `LICENSE` file. Do not assume that the source code is open source: review the repository's licensing status and obtain any required permission before copying, modifying, or redistributing it.

## Resources

- [RFC 791 — Internet Protocol](https://www.rfc-editor.org/rfc/rfc791.html)
- [RFC 1918 — Address Allocation for Private Internets](https://www.rfc-editor.org/info/rfc1918/)
- [RFC 4632 — Classless Inter-domain Routing](https://www.rfc-editor.org/info/rfc4632/)
- [Vercel project configuration reference](https://vercel.com/docs/project-configuration/vercel-json)

## AI Usage

AI was used as a learning and development assistant to help structure the curriculum, draft bilingual explanations, review networking edge cases, and design automated tests. Every generated explanation and implementation was reviewed and validated against the project's own tests. No official NetPractice level data was used to generate the exercises.
