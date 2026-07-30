export function resumeCode(): string {
  return `
  function _resolveResumeBranch(resumeRaw) {
    if (!resumeRaw) return null;
    try {
      const d = JSON.parse(resumeRaw);
      const branches = d.branches || [];
      const branchConditions = d.branchConditions || [];
      const trialData = d.trialData || {};

      if (branches.length === 0) return null;
      if (branches.length === 1) return String(branches[0]);

      const flat = Array.isArray(branchConditions[0])
        ? branchConditions.flat()
        : branchConditions;

      for (let i = 0; i < flat.length; i++) {
        const cond = flat[i];
        if (!cond || !cond.rules) continue;
        const match = cond.rules.every(rule => {
          let col = rule.column || '';
          if (!col && rule.componentIdx && rule.prop) {
            col = rule.componentIdx + '_' + rule.prop;
          } else if (!col && rule.prop) {
            col = rule.prop;
          }

          let val = trialData[col];
          if (val === undefined) {
            const parts = col.split('_');
            if (parts.length >= 2) {
              const responseKey = parts.slice(0, -1).join('_') + '_response';
              const response = trialData[responseKey];
              if (response && typeof response === 'object') {
                val = response[parts[parts.length - 1]];
              }
            }
          }

          if (Array.isArray(val)) {
            const has = val.includes(rule.value) || val.includes(String(rule.value));
            return rule.op === '==' ? has : rule.op === '!=' ? !has : false;
          }

          const left = parseFloat(val);
          const right = parseFloat(rule.value);
          const numeric = !isNaN(left) && !isNaN(right);
          switch (rule.op) {
            case '==': return numeric ? left === right : val == rule.value;
            case '!=': return numeric ? left !== right : val != rule.value;
            case '>': return numeric && left > right;
            case '<': return numeric && left < right;
            case '>=': return numeric && left >= right;
            case '<=': return numeric && left <= right;
            default: return false;
          }
        });

        if (match) {
          if (cond.nextTrialId !== undefined && cond.nextTrialId !== null) {
            return String(cond.nextTrialId);
          }
          if (i < branches.length) return String(branches[i]);
        }
      }
      return String(branches[0]);
    } catch (error) {
      return null;
    }
  }
`;
}
