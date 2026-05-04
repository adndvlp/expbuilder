# Scaling de Gorilla en Konva: implementación exacta

## La idea en una línea

Defines todo en coordenadas base (las que ves en Gorilla al 100%) y escalasel `Stage` una sola vez. Konva propaga la transformación a cada nodo automáticamente.

---

## Paso 1 — HTML mínimo

```html
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; }
    #container { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <div id="container"></div>
  <script src="https://unpkg.com/konva@9/konva.min.js"></script>
  <script src="task.js"></script>
</body>
</html>
```

---

## Paso 2 — Crear el Stage con escala inicial

```js
const BASE_W = 1200; // ancho del canvas de diseño en Gorilla
const BASE_H = 696;  // alto del canvas de diseño en Gorilla

const factor = window.innerWidth / BASE_W;

const stage = new Konva.Stage({
  container: 'container',
  width:     window.innerWidth,
  height:    window.innerHeight,
  scaleX:    factor,
  scaleY:    factor,  // mismo valor en X e Y → sin distorsión
});
```

`scaleX` y `scaleY` están en el constructor de `Stage` según el API. No hace falta llamar nada más después de esto para el primer render.

---

## Paso 3 — Layer y clip

```js
const layer = new Konva.Layer();
stage.add(layer);

// Equivale al overflow:hidden del div contenedor de Gorilla.
// El clip vive en coordenadas BASE, no en px reales.
stage.clip({ x: 0, y: 0, width: BASE_W, height: BASE_H });
```

---

## Paso 4 — Agregar estímulos en coordenadas base

Los valores de `x`, `y`, `width`, `height` son exactamente los que leerías en DevTools de Gorilla con el viewport en `BASE_W`. No multipliques nada.

### Imagen

```js
const imageEl = new Image();
imageEl.onload = () => {
  const armadillo = new Konva.Image({
    image:  imageEl,
    x:      198,
    y:      43,
    width:  522,
    height: 478,
  });
  layer.add(armadillo);
};
imageEl.src = 'armadillo.png';
```

### Texto

```js
const texto = new Konva.Text({
  x:             807,
  y:             87,
  width:         348,
  height:        87,
  text:          'Your text here',
  fontSize:      14,       // en coords base; escala visualmente con el Stage
  fontFamily:    'Arial',
  fill:          '#333333',
  align:         'center',
  verticalAlign: 'middle',
});
layer.add(texto);
```

### Botón Next (rect + texto sobre el mismo grupo)

```js
const btnGroup = new Konva.Group({ x: 633, y: 565 });

btnGroup.add(new Konva.Rect({
  width:        174,
  height:       43,
  fill:         '#e53935',
  cornerRadius: 4,
}));

btnGroup.add(new Konva.Text({
  width:         174,
  height:        43,
  text:          'Next',
  fontSize:      16,
  fontFamily:    'Arial',
  fontStyle:     'bold',
  fill:          '#ffffff',
  align:         'center',
  verticalAlign: 'middle',
}));

btnGroup.on('mouseenter', () => stage.container().style.cursor = 'pointer');
btnGroup.on('mouseleave', () => stage.container().style.cursor = 'default');

layer.add(btnGroup);
```

---

## Paso 5 — Resize

Solo actualizas el Stage. Los nodos no se tocan.

```js
window.addEventListener('resize', () => {
  const f = window.innerWidth / BASE_W;
  stage.width(window.innerWidth);
  stage.height(window.innerHeight);
  stage.scaleX(f);
  stage.scaleY(f);
});
```

---

## Paso 6 — Integrar con jsPsych

```js
const trial = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: '<div id="container"></div>',
  choices:  'NO_KEYS',

  on_load() {
    // todo el código de Konva va aquí
    const stage = buildStage(); // tu función con los pasos 2-5

    btnGroup.on('click', () => {
      stage.destroy();
      window.removeEventListener('resize', rescale);
      jsPsych.finishTrial({ response: 'next' });
    });
  },
};
```

---

## Dos cosas que no son obvias del API

### Coordenadas del pointer

`stage.getPointerPosition()` devuelve coordenadas **absolutas sin escala** (px reales del canvas). Si necesitas saber en qué punto base hizo click el usuario, no uses ese método. Usa el evento directamente sobre el shape:

```js
armadillo.on('click', (e) => {
  // e.target.x(), e.target.y() → coords base, ya transformadas
  console.log(e.target.x(), e.target.y());
});
```

### fontSize no tiene setter que escale automáticamente en memoria

El `fontSize` de un `Konva.Text` se escala **visualmente** con el Stage, pero el valor en memoria queda como el base. Si en algún punto necesitas el tamaño real renderizado:

```js
const fzReal = texto.fontSize() * stage.scaleX();
```

---

## Resumen de métodos usados

| Qué | Método del API |
|---|---|
| Escala inicial | `new Konva.Stage({ scaleX, scaleY })` |
| Escala en resize | `stage.scaleX(f)` / `stage.scaleY(f)` |
| Tamaño del stage | `stage.width(n)` / `stage.height(n)` |
| Overflow hidden | `stage.clip({ x, y, width, height })` |
| Cursor pointer | `stage.container().style.cursor` |
| Destruir al salir | `stage.destroy()` |
