# Teaching Assistant

A React and Firebase application for planning academic terms, ordered teaching
weeks, and lesson plans. The curriculum library is designed to import Beacon's
audited curriculum records in a later step.

## Run locally

1. Install Node.js 20 or newer and pnpm.
2. Copy `.env.example` to `.env` and set the six Firebase web app values.
3. In Firebase Authentication, enable Email/Password sign-in. Create a
   Firestore database in the same Firebase project.
4. Install and start the app:

   ```sh
   pnpm install
   pnpm dev
   ```

5. Deploy Firestore rules and indexes before signing up:

   ```sh
   firebase deploy --only firestore:rules,firestore:indexes
   ```

The Firebase web config is public client configuration. Never put service
account credentials or Admin SDK keys in `.env` or the browser bundle.

## Current application foundation

- Email/password sign-up and sign-in.
- Automatic personal workspace creation on first sign-in.
- Workspace-scoped academic terms, weeks, and draft lessons stored in
  Firestore.
- Lesson status changes and archive action.
- Firestore rules and indexes for the current workspace and planning queries.
- Typed document shapes in `src/types/models.ts`.

The curriculum navigation and models are scaffolded, but the curriculum manager,
Beacon data importer, lesson materials, upload UI, term/week editing and
reordering are follow-up implementation work. Full-text search needs a search
index or external search service; the current finder matches lesson titles
already loaded for the selected term.

## Data and access model

Every educator has a workspace. Plans and curriculum data live under
`workspaces/{workspaceId}`. Workspace membership documents determine read and
write access. The initial workspace and owner membership are created together
in one Firestore batch; later invites and role changes require trusted
server-side code. See [firebase-data-model.md](firebase-data-model.md) for the
collection layout and field descriptions.

Date-only fields use `YYYY-MM-DD` strings. Creation and update timestamps are
Firestore timestamps. Uploaded files belong in Firebase Storage; Firestore
documents should contain only the Storage object path and metadata.

## Project files

- `src/App.tsx` — authentication boundary and planning interface.
- `src/lib/` — Firebase initialization and workspace/planning operations.
- `src/types/models.ts` — Firestore document type definitions.
- `firebase/firestore.rules` — workspace membership and role access.
- `firebase/firestore.indexes.json` — composite query indexes.
- `firebase.json` — Firebase CLI configuration.

## Deployment

Vite can be deployed to Vercel or another static frontend host. Set the six
`VITE_FIREBASE_*` values in the host's build environment. Deploy Firestore rules
and indexes with the Firebase CLI from this repository. Configure Firebase
Authentication's authorized domains for the local and deployed app domains.
