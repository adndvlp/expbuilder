# Eliminación del Workaround del "Last Trial"

Este documento detalla los pasos necesarios para revertir y eliminar la lógica temporal que fuerza un salto (`jump`) hacia el `Last_Trial` (ID: `1778798102194`) en lugar de usar `jsPsych.abortExperiment('', {});`.

Esta solución temporal se implementó para evitar que el experimento se abortara abruptamente y asegurar que la pantalla final ("Ya puedes cerrar esta ventana") siempre se mostrara, pero se planea refactorizar el sistema de branching en el futuro.

Para erradicar esta funcionalidad, se deben revertir los cambios en los siguientes **3 archivos**:

## 1. `client/src/pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode/BranchesCode.ts`

**Buscar:**
```typescript
    if (window.branchingActive) {
      window.nextTrialId = '1778798102194';
      window.skipRemaining = true;
    }
```

**Reemplazar por (en 2 lugares):**
```typescript
    if (window.branchingActive) {
      jsPsych.abortExperiment('', {});
    }
```

---

## 2. `client/src/pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/TrialCodeGenerators/onFinishGenerator.ts`

**Buscar:**
```typescript
        if (window.branchingActive) {
          window.nextTrialId = '1778798102194';
          window.skipRemaining = true;
        }
```

**Reemplazar por (en 3 lugares):**
```typescript
        if (window.branchingActive) {
          jsPsych.abortExperiment('', {});
        }
```

---

## 3. `client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/useExperimentCode.ts`

**Buscar:**
```typescript
            if (nextTrialId === 'FINISH_EXPERIMENT') {
              console.log('🏁 [BRANCHING] Finishing experiment via branching');
              window.nextTrialId = '1778798102194';
              window.skipRemaining = true;
              window.branchingActive = true;
            } else {
```

**Reemplazar por:**
```typescript
            if (nextTrialId === 'FINISH_EXPERIMENT') {
              console.log('🏁 [BRANCHING] Finishing experiment via branching');
              jsPsych.abortExperiment('Experiment finished by branching condition', {});
              return;
            } else {
```

---