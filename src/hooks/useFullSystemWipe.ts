import {
  collection,
  getDocs,
  limit,
  query,
  writeBatch,
  Firestore,
  QueryDocumentSnapshot,
  DocumentData,
  startAfter
} from "firebase/firestore";

import { useCallback, useState } from "react";

const BATCH_LIMIT = 400; // Safer limit than 500

export type CollectionProgress = {
  collection: string;
  deleted: number;
  skipped: number;
  status: "pending" | "running" | "completed" | "failed";
  error?: string;
};

type WipeOptions = {
  collections: string[];
  preserveAdminEmails?: string[];
  preserveAdminRoles?: string[];
  onProgress?: (progress: CollectionProgress) => void;
  dryRun?: boolean;
};

type WipeResult = {
  success: boolean;
  collections: CollectionProgress[];
  totalDeleted: number;
  totalSkipped: number;
};

export function useFullSystemWipe(db: Firestore) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<CollectionProgress[]>([]);

  const updateProgress = (data: CollectionProgress) => {
    setProgress((prev) => {
      const existing = prev.find((p) => p.collection === data.collection);
      if (!existing) {
        return [...prev, data];
      }
      return prev.map((p) => (p.collection === data.collection ? data : p));
    });
  };

  const shouldPreserveUser = (
    userData: any,
    preserveEmails: string[],
    preserveRoles: string[]
  ) => {
    const email = userData?.email?.toLowerCase?.() || "";
    const role = userData?.role || "";

    const emailMatch = preserveEmails.some(
      (e) => e.toLowerCase() === email
    );

    const roleMatch = preserveRoles.includes(role);

    return emailMatch || roleMatch;
  };

  const deleteCollectionInBatches = async ({
    collectionName,
    preserveAdminEmails,
    preserveAdminRoles,
    dryRun,
    onProgress,
  }: {
    collectionName: string;
    preserveAdminEmails: string[];
    preserveAdminRoles: string[];
    dryRun: boolean;
    onProgress?: (progress: CollectionProgress) => void;
  }): Promise<CollectionProgress> => {
    let deleted = 0;
    let skipped = 0;
    let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;

    const progressData: CollectionProgress = {
      collection: collectionName,
      deleted: 0,
      skipped: 0,
      status: "running",
    };

    try {
      while (true) {
        // Query from top. As we delete, the next BATCH_LIMIT docs will rise to the top.
        const q = query(
          collection(db, collectionName),
          limit(BATCH_LIMIT)
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) break;

        const batch = writeBatch(db);
        let operationsInBatch = 0;

        for (const document of snapshot.docs) {
          // Special handling for users collection
          if (collectionName === "users") {
            const userData = document.data();
            const preserve = shouldPreserveUser(
              userData,
              preserveAdminEmails,
              preserveAdminRoles
            );

            if (preserve) continue;
          }

          batch.delete(document.ref);
          deleted++;
          operationsInBatch++;
        }

        if (operationsInBatch > 0) {
          await batch.commit();
        }

        progressData.deleted = deleted;
        updateProgress(progressData);
        if (onProgress) onProgress(progressData);

        // Safety break: if we couldn't delete anything in this batch but it's not empty,
        // it means everything left is preserved (like admins).
        if (operationsInBatch === 0 && snapshot.docs.length > 0) {
          // To avoid infinite loop on users collection where we skip admins,
          // we only continue if it's NOT the users collection or we haven't seen this before.
          // For simplicity, if we skipped everything in a snapshot, we're likely done with this collection.
          break;
        }

        // If we got fewer docs than the limit, we're definitely done.
        if (snapshot.docs.length < BATCH_LIMIT) break;
      }

      progressData.status = "completed";
      updateProgress(progressData);
      return progressData;
    } catch (error: any) {
      console.error(`Failed wiping collection: ${collectionName}`, error);
      progressData.status = "failed";
      progressData.error = error?.message || "Unknown error";
      updateProgress(progressData);
      if (onProgress) onProgress(progressData);
      return progressData;
    }
  };

  const wipeSystem = useCallback(
    async ({
      collections,
      preserveAdminEmails = [],
      preserveAdminRoles = ["admin", "superadmin"],
      onProgress,
      dryRun = false,
    }: WipeOptions): Promise<WipeResult> => {
      setRunning(true);
      setProgress([]);

      try {
        const results: CollectionProgress[] = [];

        for (const collectionName of collections) {
          const result = await deleteCollectionInBatches({
            collectionName,
            preserveAdminEmails,
            preserveAdminRoles,
            dryRun,
            onProgress,
          });
          results.push(result);
        }

        const totalDeleted = results.reduce((sum, item) => sum + item.deleted, 0);
        const totalSkipped = results.reduce((sum, item) => sum + item.skipped, 0);

        return {
          success: results.every((r) => r.status === "completed"),
          collections: results,
          totalDeleted,
          totalSkipped,
        };
      } finally {
        setRunning(false);
      }
    },
    [db]
  );

  return {
    wipeSystem,
    progress,
    running,
  };
}
