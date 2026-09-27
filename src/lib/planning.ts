import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { db, getStorageClient } from "./firebase";
import { findWeekOverlap, validateDateRange, validateWeekWithinTerm, type ExistingWeek, type DateRange } from "./validation";

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
function termRef(workspaceId: string, termId: string) {
  return doc(firestore(), "workspaces", workspaceId, "terms", termId);
}
function weeksCollection(workspaceId: string, termId: string) {
  return collection(termRef(workspaceId, termId), "weeks");
}
function allWeeksCollection(workspaceId: string, termId: string) {
  return getDocs(weeksCollection(workspaceId, termId));
}
function dateRange(value: { startDate: string | null; endDate: string | null }): DateRange {
  return { startDate: value.startDate, endDate: value.endDate };
}
function weekForValidation(value: { id?: string; number: number; title: string; startDate: string | null; endDate: string | null }): ExistingWeek {
  return { id: value.id, number: value.number, title: value.title, startDate: value.startDate, endDate: value.endDate };
}
function ensureValidDateRange(range: DateRange, label: string) {
  const error = validateDateRange(range, label);
  if (error) throw new Error(error);
}

export function listTerms(workspaceId: string) {
  return getRows<TermRow>(workspaceCollection(workspaceId, "terms"), [where("archivedAt", "==", null), orderBy("academicYear", "desc"), orderBy("name")]);
}
export async function listArchivedTerms(workspaceId: string) {
  const rows = await getRows<TermRow>(workspaceCollection(workspaceId, "terms"), []);
  return rows.filter((row) => row.archivedAt != null).sort((a, b) => b.academicYear.localeCompare(a.academicYear) || a.name.localeCompare(b.name));
}
export function listWeeks(workspaceId: string, termId: string) {
  return getRows<WeekRow>(weeksCollection(workspaceId, termId), [where("archivedAt", "==", null), orderBy("sortOrder"), orderBy("number")]);
}
export async function listArchivedWeeks(workspaceId: string, termId: string) {
  const rows = await getRows<WeekRow>(weeksCollection(workspaceId, termId), []);
  return rows.filter((row) => row.archivedAt != null).sort((a, b) => a.sortOrder - b.sortOrder || a.number - b.number);
}
export function listLessons(workspaceId: string, termId: string, weekId: string) {
  return getRows<LessonRow>(collection(firestore(), "workspaces", workspaceId, "terms", termId, "weeks", weekId, "lessons"), [where("archivedAt", "==", null), orderBy("sortOrder")]);
}

