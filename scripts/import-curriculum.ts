import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { normalizeCurriculumInput, sortImportRecords, type CurriculumCollection, type ImportRecord } from "./curriculum-importer.ts";

const BATCH_SIZE = 400;

function argumentsFrom(argv: string[]) {
  const result: Record<string, string | boolean> = { source: "data/curriculum" };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--") continue;
    if (argument === "--dry-run") { result.dryRun = true; continue; }
    if (argument === "--help" || argument === "-h") { result.help = true; continue; }
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);
    const key = argument.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Expected a value after ${argument}.`);
    result[key] = value;
    index += 1;
  }
  return result;
}

function printHelp() {
  console.log(`Beacon curriculum importer

Usage:
  pnpm import:curriculum -- --source data/curriculum --workspace WORKSPACE_ID --project FIREBASE_PROJECT_ID [--dry-run]

The importer reads JSON files from a directory (or one JSON file), validates and
normalizes the documented Beacon hierarchy, then performs an idempotent,
parent-first upsert. Live writes require Firebase Application Default Credentials
with Firestore write access; never put a service-account key in the frontend.`);
}

async function inputFiles(source: string): Promise<string[]> {
  const absolute = path.resolve(source);
  const stat = await import("node:fs/promises").then(({ stat: statPath }) => statPath(absolute));
  if (stat.isFile()) {
    if (path.extname(absolute).toLowerCase() !== ".json") throw new Error("The curriculum source file must be JSON.");
    return [absolute];
  }
  if (!stat.isDirectory()) throw new Error(`Curriculum source was not found: ${absolute}`);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === ".json")
    .map((entry) => path.join(absolute, entry.name)).sort();
  if (!files.length) throw new Error(`No JSON files were found in ${absolute}.`);
  return files;
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

async function upsertRecords(projectId: string, workspaceId: string, records: ImportRecord[]) {
  const app = getApps()[0] || initializeApp({ credential: applicationDefault(), projectId });
  const database = getFirestore(app);
  const collections: CurriculumCollection[] = [
    "curriculumFrameworks", "curriculumLevels", "curriculumSubjects", "curriculumStrands",
    "curriculumSubStrands", "curriculumContentStandards", "curriculumIndicators",
  ];
  for (const collectionName of collections) {
    const group = records.filter((record) => record.collection === collectionName);
    for (const slice of chunks(group, BATCH_SIZE)) {
      const refs = slice.map((record) => database.doc(`workspaces/${workspaceId}/${collectionName}/${record.id}`));
      const existing = await Promise.all(refs.map((reference) => reference.get()));
      const batch = database.batch();
      slice.forEach((record, index) => {
        batch.set(refs[index], {
          ...record.data,
          createdAt: existing[index].get("createdAt") || FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      });
      await batch.commit();
    }
  }
}

async function main() {
  const args = argumentsFrom(process.argv.slice(2));
  if (args.help) { printHelp(); return; }
  const source = String(args.source || "data/curriculum");
  const workspaceId = String(args.workspace || process.env.CURRICULUM_WORKSPACE_ID || "").trim();
  const projectId = String(args.project || process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "").trim();
  const dryRun = args.dryRun === true;
  if (!workspaceId) throw new Error("Provide --workspace or set CURRICULUM_WORKSPACE_ID.");
  if (workspaceId.includes("/") || workspaceId === "." || workspaceId === "..") throw new Error("Workspace ID must be a single Firestore document ID.");
  if (!dryRun && !projectId) throw new Error("Provide --project or set GCLOUD_PROJECT before importing.");

  const files = await inputFiles(source);
  const recordsByPath = new Map<string, ImportRecord>();
  for (const file of files) {
    const relativePath = path.relative(process.cwd(), file).split(path.sep).join("/");
    const json: unknown = JSON.parse(await readFile(file, "utf8"));
    const frameworks = normalizeCurriculumInput(json, relativePath);
    for (const framework of frameworks) {
      for (const record of framework.records) {
        const key = `${record.collection}/${record.id}`;
        const existing = recordsByPath.get(key);
        if (!existing) {
          record.data.sourceFiles = [String(record.data.sourceFile)];
          record.data.sourceRecordIds = [String(record.data.sourceRecordId)];
          recordsByPath.set(key, record);
          continue;
        }
        const stableFields = (data: Record<string, unknown>) => Object.fromEntries(
          Object.entries(data).filter(([field]) => !["sourceFile", "sourceRecordId", "sourceFiles", "sourceRecordIds"].includes(field)),
        );
        if (JSON.stringify(stableFields(existing.data)) !== JSON.stringify(stableFields(record.data))) {
          throw new Error(`Conflicting source records resolve to ${key}. Reconcile them before importing.`);
        }
        existing.data.sourceFiles = [...new Set([...(existing.data.sourceFiles as string[]), String(record.data.sourceFile)])];
        existing.data.sourceRecordIds = [...new Set([...(existing.data.sourceRecordIds as string[]), String(record.data.sourceRecordId)])];
      }
    }
  }

  const records = sortImportRecords([...recordsByPath.values()]);
  const counts = new Map<CurriculumCollection, number>();
  for (const record of records) counts.set(record.collection, (counts.get(record.collection) || 0) + 1);
  console.log(`Validated ${files.length} JSON file(s) for workspace ${workspaceId}:`);
  for (const [collectionName, count] of counts) console.log(`  ${collectionName}: ${count}`);
  if (dryRun) {
    console.log("Dry run complete; no Firebase connection or writes were made.");
    return;
  }
  await upsertRecords(projectId, workspaceId, records);
  console.log(`Imported ${records.length} records into Firebase project ${projectId}. Existing createdAt values were preserved.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
