import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";

let environment: RulesTestEnvironment;
const projectId = "demo-teaching-assistant";
const filePath = "workspaces/ws/lessons/lesson-1/resources/resource-1/lesson.pdf";
const now = Timestamp.fromDate(new Date("2026-09-01T12:00:00Z"));

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync("firebase/firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
    storage: { rules: readFileSync("firebase/storage.rules", "utf8"), host: "127.0.0.1", port: 9199 },
  });
});

afterAll(async () => environment.cleanup());
beforeEach(async () => {
  await environment.clearFirestore();
  await environment.clearStorage();
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await setDoc(doc(database, "workspaces/ws"), { name: "School", ownerUid: "owner", archivedAt: null, createdAt: now, updatedAt: now });
    await setDoc(doc(database, "workspaces/ws/members/editor"), { uid: "editor", role: "editor", createdAt: now, updatedAt: now });
    await setDoc(doc(database, "workspaces/ws/members/viewer"), { uid: "viewer", role: "viewer", createdAt: now, updatedAt: now });
  });
});
afterEach(async () => {
  await environment.clearStorage();
  await environment.clearFirestore();
});

describe("Firebase Storage workspace rules", () => {
  it("allows workspace editors to upload and members to read an approved file", async () => {
    const editorStorage = environment.authenticatedContext("editor").storage();
    const viewerStorage = environment.authenticatedContext("viewer").storage();
    const contents = new Blob(["sample PDF"], { type: "application/pdf" });
    await assertSucceeds(uploadBytes(ref(editorStorage, filePath), contents, { contentType: "application/pdf" }));
    const downloaded = await assertSucceeds(getBytes(ref(viewerStorage, filePath)));
    expect(new TextDecoder().decode(downloaded)).toBe("sample PDF");
    await assertSucceeds(deleteObject(ref(editorStorage, filePath)));
  });

  it("blocks viewers and non-members from writing and blocks unsupported files", async () => {
    const viewerStorage = environment.authenticatedContext("viewer").storage();
    const outsiderStorage = environment.authenticatedContext("outsider").storage();
    const editorStorage = environment.authenticatedContext("editor").storage();
    const pdf = new Blob(["file"], { type: "application/pdf" });
    await assertFails(uploadBytes(ref(viewerStorage, filePath), pdf, { contentType: "application/pdf" }));
    await assertFails(uploadBytes(ref(outsiderStorage, filePath), pdf, { contentType: "application/pdf" }));
    await assertFails(uploadBytes(ref(editorStorage, filePath), new Blob(["script"], { type: "application/javascript" }), { contentType: "application/javascript" }));
  });
});
