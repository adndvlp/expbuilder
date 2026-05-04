# Replicar el sistema de scaling de Gorilla en Konva + jsPsych

---

## 1. Qué hace Gorilla por debajo

Gorilla almacena cada estímulo como coordenadas en un **espacio de diseño base** (un viewport de referencia, por ejemplo 1200 × 696 px). Cuando el experimento corre en un dispositivo real, Gorilla calcula un factor de escala y convierte cada coordenada a píxeles del viewport actual usando multiplicación directa:

```
px_real = px_base × (viewport_width / BASE_WIDTH)
```

El resultado se vuelca como `style="position:absolute; left:Xpx; top:Ypx; width:Wpx; height:Hpx"` en cada elemento del DOM. Gorilla hace esa multiplicación **elemento por elemento** en cada resize. Puedes verlo inspeccionando los valores en DevTools a distintos anchos: el ratio `left / viewport_width` se mantiene constante.

### Evidencia del PDF (elemento cubo a distintos viewports)

| Viewport width | left (px) | left / width |
|---|---|---|
| 320 | 213.33 | **0.667** |
| 375 | 250.00 | **0.667** |
| 768 | 512.00 | **0.667** |
| 1024 | 666.67 | **0.651** |

El ratio es prácticamente constante → escala lineal respecto al ancho.

El `font-size` también escala: de `4.4px` en 320 px de ancho a `20px` en 2560 px. La fórmula es la misma: `fontSize_real = fontSize_base × factor`.

---

## 2. Arquitectura DOM de Gorilla

Para cada tarea, Gorilla genera tres capas de contenedores anidados y luego los estímulos dentro:

```
div [position:absolute; left:0; right:0; top:0; bottom:0]   ← ancla al viewport
  └─ div [position:absolute; inset:0px]                      ← gestión de z-index interna
       └─ div [position:absolute; inset:0px; overflow:hidden] ← canvas real (clips el contenido)
            ├─ div [position:absolute; left:Xpx; top:Ypx; width:Wpx; height:Hpx]   ← SLOT estímulo 1
            │    └─ div [display:flex; align-items:center; justify-content:center]  ← centrado
            │         └─ img / button / ...                                          ← contenido real
            ├─ div [slot estímulo 2] ...
            └─ div [slot estímulo N] ...
```

### Qué hace cada capa

**Capa 1 — ancla al viewport**: establece el sistema de coordenadas. El equivalente en Konva es el `Stage`.

**Capa 2 — gestión interna**: Gorilla la usa para z-index entre componentes propios (audio player, overlays). No tienes que replicarla; es un detalle de implementación de la plataforma.

**Capa 3 — canvas real con `overflow:hidden`**: recorta cualquier elemento que salga del área visible. En Konva se replica con `layer.clip()`.

**Slot (div exterior por estímulo)**: define el **bounding box** del estímulo: posición y tamaño en píxeles calculados. En Konva es un `Konva.Group` con `x`, `y`, `width`, `height` en coordenadas base.

**Div de flex (div interior por estímulo)**: centra el contenido dentro del bounding box, independientemente del tamaño natural del elemento. En Konva se reemplaza por `offsetX`/`offsetY` en el nodo hijo.

**Contenido real** (`img`, `button`, etc.): el estímulo propiamente tal. Mapea a `Konva.Image`, `Konva.Rect + Konva.Text`, etc.

---

## 3. El patrón de 3 tags por estímulo

Cada estímulo en Gorilla sigue siempre esta estructura, sin excepción:

```
div  [slot]     → position:absolute; left/top/width/height en px calculados
  └─ div [flex] → display:flex; align-items:center; justify-content:center; w-full; h-full
       └─ img / button / ...   → max-width:100%; max-height:100%
```

### Por qué existen los tres niveles

**Tag 1 — slot**: es el único que Gorilla toca en cada resize. Contiene la posición y el tamaño del estímulo en píxeles reales. Si el viewport cambia, Gorilla recalcula solo este div.

**Tag 2 — flex**: no cambia nunca. Su único propósito es centrar el contenido dentro del bounding box del slot, sea cual sea el tamaño natural del elemento. Es el equivalente CSS de `object-fit: contain` con centrado automático.

