## Debugging y Logging

El código generado incluye extensive logging para debugging:

```javascript
console.log("🔍 [LOOP BRANCH] Evaluating branch conditions...");
console.log("🔍 [LOOP BRANCH] Available branches:", branches);
console.log("Branch eval (loop): Checking column", columnName);
console.log("✅ [SKIP CHECK] Found target trial!");
console.log("⏭️ [SKIP CHECK] Skipping trial", currentId);
```

Emojis y prefijos ayudan a identificar rápidamente el tipo de operación:

- 🔍 = Evaluación
- ✅ = Éxito
- ⏭️ = Skip
- 🔁 = Repeat
- 🔄 = Branch

---

## Testing y Validación

### Verificación Manual

Para verificar que el código generado funciona:

1. Crear un trial/loop con el feature
2. Ejecutar el experimento
3. Abrir consola del navegador
4. Verificar logs:
   - ✅ "Found direct column value..."
   - ❌ "Column not found..." o "Property not found..."

### Casos de Prueba Críticos

1. **Dynamic Plugin con ButtonResponse**
   - Crear trial con ButtonResponseComponent
   - Agregar branching basado en respuesta
   - Verificar que encuentra `ButtonResponseComponent_1_response`

2. **Survey Component**
   - Crear trial con SurveyComponent
   - Agregar branching basado en pregunta específica
   - Verificar que accede al objeto `response.questionName`

3. **Nested Loop con Branching**
   - Crear loop A con loop B anidado
   - Agregar branching en trial dentro de B
   - Verificar que usa variables loop-scoped correctamente

4. **Params Override + Branching**
   - Crear trial con branching + customParameters
   - Verificar que aplica parámetros al trial destino
   - Verificar que no afecta trials intermedios

---

## Conclusión

Este sistema de generación de código permite crear experimentos psicológicos complejos mediante:

1. **Aprovechamiento de features de jsPsych**:
   - `timeline` para anidamiento
   - `conditional_function` para branching
   - `loop_function` para loops condicionales
   - `on_start`/`on_finish` para modificación dinámica

2. **Generación basada en templates**:
   - Flexibilidad total
   - Código legible y debugeable
   - Compatible con cualquier feature de jsPsych

3. **Arquitectura modular**:
   - Generators componibles
   - Separación de concerns
   - Reutilización de lógica

4. **Patrones consistentes**:
   - Acceso a datos unificado
   - Evaluación de condiciones estándar
   - Scoping de variables claro

El resultado es un sistema extensible que puede crecer para soportar nuevos features sin comprometer la compatibilidad o legibilidad del código generado.
