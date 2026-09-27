import { describe, expect, it } from "vitest";
import { normalizeCurriculumInput, sortImportRecords } from "../scripts/curriculum-importer";

const source = {
  framework_name: "Beacon Basic Education Curriculum",
  country: "Ghana",
  curriculum_version: "2024",
  effective_from: "2024-09-01",
  audit_reference: "audit-001",
  levels: [{ level_code: "JHS1", label: "Junior High School 1" }],
  subjects: [{ subject_code: "SCI", name: "Science", overview: "Science curriculum" }],
  strands: [{
    level_code: "JHS1",
    subject_code: "SCI",
    strand_code: "S1",
    title: "Materials",
    sub_strands: [{
      sub_strand_code: "SS1",
      title: "Properties of materials",
      content_standards: [{
        standard_code: "B7.1.1",
        statement: "Learners investigate materials.",
        learning_indicators: [{ indicator_code: "B7.1.1.1", text: "Classify familiar materials." }],
      }],
    }],
  }],
};

describe("Beacon curriculum normalization", () => {
  it("normalizes common source naming variants and preserves hierarchy/provenance", () => {
    const [framework] = normalizeCurriculumInput(source, "data/curriculum/science.json");
    expect(framework.name).toBe("Beacon Basic Education Curriculum");
    expect(framework.jurisdiction).toBe("Ghana");
    expect(framework.version).toBe("2024");
    expect(framework.records).toHaveLength(7);

    const indicator = framework.records.find((record) => record.collection === "curriculumIndicators");
    const level = framework.records.find((record) => record.collection === "curriculumLevels");
    expect(indicator?.data.fullCode).toBe("JHS1.SCI.S1.SS1.B7.1.1.B7.1.1.1");
    expect(indicator?.data.description).toBe("Classify familiar materials.");
    expect(indicator?.data.sourceFile).toBe("data/curriculum/science.json");
    expect(indicator?.data.auditReference).toBe("audit-001");
    expect(indicator?.data.levelId).toBe(level?.id);
  });

  it("uses deterministic IDs and returns parent records before children", () => {
    const first = normalizeCurriculumInput(source, "source.json")[0];
    const second = normalizeCurriculumInput(source, "source.json")[0];
    expect(first.id).toBe(second.id);
    expect(first.records.map((record) => record.id)).toEqual(second.records.map((record) => record.id));
    const sorted = sortImportRecords(first.records);
    expect(sorted.map((record) => record.collection)).toEqual([
      "curriculumFrameworks", "curriculumLevels", "curriculumSubjects", "curriculumStrands",
      "curriculumSubStrands", "curriculumContentStandards", "curriculumIndicators",
    ]);
  });

  it("rejects invalid parent references instead of importing orphan records", () => {
    const invalid = structuredClone(source) as typeof source;
    invalid.strands[0].level_code = "UNKNOWN";
    expect(() => normalizeCurriculumInput(invalid, "bad.json")).toThrow(/unknown level UNKNOWN/);
  });

  it("rejects invalid dates and conflicting duplicate identities", () => {
    const invalidDate = { ...source, effective_from: "2024-02-30" };
    expect(() => normalizeCurriculumInput(invalidDate, "bad.json")).toThrow(/valid YYYY-MM-DD/);
    const duplicateFrameworks = { frameworks: [source, source] };
    expect(() => normalizeCurriculumInput(duplicateFrameworks, "bad.json")).toThrow(/Duplicate framework identity/);
  });
});
