import type { User } from "firebase/auth";
import { collection, doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import type { UserProfile } from "../types/models";

export async function ensureWorkspace(user: User): Promise<UserProfile> {
  if (!db) throw new Error("Firebase is not configured.");
  const profileRef = doc(db, "users", user.uid);
  const existing = await getDoc(profileRef);
  if (existing.exists()) return existing.data() as UserProfile;

  const workspaceRef = doc(collection(db, "workspaces"));
  const memberRef = doc(db, "workspaces", workspaceRef.id, "members", user.uid);
  const now = serverTimestamp();
  const batch = writeBatch(db);
  batch.set(workspaceRef, { name: user.displayName ? `${user.displayName}'s workspace` : "My teaching workspace", ownerUid: user.uid, createdAt: now, updatedAt: now, archivedAt: null });
  batch.set(memberRef, { uid: user.uid, role: "owner", createdAt: now, updatedAt: now });
  batch.set(profileRef, { displayName: user.displayName || "", email: user.email || "", activeWorkspaceId: workspaceRef.id, createdAt: now, updatedAt: now });
  await batch.commit();
  return { displayName: user.displayName || "", email: user.email || "", activeWorkspaceId: workspaceRef.id } as UserProfile;
}
