# Investigación: Migración Konva → html-in-canvas

**Fecha:** 2026-04-30
**Proyecto:** JsPsych Builder (Electron)
**Objetivo:** Evaluar reemplazo de Konva.js por html-in-canvas (https://html-in-canvas.dev/)

---

## 1. Estado actual de Konva en el proyecto

### Volumen
- **20 archivos** con imports de `konva` / `react-konva`
- **~4-5k LOC** específicos de Konva (de ~8.5k LOC totales en `TrialDesigner/`)
- **~229 referencias** directas a primitivas Konva
- **14 componentes visuales** distintos

### Primitivas usadas

| Primitiva | Cantidad | Notas |
|-----------|----------|-------|
| Rect | 70+ | Backgrounds, borders, contenedores |
| Text | 50+ | Labels, button text |
| Group | 45+ | Wrappers de componentes |
| Transformer | 15 | Resize/rotate handles (uno por componente) |
| Image (KonvaImage) | 8 | Placeholders y media |
| Circle | 8 | Slider thumbs, markers |
| Line | 12 | Slider tracks, underlines, sketchpad |
| Stage | 2 | Canvas root |
| Layer | 2 | Canvas hierarchy |

**No usa:** Path, Arrow, Star, Polygon, Tween, Animation, Filters, Label, RegularPolygon.

### Archivos clave

**Core canvas:**
- `client/src/.../TrialDesigner/KonvaCanvas.tsx` — Stage, Layer, Rect base
- `client/src/.../TrialDesigner/index.tsx` — Stage ref management
- `client/src/.../TrialDesigner/useHandleDrop.ts` — drop coordinate conversion

**Componentes visuales (14):**
ButtonResponseComponent, TextComponent, HtmlComponent, ImageComponent, AudioComponent, VideoComponent, SliderResponseComponent, InputResponseComponent, ClickResponseComponent, AudioResponseComponent, FileUploadResponseComponent, SketchpadComponent, SurveyComponent, KeyboardResponseComponent.

**Patrón uniforme** en todos los componentes visuales:
```tsx
const trRef = useRef<Konva.Transformer>(null);
// ...
<Group
  ref={groupRef}
  draggable
  onDragEnd={handleDragEnd}
  onTransformEnd={handleTransformEnd}
>
  {/* shapes */}
</Group>
<Transformer ref={trRef} />
// useEffect: trRef.current.nodes([groupRef.current]);
//            trRef.current.getLayer()?.batchDraw();
```

### Features que dependen de Konva

| Feature | Implementación |
|---------|----------------|
| Drag & drop | `Group draggable + onDragEnd` |
| Resize/rotate | `Konva.Transformer` (crítico) |
| Hit detection | `onClick`, `onTap`, `e.target.getStage()` |
| Z-index | Sort manual por `zIndex` antes de render |
| Sombras | `shadowBlur`, `shadowOpacity` (básico) |
| Performance | `batchDraw()` post-transform |
| Export | `canvas.toDataURL()` solo en VideoComponent (thumbnails) |
| Multi-screen | `screenLayouts: Record<string, ScreenLayout>` overrides responsive |
| Coordenadas | Dual: canvas px ↔ jsPsych normalized (-100/+100) |

**Funciones de conversión:** `toJsPsychCoords(x, y)` y `fromJsPsychCoords({x, y})`.

### Lo que NO hace
- Sin tweens / animations
- Sin custom shapes / Path drawing
- Sin filters / color matrix
- Sin snapping / alignment guides
- Sin multi-select / marquee selection
- Sin rich text formatting (Konva Text plain)

### Integración

**State management:** React hooks puros (no Redux/Zustand). `useState<TrialComponent[]>`, `useState<string | null>` para `selectedId`. Props drilling.

**Persistencia:**
- `generateConfigFromComponents()` → serializa a config object
- `onAutoSave(config)` callback en cada drop/drag/transform/property change
- Coords en jsPsych normalized space

**JsPsych output:** TrialComponent → `{ name, coordinates: {x, y}, width, height, rotation, zIndex, ...config }`.

**Dependencias externas:** GrapesJS para HTML/button editors, `useImage` hook, `useCanvasStyles` hook.

### Veredicto sobre estructura
**Migración limpia.** API surface mínima de Konva. Sin abstracciones profundas. Sin monkey-patches. Patrones uniformes en los 14 componentes. Reescritura factible.

---

## 2. html-in-canvas: qué es realmente

**No es html2canvas userspace lib.** Es API nativa de Chromium (WICG `drawElementImage` proposal). El sitio `html-in-canvas.dev` es demo showcase de "En Dash Consulting", no proyecto oficial de Chromium.

### Mecánica

**Tres primitivas nuevas:**
1. **`<canvas layoutsubtree>`** — children DOM se layoutean + hit-testean pero invisibles
2. **`ctx.drawElementImage(element, x, y[, w, h])`** → retorna `DOMMatrix`. Asignas matrix a `el.style.transform` para alinear DOM con pixeles pintados
3. **`paint` event** con `changedElements` array

**APIs adicionales:**
- WebGL: `texElementImage2D`
- WebGPU: `copyElementImageToTexture`
- Workers: `captureElementImage()` produce snapshot transferible

**Sample (conceptual):**
```js
const canvas = document.querySelector('canvas[layoutsubtree]');
const ctx = canvas.getContext('2d');
const el = canvas.querySelector('.my-html-widget');

canvas.addEventListener('paint', (e) => {
  for (const changed of e.changedElements) {
    const matrix = ctx.drawElementImage(changed, 100, 50);
    changed.style.transform = matrix.toString();
  }
});
```

### Comportamiento DOM

- **DOM permanece real:** events, focus, ARIA, IME funcionan
- **Pero requiere sync** de transform cada frame; drift = clicks fallan target
- **CSS transforms en hijo se ignoran para paint** pero honran para hit-test (fácil desincronizar)

---

## 3. Estado de release (CRÍTICO)

| Stage | Chrome version | Fecha |
|-------|----------------|-------|
| DevTrial (flag-only) | M138+ | activo |
| Origin Trial | M148–M151 | ~2026-05-05 |
| Stable / unflagged | **no anunciado** | — |

- **Flag:** `chrome://flags/#canvas-draw-element`
- **Mozilla:** stage 2, fingerprinting concerns abiertos. Sin implementación.
- **Safari/WebKit:** cero implementación.
- **API churn:** renombrado `drawElement` → `drawElementImage` en M145. Surface inestable.

### Mapping a Electron

| Electron | Chromium | Estado |
|----------|----------|--------|
| 41 | 146 | 2026-03-10 |
| **42** | **148** | **2026-05-05 (mínimo viable)** |

Para producción Electron: `app.commandLine.appendSwitch('enable-features=CanvasDrawElement')` o `--enable-blink-features`. Viable para builder interno controlado, hostil para distribución end-user.

### Limitaciones explícitas

- Cross-origin iframes/images/SVG `<use>` excluidos
- System colors no
- Visited links no (privacy)
- Spelling marks no
- Subpixel AA no
- Element debe ser **direct child** del canvas
- No `display:none`
- Overflow clipped a border box
- CSS transforms ignoradas para paint (solo para hit-test)

---

## 4. Paridad de features

| Feature | Konva | html-in-canvas |
|---------|-------|----------------|
| Hit-testing | bbox/path manual | **Free vía DOM** ✓ |
| Transformer (resize/rotate handles) | `Konva.Transformer` ✓ | **Build manual** ✗ |
| Layering / Group tree | tree nativo | manual draw order |
| Animations | Tween (no usado) | CSS anim/transitions automáticas ✓ |
| Filters / shaders | filtros básicos | WebGL/WebGPU strictly más potente ✓ |
| `toDataURL` export | confirmado | **claim solo, no spec-confirmed** ⚠ |
| Rich text / HTML | no | **sí, nativo** ✓ |
| Accesibilidad / IME | no | **sí** ✓ |
| Drag & drop | `onDragEnd` Konva | DOM events nativo |
| Cross-browser | sí (todos) | solo Chromium con flag |
| Estabilidad API | estable | pre-OT, churn reciente |

### Construir Transformer custom: estimación
- ~500-1000 LOC nuevos
- Math: bounding box rotated, handle positions, hit-zones rotated
- Handles DOM con event listeners
- Sync con transform CSS del elemento target
- Soporte uniform/non-uniform scale, rotación con anclaje
- Posible usar lib externa (interact.js, moveable.js)

---

## 5. Respuestas a preguntas críticas

1. **¿Interactivo dentro del canvas?**
   Sí. DOM real con eventos/focus/IME. Requiere sync transform cada frame.

2. **¿Hit-test?**
   DOM nativo (no pointer math). Pero CSS transforms en hijo ignoradas para paint pero honradas para hit — fácil desincronizar.

3. **¿Mix con drawing 2D normal?**
   Sí. Mismo contexto. CTM (current transform matrix) aplica a HTML drawn.

4. **¿`toDataURL` con HTML?**
   Docs lo claim pero WICG explainer silente. **Verificar con test antes de depender.**

5. **¿License / stability?**
   MIT (WICG repo). Pre-OT. Flag only. API renombrada recientemente. Mozilla concerns sin resolver.

6. **¿Electron version mínima?**
   42 (Chromium 148, 2026-05-05) con flag.

---

## 6. Veredicto

### ¿Feasible? **Sí.**
Uso de Konva en el proyecto es ligero. Migración estructural posible. Patrón uniforme en 14 componentes. Sin features avanzados de Konva que falten.

### ¿Recomendable AHORA? **No.**

Razones:
1. **Flag-gated single-vendor.** Solo Chromium. Electron OK pero requiere flag explícito en startup.
2. **API inestable.** Renombró métodos en M145. OT recién empieza M148. Pre-stable.
3. **Pierdes Transformer.** Konva da resize/rotate handles gratis. Con html-in-canvas build manual (~500-1000 LOC).
4. **`toDataURL` incierto.** Si experimentos jsPsych necesitan export bitmap, riesgo alto.
5. **Reproducibilidad científica.** JsPsych = research tool. Stimuli deben renderizar idénticos años/máquinas. API experimental rompe eso.

### ¿Recomendable LARGO PLAZO? **Posible pero condicional.**

Esperar a:
- Chrome unflag post-M151
- Mozilla commitment o WebKit signal
- API freeze post-OT feedback

### Wins reales si se migra
- Rich text nativo (sin GrapesJS hack para HTML components)
- Accesibilidad + IME (importante research multi-idioma)
- CSS animations sin Tween manual
- WebGL filters strictly más potente que Konva filters
- Real DOM event model — más simple, menos coordinate math

### Path híbrido pragmático
- Mantener Konva para editor (Transformer, hit, serialize)
- Probar html-in-canvas solo para `HtmlComponent` + `TextComponent` rich rendering bajo flag
- Re-evaluar 2027 cuando OT termine

### Si decisión es full migrate AHORA

Presupuesto:
- ~3-5k LOC reescritura
- Build custom Transformer (~500-1000 LOC)
- Test exhaustivo export pipeline
- Lock Electron 42+
- Acepta vendor-lock Chromium
- Asume riesgo de API breaking changes durante OT

---

## 7. Fuentes

- [html-in-canvas.dev landing](https://html-in-canvas.dev/)
- [browser-support](https://html-in-canvas.dev/docs/browser-support/)
- [API reference](https://html-in-canvas.dev/docs/api-reference/)
- [WICG/html-in-canvas GitHub](https://github.com/WICG/html-in-canvas)
- [Intent to Experiment (M148–M151)](https://groups.google.com/a/chromium.org/g/blink-dev/c/t_nGEmJ_v4s)
- [Ready for Dev Testing announcement](https://www.mail-archive.com/blink-dev@chromium.org/msg14618.html)
- [Electron release schedule](https://releases.electronjs.org/schedule)
- [WICG/canvas-place-element explainer](https://github.com/WICG/canvas-place-element)
