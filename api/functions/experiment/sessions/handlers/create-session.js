import { db } from "../../../app.js";
import writeLog from "../logging/write-log.js";
import MESSAGES from "../../api/messages.js";
import { deserializeFromFirestore } from "../validation/serialize.js";

function reject(message) { throw Object.assign(new Error(message.error), { response: message }); }

async function registrationResponse(ref, data, experimentID, sessionId) {
  const snapshot = await ref.collection("event_receipts").get();
  const receivedEvents = (snapshot?.docs ?? []).map(doc => {
    const { eventId, sequence, payloadHash } = doc.data();
    return { eventId, sequence, payloadHash };
  }).sort((a, b) => a.sequence - b.sequence);
  return { success: true, ...data, experimentID, sessionId, receivedEvents,
    receivedEventCount: receivedEvents.length, resumeCheckpoint: deserializeFromFirestore(data.resumeCheckpoint) ?? null };
}

export async function handleCreateSession(req, res, experimentID, sessionId) {
  try {
    await writeLog(experimentID, "createSession");
    const experiment = db.collection("experiments").doc(experimentID);
    const initial = await experiment.get();
    if (!initial.exists) { res.status(400).json(MESSAGES.EXPERIMENT_NOT_FOUND); return; }
    if (!initial.data().active) { res.status(400).json(MESSAGES.DATA_COLLECTION_NOT_ACTIVE); return; }
    const session = experiment.collection("sessions").doc(sessionId);
    const existing = await session.get();
    if (existing.exists) {
      res.status(200).json(await registrationResponse(session, existing.data(), experimentID, sessionId));
      return;
    }
    let result;
    try {
      result = await db.runTransaction(async transaction => {
        const currentExperiment = await transaction.get(experiment);
        const currentSession = await transaction.get(session);
        if (!currentExperiment.exists) reject(MESSAGES.EXPERIMENT_NOT_FOUND);
        const config = currentExperiment.data();
        if (!config.active) reject(MESSAGES.DATA_COLLECTION_NOT_ACTIVE);
        if (currentSession.exists) return { created: false, data: currentSession.data() };
        if (config.limitSessions && (config.sessions ?? 0) >= config.maxSessions) reject(MESSAGES.MAX_SESSIONS_REACHED);
        const participantNumber = config.currentCondition || 0;
        const nextCondition = config.activeConditionAssignment !== false && config.nConditions > 1
          ? (participantNumber + 1) % config.nConditions : participantNumber + 1;
        const data = { experimentID, sessionId, participantNumber, condition: participantNumber,
          createdAt: new Date().toISOString(), sessionProtocolVersion: 2, eventProtocolVersion: 1,
          lifecycle: "active", trialCount: 0, receivedEventCount: 0,
          metadata: req.body.metadata ?? {},
          ...(req.body.sessionName && { sessionName: req.body.sessionName }),
        };
        transaction.set(session, data);
        transaction.set(experiment, { currentCondition: nextCondition, sessions: (config.sessions ?? 0) + 1 }, { merge: true });
        return { created: true, data };
      });
    } catch (error) {
      console.error("Error registering session:", error);
      res.status(400).json(error.response ?? MESSAGES.UNKNOWN_ERROR_GETTING_CONDITION);
      return;
    }
    if (result.created && req.body.sessionName) {
      try {
        await experiment.collection("session_metadata").doc(sessionId).set({
          sessionId, sessionName: result.data.sessionName, createdAt: result.data.createdAt,
        }, { merge: true });
      } catch (error) { console.error("Error writing sessionName metadata:", error); }
    }
    res.status(result.created ? 201 : 200).json(await registrationResponse(session, result.data, experimentID, sessionId));
  } catch (error) {
    console.error("Error in handleCreateSession:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}
