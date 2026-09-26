import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, updateDoc, where, type DocumentData, type QueryConstraint } from "firebase/firestore";
import { db } from "./firebase";

export type Row<T> = T & { id: string };
export type TermRow = Row<{ name: string; academicYear: string; startDate: string | null; endDate: string | null; archivedAt: unknown }>;
export type WeekRow = Row<{ termId: string; number: number; title: string; startDate: string | null; endDate: string | null; sortOrder: number; archivedAt: unknown }>;
export type LessonRow = Row<{ weekId: string; title: string; summary: string; objectives: string; plannedDate: string | null; durationMinutes: number | null; status: "draft" | "ready" | "taught"; sortOrder: number; archivedAt: unknown }>;

function firestore() { if (!db) throw new Error("Firebase is not configured."); return db; }
function workspaceCollection(workspaceId: string, collectionName: string) { return collection(firestore(), "workspaces", workspaceId, collectionName); }
async function getRows<T extends DocumentData>(path: ReturnType<typeof collection>, constraints: QueryConstraint[]) {
  const snapshot = await getDocs(query(path, ...constraints));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as unknown as T);
}

export function listTerms(workspaceId: string) {
  return getRows<TermRow>(workspaceCollection(workspaceId, "terms"), [where("archivedAt", "==", null), orderBy("academicYear", "desc"), orderBy("name")]);
}
export function listWeeks(workspaceId: string, termId: string) {
  return getRows<WeekRow>(collection(firestore(), "workspaces", workspaceId, "terms", termId, "weeks"), [where("archivedAt", "==", null), orderBy("sortOrder"), orderBy("number")]);
}
export function listLessons(workspaceId: string, termId: string, weekId: string) {
  return getRows<LessonRow>(collection(firestore(), "workspaces", workspaceId, "terms", termId, "weeks", weekId, "lessons"), [where("archivedAt", "==", null), orderBy("sortOrder")]);
}
export async function addTerm(workspaceId: string, values: Omit<TermRow, "id" | "archivedAt">) {
  const now = serverTimestamp();
  return addDoc(workspaceCollection(workspaceId, "terms"), { ...values, createdAt: now, updatedAt: now, archivedAt: null });
}
export async function addWeek(workspaceId: string, termId: string, values: Omit<WeekRow, "id" | "termId" | "archivedAt">) {
  const now = serverTimestamp();
  return addDoc(collection(firestore(), "workspaces", workspaceId, "terms", termId, "weeks"), { ...values, termId, createdAt: now, updatedAt: now, archivedAt: null });
}
export async function addLesson(workspaceId: string, termId: string, weekId: string, values: Pick<LessonRow, "title" | "summary">) {
  const now = serverTimestamp();
  return addDoc(collection(firestore(), "workspaces", workspaceId, "terms", termId, "weeks", weekId, "lessons"), {
    ...values, weekId, objectives: "", plannedDate: null, durationMinutes: null, status: "draft", sortOrder: Date.now(), createdAt: now, updatedAt: now, archivedAt: null,
  });
}

export type LessonIndicatorLinkRow = Row<{ indicatorId: string; fullCode: string; subjectId: string; subjectName: string; levelId: string; sortOrder: number; archivedAt: unknown }>;

function lessonCollection(workspaceId: string, termId: string, weekId: string) {
  return collection(firestore(), "workspaces", workspaceId, "terms", termId, "weeks", weekId, "lessons");
}
function lessonRef(workspaceId: string, termId: string, weekId: string, lessonId: string) {
  return doc(lessonCollection(workspaceId, termId, weekId), lessonId);
}

export async function updateLesson(workspaceId: string, termId: string, weekId: string, lessonId: string, values: Partial<Pick<LessonRow, "title" | "summary" | "objectives" | "plannedDate" | "durationMinutes" | "status">>) {
  await updateDoc(lessonRef(workspaceId, termId, weekId, lessonId), { ...values, updatedAt: serverTimestamp() });
}
export function listLessonIndicatorLinks(workspaceId: string, termId: string, weekId: string, lessonId: string) {
  return getRows<LessonIndicatorLinkRow>(collection(lessonRef(workspaceId, termId, weekId, lessonId), "indicatorLinks"), [where("archivedAt", "==", null), orderBy("sortOrder")]);
}
export async function addLessonIndicatorLink(workspaceId: string, termId: string, weekId: string, lessonId: string, values: Omit<LessonIndicatorLinkRow, "id" | "archivedAt">) {
  const now = serverTimestamp();
  return addDoc(collection(lessonRef(workspaceId, termId, weekId, lessonId), "indicatorLinks"), { ...values, createdAt: now, updatedAt: now, archivedAt: null });
}
export async function removeLessonIndicatorLink(workspaceId: string, termId: string, weekId: string, lessonId: string, linkId: string) {
  await updateDoc(doc(collection(lessonRef(workspaceId, termId, weekId, lessonId), "indicatorLinks"), linkId), { archivedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function setLessonStatus(workspaceId: string, termId: string, weekId: string, lessonId: string, status: LessonRow["status"]) {
  await updateDoc(doc(firestore(), "workspaces", workspaceId, "terms", termId, "weeks", weekId, "lessons", lessonId), { status, updatedAt: serverTimestamp() });
}
export async function archiveLesson(workspaceId: string, termId: string, weekId: string, lessonId: string) {
  await updateDoc(doc(firestore(), "workspaces", workspaceId, "terms", termId, "weeks", weekId, "lessons", lessonId), { archivedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}
export async function removeTerm(workspaceId: string, termId: string) {
  await deleteDoc(doc(firestore(), "workspaces", workspaceId, "terms", termId));
}
