# Refactorización sugerida para JsPsych

## 🔴 PRIORIDAD ALTA (Archivos que necesitan división urgente)

### Cliente (React/TypeScript)

1. **client/src/pages/ExperimentBuilder/components/ConfigPanel/TrialsConfig/BranchedTrial/BranchConditions.tsx** - 2,153 líneas

   - Contiene toda la lógica de Branch y Jump conditions
   - Debería dividirse en:
     - BranchConditionsManager.tsx - Lógica principal
     - ConditionEditor.tsx - Editor de condiciones individuales
     - RuleEditor.tsx - Editor de reglas
     - ParameterOverridePanel.tsx - Panel de override de parámetros
     - hooks/useBranchConditions.ts - Custom hook para la lógica

2. **client/src/pages/ExperimentBuilder/components/ConfigPanel/TrialsConfig/ParameterMapper/SurveyEditor/CustomSurveyEditor.tsx** - 1,635 líneas

   - Editor visual de JSON para encuestas
   - Debería dividirse en:
     - SurveyEditor.tsx - Componente principal
     - QuestionEditor.tsx - Editor de preguntas individuales
     - QuestionTypeSelector.tsx - Selector de tipo de pregunta
     - ChoiceEditor.tsx - Editor de opciones
     - ImagePickerEditor.tsx - Editor específico para image picker
     - RatingEditor.tsx - Editor específico para rating

3. **client/src/pages/ExperimentBuilder/components/ConfigPanel/TrialsConfig/hooks/useTrialCode.ts** - 1,633 líneas

   - Hook gigante que genera código de trials
   - Debería dividirse en:
     - useTrialCode.ts - Hook principal
     - generators/codeGenerator.ts - Generador base
     - generators/branchingGenerator.ts - Generador de branching
     - generators/parameterMapper.ts - Mapeo de parámetros
     - generators/fileMapper.ts - Mapeo de archivos
     - utils/sanitizers.ts - Funciones de sanitización

4. **client/src/pages/ExperimentBuilder/components/ConfigPanel/TrialsConfig/ParamsOverride.tsx** - 1,474 líneas

   - Maneja override de parámetros
   - Debería dividirse en:
     - ParamsOverride.tsx - Componente principal
     - ConditionsList.tsx - Lista de condiciones
     - RuleBuilder.tsx - Constructor de reglas
     - ParameterSelector.tsx - Selector de parámetros
     - hooks/useParamsOverride.ts - Lógica de negocio

5. **client/src/pages/ExperimentBuilder/components/ConfigPanel/TrialsConfig/ParameterMapper/KonvaTrialDesigner.tsx** - 1,261 líneas

   - Designer visual con Konva
   - Debería dividirse en:
     - KonvaTrialDesigner.tsx - Componente principal
     - CanvasStage.tsx - Stage de Konva
     - ComponentRenderer.tsx - Renderizado de componentes
     - ResizablePanels.tsx - Paneles redimensionables
     - hooks/useCanvasScale.ts - Manejo de escala
     - hooks/useComponentDrag.ts - Drag & drop

6. **client/src/pages/ExperimentBuilder/components/ConfigPanel/TrialsConfig/LoopsConfig/ConditionalLoop.tsx** - 1,091 líneas
   - Lógica de loops condicionales
   - Debería dividirse en:
     - ConditionalLoop.tsx - Componente principal
     - LoopConditionEditor.tsx - Editor de condiciones
     - TrialDataLoader.tsx - Cargador de datos de trials
     - hooks/useLoopConditions.ts - Lógica de condiciones

---

## 🟠 PRIORIDAD MEDIA (Archivos que se beneficiarían de división)

### Cliente

7. **useExperimentCode.ts** - 793 líneas

   - Generación de código completo del experimento
   - Dividir en:
     - useExperimentCode.ts - Hook principal
     - generators/branchingLogic.ts - Lógica de branching
     - generators/extensionsGenerator.ts - Generador de extensiones
     - generators/timelineGenerator.ts - Generador de timeline

