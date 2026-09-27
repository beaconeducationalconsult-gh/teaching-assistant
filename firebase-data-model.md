# Firestore and Storage data model

All teacher plans and the current curriculum copy are workspace-scoped. The app
keeps the relational hierarchy explicit in Firestore paths and repeats parent
IDs on curriculum records so they can be filtered by a hierarchy level.

```text
users/{uid}
workspaces/{workspaceId}
  members/{uid}
  curriculumFrameworks/{frameworkId}
  curriculumLevels/{levelId}
  curriculumSubjects/{subjectId}
  curriculumStrands/{strandId}
  curriculumSubStrands/{subStrandId}
  curriculumContentStandards/{standardId}
  curriculumIndicators/{indicatorId}
  terms/{termId}
    weekNumberLocks/{number}
    weeks/{weekId}
      lessons/{lessonId}
        indicatorLinks/{linkId}
        resources/{resourceId}
        diagrams/{diagramId}
        teachingSteps/{stepId}
        assessments/{assessmentId}
          items/{itemId}
```

Uploaded files are stored separately in Firebase Storage:

```text
workspaces/{workspaceId}/lessons/{lessonId}/resources/{resourceId}/{fileName}
```

A Firestore resource document stores only the Storage path and file metadata;
the client downloads through the authenticated Storage SDK rather than saving
a public download URL.

## Document fields

Every Firestore document has `createdAt` and `updatedAt` timestamps. Archivable
documents have `archivedAt` (`null` while active). Date-only values use valid
`YYYY-MM-DD` strings. Optional dates are stored as `null`, not omitted.

| Record | Important fields |
|---|---|
| User profile | `displayName`, `email`, `activeWorkspaceId` |
| Workspace | `name`, `ownerUid`, `archivedAt` |
| Membership | `uid`, `role` (`owner`, `admin`, `editor`, `viewer`) |
| Framework | `name`, `jurisdiction`, `version`, `effectiveFrom`, `effectiveTo`, `archivedAt`, source provenance |
| Level | `frameworkId`, `code`, `name`, `sortOrder`, source provenance |
| Subject | `frameworkId`, `name`, `code`, `description`, `archivedAt`, source provenance |
| Strand | `frameworkId`, `levelId`, `subjectId`, `code`, `name`, `description`, `sortOrder` |
| Sub-strand | `frameworkId`, `levelId`, `subjectId`, `strandId`, `code`, `name`, `description`, `sortOrder` |
| Content standard | ancestor IDs, `code`, `description`, `sortOrder` |
| Indicator | ancestor IDs, `code`, derived `fullCode`, `description`, `sortOrder`, `archivedAt` |
| Term | `name`, `academicYear`, `startDate`, `endDate`, `archivedAt` |
| Week-number lock | `number`, `weekId`; a transaction reserves each week number once per term |
| Week | `termId`, `number`, `title`, dates, `sortOrder`, `archivedAt` |
| Lesson | `weekId`, `title`, `summary`, `objectives`, `plannedDate`, `durationMinutes`, `status`, `sortOrder`, `archivedAt` |
| Lesson indicator link | canonical `indicatorId`, `fullCode`, `description`, `subjectId`, `subjectName`, `levelId`, `sortOrder` |
| Resource | `title`, `type`, `url`, `storagePath`, `notes`, `sortOrder`, `archivedAt` |
| Teaching step | `lessonId`, `title`, `phase`, `instructions`, `minutes`, `sortOrder`, `archivedAt` |
| Assessment | `lessonId`, `title`, `type`, `instructions`, `markingNotes`, `plannedDate`, `sortOrder`, `archivedAt` |
| Assessment item | `assessmentId`, `type`, `prompt`, `marks`, `options`, `answer`, `markingGuide`, `indicatorId`, `sortOrder`, `archivedAt` |

Curriculum imports also retain `sourceFile`, `sourceRecordId`, `sourceFiles`,
`sourceRecordIds`, and `auditReference` where available. The importer preserves
`createdAt` for existing records and updates `updatedAt` on each import.

## Curriculum import

Beacon's audited curriculum JSON is not bundled with this repository. Place the
approved source JSON under `data/curriculum/` (or pass another file/directory to
the CLI). The importer accepts a framework hierarchy with levels, subjects,
strands, sub-strands, content standards, and indicators. A minimal illustrative
shape is:

