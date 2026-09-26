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

export type LessonIndicatorLinkRow = Row<{ indicatorId: string; fullCode: string; description: string; subjectId: string; subjectName: string; levelId: string; sortOrder: number; archivedAt: unknown }>;
export type LessonResourceRow = Row<{ title: string; type: "link" | "note" | "file" | "other"; url: string; storagePath: string; notes: string; sortOrder: number; archivedAt: unknown }>;
export type TeachingStepRow = Row<{ title: string; phase: "opening" | "explore" | "explain" | "practice" | "assessment" | "closing"; instructions: string; minutes: number | null; sortOrder: number; archivedAt: unknown }>;

function lessonCollection(workspaceId: string, termId: string, weekId: string) {
  return collection(firestore(), "workspaces", workspaceId, "terms", termId, "weeks", weekId, "lessons");
}
function lessonRef(workspaceId: string, termId: string, weekId: string, lessonId: string) {
  return doc(lessonCollection(workspaceId, termId, weekId), lessonId);
}

export type AssessmentRow = Row<{ lessonId: string; title: string; type: "formative" | "summative" | "practical" | "other"; instructions: string; markingNotes: string; plannedDate: string | null; sortOrder: number; archivedAt: unknown }>;
export type AssessmentItemRow = Row<{ assessmentId: string; type: "shortAnswer" | "multipleChoice" | "trueFalse" | "essay" | "practical"; prompt: string; marks: number; options: string[]; answer: string; markingGuide: string; indicatorId: string | null; sortOrder: number; archivedAt: unknown }>;

function assessmentCollection(workspaceId: string, termId: string, weekId: string, lessonId: string) {
  return collection(lessonRef(workspaceId, termId, weekId, lessonId), "assessments");
}
function assessmentRef(workspaceId: string, termId: string, weekId: string, lessonId: string, assessmentId: string) {
  return doc(assessmentCollection(workspaceId, termId, weekId, lessonId), assessmentId);
}
function assessmentItemCollection(workspaceId: string, termId: string, weekId: string, lessonId: string, assessmentId: string) {
  return collection(assessmentRef(workspaceId, termId, weekId, lessonId, assessmentId), "items");
}

export function listAssessments(workspaceId: string, termId: string, weekId: string, lessonId: string) {
  return getRows<AssessmentRow>(assessmentCollection(workspaceId, termId, weekId, lessonId), [where("archivedAt", "==", null), orderBy("sortOrder")]);
}
export async function addAssessment(workspaceId: string, termId: string, weekId: string, lessonId: string, values: Omit<AssessmentRow, "id" | "archivedAt">) {
  const now = serverTimestamp();
  return addDoc(assessmentCollection(workspaceId, termId, weekId, lessonId), { ...values, lessonId, createdAt: now, updatedAt: now, archivedAt: null });
}
export async function updateAssessment(workspaceId: string, termId: string, weekId: string, lessonId: string, assessmentId: string, values: Partial<Omit<AssessmentRow, "id" | "archivedAt" | "lessonId">>) {
  await updateDoc(assessmentRef(workspaceId, termId, weekId, lessonId, assessmentId), { ...values, updatedAt: serverTimestamp() });
}
export async function removeAssessment(workspaceId: string, termId: string, weekId: string, lessonId: string, assessmentId: string) {
  await updateDoc(assessmentRef(workspaceId, termId, weekId, lessonId, assessmentId), { archivedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}
export function listAssessmentItems(workspaceId: string, termId: string, weekId: string, lessonId: string, assessmentId: string) {
  return getRows<AssessmentItemRow>(assessmentItemCollection(workspaceId, termId, weekId, lessonId, assessmentId), [where("archivedAt", "==", null), orderBy("sortOrder")]);
}
export async function addAssessmentItem(workspaceId: string, termId: string, weekId: string, lessonId: string, assessmentId: string, values: Omit<AssessmentItemRow, "id" | "archivedAt">) {
  const now = serverTimestamp();
  return addDoc(assessmentItemCollection(workspaceId, termId, weekId, lessonId, assessmentId), { ...values, assessmentId, createdAt: now, updatedAt: now, archivedAt: null });
}
export async function updateAssessmentItem(workspaceId: string, termId: string, weekId: string, lessonId: string, assessmentId: string, itemId: string, values: Partial<Omit<AssessmentItemRow, "id" | "archivedAt" | "assessmentId">>) {
  await updateDoc(doc(assessmentItemCollection(workspaceId, termId, weekId, lessonId, assessmentId), itemId), { ...values, updatedAt: serverTimestamp() });
}
export async function removeAssessmentItem(workspaceId: string, termId: string, weekId: string, lessonId: string, assessmentId: string, itemId: string) {
  await updateDoc(doc(assessmentItemCollection(workspaceId, termId, weekId, lessonId, assessmentId), itemId), { archivedAt: serverTimestamp(), updatedAt: serverTimestamp() });
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


export function listLessonResources(workspaceId: string, termId: string, weekId: string, lessonId: string) {
  return getRows<LessonResourceRow>(collection(lessonRef(workspaceId, termId, weekId, lessonId), "resources"), [where("archivedAt", "==", null), orderBy("sortOrder")]);
}
export async function addLessonResource(workspaceId: string, termId: string, weekId: string, lessonId: string, values: Omit<LessonResourceRow, "id" | "archivedAt">) {
  const now = serverTimestamp();
  return addDoc(collection(lessonRef(workspaceId, termId, weekId, lessonId), "resources"), { ...values, createdAt: now, updatedAt: now, archivedAt: null });
}
export async function removeLessonResource(workspaceId: string, termId: string, weekId: string, lessonId: string, resourceId: string) {
  await updateDoc(doc(collection(lessonRef(workspaceId, termId, weekId, lessonId), "resources"), resourceId), { archivedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export function listTeachingSteps(workspaceId: string, termId: string, weekId: string, lessonId: string) {
  return getRows<TeachingStepRow>(collection(lessonRef(workspaceId, termId, weekId, lessonId), "teachingSteps"), [where("archivedAt", "==", null), orderBy("sortOrder")]);
}
export async function addTeachingStep(workspaceId: string, termId: string, weekId: string, lessonId: string, values: Omit<TeachingStepRow, "id" | "archivedAt">) {
  const now = serverTimestamp();
  return addDoc(collection(lessonRef(workspaceId, termId, weekId, lessonId), "teachingSteps"), { ...values, createdAt: now, updatedAt: now, archivedAt: null });
}
export async function updateTeachingStep(workspaceId: string, termId: string, weekId: string, lessonId: string, stepId: string, values: Partial<Omit<TeachingStepRow, "id" | "archivedAt">>) {
  await updateDoc(doc(collection(lessonRef(workspaceId, termId, weekId, lessonId), "teachingSteps"), stepId), { ...values, updatedAt: serverTimestamp() });
}
export async function removeTeachingStep(workspaceId: string, termId: string, weekId: string, lessonId: string, stepId: string) {
  await updateDoc(doc(collection(lessonRef(workspaceId, termId, weekId, lessonId), "teachingSteps"), stepId), { archivedAt: serverTimestamp(), updatedAt: serverTimestamp() });
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