**Tag 3 — contenido**: la imagen, el botón, o cualquier elemento real. Tiene `max-width:100%; max-height:100%` para no salirse del slot, y el flex del tag 2 lo mantiene centrado.

### Cómo se ve en DevTools

```html
<!-- Imagen -->
<div style="position:absolute; left:198px; top:43.5px; width:522px; height:478.5px;">
  <div class="relative w-full h-full flex flex-row items-center justify-center">
    <img src="armadillo.png"
         style="max-width:100%; max-height:100%"
         draggable="false">
  </div>
</div>

<!-- Botón -->
<div style="position:absolute; left:633px; top:565.5px; width:174px; height:43.5px;">
  <div class="w-full h-full flex flex-row items-center justify-center">
    <button class="button button-brand">Next</button>
  </div>
</div>
```

### El equivalente exacto en Konva

En Konva los tres tags colapsan en un solo `Group` + nodo hijo, porque Konva no necesita un div de flex: el centrado se logra con `offsetX`/`offsetY`.

```
div[slot]  →  Konva.Group  (x, y, width, height en coords base)
div[flex]  →  desaparece   (el centrado lo hace offsetX/offsetY)
img        →  Konva.Image  (centrada con offsetX = width/2, offsetY = height/2)
button     →  Konva.Rect + Konva.Text dentro del mismo Group
```

Ejemplo directo comparando ambos:

```js
// ── Gorilla (HTML generado en runtime) ──────────────────────
// <div style="position:absolute; left:198px; top:43.5px; width:522px; height:478.5px;">
//   <div class="flex items-center justify-center w-full h-full">
//     <img src="armadillo.png" style="max-width:100%; max-height:100%">
//   </div>
// </div>

// ── Konva equivalente ───────────────────────────────────────
const slotX = 198, slotY = 43.5, slotW = 522, slotH = 478.5;

const group = new Konva.Group({ x: slotX, y: slotY });  // Tag 1: slot

const img = new Konva.Image({
  image:   imageEl,
  x:       slotW / 2,          // centro del slot (= lo que hace el flex)
  y:       slotH / 2,
  width:   slotW,
  height:  slotH,
  offsetX: slotW / 2,          // Tag 2: centrado horizontal
  offsetY: slotH / 2,          // Tag 2: centrado vertical
});

group.add(img);                 // Tag 3: contenido
layer.add(group);
```

---

## 4. Por qué Konva es más simple

Gorilla multiplica cada coordenada en JS en cada resize. Konva tiene `layer.scale()`, que aplica una transformación matricial a **todo el layer de golpe**. El resultado visual es idéntico, pero tú solo calculas el factor una vez:

```
Gorilla:  px_real = px_base × factor   (por cada elemento, en cada resize)
Konva:    layer.scale({ x: factor, y: factor })   (una sola llamada, Konva hace el resto)
```

Esto significa que puedes definir todos tus estímulos en coordenadas base y olvidarte del viewport. Konva transforma automáticamente cada nodo al renderizar.

---

## 4. Implementación paso a paso

### 4.1 Definir el espacio base

Elige un viewport de referencia. Lo más práctico es medir el task de Gorilla en DevTools a un ancho conocido y usar esos valores directamente.

```js
const BASE_W = 1200;  // ancho de referencia en px (el que usaste al diseñar en Gorilla)
const BASE_H = 696;   // alto de referencia en px
```

### 4.2 Crear el Stage

El Stage ocupa el viewport completo. Sus dimensiones cambian en cada resize, pero las coordenadas de los nodos no.

```js
const stage = new Konva.Stage({
  container: 'konva-container',   // id del div en el HTML
  width:  window.innerWidth,
  height: window.innerHeight,
});
```

### 4.3 Crear el Layer y aplicar clip

El Layer reemplaza las tres capas de Gorilla. El `clip` reemplaza el `overflow:hidden`.

```js
const layer = new Konva.Layer();
stage.add(layer);

// Equivalente al overflow:hidden de Gorilla
// Importante: el clip se define en coordenadas BASE, no en px reales
layer.clip({
  x: 0,
  y: 0,
  width:  BASE_W,
  height: BASE_H,
});
```

