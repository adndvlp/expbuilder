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
      
      // Structured navigation from loop-branches, with localStorage fallback from self-hosted
      const navigationDecision =
        window.ExpBuilderNavigation?.enterItem(currentId, 'trial');
      if (navigationDecision !== null && navigationDecision !== undefined) {
        return navigationDecision;
      }
      // Fallback: Verificar si hay un trial objetivo guardado en localStorage (para repeat/jump)
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
        if (String(currentId) === String(window.nextTrialId)) {
          window.ExpBuilderRuntime?.emit('branch-target-enter', {
            targetId: currentId
          });
          window.skipRemaining = false;
          window.nextTrialId = null;
          return true;
        }
        return false;
      }
      
      return true;
    },
  `;
}
