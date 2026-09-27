import { createHash } from "node:crypto";
import { isDateOnly } from "../src/lib/validation.ts";

export type CurriculumCollection =
  | "curriculumFrameworks"
  | "curriculumLevels"
  | "curriculumSubjects"
  | "curriculumStrands"
  | "curriculumSubStrands"
  | "curriculumContentStandards"
  | "curriculumIndicators";

export type ImportRecord = {
  collection: CurriculumCollection;
  id: string;
  data: Record<string, unknown>;
};

export type NormalizedFramework = {
  id: string;
  name: string;
  version: string;
  jurisdiction: string;
  records: ImportRecord[];
};

type JsonRecord = Record<string, unknown>;
type ParentRecord = {
  id: string;
  code: string;
  name: string;
  raw: JsonRecord;
};

const collectionOrder: CurriculumCollection[] = [
  "curriculumFrameworks",
  "curriculumLevels",
  "curriculumSubjects",
  "curriculumStrands",
  "curriculumSubStrands",
  "curriculumContentStandards",
  "curriculumIndicators",
];

export function normalizeCurriculumInput(input: unknown, sourceFile: string): NormalizedFramework[] {
  const entries = frameworkEntries(input, sourceFile);
  if (!entries.length) throw new Error(`${sourceFile} contains no curriculum frameworks.`);
  const frameworks = entries.map((entry, index) => normalizeFramework(entry, sourceFile, index));
  const ids = new Set<string>();
  for (const framework of frameworks) {
    if (ids.has(framework.id)) throw new Error(`Duplicate framework identity in ${sourceFile}: ${framework.name} (${framework.version}).`);
    ids.add(framework.id);
  }
  return frameworks;
}

export function sortImportRecords(records: ImportRecord[]): ImportRecord[] {
  const rank = new Map(collectionOrder.map((name, index) => [name, index]));
  return [...records].sort((a, b) => rank.get(a.collection)! - rank.get(b.collection)! || a.id.localeCompare(b.id));
}

export function stableCurriculumId(kind: string, identity: string): string {
  const digest = createHash("sha256").update(`${kind}\u0000${identity}`).digest("hex").slice(0, 24);
  return `${kind}_${digest}`;
}

function frameworkEntries(input: unknown, sourceFile: string): JsonRecord[] {
  if (Array.isArray(input)) return input.map((item, index) => asRecord(item, `${sourceFile} item ${index + 1}`));
  const root = asRecord(input, sourceFile);
  const list = firstArray(root, ["frameworks", "curriculumFrameworks", "curriculum_frameworks"]);
  if (list) return list.map((item, index) => asRecord(item, `${sourceFile} framework ${index + 1}`));
  const single = first(root, ["framework", "curriculumFramework"]);
  if (single && typeof single === "object") return [asRecord(single, `${sourceFile} framework`)];
  return [root];
}