export async function addTerm(workspaceId: string, values: Omit<TermRow, "id" | "archivedAt">) {
  if (!values.name.trim() || !values.academicYear.trim()) throw new Error("A term name and academic year are required.");
  ensureValidDateRange(values, "Term");
  const now = serverTimestamp();
  return addDoc(workspaceCollection(workspaceId, "terms"), { ...values, createdAt: now, updatedAt: now, archivedAt: null });
}
export async function updateTerm(workspaceId: string, termId: string, values: Pick<TermRow, "name" | "academicYear" | "startDate" | "endDate">) {
  if (!values.name.trim() || !values.academicYear.trim()) throw new Error("A term name and academic year are required.");
  ensureValidDateRange(values, "Term");
  const activeWeeks = await listWeeks(workspaceId, termId);
  for (const week of activeWeeks) {
    const error = validateWeekWithinTerm(dateRange(week), dateRange(values));
    if (error) throw new Error(`Update the term dates or adjust Week ${week.number} first. ${error}`);
  }
  await updateDoc(termRef(workspaceId, termId), { ...values, updatedAt: serverTimestamp() });
}
export async function archiveTerm(workspaceId: string, termId: string) {
  await updateDoc(termRef(workspaceId, termId), { archivedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}
export async function restoreTerm(workspaceId: string, term: TermRow) {
  ensureValidDateRange(term, "Term");
  const weeks = await listWeeks(workspaceId, term.id);
  for (const week of weeks) {
    const error = validateWeekWithinTerm(dateRange(week), dateRange(term));
    if (error) throw new Error(`Week ${week.number} must fit inside the term before it can be restored. ${error}`);
  }
  await updateDoc(termRef(workspaceId, term.id), { archivedAt: null, updatedAt: serverTimestamp() });
}

export async function addWeek(workspaceId: string, termId: string, values: Omit<WeekRow, "id" | "termId" | "archivedAt">) {
  if (!Number.isInteger(values.number) || values.number < 1) throw new Error("Week number must be a positive whole number.");
  if (!Number.isInteger(values.sortOrder)) throw new Error("Week order must be a whole number.");
  const termSnapshot = await getDoc(termRef(workspaceId, termId));
  if (!termSnapshot.exists() || termSnapshot.data().archivedAt != null) throw new Error("This term is not available for planning.");
  const term = termSnapshot.data() as DateRange;
  const withinTermError = validateWeekWithinTerm(values, term);
  if (withinTermError) throw new Error(withinTermError);

  // Legacy records may not have a number lock, so check them before reserving one.
  const existingSnapshot = await allWeeksCollection(workspaceId, termId);
  const existingWeeks = existingSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as WeekRow);
  if (existingWeeks.some((week) => week.number === values.number)) {
    throw new Error(`Week ${values.number} already exists in this term. Choose another number.`);
  }
  const overlap = findWeekOverlap(weekForValidation(values), existingWeeks.filter((week) => week.archivedAt == null).map(weekForValidation));
  if (overlap) throw new Error(`These dates overlap Week ${overlap.number}. Adjust the dates before saving.`);

  const weekRef = doc(weeksCollection(workspaceId, termId));
  const lockRef = doc(termRef(workspaceId, termId), "weekNumberLocks", String(values.number));
  const now = serverTimestamp();
  await runTransaction(firestore(), async (transaction) => {
    const lock = await transaction.get(lockRef);
    if (lock.exists()) throw new Error(`Week ${values.number} is already reserved in this term.`);
    transaction.set(lockRef, { number: values.number, weekId: weekRef.id, createdAt: now, updatedAt: now });
    transaction.set(weekRef, { ...values, termId, createdAt: now, updatedAt: now, archivedAt: null });
  });
  return weekRef;
}
export async function updateWeek(workspaceId: string, termId: string, week: WeekRow, values: Pick<WeekRow, "title" | "startDate" | "endDate">) {
  const termSnapshot = await getDoc(termRef(workspaceId, termId));
  if (!termSnapshot.exists() || termSnapshot.data().archivedAt != null) throw new Error("This term is not available for planning.");
  const term = termSnapshot.data() as DateRange;
  const candidate = { ...week, ...values };
  const withinTermError = validateWeekWithinTerm(candidate, term);
  if (withinTermError) throw new Error(withinTermError);
  const existing = await listWeeks(workspaceId, termId);
  const overlap = findWeekOverlap(weekForValidation(candidate), existing.map(weekForValidation), week.id);
  if (overlap) throw new Error(`These dates overlap Week ${overlap.number}. Adjust the dates before saving.`);
  await updateDoc(doc(weeksCollection(workspaceId, termId), week.id), { ...values, updatedAt: serverTimestamp() });
}
export async function archiveWeek(workspaceId: string, termId: string, weekId: string) {
  await updateDoc(doc(weeksCollection(workspaceId, termId), weekId), { archivedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}
export async function restoreWeek(workspaceId: string, termId: string, week: WeekRow) {
  const termSnapshot = await getDoc(termRef(workspaceId, termId));
  if (!termSnapshot.exists() || termSnapshot.data().archivedAt != null) throw new Error("Restore the term before restoring one of its weeks.");
  const term = termSnapshot.data() as DateRange;
  const withinTermError = validateWeekWithinTerm(dateRange(week), term);
  if (withinTermError) throw new Error(withinTermError);
  const existing = await listWeeks(workspaceId, termId);
  const overlap = findWeekOverlap(weekForValidation(week), existing.map(weekForValidation), week.id);
  if (overlap) throw new Error(`These dates overlap Week ${overlap.number}. Adjust the dates before restoring.`);
  await updateDoc(doc(weeksCollection(workspaceId, termId), week.id), { archivedAt: null, updatedAt: serverTimestamp() });
}
export async function reorderWeeks(workspaceId: string, termId: string, first: WeekRow, second: WeekRow) {
  const firstRef = doc(weeksCollection(workspaceId, termId), first.id);
  const secondRef = doc(weeksCollection(workspaceId, termId), second.id);
  await runTransaction(firestore(), async (transaction) => {
    const [firstSnapshot, secondSnapshot] = await Promise.all([transaction.get(firstRef), transaction.get(secondRef)]);
    if (!firstSnapshot.exists() || !secondSnapshot.exists()) throw new Error("A week changed while the plan was being reordered. Refresh and try again.");
    const firstData = firstSnapshot.data() as WeekRow;
    const secondData = secondSnapshot.data() as WeekRow;
    if (firstData.archivedAt != null || secondData.archivedAt != null) throw new Error("Archived weeks cannot be reordered.");
    transaction.update(firstRef, { sortOrder: secondData.sortOrder, updatedAt: serverTimestamp() });
    transaction.update(secondRef, { sortOrder: firstData.sortOrder, updatedAt: serverTimestamp() });
  });
}

export async function addLesson(workspaceId: string, termId: string, weekId: string, values: Pick<LessonRow, "title" | "summary">) {
  if (!values.title.trim()) throw new Error("A lesson title is required.");
  const now = serverTimestamp();
  return addDoc(collection(firestore(), "workspaces", workspaceId, "terms", termId, "weeks", weekId, "lessons"), {
    ...values, title: values.title.trim(), summary: values.summary.trim(), weekId, objectives: "", plannedDate: null, durationMinutes: null, status: "draft", sortOrder: Date.now(), createdAt: now, updatedAt: now, archivedAt: null,
  });
}

export type LessonIndicatorLinkRow = Row<{ indicatorId: string; fullCode: string; description: string; subjectId: string; subjectName: string; levelId: string; sortOrder: number; archivedAt: unknown }>;
export type LessonResourceRow = Row<{ title: string; type: "link" | "note" | "file" | "other"; url: string; storagePath: string; notes: string; sortOrder: number; contentType?: string; sizeBytes?: number; archivedAt: unknown }>;
export type TeachingStepRow = Row<{ lessonId: string; title: string; phase: "opening" | "explore" | "explain" | "practice" | "assessment" | "closing"; instructions: string; minutes: number | null; sortOrder: number; archivedAt: unknown }>;

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
  if (!values.title.trim()) throw new Error("An assessment title is required.");
  ensureValidDateRange({ startDate: values.plannedDate, endDate: values.plannedDate }, "Assessment date");
  const now = serverTimestamp();
  return addDoc(assessmentCollection(workspaceId, termId, weekId, lessonId), { ...values, title: values.title.trim(), lessonId, createdAt: now, updatedAt: now, archivedAt: null });
}
export async function updateAssessment(workspaceId: string, termId: string, weekId: string, lessonId: string, assessmentId: string, values: Partial<Omit<AssessmentRow, "id" | "archivedAt" | "lessonId">>) {
  if (values.title !== undefined && !values.title.trim()) throw new Error("An assessment title is required.");
  if (values.plannedDate !== undefined) ensureValidDateRange({ startDate: values.plannedDate, endDate: values.plannedDate }, "Assessment date");
  await updateDoc(assessmentRef(workspaceId, termId, weekId, lessonId, assessmentId), { ...values, updatedAt: serverTimestamp() });
}
export async function removeAssessment(workspaceId: string, termId: string, weekId: string, lessonId: string, assessmentId: string) {
  await updateDoc(assessmentRef(workspaceId, termId, weekId, lessonId, assessmentId), { archivedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}
export function listAssessmentItems(workspaceId: string, termId: string, weekId: string, lessonId: string, assessmentId: string) {
  return getRows<AssessmentItemRow>(assessmentItemCollection(workspaceId, termId, weekId, lessonId, assessmentId), [where("archivedAt", "==", null), orderBy("sortOrder")]);
}
export async function addAssessmentItem(workspaceId: string, termId: string, weekId: string, lessonId: string, assessmentId: string, values: Omit<AssessmentItemRow, "id" | "archivedAt">) {
  if (!values.prompt.trim()) throw new Error("An assessment question is required.");
  if (!Number.isInteger(values.marks) || values.marks < 1) throw new Error("Marks must be a positive whole number.");
  const now = serverTimestamp();
  return addDoc(assessmentItemCollection(workspaceId, termId, weekId, lessonId, assessmentId), { ...values, prompt: values.prompt.trim(), assessmentId, createdAt: now, updatedAt: now, archivedAt: null });
}
export async function updateAssessmentItem(workspaceId: string, termId: string, weekId: string, lessonId: string, assessmentId: string, itemId: string, values: Partial<Omit<AssessmentItemRow, "id" | "archivedAt" | "assessmentId">>) {
  if (values.prompt !== undefined && !values.prompt.trim()) throw new Error("An assessment question is required.");
  if (values.marks !== undefined && (!Number.isInteger(values.marks) || values.marks < 1)) throw new Error("Marks must be a positive whole number.");
  await updateDoc(doc(assessmentItemCollection(workspaceId, termId, weekId, lessonId, assessmentId), itemId), { ...values, updatedAt: serverTimestamp() });
}
export async function removeAssessmentItem(workspaceId: string, termId: string, weekId: string, lessonId: string, assessmentId: string, itemId: string) {
  await updateDoc(doc(assessmentItemCollection(workspaceId, termId, weekId, lessonId, assessmentId), itemId), { archivedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function updateLesson(workspaceId: string, termId: string, weekId: string, lessonId: string, values: Partial<Pick<LessonRow, "title" | "summary" | "objectives" | "plannedDate" | "durationMinutes" | "status">>) {
  if (values.title !== undefined && !values.title.trim()) throw new Error("A lesson title is required.");
  if (values.plannedDate !== undefined) ensureValidDateRange({ startDate: values.plannedDate, endDate: values.plannedDate }, "Lesson date");
  if (values.durationMinutes !== undefined && values.durationMinutes !== null && (!Number.isInteger(values.durationMinutes) || values.durationMinutes < 1)) {
    throw new Error("Lesson duration must be a positive whole number of minutes.");
  }
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

const MAX_LESSON_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export async function addLessonFile(workspaceId: string, termId: string, weekId: string, lessonId: string, file: File) {
  if (!file.size || file.size > MAX_LESSON_FILE_BYTES) throw new Error("Choose a file smaller than 10 MB.");
  if (!ALLOWED_FILE_TYPES.has(file.type)) throw new Error("Choose a PDF, image, text, Word, Excel, or PowerPoint file.");
  const [storage, storageSdk] = await Promise.all([getStorageClient(), import("firebase/storage")]);
  if (!storage) throw new Error("Firebase Storage is not configured.");
  const resourceRef = doc(collection(lessonRef(workspaceId, termId, weekId, lessonId), "resources"));
  const safeName = file.name.replace(/[^a-zA-Z0-9._() -]/g, "_").replace(/^\.+/, "").slice(0, 100) || "attachment";
  const path = `workspaces/${workspaceId}/lessons/${lessonId}/resources/${resourceRef.id}/${safeName}`;
  const fileRef = storageSdk.ref(storage, path);
  await storageSdk.uploadBytes(fileRef, file, { contentType: file.type });
  const values = { title: file.name, type: "file" as const, url: "", storagePath: path, notes: "", sortOrder: Date.now(), contentType: file.type, sizeBytes: file.size };
  const now = serverTimestamp();
  try {
    await setDoc(resourceRef, { ...values, createdAt: now, updatedAt: now, archivedAt: null });
  } catch (error) {
    await storageSdk.deleteObject(fileRef).catch(() => undefined);
    throw error;
  }
  return { id: resourceRef.id, ...values, archivedAt: null } as LessonResourceRow;
}
export async function downloadLessonFile(path: string) {
  const [storage, storageSdk] = await Promise.all([getStorageClient(), import("firebase/storage")]);
  if (!storage) throw new Error("Firebase Storage is not configured.");
  return storageSdk.getBlob(storageSdk.ref(storage, path));
}
export async function deleteLessonFile(path: string) {
  const [storage, storageSdk] = await Promise.all([getStorageClient(), import("firebase/storage")]);
  if (!storage) throw new Error("Firebase Storage is not configured.");
  await storageSdk.deleteObject(storageSdk.ref(storage, path));
}

export function listLessonResources(workspaceId: string, termId: string, weekId: string, lessonId: string) {
  return getRows<LessonResourceRow>(collection(lessonRef(workspaceId, termId, weekId, lessonId), "resources"), [where("archivedAt", "==", null), orderBy("sortOrder")]);
}
export async function addLessonResource(workspaceId: string, termId: string, weekId: string, lessonId: string, values: Omit<LessonResourceRow, "id" | "archivedAt">) {
  if (!values.title.trim()) throw new Error("A resource title is required.");
  if (values.type === "file") throw new Error("Upload files through the attachment control.");
  if (values.type === "link") {
    try {
      const url = new URL(values.url);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    } catch { throw new Error("Enter a valid http or https URL."); }
  }
  const now = serverTimestamp();
  return addDoc(collection(lessonRef(workspaceId, termId, weekId, lessonId), "resources"), { ...values, createdAt: now, updatedAt: now, archivedAt: null });
}
export async function removeLessonResource(workspaceId: string, termId: string, weekId: string, lessonId: string, resourceId: string) {
  await updateDoc(doc(collection(lessonRef(workspaceId, termId, weekId, lessonId), "resources"), resourceId), { archivedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function listTeachingSteps(workspaceId: string, termId: string, weekId: string, lessonId: string) {
  const rows = await getRows<TeachingStepRow>(collection(lessonRef(workspaceId, termId, weekId, lessonId), "teachingSteps"), [where("archivedAt", "==", null), orderBy("sortOrder")]);
  // Older lesson steps predate the explicit parent ID; derive it from their path.
  return rows.map((row) => ({ ...row, lessonId: row.lessonId || lessonId }));
}
export async function addTeachingStep(workspaceId: string, termId: string, weekId: string, lessonId: string, values: Omit<TeachingStepRow, "id" | "archivedAt" | "lessonId">) {
  const now = serverTimestamp();
  return addDoc(collection(lessonRef(workspaceId, termId, weekId, lessonId), "teachingSteps"), { ...values, lessonId, createdAt: now, updatedAt: now, archivedAt: null });
}
export async function updateTeachingStep(workspaceId: string, termId: string, weekId: string, lessonId: string, stepId: string, values: Partial<Omit<TeachingStepRow, "id" | "archivedAt" | "lessonId">>) {
  await updateDoc(doc(collection(lessonRef(workspaceId, termId, weekId, lessonId), "teachingSteps"), stepId), { ...values, lessonId, updatedAt: serverTimestamp() });
}
export async function removeTeachingStep(workspaceId: string, termId: string, weekId: string, lessonId: string, stepId: string) {
  await updateDoc(doc(collection(lessonRef(workspaceId, termId, weekId, lessonId), "teachingSteps"), stepId), { archivedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function setLessonStatus(workspaceId: string, termId: string, weekId: string, lessonId: string, status: LessonRow["status"]) {
  await updateDoc(lessonRef(workspaceId, termId, weekId, lessonId), { status, updatedAt: serverTimestamp() });
}
export async function archiveLesson(workspaceId: string, termId: string, weekId: string, lessonId: string) {
  await updateDoc(lessonRef(workspaceId, termId, weekId, lessonId), { archivedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}
