import { BranchCondition, RepeatCondition } from "./types";

type Props = {
  code: string;
  hasBranchesLoop: boolean | undefined;
  branches: (string | number)[] | undefined;
  branchConditions: BranchCondition[] | undefined;
  repeatConditions?: RepeatCondition[] | undefined;
  id: string | undefined;
  loopIdSanitized: string;
};

function BranchesCode({
  code,
  hasBranchesLoop,
  branches,
  branchConditions,
  repeatConditions,
  loopIdSanitized,
  id,
}: Props) {
  // Lógica de branching para el loop (igual que trials)
  const hasBranches = hasBranchesLoop;
  const hasMultipleBranches = branches && branches.length > 1;
  const hasBranchConditions = branchConditions && branchConditions.length > 0;
  const hasRepeatConditions = repeatConditions && repeatConditions.length > 0;

  if (hasBranches || hasRepeatConditions) {
    // Si tiene branches o repeat conditions, generar on_finish completo
    if (hasRepeatConditions) {
      // Generar on_finish con evaluación de repeat conditions
      code += `
  on_finish: function(data) {
    // Evaluar repeat conditions (para reiniciar el experimento desde un trial específico)
    const repeatConditionsArray = ${JSON.stringify(repeatConditions)};
    
    let shouldRepeat = false;
    for (const condition of repeatConditionsArray) {
      if (!condition || !condition.rules) {
        continue;
      }
      
      // Get the last trial data from the loop
      const loopData = jsPsych.data.get().filter({loop_id: "${id}"}).values();
      if (loopData.length === 0) continue;
      
      const lastTrialData = loopData[loopData.length - 1];
      
      // Todas las reglas en una condición deben ser verdaderas (lógica AND)
      const allRulesMatch = condition.rules.every(rule => {
        // Construct column name from componentIdx and prop if column is empty
        let columnName = rule.column || "";
        if (!columnName && rule.componentIdx && rule.prop) {
          columnName = rule.componentIdx + '_' + rule.prop;
        } else if (!columnName && rule.prop) {
          columnName = rule.prop;
        }
        
        const propValue = lastTrialData[columnName];
        const compareValue = rule.value;
        
        // Convertir valores para comparación
        const numPropValue = parseFloat(propValue);
        const numCompareValue = parseFloat(compareValue);
        const isNumeric = !isNaN(numPropValue) && !isNaN(numCompareValue);
        
        switch (rule.op) {
          case '==':
            return isNumeric ? numPropValue === numCompareValue : propValue == compareValue;
          case '!=':
            return isNumeric ? numPropValue !== numCompareValue : propValue != compareValue;
          case '>':
            return isNumeric && numPropValue > numCompareValue;
          case '<':
            return isNumeric && numPropValue < numCompareValue;
          case '>=':
            return isNumeric && numPropValue >= numCompareValue;
          case '<=':
            return isNumeric && numPropValue <= numCompareValue;
          default:
            return false;
        }
      });
      
      if (allRulesMatch && condition.jumpToTrialId) {
        console.log('Loop repeat condition matched! Jumping to trial:', condition.jumpToTrialId);
        // Guardar el trial objetivo en localStorage
        localStorage.setItem('jsPsych_jumpToTrial', String(condition.jumpToTrialId));
        shouldRepeat = true;
        break;
      }
    }
    
    if (shouldRepeat) {
      // Limpiar el contenedor de jsPsych (jspsych-container es el display_element)
      const container = document.getElementById('jspsych-container');
      if (container) {
        // Limpiar todo el contenido del container
        container.innerHTML = '';
      }
      // Reiniciar el timeline
      setTimeout(() => {
        jsPsych.run(timeline);
      }, 100);
      return;
    }
    
    ${
      hasBranches
        ? hasMultipleBranches && hasBranchConditions
          ? `
    // Evaluar condiciones del loop para branching
    // Solo si NO se activó desde trial interno (ShouldBranchOnFinish o BranchingActive)
    if (!loop_${loopIdSanitized}_ShouldBranchOnFinish && !loop_${loopIdSanitized}_BranchingActive) {
      const branches = [${branches.map((b) => (typeof b === "string" ? `"${b}"` : b))}];
      const branchConditions = ${JSON.stringify(branchConditions)};
      
      // TODO: Implementar evaluación de condiciones si es necesario
      // Por ahora, seguir al primer branch
      if (branches.length > 0) {
        window.nextTrialId = branches[0];
        window.skipRemaining = true;
        window.branchingActive = true;
        console.log('Loop on_finish: branching to', branches[0]);
      }
    }
    `
          : `
    // Branching automático al primer branch del loop
    // Solo si NO se activó desde trial interno (ShouldBranchOnFinish o BranchingActive)
    if (!loop_${loopIdSanitized}_ShouldBranchOnFinish && !loop_${loopIdSanitized}_BranchingActive) {
      const branches = [${branches?.map((b) => (typeof b === "string" ? `"${b}"` : b)) ?? []}];
      if (branches.length > 0) {
        window.nextTrialId = branches[0];
        window.skipRemaining = true;
        window.branchingActive = true;
        console.log('Loop on_finish: branching to', branches[0]);
      }
    }
    `
        : `
    // Este loop no tiene branches, es un loop terminal
    // Si llegamos aquí después de un branching, terminar el experimento
    if (window.branchingActive) {
      jsPsych.abortExperiment('', {});
    }
    `
    }
  },`;
    } else if (hasBranches) {
      // Si tiene branches pero NO repeat conditions
      if (!hasMultipleBranches || !hasBranchConditions) {
        // Si solo hay un branch O no hay condiciones, seguir automáticamente al primer branch
        code += `
  on_finish: function(data) {
    // Branching automático al primer branch del loop
    // Solo si NO se activó desde trial interno (ShouldBranchOnFinish o BranchingActive)
    if (!loop_${loopIdSanitized}_ShouldBranchOnFinish && !loop_${loopIdSanitized}_BranchingActive) {
      const branches = [${branches?.map((b) => (typeof b === "string" ? `"${b}"` : b)) ?? []}];
      if (branches.length > 0) {
        window.nextTrialId = branches[0];
        window.skipRemaining = true;
        window.branchingActive = true;
        console.log('Loop on_finish: branching to', branches[0]);
      }
    }
  },`;
      } else {
        // Si hay múltiples branches Y condiciones, necesitamos evaluarlas
        code += `
  on_finish: function(data) {
    // Evaluar condiciones del loop para branching
    // Solo si NO se activó desde trial interno (ShouldBranchOnFinish o BranchingActive)
    if (!loop_${loopIdSanitized}_ShouldBranchOnFinish && !loop_${loopIdSanitized}_BranchingActive) {
      const branches = [${branches.map((b) => (typeof b === "string" ? `"${b}"` : b))}];
      const branchConditions = ${JSON.stringify(branchConditions)};
      
      // TODO: Implementar evaluación de condiciones si es necesario
      // Por ahora, seguir al primer branch
      if (branches.length > 0) {
        window.nextTrialId = branches[0];
        window.skipRemaining = true;
        window.branchingActive = true;
        console.log('Loop on_finish: branching to', branches[0]);
      }
    }
  },`;
      }
    }
  } else {
    // Loop terminal: no tiene branches ni repeat conditions
    code += `
  on_finish: function(data) {
    // Este loop no tiene branches ni repeat conditions, es un loop terminal
    // Si llegamos aquí después de un branching, terminar el experimento
    if (window.branchingActive) {
      jsPsych.abortExperiment('', {});
    }
  },`;
  }
  return { code };
}

export default BranchesCode;
