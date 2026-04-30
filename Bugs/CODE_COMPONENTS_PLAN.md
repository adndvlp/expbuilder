# Plan de Implementación: Code Components en JsPsych Builder

Este documento detalla la arquitectura, el enfoque y los pasos necesarios para implementar la inyección de código personalizado (estilo Code Components de PsychoPy) en el Builder de JsPsych. 

El objetivo es permitir a los investigadores ejecutar lógica personalizada (JavaScript) para calcular variables dinámicas, aplicar puntajes, integrar APIs externas o manipular el DOM, sin perder la compatibilidad con las funciones declarativas del Builder (Branching, Params Override, Loops).

---

## 1. Contexto y Casos de Uso

Actualmente, el Builder ofrece potentes herramientas declarativas:
- **Params Override:** Permite inyectar datos (de CSV o respuestas previas) en los parámetros de un trial.
- **Branching:** Permite saltar a otros trials basado en condiciones lógicas.

**¿Por qué necesitamos inyección de código personalizado?**
Las herramientas declarativas no cubren escenarios de programación imperativa, tales como:
1. **Cálculos Matemáticos/Lógicos Complejos:** Ej. "*Si el RT fue < 500ms y la respuesta fue 'f', aplicar fórmula (RT * 0.5) + Bonus y guardar el resultado en `data.score_calculado`*".
2. **Integración con APIs Externas:** Ej. Hacer un `fetch()` al finalizar un bloque de trials para enviar métricas parciales a un servidor de analíticas.
3. **Manipulación Avanzada del DOM o Variables Globales:** Ej. Mostrar un cronómetro global que persiste entre trials, o inicializar variables complejas al inicio del experimento.

---

## 2. Arquitectura de la Solución (Implementación Dual)

Para brindar la máxima flexibilidad, se implementarán dos enfoques complementarios:

### Opción A: Nodo de Código Independiente (`plugin-call-function`)
Equivalente a una rutina vacía de PsychoPy que solo contiene un Code Component.
- **Mecanismo:** Utilizar el plugin nativo `@jspsych/plugin-call-function`.
- **Ventaja:** Aisla completamente la lógica del usuario del ciclo de vida de otros trials de estímulo. Ideal para cálculos entre bloques (ej. calcular el puntaje total de un bloque y guardarlo).
- **Viabilidad:** El servidor ya cuenta con el metadata `server/metadata/plugin-call-function.json` y el bundler lo incluye en `jspsych-bundler/package.json`.

### Opción B: Inyección Quirúrgica en el Ciclo de Vida (`on_start` / `on_finish`)
Equivalente a las pestañas "Begin Routine" y "End Routine" de un Code Component de PsychoPy dentro de una rutina existente.
- **Mecanismo:** Modificar los generadores de código del Builder (`onStartGenerator.ts` y `onFinishGenerator.ts`) para anexar un bloque de código string proporcionado por el usuario.
- **Ventaja:** Precisión extrema. Permite alterar dinámicamente un estímulo justo milisegundos antes de mostrarse, o procesar la respuesta inmediatamente después de que ocurre, teniendo acceso directo al objeto `trial` o `data` de *ese* evento específico.

---

## 3. Plan de Implementación Paso a Paso

### Fase 1: Habilitar el Nodo Independiente (`plugin-call-function`)

1. **Verificación de Metadata:** Asegurar que `server/metadata/plugin-call-function.json` está correctamente formateado y expone el parámetro `func` como tipo `function` o un tipo especial que la UI interprete como código.
2. **Interfaz de Usuario (UI):** 
   - Cuando el usuario seleccione `call-function` en el Timeline, el panel de configuración debe renderizar un editor de código avanzado (ej. Monaco Editor) en lugar de un input de texto normal para el parámetro `func`.
   - Añadir placeholders o snippets por defecto:
     ```javascript
     () => {
       // Tu código aquí. Ej:
       // var lastTrial = jsPsych.data.get().last(1).values()[0];
       // jsPsych.data.addProperties({ global_score: 100 });
     }
     ```
3. **Generación de Código:** El motor actual (`stringifyWithFunctions` en `useTrialCode.ts`) ya detecta strings que empiezan con `() =>` o `function` y los inyecta sin comillas. No se requieren cambios profundos en el generador.

### Fase 2: Inyección Quirúrgica (`on_start` y `on_finish`)

1. **Modificación del Modelo de Datos:**
   - Actualizar el tipo `Trial` en `client/src/pages/ExperimentBuilder/components/ConfigurationPanel/types/index.ts` (o donde corresponda) para incluir las nuevas propiedades:
     ```typescript
     export type Trial = {
       // ...
       customOnStart?: string;
       customOnFinish?: string;
     };
     ```
   - Actualizar el esquema de la base de datos (servidor) si es necesario para persistir estos campos.