function normalizeFramework(raw: JsonRecord, sourceFile: string, frameworkIndex: number): NormalizedFramework {
  const name = requiredText(raw, ["name", "frameworkName", "framework_name", "curriculumName", "title"], `${sourceFile} framework name`);
  const jurisdiction = text(raw, ["jurisdiction", "country", "countryName", "country_name"]) || "Ghana";
  const version = text(raw, ["version", "curriculumVersion", "curriculum_version", "edition"]) || "unspecified";
  const identity = `${jurisdiction.toLowerCase()}|${name.toLowerCase()}|${version.toLowerCase()}`;
  const frameworkId = stableCurriculumId("framework", identity);
  const auditReference = text(raw, ["auditReference", "audit_reference", "auditId", "audit_id", "provenance"]);
  const effectiveFrom = dateValue(raw, ["effectiveFrom", "effective_from", "startDate", "start_date"], `${name} effective from`);
  const effectiveTo = dateValue(raw, ["effectiveTo", "effective_to", "endDate", "end_date"], `${name} effective to`);
  if (effectiveFrom && effectiveTo && effectiveFrom > effectiveTo) throw new Error(`${name}: effectiveTo must be on or after effectiveFrom.`);
  const provenance = (record: JsonRecord, fallbackId: string) => ({
    sourceFile,
    sourceRecordId: text(record, ["sourceRecordId", "source_record_id", "sourceId", "source_id", "uuid", "id"]) || fallbackId,
    ...(text(record, ["auditReference", "audit_reference", "auditId", "audit_id"]) || auditReference
      ? { auditReference: text(record, ["auditReference", "audit_reference", "auditId", "audit_id"]) || auditReference }
      : {}),
  });

  const records: ImportRecord[] = [];
  records.push({
    collection: "curriculumFrameworks",
    id: frameworkId,
    data: { name, jurisdiction, version, effectiveFrom, effectiveTo, ...provenance(raw, `framework-${frameworkIndex + 1}`), archivedAt: null },
  });

  const levels = new Map<string, ParentRecord>();
  const subjects = new Map<string, ParentRecord>();
  const rawLevels = arrayValue(raw, ["levels", "curriculumLevels", "curriculum_levels", "gradeLevels", "grade_levels"]);
  const rawSubjects = arrayValue(raw, ["subjects", "curriculumSubjects", "curriculum_subjects"]);
  const nestedSubjectEntries: Array<{ record: JsonRecord; levelCode?: string }> = [];
  const nestedStrands: Array<{ record: JsonRecord; levelCode?: string; subjectCode?: string }> = [];

  for (const [index, rawLevelValue] of rawLevels.entries()) {
    const level = asRecord(rawLevelValue, `${name} level ${index + 1}`);
    const code = requiredText(level, ["code", "levelCode", "level_code", "id"], `${name} level ${index + 1} code`);
    const levelId = stableCurriculumId("level", `${frameworkId}|${code.toLowerCase()}`);
    const levelRecord = { id: levelId, code, name: requiredText(level, ["name", "label", "title"], `${name} level ${code} name`), raw: level };
    const existingLevel = levels.get(code.toLowerCase());
    addUnique(levels, code, levelRecord, `${name} level`);
    if (!existingLevel) records.push({
      collection: "curriculumLevels",
      id: levelId,
      data: { frameworkId, code, name: levelRecord.name, sortOrder: numberValue(level, ["sortOrder", "sort_order", "order"], index), ...provenance(level, code) },
    });
    const childSubjects = arrayValue(level, ["subjects", "curriculumSubjects", "curriculum_subjects"]);
    for (const subject of childSubjects) nestedSubjectEntries.push({ record: asRecord(subject, `${name} ${code} subject`), levelCode: code });
  }

  const allSubjectEntries: Array<{ record: JsonRecord; levelCode?: string }> = [
    ...rawSubjects.map((record) => ({ record: asRecord(record, `${name} subject`) })),
    ...nestedSubjectEntries,
  ];
  for (const [index, entry] of allSubjectEntries.entries()) {
    const subject = entry.record;
    const code = requiredText(subject, ["code", "subjectCode", "subject_code", "id"], `${name} subject ${index + 1} code`);
    const subjectId = stableCurriculumId("subject", `${frameworkId}|${code.toLowerCase()}`);
    const record: ParentRecord = { id: subjectId, code, name: requiredText(subject, ["name", "label", "title"], `${name} subject ${code} name`), raw: subject };
    const existing = subjects.get(code.toLowerCase());
    if (!existing) {
      subjects.set(code.toLowerCase(), record);
      records.push({
        collection: "curriculumSubjects",
        id: subjectId,
        data: { frameworkId, name: record.name, code, description: text(subject, ["description", "definition", "overview"]) || "", ...provenance(subject, code), archivedAt: null },
      });
    } else if (existing.name !== record.name) {
      throw new Error(`${name}: subject code ${code} has conflicting names (${existing.name} and ${record.name}).`);
    }
    for (const strandValue of arrayValue(subject, ["strands", "curriculumStrands", "curriculum_strands"])) {
      nestedStrands.push({ record: asRecord(strandValue, `${name} ${code} strand`), levelCode: entry.levelCode, subjectCode: code });
    }
  }

  const flatStrands: Array<{ record: JsonRecord; levelCode?: string; subjectCode?: string }> = arrayValue(raw, ["strands", "curriculumStrands", "curriculum_strands"])
    .map((record) => ({ record: asRecord(record, `${name} strand`) }));
  const strandEntries = [...flatStrands, ...nestedStrands];
  const seenStrands = new Set<string>();
  for (const [strandIndex, entry] of strandEntries.entries()) {
    const strand = entry.record;
    const levelCode = referenceCode(strand, ["levelCode", "level_code", "levelId", "level_id", "level"], entry.levelCode);
    const subjectCode = referenceCode(strand, ["subjectCode", "subject_code", "subjectId", "subject_id", "subject"], entry.subjectCode);
    const level = levels.get(levelCode.toLowerCase());
    const subject = subjects.get(subjectCode.toLowerCase());
    if (!level) throw new Error(`${name}: strand ${text(strand, ["code", "strandCode", "strand_code"]) || strandIndex + 1} refers to unknown level ${levelCode}.`);
    if (!subject) throw new Error(`${name}: strand ${text(strand, ["code", "strandCode", "strand_code"]) || strandIndex + 1} refers to unknown subject ${subjectCode}.`);
    const code = requiredText(strand, ["code", "strandCode", "strand_code", "id"], `${name} strand ${strandIndex + 1} code`);
    const strandKey = `${level.id}|${subject.id}|${code.toLowerCase()}`;
    if (seenStrands.has(strandKey)) throw new Error(`${name}: duplicate strand code ${code} for ${levelCode}/${subjectCode}.`);
    seenStrands.add(strandKey);
    const strandId = stableCurriculumId("strand", `${frameworkId}|${strandKey}`);
    records.push({
      collection: "curriculumStrands",
      id: strandId,
      data: { frameworkId, levelId: level.id, subjectId: subject.id, code, name: requiredText(strand, ["name", "label", "title"], `${name} strand ${code} name`), description: text(strand, ["description", "definition", "overview"]) || "", sortOrder: numberValue(strand, ["sortOrder", "sort_order", "order"], strandIndex), ...provenance(strand, code) },
    });

    const subStrands = arrayValue(strand, ["subStrands", "sub_strands", "subStrand", "curriculumSubStrands", "curriculum_sub_strands"]);
    const seenSubStrands = new Set<string>();
    for (const [subIndex, subValue] of subStrands.entries()) {
      const sub = asRecord(subValue, `${name} sub-strand ${code}`);
      const subCode = requiredText(sub, ["code", "subStrandCode", "sub_strand_code", "id"], `${name} ${code} sub-strand ${subIndex + 1} code`);
      const subKey = `${strandId}|${subCode.toLowerCase()}`;
      if (seenSubStrands.has(subKey)) throw new Error(`${name}: duplicate sub-strand code ${subCode} under ${code}.`);
      seenSubStrands.add(subKey);
      const subStrandId = stableCurriculumId("substrand", `${frameworkId}|${subKey}`);
      const subName = requiredText(sub, ["name", "label", "title"], `${name} sub-strand ${subCode} name`);
      records.push({
        collection: "curriculumSubStrands",
        id: subStrandId,
        data: { frameworkId, levelId: level.id, subjectId: subject.id, strandId, code: subCode, name: subName, description: text(sub, ["description", "definition", "overview"]) || "", sortOrder: numberValue(sub, ["sortOrder", "sort_order", "order"], subIndex), ...provenance(sub, subCode) },
      });

      const standards = arrayValue(sub, ["contentStandards", "content_standards", "contentStandard", "content_standard", "standards"]);
      const seenStandards = new Set<string>();
      for (const [standardIndex, standardValue] of standards.entries()) {
        const standard = asRecord(standardValue, `${name} content standard ${subCode}`);
        const standardCode = requiredText(standard, ["code", "standardCode", "standard_code", "id"], `${name} ${subCode} content standard ${standardIndex + 1} code`);
        const standardKey = `${subStrandId}|${standardCode.toLowerCase()}`;
        if (seenStandards.has(standardKey)) throw new Error(`${name}: duplicate content standard code ${standardCode} under ${subCode}.`);
        seenStandards.add(standardKey);
        const contentStandardId = stableCurriculumId("standard", `${frameworkId}|${standardKey}`);
        records.push({
          collection: "curriculumContentStandards",
          id: contentStandardId,
          data: { frameworkId, levelId: level.id, subjectId: subject.id, strandId, subStrandId, code: standardCode, description: requiredText(standard, ["description", "content", "statement", "text", "name"], `${name} content standard ${standardCode} description`), sortOrder: numberValue(standard, ["sortOrder", "sort_order", "order"], standardIndex), ...provenance(standard, standardCode) },
        });

        const indicators = arrayValue(standard, ["indicators", "learningIndicators", "learning_indicators", "learningOutcomes", "learning_outcomes"]);
        const seenIndicators = new Set<string>();
        for (const [indicatorIndex, indicatorValue] of indicators.entries()) {
          const indicator = asRecord(indicatorValue, `${name} indicator ${standardCode}`);
          const indicatorCode = requiredText(indicator, ["code", "indicatorCode", "indicator_code", "id"], `${name} ${standardCode} indicator ${indicatorIndex + 1} code`);
          const indicatorKey = `${contentStandardId}|${indicatorCode.toLowerCase()}`;
          if (seenIndicators.has(indicatorKey)) throw new Error(`${name}: duplicate indicator code ${indicatorCode} under ${standardCode}.`);
          seenIndicators.add(indicatorKey);
          const indicatorId = stableCurriculumId("indicator", `${frameworkId}|${indicatorKey}`);
          const fullCode = text(indicator, ["fullCode", "full_code", "indicatorFullCode", "indicator_full_code"])
            || [level.code, subject.code, code, subCode, standardCode, indicatorCode].filter(Boolean).join(".");
          records.push({
            collection: "curriculumIndicators",
            id: indicatorId,
            data: { frameworkId, levelId: level.id, subjectId: subject.id, strandId, subStrandId, contentStandardId, code: indicatorCode, fullCode, description: requiredText(indicator, ["description", "statement", "text", "content", "name"], `${name} indicator ${indicatorCode} description`), sortOrder: numberValue(indicator, ["sortOrder", "sort_order", "order"], indicatorIndex), ...provenance(indicator, indicatorCode), archivedAt: null },
          });
        }
      }
    }
  }

  return { id: frameworkId, name, version, jurisdiction, records };
}

function asRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a JSON object.`);
  return value as JsonRecord;
}
function first(record: JsonRecord, keys: string[]): unknown {
  for (const key of keys) if (record[key] !== undefined && record[key] !== null) return record[key];
  return undefined;
}
function firstArray(record: JsonRecord, keys: string[]): unknown[] | undefined {
  const value = first(record, keys);
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`${keys[0]} must be an array.`);
  return value;
}
function arrayValue(record: JsonRecord, keys: string[]): unknown[] {
  return firstArray(record, keys) || [];
}
function text(record: JsonRecord, keys: string[]): string {
  const value = first(record, keys);
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  return "";
}
function requiredText(record: JsonRecord, keys: string[], label: string): string {
  const value = text(record, keys);
  if (!value) throw new Error(`${label} is required.`);
  return value;
}
function numberValue(record: JsonRecord, keys: string[], fallback: number): number {
  const value = first(record, keys);
  if (value === undefined || value === "") return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`${keys[0]} must be a non-negative whole number.`);
  return number;
}
function dateValue(record: JsonRecord, keys: string[], label: string): string | null {
  const value = text(record, keys);
  if (!value) return null;
  if (!isDateOnly(value)) throw new Error(`${label} must use a valid YYYY-MM-DD date.`);
  return value;
}
function referenceCode(record: JsonRecord, keys: string[], inherited?: string): string {
  const value = first(record, keys);
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (value && typeof value === "object") {
    const nested = asRecord(value, keys[0]);
    return requiredText(nested, ["code", "levelCode", "subjectCode", "id", "name"], keys[0]);
  }
  if (inherited) return inherited;
  throw new Error(`${keys[0]} is required on every strand.`);
}
function addUnique(map: Map<string, ParentRecord>, code: string, record: ParentRecord, label: string) {
  const key = code.toLowerCase();
  const existing = map.get(key);
  if (existing && existing.name !== record.name) throw new Error(`${label} code ${code} has conflicting names.`);
  if (!existing) map.set(key, record);
}
