# NetPractice audit corrections

The user approved implementing the audit on 2026-09-17. Scope: the sixteen corrections and usability improvements; additional learning modules remain future work. Preserve the existing visual palette, bilingual curriculum, local-only data and exam answer secrecy. After reviewing the implementation, the user requested merging all changes into main and pushing to origin.

## Work and ownership

1. Pedagogy: correct gateway explanation context, human-readable field names and actionable diagnostics. Agent `pedagogy` owns feedback.js, exercise-labels.js, practice translations and focused unit tests.
2. Session continuity: bounded local attempt store; restore exam deadline, entries, mission/check state; preserve final results. Agent `exam_resume` owns attempts.js, exam.js and focused tests. Root integrates store callbacks in app.js and workshop.js.
3. Topology: eliminate collisions/clipping based on container width and expose mobile neighbor relations. Agent `topology` owns topology.js, topology.css and topology tests. Root imports CSS after components.css.
4. Root: clear stale workshop validation on editing; save/restore workshop drafts; put variant seed in URL; compact collapsible lessons and workspace; explicit communication goals; friendly configuration labels; mobile curriculum with workshop navigation; workshop-level progress; sticky exam context and preflight if compatible with session state.
5. Integrate and run all unit/public/build/Playwright checks, then inspect real desktop/tablet/mobile pages and reproduce the original bugs. Adapt assertions only where the intended UI contract changes.

## Acceptance

- Gateway explanations refer to the local subnet, not the default route destination.
- Editing a checked answer clears the old verdict and permits checking again.
- Reloading an atelier restores its seed, entries, hints and selected device.
- Reloading or revisiting an exam does not give a new timer or discard answers; expired sessions stay expired.
- Every mobile device exposes its links; dense diagrams have no overlapping or clipped devices.
- Exercise action area is near the objective and configuration; lecture is optional/reopenable.
- Users can switch chapters and workshops on a narrow screen; labels and progress describe workshops.
- The visible goals state requested source/destination pairs without answers.
- Variants have shareable URLs that regenerate the same exercise.
- English/French and keyboard focus continue to work; no silent storage or network dependency introduced.

## Progress

- Audit baseline verified: 160 unit tests; 58 selected E2E passed, 22 skipped; build passed; clean main at 3008fbf.
- Created branch codex/netpractice-audit-fixes.
- All sixteen corrections integrated. Extra learning modules remain deferred.
- User clarified desktop is the primary target; layout was then refined for 1440×900 and 1366×768 laptop screens. Mobile retains working navigation and readable neighbor cards.
- Regressions observed before fixes: wrong gateway context, stale workshop success, missing drafts, timer reset, variant URL mismatch, navigation losing a selected variant, graph overlap and laptop controls covering the first input.
- Final validation: 194 unit tests passed (15 files); 138 Playwright checks passed across four viewport projects, 82 intentionally skipped for other viewport targets. Public-tree check, production build, emitted-output check and git diff --check passed.
- Final laptop measurements at 1366×768: graph ends at754px, first editable field ends at637px, action bar starts at680px; no horizontal page overflow. Browser console had no errors during the final visual check.
- The existing explicit exam-launch action is retained; no additional preflight screen was added. The timer is sticky and resumes its original deadline.
- Integration requested: commit the verified changes, merge codex/netpractice-audit-fixes into main, push main to origin and verify synchronization. No separate manual deployment requested.