```json
{
  "frameworks": [{
    "name": "Framework name",
    "jurisdiction": "Ghana",
    "version": "source version",
    "levels": [{ "code": "JHS1", "name": "Junior High School 1" }],
    "subjects": [{ "code": "SCI", "name": "Science", "description": "" }],
    "strands": [{
      "levelCode": "JHS1", "subjectCode": "SCI",
      "code": "S1", "name": "Strand name",
      "subStrands": [{
        "code": "SS1", "name": "Sub-strand name",
        "contentStandards": [{
          "code": "B7.1.1", "description": "Standard statement",
          "indicators": [{ "code": "B7.1.1.1", "description": "Indicator text" }]
        }]
      }]
    }]
  }]
}
```

This is a shape example, not audited curriculum content. The importer also
recognizes common snake_case/camelCase variants such as
`sub_strands`/`subStrands`, `content_standards`/`contentStandards`, and
`learning_indicators`/`learningIndicators`; references on strands must resolve
to a level and subject in the same framework. Unknown references, invalid dates,
conflicting records, and duplicate identities fail validation rather than
creating orphaned records. Source `fullCode` values are preserved; if absent, the
importer joins the level, subject, strand, sub-strand, standard, and indicator
codes with periods. Verify that derivation against Beacon's audited code format
before a live import.

Preview and validate first:

```sh
pnpm import:curriculum -- --source data/curriculum --workspace WORKSPACE_ID --dry-run
```

Then import to a real project using Application Default Credentials (for
example, a locally authenticated Google Cloud CLI or a service account provided
outside the repository):

```sh
pnpm import:curriculum -- --source data/curriculum --workspace WORKSPACE_ID --project FIREBASE_PROJECT_ID
```

The importer uses deterministic IDs and parent-first upserts, so re-running it
updates the same records instead of creating duplicates. It merges duplicate
records from source files only when their substantive fields match. Service
account credentials must never be committed or placed in the Vite `.env` file.

**Current MVP choice:** keep curriculum copies workspace-scoped. This preserves
the existing membership boundary and lets a workspace archive or extend its
copy independently. The importer is therefore run once per workspace. Before a
large multi-school rollout, measure the storage/import duplication and consider
a central read-only Beacon catalog with workspace-local teacher extensions.

## Validation and access

Application validation checks actual calendar dates, start/end order, week
containment within term dates, and overlaps between fully dated weeks. Unknown
week boundaries are intentionally not treated as definite overlaps. Week
numbers are reserved transactionally so concurrent app sessions cannot create
the same number; existing legacy weeks are checked before a new reservation.
The Firestore rules additionally validate the shape and types of planning,
lesson, curriculum, and assessment records, preserve immutable parent IDs and
creation timestamps, deny client hard-deletes, and enforce workspace membership
and editor roles. Rules cannot enforce every cross-document constraint, so
the application remains responsible for date relationships and the importer
validates curriculum parent references.

Initial workspace, owner membership, and user profile creation happen in one
batch. Users cannot add themselves to an existing workspace. Invites and role
changes must be implemented by trusted server-side code before collaboration is
enabled in the UI. The current interface is deliberately labeled as a personal
workspace rather than presenting a non-functional workspace switcher.

Storage rules allow authenticated workspace members to read lesson attachments
and owners/admins/editors to upload or remove approved file types up to 10 MB.
Authenticated SDK downloads also require the bucket CORS policy in
`storage.cors.json`; narrow the wildcard origin to the deployed app origins when
possible. CORS is not an authorization mechanism—the Firebase Storage rules
remain responsible for access checks. Full-text search is not provided by
Firestore; the existing lesson finder only filters titles already loaded for the
selected term.

## Indexes and archival

Composite indexes in `firebase/firestore.indexes.json` support active term, week,
lesson, and curriculum queries. Add indexes when query shapes change and deploy
them with the Firestore rules. Client hard-deletes are denied; records are
archived so their children and lesson links remain available. Archived terms
and weeks are restorable from the planning view. Week number reservations remain
in place after archive so historical numbers cannot be silently reused. Any
permanent data removal should use a trusted, explicitly reviewed Admin workflow.
