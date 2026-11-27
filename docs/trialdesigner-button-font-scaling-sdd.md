# SDD: escalar los botones del designer con el tamaño de letra

Estado: implementado y verificado localmente el 2026-11-26. Nada se implementó al redactar este documento; la implementación posterior fue autorizada y se ejecutó mediante TDD.

Fecha: 2026-11-26. Código revisado: `fc8f8a2a218e5f366d7f521dc825eb372c425d03`, rama `bugs`.

## 1. Resultado acordado

En el TrialDesigner, los botones de un componente Button Response escalan con `button_font_size`. Un botón recién agregado con la fuente por defecto (14 px) conserva su apariencia actual (80×34), y con una fuente mayor crece de alto y de ancho para mostrar la letra completa, sin recortarla.

El resultado debe coincidir con el preview de runtime (`experimentalScene/runtimePreviewButtons.ts`), que ya deriva el tamaño natural de la fuente. No se cambia el preview de runtime, el HTML publicado ni el comportamiento de redimensionado manual.

## 2. Evidencia del problema

### 2.1 Flujo afectado

El canvas activo del designer es `KonvaCanvas`, que renderiza los botones con `VisualComponents/ButtonResponseComponent.tsx` y `VisualComponents/ButtonResponse/ButtonContent.tsx`.

### 2.2 Mecanismo del fallo

Dos decisiones fijas impiden el escalado:

1. El tamaño natural de un botón recién soltado es constante, sin relación con la fuente — `buttonModel.ts`:

```ts
export const NATURAL_BUTTON_WIDTH = 80;
export const NATURAL_BUTTON_HEIGHT = 34;
```

Cuando `shapeProps.width/height` son 0 (componente recién soltado, sin redimensionar), `ButtonResponseComponent` usa ese tamaño fijo.

2. La fuente se recorta al 40 % de la altura del botón — `ButtonContent.tsx`:

```tsx
fontSize={Math.min(props.height * 0.4, props.fontSize)}
```

### 2.3 Reproducción

1. Se agrega un Button Response al trial: tamaño efectivo 80×34 por botón.
2. Se configura `button_font_size: 28` en el panel de parámetros.
3. El texto se renderiza a `min(34 × 0.4, 28) = 13.6` px: el botón no escala y la letra queda fija.

### 2.4 Contraste con el preview de runtime

`experimentalScene/runtimePreviewButtons.ts` ya deriva el tamaño natural de la fuente:

```ts
const naturalButtonWidth = Math.max(80, textoMedido + padding.left + padding.right + 2);
const naturalButtonHeight = Math.max(34, fontSize * 1.4 + padding.top + padding.bottom);
```

El designer y el preview no coinciden; el reporte del tester es correcto.

## 3. Diseño de la solución

### 3.1 Tamaño natural derivado de la fuente

En `buttonModel.ts` se añade una función pura que calcula el tamaño natural por botón:

```ts
getNaturalButtonSize({ choices, fontSize }) => { width, height }
```

- `height = max(NATURAL_BUTTON_HEIGHT, fontSize * 1.4 + 12)`, con 12 como padding vertical (6 arriba y 6 abajo, equivalente al `"6px 14px"` del runtime).
- `width = max(NATURAL_BUTTON_WIDTH, choiceMásLarga * fontSize * 0.55 + 30)`, con 30 como padding horizontal y ancho de borde; `0.55` es el mismo `CHAR_WIDTH_RATIO` de `textSizing.ts`.
- Las constantes `NATURAL_BUTTON_WIDTH`/`NATURAL_BUTTON_HEIGHT` se conservan como mínimo.

### 3.2 Aplicación solo al tamaño natural

`ButtonResponseComponent.tsx` usa el tamaño nuevo únicamente cuando `shapeProps.width/height <= 0` (recién soltado). Un botón redimensionado manualmente conserva su tamaño explícito, igual que hoy. `onTransformEnd` sigue escalando `buttonFontSize` por `scaleY`.

### 3.3 Clamp que respeta la fuente completa

`ButtonContent.tsx` cambia el límite de `props.height * 0.4` a `props.height - 16`:

- Con tamaño natural, `height = fontSize * 1.4 + 12` y `height - 16 ≥ fontSize` para `fontSize ≥ 10`: la fuente completa se muestra.
- Si el usuario encoge el botón manualmente, la letra se ajusta para caber dentro del alto disponible.
- Con la fuente por defecto de 14 px el resultado visual es idéntico al actual.

### 3.4 Lo que no cambia

- Preview de runtime (`runtimePreviewButtons.ts`), HTML publicado y runtime de participantes.
- Comportamiento del Transformer, grid (`grid_rows`/`grid_columns`), botones de imagen y opciones desde CSV.
- Sincronización de `button_font_size` con el panel de parámetros (`syncConfigToComponent.ts`, `useComponentMutations.ts`).

## 4. Alcance y límites

- Solo los tres archivos del designer indicados y sus pruebas.
- No tocar `experimentalScene`, `EditorHitBox` ni el preview de runtime.
- No cambiar el contrato de `button_font_size` ni el HTML generado.
- No modificar el editor GrapesJS de botones ni la barra del viewport.

## 5. Inventario de cambios