### 4.4 Función de escala

Esta función es el corazón del sistema. Se llama al inicio y en cada resize.

```js
function applyScale() {
  const factor = window.innerWidth / BASE_W;

  stage.width(window.innerWidth);
  stage.height(window.innerHeight);

  layer.scale({ x: factor, y: factor });
  layer.batchDraw();
}

// Llamar al cargar
applyScale();

// Y en cada resize
window.addEventListener('resize', applyScale);
```

> **Nota**: si quieres escalar también en altura (para que nada quede fuera verticalmente), usa `Math.min`:
> ```js
> const factor = Math.min(
>   window.innerWidth  / BASE_W,
>   window.innerHeight / BASE_H
> );
> ```
> Esto preserva el aspect ratio exacto del diseño, letterboxeando si el viewport tiene otra proporción.

### 4.5 Agregar estímulos en coordenadas base

Todos los valores son los que leerías en DevTools de Gorilla **en el viewport de referencia**. No multipliques nada: Konva lo hace.

#### Imagen (equivale a slot div + flex div + img)

```js
const imageObj = new Image();
imageObj.onload = () => {
  const img = new Konva.Image({
    image:  imageObj,
    x:      198,     // left del slot en Gorilla @ BASE_W
    y:      43.5,    // top del slot en Gorilla @ BASE_W
    width:  522,     // width del slot
    height: 478.5,   // height del slot
    // Para centrar el contenido dentro del slot (= el div de flex de Gorilla):
    // Si la imagen es más pequeña que el slot, ajusta con offsetX/Y
  });
  layer.add(img);
  layer.batchDraw();
};
imageObj.src = 'armadillo.png';
```

Si la imagen tiene proporciones distintas al slot y quieres que se comporte como `object-fit: contain`:

```js
// Calcular escala contain manualmente
const scaleX = slotW / imageObj.naturalWidth;
const scaleY = slotH / imageObj.naturalHeight;
const contain = Math.min(scaleX, scaleY);

const img = new Konva.Image({
  image:   imageObj,
  x:       slotX + slotW / 2,     // centro del slot
  y:       slotY + slotH / 2,
  width:   imageObj.naturalWidth  * contain,
  height:  imageObj.naturalHeight * contain,
  offsetX: (imageObj.naturalWidth  * contain) / 2,  // centrado
  offsetY: (imageObj.naturalHeight * contain) / 2,
});
```

#### Texto

```js
const texto = new Konva.Text({
  x:        807,
  y:        87,
  width:    348,
  height:   87,
  text:     'Your text here',
  fontSize: 14,          // en px base; escala automáticamente con el layer
  fontFamily: 'Arial',
  align:    'center',
  verticalAlign: 'middle',
  fill:     '#333',
});
layer.add(texto);
```

> `fontSize` se escala visualmente por el `layer.scale()`, pero el valor en memoria queda como el base. Si en algún momento necesitas el tamaño renderizado real:
> ```js
> const fzReal = texto.fontSize() * layer.scaleX();
> ```

#### Botón (= Rect + Text, equivale al button de Gorilla)

```js
const btnGroup = new Konva.Group({
  x: 633,
  y: 565.5,
});

const btnRect = new Konva.Rect({
  width:        174,
  height:       43.5,
  fill:         '#e53935',   // color del botón Next de Gorilla
  cornerRadius: 4,
});

const btnText = new Konva.Text({
  width:       174,
  height:      43.5,
  text:        'Next',
  fontSize:    16,
  fontFamily:  'Arial',
  fontStyle:   'bold',
  fill:        '#ffffff',
  align:       'center',
  verticalAlign: 'middle',
});

btnGroup.add(btnRect, btnText);

// Cursor pointer al hover
btnGroup.on('mouseenter', () => stage.container().style.cursor = 'pointer');
btnGroup.on('mouseleave', () => stage.container().style.cursor = 'default');

layer.add(btnGroup);
```

---

## 5. Integración con jsPsych

### Estructura del trial

