# Plan de Implementación — Sistema de Escalado Gorilla.sc

## 1. Referencia de Diseño

El canvas de diseño tiene dimensiones fijas según el preset activo. Las coordenadas de todos los objetos viven en **espacio de diseño** y se transforman a pantalla en runtime.

| Preset | design_width | design_height |
|--------|-------------|--------------|
| Large Monitor | 1920 | 1080 |
| Laptop | 1440 | 900 |
| Tablet landscape | 1024 | 768 |
| Tablet portrait | 768 | 1024 |
| Phone landscape | 800 | 450 |
| Phone portrait | 450 | 800 |

---

## 2. Algoritmo de Escalado

### 2.1 Runtime (confirmado con capturas DevTools)

El CSS aplicado a cada elemento en runtime es exactamente:

```
position: absolute;
left:   Xpx;
top:    Ypx;
width:  Wpx;
height: Hpx;
```

Las coordenadas se calculan así (validado en **7 viewports** con orientaciones y presets mixtos):

```
scaleX              = viewport_width  / design_width
scaleY              = viewport_height / design_height
scale               = Math.min(scaleX, scaleY)
canvas_rendered_width  = design_width  * scale
canvas_rendered_height = design_height * scale
x_offset            = (viewport_width  - canvas_rendered_width)  / 2
y_offset            = (viewport_height - canvas_rendered_height) / 2
screen_x            = design_x          * scale + x_offset
screen_y            = design_y          * scale + y_offset
screen_width        = design_width_elem  * scale
screen_height       = design_height_elem * scale
```

> ℹ️ **Nota sobre el eje limitante:** Las primeras cinco capturas (preset Laptop, AR=1.6) usaban `scaleX < scaleY` en todos los viewports probados, por lo que `Math.min()` devolvía siempre `scaleX` y el comportamiento era indistinguible de un simple scale-by-width. Las dos capturas nuevas con preset **Tablet landscape (1024×768, AR=1.333)** en viewport **696×425** demostraron que, cuando el alto del viewport es el eje limitante, el runtime detecta `scaleY < scaleX` y aplica `Math.min()` correctamente. El algoritmo es, por tanto, idéntico al que usa el editor.

### 2.2 Editor (confirmado con capturas HTML)

El editor aplica `transform: scale(s, s)` a un `div` del tamaño real del diseño. Ejemplo capturado (Laptop):

```css
width: 1440px;
height: 900px;
transform: scale(0.575, 0.575);
```

El scale del editor **no** es `panel_width / design_width` sino:

```
scale = min(panel_width / design_width, panel_height / design_height)
```

Evidencia directa:
- **Tablet portrait (768×1024):** scale = 0.896973 → el alto es el eje limitante, el canvas no llena el ancho del panel.
- **Phone portrait (450×800):** scale = 1.14813 → ídem.

### 2.3 Fórmula unificada (runtime = editor)

```js
const scaleX = stageContainerWidth  / designWidth;
const scaleY = stageContainerHeight / designHeight;
const scale  = Math.min(scaleX, scaleY);

const xOffset = (stageContainerWidth  - designWidth  * scale) / 2;
const yOffset = (stageContainerHeight - designHeight * scale) / 2;
```

Esta fórmula replica exactamente el comportamiento tanto del **runtime** como del **editor**. El `Math.min()` no es un "parche defensivo" sino el algoritmo real confirmado en ambos entornos:

- Cuando `scaleX < scaleY` (el ancho del viewport es el eje limitante) → el canvas no llena el alto, centrado vertical.
- Cuando `scaleY < scaleX` (el alto del viewport es el eje limitante) → el canvas no llena el ancho, centrado horizontal.

---

## 3. Verificación con Capturas Reales (runtime)

### Preset Laptop (design 1440×900) — objeto de referencia: `design_x=540, design_y=330, design_w=360, design_h=300`

| Viewport W×H | Orientación viewport | scaleX | scaleY | scale (min) | screen_x | screen_y | screen_w | screen_h |
|---|---|---|---|---|---|---|---|---|
| 1440 × 1282 | landscape | 1.0000 | 1.4244 | **1.0000** | 540 | 330 + 191 = **521** ✓ | **360** ✓ | **300** ✓ |
| 1362 × 1154 | landscape | 0.9458 | 1.2822 | **0.9458** | **510.75** ✓ | 312.1 + 151.4 = **463.5** ✓ | **340.5** ✓ | **283.75** ✓ |
| 1024 × 1154 | portrait | 0.7111 | 1.2822 | **0.7111** | **384** ✓ | 234.7 + 257 = **491.67** ✓ | **256** ✓ | **213.33** ✓ |
| 768 × 769   | casi cuadrado | 0.5333 | 0.8544 | **0.5333** | **288** ✓ | 176 + 144.5 = **320.5** ✓ | **192** ✓ | **160** ✓ |
| 425 × 577   | portrait | 0.2951 | 0.6411 | **0.2951** | **159.4** ✓ | 97.4 + 155.7 = **253.1** ✓ | **106.25** ✓ | **88.54** ✓ |

