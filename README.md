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
- Workspace-scoped terms, weeks and lessons, including date checks, reserved
  week numbers, reordering, archiving and restoration.
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
  builder and lesson-plan starter.
- `src/lib/` — Firebase access, planning data operations and validation.
- `src/types/models.ts` — Firestore record types.
- `scripts/` — audited curriculum normalizer/importer.
- `tests/` — validation and Firestore/Storage rules tests.
- `firebase/firestore.rules` and `firebase/storage.rules` — access controls.
- `firebase/firestore.indexes.json` — composite query indexes.
- `.github/workflows/ci.yml` — build and test workflow.