```js
const konvaTrial = {
  type: jsPsychHtmlKeyboardResponse,   // o un plugin custom
  stimulus: '<div id="konva-container"></div>',
  choices: 'NO_KEYS',
  on_load: () => {
    // Aquí va todo el código de Konva
    const stage = new Konva.Stage({ ... });
    // ...

    // El botón Next llama a jsPsych para terminar el trial
    btnGroup.on('click', () => {
      jsPsych.finishTrial({ respuesta: 'next' });
    });

    applyScale();
  },
  on_finish: () => {
    // Limpiar el stage para no acumular canvas elements
    stage.destroy();
    window.removeEventListener('resize', applyScale);
  },
};
```

### Plugin custom (recomendado para múltiples trials)

Si tienes muchos trials con canvas, conviene encapsularlo en un plugin propio:

```js
const jsPsychKonvaTrial = {
  info: {
    name: 'konva-trial',
    parameters: {
      stimuli: { type: jsPsych.ParameterType.OBJECT, array: true },
    },
  },
  trial(displayEl, trial) {
    // 1. Montar el contenedor
    displayEl.innerHTML = '<div id="konva-container" style="width:100vw;height:100vh;"></div>';

    // 2. Construir el stage y los estímulos
    const stage = buildStage(trial.stimuli);   // tu función
    applyScale(stage);
    window.addEventListener('resize', () => applyScale(stage));

    // 3. El botón cierra el trial
    stage.findOne('#btn-next').on('click', () => {
      stage.destroy();
      window.removeEventListener('resize', () => applyScale(stage));
      jsPsych.finishTrial();
    });
  },
};
```

---

## 6. Tabla resumen: Gorilla → Konva

| Concepto en Gorilla | Equivalente en Konva |
|---|---|
| 3 divs anidados (contenedores) | `Konva.Stage` + `Konva.Layer` |
| `overflow:hidden` en capa 3 | `layer.clip({ x, y, width, height })` |
| `position:absolute` + px calculados por elemento | `layer.scale({ x: factor, y: factor })` aplicado una vez |
| Slot div (bounding box del estímulo) | `Konva.Group` con `x`, `y`, `width`, `height` |
| Div de flex (centrado dentro del slot) | `offsetX` / `offsetY` en el nodo hijo |
| `img` | `Konva.Image` |
| `button` | `Konva.Group` con `Konva.Rect` + `Konva.Text` |
| `font-size` calculado en px reales | `Konva.Text.fontSize` en px base (escala con el layer) |
| Resize handler que recalcula cada elemento | `window.addEventListener('resize', applyScale)` |
| `object-fit: contain` en imágenes | Cálculo manual con `Math.min(scaleX, scaleY)` |

---

## 7. Cosas a tener en cuenta

**Coordenadas del mouse**: los eventos de Konva (`click`, `mousemove`, etc.) devuelven coordenadas ya transformadas al espacio base. No necesitas dividir por el factor.

**Hit detection**: Konva hace el hit testing en coordenadas base también. Los clicks funcionan correctamente sin ajustes.

**Retina / devicePixelRatio**: para pantallas de alta densidad, agrega esto al crear el Stage:

```js
const dpr = window.devicePixelRatio || 1;
const stage = new Konva.Stage({
  container: 'konva-container',
  width:  window.innerWidth,
  height: window.innerHeight,
  pixelRatio: dpr,
});
```

**Performance**: llama siempre `layer.batchDraw()` en lugar de `layer.draw()` dentro de loops o handlers de resize. Konva agrupa los redraws en un solo frame.

**Múltiples layers**: si necesitas z-ordering complejo (fondo estático + estímulos animados + UI), usa layers separados. Cada layer puede tener su propio scale, aunque normalmente todos comparten el mismo factor.

```js
const bgLayer  = new Konva.Layer();   // fondo, no cambia
const stimLayer = new Konva.Layer();  // estímulos
const uiLayer  = new Konva.Layer();   // botones

stage.add(bgLayer, stimLayer, uiLayer);

function applyScale() {
  const f = window.innerWidth / BASE_W;
  [bgLayer, stimLayer, uiLayer].forEach(l => l.scale({ x: f, y: f }));
  stage.batchDraw();
}
```