8. **useLoopCode.ts** - 772 líneas

   - Generación de código para loops
   - Dividir en:
     - useLoopCode.ts - Hook principal
     - generators/loopGenerator.ts - Generador de loops
     - generators/conditionalLogic.ts - Lógica condicional

9. **LoopsConfig/index.tsx** - 745 líneas

   - Configuración de loops
   - Dividir en:
     - LoopsConfig.tsx - Componente principal
     - LoopTypeSelector.tsx - Selector de tipo de loop
     - LoopParametersEditor.tsx - Editor de parámetros

10. **ComponentSidebar.tsx** - 702 líneas

    - Sidebar de componentes
    - Dividir en:
      - ComponentSidebar.tsx - Componente principal
      - ComponentList.tsx - Lista de componentes
      - ComponentPreview.tsx - Preview de componentes

11. **TrialsConfig/index.tsx** - 684 líneas

    - Configuración de trials
    - Dividir en:
      - TrialsConfig.tsx - Componente principal
      - TrialEditor.tsx - Editor de trial
      - TrialToolbar.tsx - Toolbar de trial

12. **Timeline/index.tsx** - 674 líneas

    - Timeline principal
    - Dividir en:
      - Timeline.tsx - Componente principal
      - TimelineToolbar.tsx - Toolbar
      - PublishControls.tsx - Controles de publicación
      - TunnelManager.tsx - Manejo de tunnel

13. **SketchpadComponent.ts** - 645 líneas

    - Componente de sketchpad
    - Dividir en:
      - SketchpadComponent.ts - Componente principal
      - SketchpadRenderer.ts - Renderizado
      - SketchpadTools.ts - Herramientas de dibujo

14. **ResultsList.tsx** - 553 líneas
    - Lista de resultados
    - Dividir en:
      - ResultsList.tsx - Componente principal
      - SessionsList.tsx - Lista de sesiones
      - SessionsToolbar.tsx - Toolbar de sesiones
      - hooks/useSessionsWebSocket.ts - WebSocket logic

### Servidor

15. **routes/experiments.js** - 503 líneas

    - Rutas de experimentos
    - Dividir en:
      - experiments.js - Rutas principales
      - controllers/experimentsController.js - Controladores
      - services/experimentsService.js - Lógica de negocio

16. **Canvas/index.tsx** - 493 líneas
    - Canvas principal
    - Dividir en:
      - Canvas.tsx - Componente principal
      - TrialCreator.tsx - Creador de trials
      - LoopManager.tsx - Manejo de loops
      - hooks/useCanvasState.ts - Estado del canvas

---

## 🟢 PRIORIDAD BAJA (Archivos que podrían mejorarse pero no son urgentes)

17. **BranchedTrial/index.tsx** - 481 líneas
18. **WebGazer.tsx** - 454 líneas
19. **ConfigPanel/index.tsx** - 449 líneas
20. **useFlowLayout.ts** - 401 líneas
21. **Settings/index.tsx** - 391 líneas
22. **TrialsProvider.tsx** - 350 líneas
23. **ExperimentBuilder/index.tsx** - 333 líneas

### Builder API

24. **routes/data.js** - 963 líneas
25. **services/storage.js** - 835 líneas
26. **api-github.js** - 702 líneas
27. **crud-file-github.js** - 414 líneas

---

## 📊 Resumen Estadístico

- Archivos de prioridad alta: 6 archivos (>1,000 líneas)
- Archivos de prioridad media: 11 archivos (500-1,000 líneas)
- Archivos de prioridad baja: 11 archivos (300-500 líneas)
- Total de archivos que necesitan refactorización: 28 archivos
- Total de líneas a refactorizar: ~18,000 líneas

Los archivos de prioridad alta son críticos porque su tamaño hace que sean difíciles de mantener, propensos a bugs, y difíciles de entender para nuevos desarrolladores.