| Área | Trabajo previsto |
|---|---|
| [buttonModel.ts](../client/src/pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/ButtonResponse/buttonModel.ts) | Añadir `getNaturalButtonSize` pura; conservar las constantes como mínimo. |
| [ButtonResponseComponent.tsx](../client/src/pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/ButtonResponseComponent.tsx) | Usar el tamaño natural derivado de la fuente cuando `width/height <= 0`. |
| [ButtonContent.tsx](../client/src/pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/ButtonResponse/ButtonContent.tsx) | Cambiar el clamp a `height - 16`. |
| [buttonAndKeyboardResponses.test.tsx](../client/src/__tests__/components/coverageVisualComponents/buttonAndKeyboardResponses.test.tsx) y harness | RED: tamaño natural con fuente por defecto, fuente grande, elección larga y clamp al encoger; GREEN tras el cambio. |

## 6. Criterios de aceptación mediante TDD

Cada punto empieza con una prueba que falle por el comportamiento que se cambia y termina con las regresiones pertinentes aprobadas.

| ID | Caso | Resultado obligatorio |
|---|---|---|
| AC01 | Botón recién soltado con `button_font_size` 14 | Tamaño natural 80×34 y texto a 14: apariencia actual sin cambios. |
| AC02 | Botón recién soltado con `button_font_size` 28 | Alto natural ≥ `28 × 1.4 + 12`; el texto se renderiza a 28, no a 13.6. |
| AC03 | Elección larga con fuente mayor | El ancho natural crece con la elección más larga (`largo × fontSize × 0.55 + 30`, mínimo 80). |
| AC04 | Botón redimensionado manualmente a un alto menor que la fuente | Conserva el tamaño explícito y el texto se ajusta a `alto − 16`. |
| AC05 | `onTransformEnd` | Sigue escalando `buttonFontSize` por `scaleY` y mantiene el tamaño resultante. |
| AC06 | Preview de runtime | Sin cambios; `runtimePreviewButtons.ts` queda intacto y sus pruebas verdes. |
| AC07 | Suite del cliente | Sin regresiones: los casos nuevos pasan y el resto de la suite conserva su línea base. |
| AC08 | TypeScript, lint y `git diff --check` | Aprobados; diff limitado a los archivos del inventario y pruebas. |

## 7. Orden de implementación

1. **Modelo puro.** Añadir `getNaturalButtonSize` con pruebas unitarias RED para fuente por defecto, fuente grande y elección larga.
2. **Integración en el canvas.** Usar el tamaño nuevo en `ButtonResponseComponent` y ajustar el clamp en `ButtonContent`; pruebas del harness de componentes visuales RED → GREEN para AC01–AC05.
3. **Regresión y documentación.** Suite unitaria completa del cliente, TypeScript, lint y `git diff --check`; registrar resultados reales en esta SDD y actualizar el índice.

Los puntos son entregas separadas. La implementación no comienza sin autorización y se detiene al terminar el punto solicitado. Redactar esta SDD no ejecuta ninguno de esos puntos.

## 8. Condición de cierre

La implementación termina cuando un botón recién soltado escala con `button_font_size` y coincide con la fórmula del preview de runtime; el caso por defecto conserva su apariencia actual; el redimensionado manual mantiene prioridad sobre la fuente; y los criterios de aceptación pasan con evidencia registrada.

## 9. Entrega — 2026-11-26

Se implementaron los puntos 1–3 mediante TDD.

### Modelo puro

`buttonModel.ts` añade `getNaturalButtonSize({ choices, fontSize })`: alto `max(34, ⌈fontSize × 1.4 + 12⌉)` cuando hay opciones de texto y ancho `max(80, ⌈opciónMásLarga × fontSize × 0.55 + 30⌉)`, con sanitización de fuente inválida, mínimo para opciones de imagen y respaldo a `["Button"]` con lista vacía. Las constantes originales se conservan como mínimo.

### Integración en el canvas

`ButtonResponseComponent.tsx` usa el tamaño natural derivado de la fuente únicamente cuando `width/height <= 0` (componente recién soltado); el tamaño explícito del usuario mantiene prioridad y `onTransformEnd` sigue escalando `buttonFontSize` por `scaleY`. `ButtonContent.tsx` cambia el clamp de `height × 0.4` a `max(6, min(height − 16, fontSize))`: la fuente completa cabe en un botón de tamaño natural y se ajusta si el usuario lo encoge.

### TDD y verificación

Las pruebas RED fallaron por la ausencia del modelo y por el tamaño fijo 80×34 con la fuente recortada (4 fallos de integración). Después:

| Comprobación | Resultado |
|---|---|
| Modelo puro (AC01–AC03, casos defensivos) | 6 pruebas aprobadas en [buttonModel.test.ts](../client/src/__tests__/components/coverageVisualComponents/buttonModel.test.ts). |
| Integración (AC01–AC05) | 7 pruebas aprobadas en [buttonAndKeyboardResponses.test.tsx](../client/src/__tests__/components/coverageVisualComponents/buttonAndKeyboardResponses.test.tsx), con el mock de react-konva exponiendo `data-font-size`/`data-width`/`data-height`. |
| Suite unitaria completa del cliente (AC07) | 1875 pruebas aprobadas, 0 fallos. |
| Preview de runtime (AC06) | Sin cambios; `runtimePreviewButtons.ts` intacto. |
| TypeScript (`tsc -b`), lint y `git diff --check` (AC08) | Aprobados; cero errores nuevos de lint frente a HEAD. |

Se actualizó el [índice](INDEX.md) con esta SDD. Nombre de commit sugerido para que el usuario lo ejecute: `fix(trialdesigner): scale fresh buttons with the configured font size`.

La condición de cierre queda satisfecha con evidencia local.
