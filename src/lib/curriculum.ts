import { collection, getDocs, orderBy, query, where, type DocumentData, type QueryConstraint } from "firebase/firestore";
import { db } from "./firebase";
import type { CurriculumFramework, CurriculumLevel, Subject, Strand, SubStrand, ContentStandard, Indicator } from "../types/models";

function firestore() {
  if (!db) throw new Error("Firebase is not configured.");
  return db;
}
async function rows<T extends DocumentData>(path: ReturnType<typeof collection>, constraints: QueryConstraint[] = []) {
  const snapshot = await getDocs(query(path, ...constraints));
  return snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as T & { id: string });
}
function base(workspaceId: string, name: string) { return collection(firestore(), "workspaces", workspaceId, name); }

export function listFrameworks(workspaceId: string) {
  return rows<CurriculumFramework>(base(workspaceId, "curriculumFrameworks"), [where("archivedAt", "==", null), orderBy("name")]);
}
export function listLevels(workspaceId: string, frameworkId: string) {
  return rows<CurriculumLevel>(base(workspaceId, "curriculumLevels"), [where("frameworkId", "==", frameworkId), orderBy("sortOrder")]);
}
export function listSubjects(workspaceId: string, frameworkId: string) {
  return rows<Subject>(base(workspaceId, "curriculumSubjects"), [where("frameworkId", "==", frameworkId), where("archivedAt", "==", null), orderBy("name")]);
}
export function listStrands(workspaceId: string, frameworkId: string, levelId: string, subjectId: string) {
  return rows<Strand>(base(workspaceId, "curriculumStrands"), [where("frameworkId", "==", frameworkId), where("levelId", "==", levelId), where("subjectId", "==", subjectId), orderBy("sortOrder")]);
}
export function listSubStrands(workspaceId: string, frameworkId: string, levelId: string, subjectId: string, strandId: string) {
  return rows<SubStrand>(base(workspaceId, "curriculumSubStrands"), [where("frameworkId", "==", frameworkId), where("levelId", "==", levelId), where("subjectId", "==", subjectId), where("strandId", "==", strandId), orderBy("code")]);
}
export function listContentStandards(workspaceId: string, frameworkId: string, levelId: string, subjectId: string, strandId: string, subStrandId: string) {
  return rows<ContentStandard>(base(workspaceId, "curriculumContentStandards"), [where("frameworkId", "==", frameworkId), where("levelId", "==", levelId), where("subjectId", "==", subjectId), where("strandId", "==", strandId), where("subStrandId", "==", subStrandId), orderBy("code")]);
}
export function listIndicators(workspaceId: string, frameworkId: string, levelId: string, subjectId: string, strandId: string, subStrandId: string, contentStandardId: string) {
  return rows<Indicator>(base(workspaceId, "curriculumIndicators"), [where("frameworkId", "==", frameworkId), where("levelId", "==", levelId), where("subjectId", "==", subjectId), where("strandId", "==", strandId), where("subStrandId", "==", subStrandId), where("contentStandardId", "==", contentStandardId), where("archivedAt", "==", null), orderBy("code")]);
}
