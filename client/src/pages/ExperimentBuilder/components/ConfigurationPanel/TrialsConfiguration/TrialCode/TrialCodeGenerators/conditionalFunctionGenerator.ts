/**
 * Generates the conditional_function code for procedures
 * This handles skipping remaining trials (branching) and repeating/jumping logic
 */
export function generateConditionalFunctionCode(
  id: number | undefined,
): string {
  // If no ID is provided, use a placeholder or handle gracefully
  // In the builder, every trial usually has an ID
  const trialId = id !== undefined ? id : "null";

  return `
    conditional_function: function() {
      const currentId = ${trialId};
      
      // Verificar si hay un trial objetivo guardado en localStorage (para repeat/jump)
      const jumpKey = window.JSPSYCH_LOCAL_KEYS?.jumpTrial || 'jsPsych_jumpToTrial';
      const jumpToTrial = localStorage.getItem(jumpKey);
      if (jumpToTrial) {
        if (String(currentId) === String(jumpToTrial)) {
          // Encontramos el trial objetivo para repeat/jump
          console.log('🔁 [REPEAT/JUMP] Found target trial', currentId);
          localStorage.removeItem(jumpKey);
          return true;
        }
        // No es el objetivo, saltar
        console.log('⏭️ [REPEAT/JUMP] Skipping trial', currentId);
        return false;
      }
      
      // Si skipRemaining está activo (branching normal), verificar si este es el trial objetivo
      if (window.skipRemaining) {
        console.log('🔍 [SKIP CHECK] Trial', currentId, '| Target:', window.nextTrialId, '| Match:', String(currentId) === String(window.nextTrialId));
        if (String(currentId) === String(window.nextTrialId)) {
          // Encontramos el trial objetivo
          console.log('✅ [SKIP CHECK] Found target trial! Disabling skip mode');
          window.skipRemaining = false;
          window.nextTrialId = null;
          return true;
        }
        // No es el objetivo, saltar
        console.log('⏭️ [SKIP CHECK] Skipping trial', currentId);
        return false;
      }
      
      return true;
    },
  `;
}
