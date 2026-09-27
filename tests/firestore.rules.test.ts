import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from "vitest";
import { deleteDoc, doc, getDoc, setDoc, Timestamp, writeBatch } from "firebase/firestore";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";

let environment: RulesTestEnvironment;
const projectId = "demo-teaching-assistant";
const now = Timestamp.fromDate(new Date("2026-09-01T12:00:00Z"));

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync("firebase/firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => environment.cleanup());
beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await setDoc(doc(database, "workspaces/ws"), { name: "School", ownerUid: "owner", archivedAt: null, createdAt: now, updatedAt: now });
    for (const [uid, role] of [["owner", "owner"], ["editor", "editor"], ["viewer", "viewer"]]) {
      await setDoc(doc(database, `workspaces/ws/members/${uid}`), { uid, role, createdAt: now, updatedAt: now });
    }
    await setDoc(doc(database, "workspaces/other"), { name: "Other", ownerUid: "someone-else", archivedAt: null, createdAt: now, updatedAt: now });
    await setDoc(doc(database, "workspaces/other/members/someone-else"), { uid: "someone-else", role: "owner", createdAt: now, updatedAt: now });
  });
});
afterEach(async () => environment.clearFirestore());

function termRecord() {
  return { name: "Term One", academicYear: "2026/2027", startDate: "2026-09-01", endDate: "2026-12-20", archivedAt: null, createdAt: now, updatedAt: now };
}

describe("Firestore workspace rules", () => {
  it("isolates workspace reads by membership", async () => {
    const editor = environment.authenticatedContext("editor").firestore();
    const outsider = environment.authenticatedContext("outsider").firestore();
    await assertSucceeds(getDoc(doc(editor, "workspaces/ws")));
    await assertFails(getDoc(doc(outsider, "workspaces/ws")));
    await assertFails(getDoc(doc(editor, "workspaces/other")));
  });

  it("allows editors to create valid plans but blocks viewers", async () => {
    const editor = environment.authenticatedContext("editor").firestore();
    const viewer = environment.authenticatedContext("viewer").firestore();
    await assertSucceeds(setDoc(doc(editor, "workspaces/ws/terms/term-1"), termRecord()));
    await assertFails(setDoc(doc(viewer, "workspaces/ws/terms/term-2"), { ...termRecord(), name: "Term Two" }));
    await assertFails(setDoc(doc(editor, "workspaces/ws/terms/bad-date"), { ...termRecord(), startDate: "2026-9-1" }));
  });

  it("requires the owner workspace and membership to be created atomically", async () => {
    const database = environment.authenticatedContext("new-owner").firestore();
    const batch = writeBatch(database);
    batch.set(doc(database, "workspaces/new-ws"), { name: "My workspace", ownerUid: "new-owner", archivedAt: null, createdAt: now, updatedAt: now });
    batch.set(doc(database, "workspaces/new-ws/members/new-owner"), { uid: "new-owner", role: "owner", createdAt: now, updatedAt: now });
    batch.set(doc(database, "users/new-owner"), { displayName: "New Owner", email: "new@example.test", activeWorkspaceId: "new-ws", createdAt: now, updatedAt: now });
    await assertSucceeds(batch.commit());

    const outsider = environment.authenticatedContext("outsider").firestore();
    await assertFails(setDoc(doc(outsider, "workspaces/ws/members/outsider"), { uid: "outsider", role: "owner", createdAt: now, updatedAt: now }));
  });

  it("preserves week identity and validates lesson document shapes", async () => {
    const editor = environment.authenticatedContext("editor").firestore();
    await setDoc(doc(editor, "workspaces/ws/terms/term-1"), termRecord());
    const week = doc(editor, "workspaces/ws/terms/term-1/weeks/week-1");
    const weekData = { termId: "term-1", number: 1, title: "Week 1", startDate: null, endDate: null, sortOrder: 1, archivedAt: null, createdAt: now, updatedAt: now };
    const lock = doc(editor, "workspaces/ws/terms/term-1/weekNumberLocks/1");
    const batch = writeBatch(editor);
    batch.set(lock, { number: 1, weekId: "week-1", createdAt: now, updatedAt: now });
    batch.set(week, weekData);
    await assertSucceeds(batch.commit());
    await assertFails(setDoc(week, { ...weekData, number: 2, title: "Week 2" }));
    await assertFails(setDoc(doc(editor, "workspaces/ws/terms/term-1/weeks/week-2"), weekData));
    await assertFails(setDoc(doc(editor, "workspaces/ws/terms/term-1/weekNumberLocks/99"), { number: 99, weekId: "missing-week", createdAt: now, updatedAt: now }));

    await assertSucceeds(setDoc(doc(editor, `${week.path}/lessons/lesson-1`), {
      weekId: "week-1", title: "Fractions", summary: "", objectives: "", plannedDate: null,
      durationMinutes: 50, status: "draft", sortOrder: 1, archivedAt: null, createdAt: now, updatedAt: now,
    }));
    await assertFails(setDoc(doc(editor, `${week.path}/lessons/lesson-bad`), {
      weekId: "some-other-week", title: "Fractions", summary: "", objectives: "", plannedDate: null,
      durationMinutes: 0, status: "draft", sortOrder: 1, archivedAt: null, createdAt: now, updatedAt: now,
    }));
  });

  it("denies changing the owner or updating protected user profile fields", async () => {
    const owner = environment.authenticatedContext("owner").firestore();
    const profile = doc(owner, "users/owner");
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users/owner"), { displayName: "Owner", email: "owner@example.test", activeWorkspaceId: "ws", createdAt: now, updatedAt: now });
    });
    await assertFails(setDoc(doc(owner, "workspaces/ws"), { name: "Changed", ownerUid: "attacker", archivedAt: null, createdAt: now, updatedAt: now }));
    await assertFails(deleteDoc(doc(owner, "workspaces/ws")));
    await assertFails(setDoc(profile, { displayName: "Owner", email: "changed@example.test", activeWorkspaceId: "other", createdAt: now, updatedAt: now }));
  });
});