> En los 5 casos con preset Laptop, `scaleX < scaleY` — el ancho era siempre el eje limitante, por lo que `Math.min()` devolvía `scaleX` y el comportamiento era visualmente idéntico a scale-by-width.

### Preset Tablet landscape (design 1024×768) — objeto de referencia: `design_x=384, design_y=256, design_w=256, design_h=213.3`

| Viewport W×H | Orientación viewport | scaleX | scaleY | scale (min) | Eje limitante | screen_x | screen_y | screen_w | screen_h |
|---|---|---|---|---|---|---|---|---|---|
| 425 × 696 | portrait | 0.4150 | 0.9063 | **0.4150** | ancho | 384×0.4150 + 0 = **159.375** ✓ | 256×0.4150 + 188.6 = **294.875** ✓ | **106.25** ✓ | **88.54** ✓ |
| 696 × 425 | landscape | 0.6797 | 0.5534 | **0.5534** | **alto** | 384×0.5534 + 64.67 = **277.167** ✓ | 256×0.5534 + 0 = **141.667** ✓ | **141.667** ✓ | **118.056** ✓ |

> La captura 696×425 es la evidencia definitiva: con el alto como eje limitante (`scaleY=0.5534 < scaleX=0.6797`), el runtime aplica `scale=0.5534`, el canvas no llena el ancho del viewport, y el `xOffset` centra horizontalmente. Esto confirma que el runtime usa `Math.min(scaleX, scaleY)`, no scale-by-width.

---

## 4. Implementación en Konva

### Opción A — Escalar cada nodo individualmente

```js
const scaleX  = stageContainerWidth  / designWidth;
const scaleY  = stageContainerHeight / designHeight;
const scale   = Math.min(scaleX, scaleY);
const xOffset = (stageContainerWidth  - designWidth  * scale) / 2;
const yOffset = (stageContainerHeight - designHeight * scale) / 2;

// Para cada objeto:
node.x(obj.designX * scale + xOffset);
node.y(obj.designY * scale + yOffset);
node.width(obj.designWidth   * scale);
node.height(obj.designHeight * scale);
```

### Opción B — Escalar el Layer/Group completo ✅ recomendada

```js
function applyScale(stage, layer, designWidth, designHeight) {
  const containerWidth  = stage.container().offsetWidth;
  const containerHeight = stage.container().offsetHeight;

  const scaleX  = containerWidth  / designWidth;
  const scaleY  = containerHeight / designHeight;
  const scale   = Math.min(scaleX, scaleY);
  const xOffset = (containerWidth  - designWidth  * scale) / 2;
  const yOffset = (containerHeight - designHeight * scale) / 2;

  layer.scaleX(scale);
  layer.scaleY(scale);
  layer.x(xOffset);
  layer.y(yOffset);

  stage.batchDraw();
}

// Aplicar en carga y en cada resize:
applyScale(stage, layer, designWidth, designHeight);
window.addEventListener('resize', () => {
  applyScale(stage, layer, designWidth, designHeight);
});
```

Con la Opción B todos los nodos hijos operan en coordenadas de diseño puras. Konva aplica la transformación del Layer automáticamente.

---

## 5. Notas y Pendientes

| # | Estado | Descripción |
|---|--------|-------------|
| 1 | ✅ Confirmado | Runtime usa `position:absolute` con coordenadas calculadas en JS |
| 2 | ✅ Confirmado | Editor usa `transform:scale(min(scaleX, scaleY))` sobre div de tamaño real |
| 3 | ✅ Confirmado | Presets de 6 displays con dimensiones exactas |
| 4 | ✅ Confirmado | Runtime usa `Math.min(scaleX, scaleY)`, no simple scale-by-width. Validado con 7 viewports: 5 con preset Laptop (ancho siempre limitante), 2 con preset Tablet landscape donde el alto pasa a ser limitante (viewport 696×425) |
| 5 | ✅ Confirmado | Comportamiento runtime con preset landscape (Tablet 1024×768) en viewport landscape (696×425): el alto es el eje limitante, `scale=scaleY=0.5534`, `xOffset=64.67px`, centrado horizontal. Algoritmo `Math.min()` es correcto y necesario |
| 6 | ℹ️ No aplica | El "grid" en clases `network-popup` es un layer separado, sin relación con el sistema de coordenadas de objetos |
| 7 | ✅ Confirmado por inferencia | Preset portrait en viewport landscape (y cualquier otra combinación) queda cubierto: una vez confirmado que el runtime usa `Math.min(scaleX, scaleY)`, el algoritmo garantiza por construcción que nunca habrá desborde en ninguna combinación de preset/viewport |