2. **Interfaz de Usuario (UI) en la Configuración del Trial:**
   - Añadir una nueva pestaña o sección llamada "Custom Code" (o "Inyección de Código") en el panel de configuración de cualquier trial.
   - Renderizar dos instancias de Monaco Editor: una para `on_start` y otra para `on_finish`.

3. **Modificación de los Generadores de Código (`TrialCodeGenerators`):**
   - **`onStartGenerator.ts`**:
     Actualizar la firma para aceptar `customOnStart: string` y agregarlo al final del bloque generado.
     ```typescript
     export function generateOnStartCode(options: {
       paramsOverride?: ParamsOverrideCondition[];
       customOnStart?: string;
       // ...
     }): string {
       // ... generar overrides ...
       return `on_start: function(trial) {
         ${paramsOverrideCode}
         ${branchCustomParamsCode}
         
         // --- User Custom Code ---
         ${options.customOnStart || ''}
       },`;
     }
     ```
   - **`onFinishGenerator.ts`**:
     Actualizar la firma para aceptar `customOnFinish: string`. **Crítico:** Insertar el código del usuario *antes* de la lógica de Branching del Builder, para que el usuario pueda modificar el objeto `data` y que el Branching evalúe esos nuevos datos correctamente.
     ```typescript
     export function generateOnFinishCode(options: {
       branches?: (string | number)[];
       customOnFinish?: string;
       // ...
     }): string {
       // ... generar branching ...
       return `on_finish: function(data) {
         // --- User Custom Code ---
         ${options.customOnFinish || ''}
         
         // --- Builder Logic (Branching, Repeat) ---
         ${branchingCode}
       },`;
     }
     ```
   - **Actualizar `useTrialCode.ts`**: Pasar los nuevos campos `customOnStart` y `customOnFinish` del objeto `trial` a las funciones generadoras `generateOnStartCode` y `generateOnFinishCode`.

---

## 4. Consideraciones y Limitaciones

### A. Alcance (Scope) de las Variables
El código inyectado en `on_start` recibe el argumento `trial`. El código inyectado en `on_finish` recibe el argumento `data`. El usuario tiene acceso a la API global `jsPsych`.

### B. Colisiones con el Builder (Peligro)
El Builder utiliza variables inyectadas en el ámbito global o local para controlar el flujo. Si el usuario modifica estas variables, el experimento se romperá.
**Variables Críticas del Builder a evitar:**
- `window.nextTrialId`
- `window.skipRemaining`
- `window.branchingActive`
- `window.branchCustomParameters`
- Nombres de variables generados dinámicamente en loops (ej. `loop_X_HasBranches`).

### C. Conflicto Conceptual con Features Declarativos
Si un usuario inyecta código en `on_start` para sobreescribir el parámetro `stimulus` (`trial.stimulus = '...'`), esto sobrescribirá (o será sobrescrito por, dependiendo del orden) la configuración de la pestaña "Params Override".
**Decisión Arquitectónica:** El código del usuario en `on_start` se ejecutará **después** del `Params Override` del Builder. Esto permite al usuario "parchar" o modificar el resultado final antes de que jsPsych lo renderice.

### D. Seguridad (Evaluación de Riesgos)
Dado que se permite inyectar JavaScript arbitrario, existe un riesgo inherente de ejecución de código (XSS) si los experimentos se exponen públicamente y se permite a los participantes alterar la estructura. Sin embargo, como el Builder genera código estático (HTML/JS) que se despliega en sitios estáticos (como GitHub Pages), el riesgo es mitigado: el creador del experimento es el único que inyecta el código, y los participantes solo ejecutan el código pre-generado en sus navegadores.

---

## 5. Estrategia de Documentación (Requisito Indispensable)

Dado que la "Opción Avanzada (Responsabilidad del Usuario)" fue seleccionada, la documentación es el escudo principal contra errores de implementación.

1. **Tooltips en la UI:**
   - En la pestaña de Custom Code, mostrar un "Warning" permanente: *"El código inyectado se ejecuta nativamente. No modifiques las variables globales `window.nextTrialId`, `window.skipRemaining` ni `window.branchingActive`."*
2. **Guía de Buenas Prácticas (Docs):**
   - Explicar la diferencia entre `call-function` (para lógica global/entre-trials) y `on_start`/`on_finish` (para lógica específica del trial).
   - Proveer ejemplos de cómo leer datos (`jsPsych.data.get()`) y cómo escribir datos (`data.mi_variable = X` en `on_finish`).
   - Aclarar el orden de ejecución: *"En on_start, tu código se ejecuta DESPUÉS de Params Override. En on_finish, tu código se ejecuta ANTES del Branching."*