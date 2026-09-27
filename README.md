# Teaching Assistant

A React and Firebase app for planning academic terms, ordered teaching weeks,
lesson plans, curriculum alignment, teaching steps, resources, and assessments.
The curriculum UI targets Beacon's audited curriculum data; that source data is
not included in this repository.

## Run locally

Requirements: Node.js 20 or newer and Corepack/pnpm 12.6.0 (pinned in
`package.json`).

1. Copy `.env.example` to `.env` and fill in the six Firebase web app values.
2. In Firebase Authentication, enable Email/Password sign-in. Create Firestore
   and Firebase Storage in the same Firebase project.
3. Install and start the app:

   ```sh
   corepack pnpm install --frozen-lockfile
   corepack pnpm dev
   ```

4. Deploy Firestore rules/indexes and Storage rules:

   ```sh
   corepack pnpm exec firebase deploy --only firestore:rules,firestore:indexes,storage
   ```

   Authenticated attachment downloads use the Storage SDK and need bucket CORS.
   Apply `storage.cors.json` to the bucket (replace the wildcard origin with your
   app's local/deployed origins when practical):

   ```sh
   gcloud storage buckets update gs://YOUR_STORAGE_BUCKET --cors-file=storage.cors.json
   ```

The Firebase web config is public client configuration. Never place service
account credentials or Admin SDK keys in `.env` or the browser bundle.

## Checks

```sh
corepack pnpm test                 # pure validation/importer/generator tests
corepack pnpm test:rules           # Firestore + Storage Emulator rule tests
corepack pnpm typecheck
corepack pnpm build
```

The emulator tests start Firestore and Storage emulators on ports 8080 and 9199.
Firebase CLI is a dev dependency; Java 21 is required locally to run the emulators
(CI installs it automatically). The GitHub CI workflow runs the test suites and
production build.

## Curriculum import

Put Beacon's approved JSON under `data/curriculum/`, then validate before
writing anything:

```sh
corepack pnpm import:curriculum -- --source data/curriculum --workspace WORKSPACE_ID --dry-run
```

For a live import, provide Firebase Application Default Credentials with
Firestore write access, plus the project ID:

```sh
corepack pnpm import:curriculum -- --source data/curriculum --workspace WORKSPACE_ID --project FIREBASE_PROJECT_ID
```

The importer normalizes documented camelCase/snake_case field variants,
validates parent links, dates and duplicates, uses deterministic IDs, preserves
source/audit provenance, and performs idempotent parent-first upserts. See
[firebase-data-model.md](firebase-data-model.md) for the input hierarchy and
collection model. No Beacon curriculum data is provided here. `tests/fixtures/curriculum-example.json`
is synthetic test data only; do not import it into a live workspace.

## Current application foundation

- Email/password sign-up and sign-in, with a personal workspace created on
  first sign-in.
- Two appearances — Warm Light (default) and Slate Dark — chosen from a switch in
  the topbar (and on the sign-in screen), remembered per browser, on a shared
  palette token scale with a contrast and minimum-type floor.
- Workspace-scoped terms, weeks and lessons, including date checks, reserved
  week numbers, reordering, archiving and restoration.
- Dropdown-based lesson setup: the new-lesson dialog picks the term and week from
  dropdowns, and the lesson workspace sets status, lesson length and planned date.
- Lesson details with curriculum links, objectives, teaching steps, assessments,
  notes/links and private file attachments.
- A transparent, local template-based lesson-plan starter (no LLM/API call).
- Curriculum hierarchy browser and lesson indicator picker.
- Membership-based Firestore and Storage rules plus emulator tests.

The current interface is for one personal workspace. Invites, role management,
workspace switching and a curriculum admin UI need trusted server-side code and
are intentionally not presented as available controls. Full-text search needs a
search index or external service; lesson search currently matches titles loaded
for the selected term.

## Appearance

The switch in the topbar toggles between the original warm editorial palette
("Warm Light") and the dense dark palette ("Slate Dark"). Warm Light is the
default; the choice is written to `localStorage` under
`teaching-assistant.theme` and re-applied by a small inline script in
`index.html` before first paint, so reloads and new tabs keep the same
appearance without flashing the other palette. `src/lib/theme.ts` holds the
parsing, persistence and `<html class="theme-dense">` application; the palettes
themselves live in `src/styles.css`. The dark palette also declares
`color-scheme: dark` so native controls and scrollbars match.

### Palette tokens

Both appearances are driven by the same token names. Warm Light values sit in
`:root` and Slate Dark overrides them in `.theme-dense`, so a colour is changed
once instead of per palette:

- text: `--ink`, `--ink-soft`, `--muted`, `--faint`, `--olive-ink`, `--teal-ink`,
  `--danger`, `--field-ink`, `--placeholder`
- surfaces and lines: `--paper`, `--surface`, `--surface-raised`,
  `--surface-sunken`, `--field-bg`, `--tint`, `--tint-strong`, `--active`,
  `--hover`, `--tan`, `--line`, `--line-soft`, `--line-strong`
- accents and type: `--olive`, `--text-micro` (10px), `--text-small` (11px)

The mid-tier greys were re-tuned when Warm Light became the default appearance:
the previous `--muted`/caption greys measured between 2.3:1 and 3.2:1 against
their backgrounds at 8px, which is unreadable on a projector or an older laptop.
Every text token now clears 4.5:1 (WCAG AA) on the surfaces it is used on, the
smallest type in the app is 10px, and `tests/palette.test.ts` fails the build if
either palette drifts below those levels or the two palettes stop defining the
same token names. Illustration, brand and small tint chips deliberately keep
one-off literals.

## Lesson setup

`Add a lesson to this week` opens a dialog that selects the term and week from
dropdowns (pre-filled with the week you clicked) and shows the dated weeks of
whichever term is chosen. Firestore rules keep `weekId` fixed for the life of a
lesson document, so the placement is chosen at creation; the lesson workspace
then shows that placement and sets status, lesson length (preset durations plus a
custom value) and the planned date. Lesson length feeds the lesson-plan starter,
which splits the total minutes across the six teaching phases.

## Accessibility

- Dialogs are real dialogs: `src/components/Modal.tsx` sets
  `role="dialog"`/`aria-modal`, labels the dialog with its heading, closes on
  Escape or a backdrop click, keeps Tab inside while open, locks page scroll and
  returns focus to the control that opened it.
- The sidebar marks the current view with `aria-current="page"`, and icon-only
  controls (help, sign out, archive, close) carry `aria-label`s instead of relying
  on an icon or a `title` tooltip.
- A "Skip to content" link is the first focusable element and jumps to the main
  landmark.
- Keyboard focus is always visible (`:focus-visible`), while fields keep their
  existing focus ring instead of doubling up.
- `prefers-reduced-motion: reduce` removes transitions and animations; the
  loading ring keeps turning because it conveys progress rather than decoration.
- Type never renders below 10px and every text token clears 4.5:1 contrast, both
  enforced by `tests/palette.test.ts`.

## Security and data handling

Workspace membership documents define read access. Owners/admins/editors can
write; viewers are read-only. Initial workspace and owner membership records are
created atomically. Invites and role changes must use trusted server code.
Uploaded files live in Firebase Storage under workspace/lesson paths; Firestore
stores their path and metadata. Storage rules restrict file type, size and
workspace access. See `firebase-data-model.md` for constraints and importer
credentials guidance.

## Project files

- `src/App.tsx` — auth boundary and term/week planning UI.
- `src/components/` — curriculum browser/picker, lesson workspace, assessment
  builder, lesson-plan starter, appearance switch, lesson setup dialog and the
  shared modal/navigation controls.
- `src/lib/theme.ts` — appearance preference: parsing, persistence and applying it
  to the document.
- `src/lib/lessonSetup.ts` — duration presets/custom parsing and week selection for
  the dropdown-based lesson setup.
- `src/lib/` — Firebase access, planning data operations and validation.
- `src/types/models.ts` — Firestore record types.
- `scripts/` — audited curriculum normalizer/importer.
- `tests/` — validation, lesson setup, appearance, palette, dialog/navigation
  accessibility and Firestore/Storage rules tests.
- `firebase/firestore.rules` and `firebase/storage.rules` — access controls.
- `firebase/firestore.indexes.json` — composite query indexes.
- `.github/workflows/ci.yml` — build and test workflow.
