import { db } from '../../../app.js';
export const sessionReference = (experimentID, sessionId) => db.collection('experiments').doc(experimentID).collection('sessions').doc(sessionId);
