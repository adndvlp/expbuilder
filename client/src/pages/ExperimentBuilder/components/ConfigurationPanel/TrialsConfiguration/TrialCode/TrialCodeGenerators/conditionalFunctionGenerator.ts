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
      const jumpToTrial = localStorage.getItem('jsPsych_jumpToTrial');
      if (jumpToTrial) {
        if (String(currentId) === String(jumpToTrial)) {
          window.ExpBuilderRuntime?.emit('jump-target-enter', {
            targetId: currentId
          });
          localStorage.removeItem('jsPsych_jumpToTrial');
          return true;
        }
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
