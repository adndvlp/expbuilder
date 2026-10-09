import { generateConditionEval, sanitizeId } from './helpers.js'

export function generateTrialBranching(trial, loopId) {
  const branches = trial.branches || []
  const conditions = (trial.branchConditions || []).flat().filter(Boolean)
  if (!branches.length && !conditions.length) return ''

  const scope = loopId != null ? `loop_${sanitizeId(loopId)}_` : 'window.'
  const variable = name => loopId != null
    ? `${scope}${name}`
    : `${scope}${name.charAt(0).toLowerCase()}${name.slice(1)}`
  const matchCode = conditions.map((condition, index) =>
    `${index ? 'else ' : ''}if (${generateConditionEval(condition)}) {
      matchedBranch = branchConditions[${index}];
    }`,
  ).join('\n    ')

  return `
    const branchConditions = ${JSON.stringify(conditions)};
    let matchedBranch = null;
    ${matchCode}
    const branchTarget = matchedBranch?.nextTrialId ?? ${JSON.stringify(branches[0] ?? null)};
    if (branchTarget !== null && branchTarget !== undefined) {
      ${variable('NextTrialId')} = branchTarget;
      ${variable('SkipRemaining')} = true;
      ${variable('BranchingActive')} = true;
      ${variable('BranchUsedDefault')} = matchedBranch === null;
      ${loopId != null ? `${variable('BranchSourceId')} = data.builder_id ?? data.trial_id ?? null;` : ''}
      ${loopId != null ? `${variable('TargetExecuted')} = false;` : ''}
      ${variable('BranchCustomParameters')} = matchedBranch?.customParameters ?? null;
    }
`
}
