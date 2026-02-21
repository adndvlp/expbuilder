/**
 * Returns the JS snippet (as a string) that injects _resolveResumeBranch
 * into the experiment page.
 *
 * Usage in generated code:
 *   const jumpTarget = _resolveResumeBranch(localStorage.getItem('jsPsych_resumeTrial'));
 *   // Returns the target trial id (string) or null if nothing to resume.
 */
export function resumeCode(): string {
  return `
  // Resuelve a qué trial saltar al reanudar evaluando las branch conditions guardadas.
  // Retorna el id (string) del trial destino, o null si no hay punto de retoma.
  function _resolveResumeBranch(resumeRaw) {
    if (!resumeRaw) return null;
    try {
      const d = JSON.parse(resumeRaw);
      const branches = d.branches || [];
      const branchConditions = d.branchConditions || [];
      const trialData = d.trialData || {};

      if (branches.length === 0) return null; // trial terminal, experimento terminó
      if (branches.length === 1) return String(branches[0]); // único branch, sin condiciones

      // Múltiples branches: evaluar condiciones (OR entre condiciones, AND entre reglas)
      const flat = Array.isArray(branchConditions[0])
        ? branchConditions.flat()
        : branchConditions;

      for (let i = 0; i < flat.length; i++) {
        const cond = flat[i];
        if (!cond || !cond.rules) continue;
        const match = cond.rules.every(rule => {
          let col = rule.column || '';
          if (!col && rule.componentIdx && rule.prop) col = rule.componentIdx + '_' + rule.prop;
          else if (!col && rule.prop) col = rule.prop;
          let val = trialData[col];
          // Manejar respuestas anidadas (SurveyComponent)
          if (val === undefined) {
            const parts = col.split('_');
            if (parts.length >= 2) {
              const resp = trialData[parts.slice(0, -1).join('_') + '_response'];
              if (resp && typeof resp === 'object') val = resp[parts[parts.length - 1]];
            }
          }
          // Respuestas en array (multi-select)
          if (Array.isArray(val)) {
            const has = val.includes(rule.value) || val.includes(String(rule.value));
            return rule.op === '==' ? has : rule.op === '!=' ? !has : false;
          }
          const n1 = parseFloat(val), n2 = parseFloat(rule.value);
          const isNum = !isNaN(n1) && !isNaN(n2);
          switch (rule.op) {
            case '==': return isNum ? n1 === n2 : val == rule.value;
            case '!=': return isNum ? n1 !== n2 : val != rule.value;
            case '>':  return isNum && n1 > n2;
            case '<':  return isNum && n1 < n2;
            case '>=': return isNum && n1 >= n2;
            case '<=': return isNum && n1 <= n2;
            default:   return false;
          }
        });
        if (match && i < branches.length) return String(branches[i]);
      }
      return String(branches[0]); // fallback al primero si ninguna condición matchea
    } catch (e) {
      return null; // datos corruptos
    }
  }
`;
}
