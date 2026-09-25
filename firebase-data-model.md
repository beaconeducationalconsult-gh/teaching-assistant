# Firestore data model

The Firestore model preserves Klazrum's workspace ownership boundary and the
planning timeline while adapting relational rows to document storage.

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
    weeks/{weekId}
      lessons/{lessonId}
        indicatorLinks/{linkId}
        resources/{resourceId}
        diagrams/{diagramId}
        assessments/{assessmentId}
```

Workspace-scoped paths make the access boundary explicit in Firestore rules.
Curriculum records use separate collections under the workspace so they can be
queried by their parent IDs. Children store those parent IDs and useful ancestor
IDs for filtering.

## Fields

Documents have `createdAt` and `updatedAt` timestamps. Archivable records have
`archivedAt` (`null` while active). Date-only values use `YYYY-MM-DD` strings.

| Record | Fields |
|---|---|
| User profile | `displayName`, `email`, `activeWorkspaceId` |
| Workspace | `name`, `ownerUid`, `archivedAt` |
| Membership | `uid`, `role` (`owner`, `admin`, `editor`, `viewer`) |
| Framework | `name`, `jurisdiction`, `version`, `effectiveFrom`, `effectiveTo`, `archivedAt` |
| Level | `frameworkId`, `code`, `name`, `sortOrder` |
| Subject | `frameworkId`, `name`, `code`, `description`, `archivedAt` |
| Strand | `frameworkId`, `levelId`, `subjectId`, `code`, `name`, `description` |
| Sub-strand | `frameworkId`, `levelId`, `subjectId`, `strandId`, `code`, `name`, `description` |
| Content standard | `frameworkId`, `levelId`, `subjectId`, `strandId`, `subStrandId`, `code`, `description` |
| Indicator | ancestor IDs, `code`, derived `fullCode`, `description`, `archivedAt` |
| Term | `name`, `academicYear`, `startDate`, `endDate`, `archivedAt` |
| Week | `termId`, `number`, `title`, `startDate`, `endDate`, `sortOrder`, `archivedAt` |
| Lesson | `weekId`, `title`, `summary`, `objectives`, `plannedDate`, `durationMinutes`, `status`, `sortOrder`, `archivedAt` |
| Lesson indicator link | `indicatorId`, `fullCode`, `subjectId`, `subjectName`, `levelId`, `sortOrder` |
| Resource | `title`, `type`, `url`, `storagePath`, `notes` |
| Diagram | `title`, `storagePath`, `caption`, `altText` |
| Assessment | `title`, `type`, `instructions`, `markingNotes`, `plannedDate` |

Indicator links are many-to-many references. Store the canonical indicator ID
and parent relationships, then snapshot code and subject labels for efficient
lesson rendering. Show every linked subject rather than implying one primary
subject. Store uploads in Firebase Storage, with only their Storage paths and
metadata in Firestore.

## Firestore behavior and limitations

The rules enforce authentication, membership, role-based writes, and workspace
path isolation. A person creates their initial workspace and owner membership
atomically; they cannot add themselves to an existing workspace. Invites and
role changes should use a trusted Admin SDK service.

Rules cannot enforce relational foreign keys, cascades, every uniqueness
constraint, or cross-document consistency. Validate dates and parent
relationships in application code; use transactions or deterministic keys for
constraints such as a unique week number within a term. Archiving is preferred
when children or lesson links still reference a record.

Firestore does not provide full-text search. The current lesson filter searches
titles loaded for one term; broader text search will need a dedicated search
service or a deliberately constrained token strategy.

Composite indexes in `firebase/firestore.indexes.json` support the active term,
week, lesson, and curriculum listing queries. Add indexes when new query shapes
are introduced and Firebase reports a missing-index error.

## Beacon import

Use Beacon's audited `data/curriculum/` JSON as the first curriculum source.
Import parent-first (framework, level, subject, strand, sub-strand, content
standard, indicator), normalize source naming variants, and retain source-file
and audit provenance. Keep Beacon lesson schedule data separate until its
teaching phases have a deliberate mapping to the lesson editor.
