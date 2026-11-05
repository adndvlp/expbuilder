import { randomUUID } from "node:crypto";
import { db } from "../app.js";
import {
  assertExperimentID,
  assertExperimentOwner,
  ExperimentAccessError,
} from "./access.js";

const LEASE_MS = 120_000;

/** Reserve ownership and exclude publication/deletion before any provider call. */
export async function withExperimentMutation(
  { experimentID, uid, operation, initialData },
  work,
) {
  assertExperimentID(experimentID);
  // Validate identity even when the document does not yet exist.
  assertExperimentOwner({ owner: uid }, uid);
  const ref = db.collection("experiments").doc(experimentID);
  const leaseToken = randomUUID();
  const reservation = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists && !initialData) {
      throw new ExperimentAccessError(
        "EXPERIMENT_NOT_FOUND",
        404,
        "Experiment not found",
      );
    }
    const data = snapshot.exists ? snapshot.data() : initialData;
    assertExperimentOwner(data, uid);
    if (data.mutationLease) {
      const expired = data.mutationLease.expiresAt <= Date.now();
      throw new ExperimentAccessError(
        expired ? "MUTATION_RECOVERY_REQUIRED" : "PUBLICATION_IN_PROGRESS",
        409,
        expired
          ? "An interrupted mutation needs reconciliation before another operation"
          : "Another experiment mutation is in progress",
      );
    }
    const generation = (data.mutationGeneration || 0) + 1;
    const lease = {
      operation,
      leaseToken,
      generation,
      expiresAt: Date.now() + LEASE_MS,
    };
    if (snapshot.exists)
      transaction.update(ref, {
        mutationLease: lease,
        mutationGeneration: generation,
      });
    else
      transaction.create(ref, {
        ...data,
        mutationLease: lease,
        mutationGeneration: generation,
      });
    return { data, created: !snapshot.exists, generation };
  });

  let renewalError;
  let renewal = Promise.resolve();
  async function transact(patch, remove = false) {
    if (renewalError) throw renewalError;
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const data = snapshot.data();
      assertExperimentOwner(data, uid);
      if (
        data.mutationLease?.leaseToken !== leaseToken ||
        data.mutationLease.expiresAt <= Date.now()
      ) {
        throw new ExperimentAccessError(
          "MUTATION_LEASE_LOST",
          409,
          "The experiment mutation permission expired or changed",
        );
      }
      if (remove) transaction.delete(ref);
      else
        transaction.update(ref, {
          ...patch,
          mutationLease: {
            ...data.mutationLease,
            expiresAt: Date.now() + LEASE_MS,
          },
        });
    });
  }
  const mutation = {
    ref,
    ...reservation,
    check: () => transact({}),
    update: async (patch) => {
      await transact(patch);
      Object.assign(reservation.data, patch);
    },
    remove: () => transact({}, true),
  };
  const timer = setInterval(() => {
    renewal = renewal
      .then(() => mutation.check())
      .catch((error) => {
        renewalError = error;
      });
  }, LEASE_MS / 3);
  timer.unref();
  try {
    return await work(mutation);
  } finally {
    clearInterval(timer);
    await renewal;
    try {
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (
          snapshot.exists &&
          snapshot.data().owner === uid &&
          snapshot.data().mutationLease?.leaseToken === leaseToken
        ) {
          transaction.update(ref, { mutationLease: null });
        }
      });
    } catch (error) {
      // A failed release stays closed; M06 supplies reconciliation of interrupted remote writes.
      console.error("Could not release experiment mutation permission:", error);
    }
  }
}
