# Estrategia de escalado de Gorilla.sc entre pantallas (móvil, tablet, escritorio)

**Resumen ejecutivo:** Gorilla.sc emplea un *contenedor virtual* (“Stage”) de proporción fija (por defecto 4:3 en horizontal) y un sistema de coordenadas relativas (grid de 24×18) para asegurar que el diseño escale uniformemente en distintos tamaños de pantalla【11†L82-L90】【11†L97-L105】. Esto implica crear versiones separadas de la tarea para cada tipo de dispositivo (móvil/tablet/escritorio) y dirigir al usuario a la versión apropiada según su dispositivo【20†L47-L50】【20†L75-L82】. Gorilla usa además reglas de estilo automáticas: zonas de texto e imagen que ajustan el contenido al área disponible (autoscaling)【32†L464-L472】【34†L641-L644】. En la práctica, esto evita que los elementos se “apilen” o queden muy separados en pantallas pequeñas o grandes【11†L60-L68】【40†L394-L402】. Para implementar una estrategia similar en una web app responsiva de experimentos en psicología, se recomiendan pasos concretos: usar meta viewport, contenedores con aspect-ratio, CSS flex/grid, media queries, unidades relativas (rem/em), manejar high-DPI (retina) y distinguir eventos táctiles vs pointer【46†L655-L663】【48†L233-L241】. A continuación se detallan todas estas técnicas con evidencia primaria (documentación oficial de Gorilla), análisis técnico, ejemplos de código y recomendaciones.

## Estrategia de escalado de Gorilla.sc

- **Contenedor “Stage” de proporción fija:** Gorilla define un área virtual llamada *Stage* con relación de aspecto constante (por defecto 4:3 en modo landscape)【11†L49-L57】【20†L136-L144】. Todo el contenido (imágenes, texto, botones) se posiciona relativamente dentro de este Stage usando un sistema de coordenadas porcentuales (grid)【11†L82-L90】【23†L492-L500】. El Stage se centra en la pantalla, y cualquier espacio extra (por ejemplo bordes negros) queda a los lados o arriba/abajo. De este modo, **independientemente del tamaño de la pantalla real**, los elementos se escalan con la misma proporción: “no importa cuán grande sea el *stage* – todos nuestros objetos escalarán con él”【11†L82-L90】, garantizando consistencia en el layout【11†L60-L68】. En la interfaz de Gorilla Task Builder 2 esto se traduce en un fondo (Stage) de tamaño fijo sobre el cual se colocan zonas; fuera del Stage no se coloca contenido relevante, para que el diseño conserve el mismo aspecto relativo en móviles, tablets o PCs【11†L60-L68】【20†L136-L144】.

- **Coordenadas proporcionales (grid):** Los objetos en pantalla no se dimensionan en píxeles absolutos, sino en unidades del grid (24 columnas × 18 filas para el Stage 4:3)【11†L97-L105】. Por ejemplo, un cuadrado de 10×10 unidades siempre será cuadrado con lado = (10/24) ancho del Stage【11†L97-L105】. Esto simplifica que el layout se “reflote” en cualquier escala: dos objetos separados por 1 unidad de grid siempre mantienen 1/24 del ancho entre ellos, sin importar el dispositivo【11†L97-L105】. (Gorilla permite excepciones con “Advanced Positioning” para usar píxeles o porcentaje del Stage manualmente【23†L492-L500】, útil en tareas de visión donde se requiere tamaño físico preciso).

- **Versiones separadas por dispositivo:** A diferencia de una sola página web que refluye, Gorilla sugiere crear varias versiones de la tarea: una optimizada para escritorio, otra para móvil (portrait) y tal vez otra para tablet【20†L47-L50】【20†L75-L82】. Gorilla *no* detecta automáticamente el dispositivo por User Agent; recomienda preguntar al participante qué dispositivo usa (por ejemplo en un cuestionario inicial) y luego enrutarlo a la versión adecuada mediante un nodo Branch en el experimento【20†L66-L69】【20†L179-L187】. Esto evita problemas críticos: por ejemplo, no enviar teclas a un smartphone (donde el teclado puede no aparecer)【20†L66-L69】. En cada versión se puede ajustar el Stage (por ejemplo, seleccionar layout “16:9 Portrait” para móviles【20†L136-L144】) y componentes específicos (p.ej. en Stroop móvil usar botones táctiles en lugar de respuesta por teclado【20†L174-L179】). 

- **Auto-escalado de texto e imágenes (zones):** Los componentes nativos de Gorilla escalon automáticamene su contenido. Por ejemplo, una zona de texto (Text Zone) en Task Builder 1 “auto-redimensiona” el texto para que quepa en su área【32†L464-L472】; de forma similar, las zonas de rich-text centran y adaptan el texto【32†L539-L543】. Las imágenes en zonas se muestran al mayor tamaño posible dentro del contenedor sin distorsionar la proporción: “imagen tan grande como quepa, manteniendo la relación de aspecto, pero sin ampliarse más allá de su tamaño natural”【34†L641-L644】【40†L376-L384】. Incluso hay opciones avanzadas para fijar ancho en cm o grados visuales【34†L704-L709】. En Task Builder 2, cada componente de texto activa por defecto “Autoscale”: el tamaño de fuente definido se adapta según el tamaño real de pantalla para evitar solapamientos【40†L394-L402】. 

- **Ejemplo práctico en Gorilla:** Un estudio con Gorilla ilustra estos principios: al presentar estímulos Kanji, cada carácter ocupaba “20×20 units dentro de una ventana 4:3 del espacio de pantalla de Gorilla”【19†L3320-L3328】. Es decir, se midió el tamaño en unidades del Stage, no en píxeles absolutos. Adicionalmente, un ejemplo público de Gorilla para tareas drag-and-drop usa CSS Flexbox para disponer imágenes horizontalmente: el código calcula anchos dinámicamente y “las imágenes deben *redimensionarse/ser responsivas*”【9†L869-L874】. En la versión móvil usan la misma idea (con jQuery TouchPunch para eventos táctiles) y también remarcan que las imágenes son responsivas【9†L897-L904】. Esto demuestra que Gorilla integra técnicas web estándar (flexbox, media queries) junto con su sistema de Stage/zonas.

En resumen, la estrategia de Gorilla combina (1) un marco fijo (Stage 4:3 o 16:9) con coordenadas proporcionales para consistencia visual【11†L82-L90】, (2) componentes que autoscalan texto/imágenes【32†L464-L472】【34†L641-L644】【40†L394-L402】, y (3) versiones distintas de la tarea para cada tipo de dispositivo【20†L47-L50】【20†L75-L82】. A continuación se discuten en detalle cada técnica, con evidencia primaria de Gorilla y recursos estándar.

## Detalles técnicos de la estrategia de escalado

- **Meta viewport:** Toda app web responsiva debe incluir `<meta name="viewport" content="width=device-width, initial-scale=1">` en `<head>`【46†L655-L663】. Esto garantiza que navegadores móviles ajusten la ventana gráfica al ancho del dispositivo, sin asumir un ancho “falso” (como 960px por defecto)【46†L655-L663】. Sin esta metaetiqueta, *media queries* y demás adaptaciones fracasan (el diseño se vería reducido). Además, por accesibilidad conviene **permitir el zoom** del usuario (no usar `user-scalable=no`)【46†L699-L702】. 

- **Proporción fija y transform/scale:** Para emular el Stage de Gorilla, puede usarse CSS moderno: por ejemplo, un contenedor `<div class="stage">` con `aspect-ratio: 4/3; width:100%; max-height:100vh; margin:auto;` asegura una caja 4:3 que ocupa el 100% del ancho y alinea alturas relativas. Otra opción es calcular un factor de escala en JS: 
  ```js
  const stage = document.querySelector('.stage');
  function resizeStage() {
    const scale = Math.min(window.innerWidth/stage.offsetWidth,
                           window.innerHeight/stage.offsetHeight);
    stage.style.transform = `scale(${scale})`;
  }
  window.addEventListener('load', resizeStage);
  window.addEventListener('resize', resizeStage);
  ```
  Este script ajusta dinámicamente `.stage` para que encaje en la pantalla, similar a cómo Gorilla maximiza el Stage. **Pros/cons:** CSS puro (`aspect-ratio`) es sencillo y eficiente en navegadores modernos, pero faltan *interactividad* ante rotación o cambios dinámicos. La solución JS es más exacta para escalado pixel-perfect pero implica más cálculo en `resize`. En cualquier caso, el objetivo es mantener constante la relación de aspecto (4:3, 16:9, etc.) y escalar toda la interfaz.

- **Breakpoints y media queries:** Definir puntos de quiebre (“breakpoints”) permite rediseñar el layout. Por ejemplo:
  ```css
  @media (max-width: 480px) { /* smartphone */ ... }
  @media (min-width: 481px) and (max-width: 768px) { /* tablet */ ... }
  @media (min-width: 769px) { /* desktop */ ... }
  ```
  A menor ancho, se puede cambiar disposición de zonas (por ejemplo un menu lateral a menú hamburguesa). Es común usar rangos como 320-480px (teléfonos), 481-768px (tablets), 769px+ (escritorio). MDN destaca que el diseño responsivo clásico combina grids fluidos, imágenes fluidas (`max-width:100%`) y media queries【44†L312-L321】. Por ejemplo, usar `img { max-width:100%; height:auto; }` evita que imágenes desborden su contenedor en pantallas pequeñas. Gorilla implementa esto tras bambalinas en sus “Scaling Guide” y componentes (imagen se ajusta manteniendo proporción【40†L376-L384】).

- **Unidades relativas (rem/em):** Para tipografía adaptable, conviene usar unidades relativas. Por ejemplo, establecer `html { font-size: 16px; }` y luego usar `rem` para tamaños de fuente. Mediante media queries se puede ajustar el tamaño base en distintos anchos (p.ej. `@media (max-width:768px) { html { font-size:14px; } }`). Gorilla aplica un concepto similar con “Autoscale”: cada texto definido para desktop se reduce proporcionalmente en pantallas más pequeñas【40†L394-L402】. En una app propia, usar `em`/`rem` facilita responsividad de texto sin cálculos manuales; combinarlo con `line-height` y `vh/vw` también puede ayudar para tipografía responsive.

- **Recursos e imágenes (assets y SVGs):** Para escalar bien los estímulos visuales, se recomienda usar **SVG** o imágenes con suficiente resolución. Las imágenes en Gorilla se redimensionan, pero no deben ser muy pequeñas o se verían borrosas en pantallas grandes【34†L641-L644】. Para alta densidad de píxeles (retina), hay que proporcionar versiones a doble resolución (Ej: usando `srcset` en `<img>`). Gorilla permite subir imágenes en .png/.jpg/.gif de hasta ~50KB recomendados【34†L646-L650】 y usa el formato “contain” (maximizar sin sobre-escalar)【40†L376-L384】. En SVG, los gráficos vectoriales escalarán sin perder definición y suelen ser ligeros, ideal para iconos o stimuli simples. Para videos, Gorilla señala que presenta videos 16:9 dentro del Stage 4:3, añadiendo letterbox si es necesario【40†L376-L384】. 

- **Orientación (portrait/landscape):** Es importante considerar la rotación de dispositivos. Se puede usar la media query `@media (orientation: portrait)` o `(orientation: landscape)` para ajustar estilos. Por ejemplo, un control o zona de respuestas podría reposicionarse en modo vertical. Gorilla facilita esto pidiendo al investigador que especifique el Stage (4:3 landscape o 16:9 portrait) según el uso previsto【20†L136-L144】. En una app propia, podemos detectar la orientación en JS (`window.screen.orientation`) o con CSS para reorganizar elementos clave. Sin embargo, Gorilla no fuerza la orientación; el participante puede rotar libremente, por lo que el diseño debe ser tolerante (p. ej. flex-wrap en columnas si es necesario).

- **Puntero vs táctil (pointer/coarse vs fine):** Para mejorar la usabilidad, se distinguen dispositivos con puntero fino (ratón) y puntero grueso (dedo). CSS ofrece media queries como `@media (pointer: coarse)` y `(pointer: fine)`【48†L233-L241】. En Gorilla, componentes táctiles (botones, zonas de clic) son más grandes y se evitó depender del teclado en móviles【20†L174-L179】. Al implementar, conviene usar estos queries: por ejemplo, hacer botones más grandes o más espaciados en touch. También en JS se puede usar eventos táctiles (`touchstart`) junto con eventos de ratón, o la API Pointer Events. No hay cita directa de Gorilla en este punto, pero es buena práctica general. El MDN explica que `pointer: coarse` identifica pantallas táctiles【48†L233-L241】.

- **Contenedores flexibles (flexbox, grid):** Gorilla usa **Flexbox** para muchos layouts (ver ejemplo de imágenes horizontales)【9†L869-L874】. Flexbox facilita reordenar elementos en filas o columnas responsivas. En CSS propio, usar `display: flex; flex-wrap: wrap; justify-content: center; align-items: center;` permite que ítems fluyan al ancho disponible. Para diseños más complejos, CSS Grid es útil. En Task Builder 2, aunque el investigador no escribe CSS directamente, internamente zones y flexbox configuran el diseño. En su ejemplo de *drag-and-drop*, el uso de Flexbox hace que las imágenes se ajusten automáticamente al espacio horizontal【9†L869-L874】.

En resumen, la implementación híbrida de Gorilla combina **HTML+CSS tradicionales** (media queries, flexbox, viewport meta, etc.) con su propio framework JavaScript que aplica el Stage/proporciones y escala automática de texto/imágenes【40†L394-L402】【40†L376-L384】. No se basa en cálculos manuales para cada elemento en cada pantalla, sino en abstracciones (grid + autoscale) que ocultan complejidad al investigador.

## Evidencia primaria

- **Artículo oficial (“Gorilla in our midst”, Anwyl-Irvine et al. 2020):** Describe Gorilla como plataforma integral de experimentos online, pero no se enfoca en detalles de escalado visual. Sin embargo, establece la importancia de consistencia en el layout. Al no mencionar explícitamente CSS, debemos basarnos más en la documentación de soporte.

- **Documentación de Gorilla:** Varias páginas de soporte detallan cómo manejar responsividad:
  - *Responsive Layouts*: explica la necesidad de crear versiones móviles/escritorio separadas y usar nodos de branching【20†L47-L50】【20†L75-L82】. Recomienda usar la vista previa de dispositivo en el builder y el setting “Use Mobile Layout” en cuestionarios【20†L99-L108】. Claramente sugiere preguntar al participante qué dispositivo usa y luego asignarle la versión adecuada【20†L66-L69】【20†L75-L82】.
  - *Positioning and Layout*: detalla el Stage 4:3, el grid de 24×18, y cómo todo se dimensiona proporcionalmente【11†L82-L90】【11†L97-L105】. Enfatiza que esto asegura una experiencia consistente: “si colocas objetos lado a lado con una separación de una casilla del grid, siempre serán 1/24 del ancho total del Stage, sea cual sea el tamaño de pantalla”【11†L97-L105】.
  - *Task Builder Components*: zonas de texto/imágenes auto-escalan. Por ejemplo: “El text zone auto-resizeará el texto para caber en su área”【32†L464-L472】. Igualmente, el Rich Text Zone “auto-resizea” texto formateado【32†L539-L543】. El Image Zone ajusta imágenes “tan grande como sea posible dentro del área, manteniendo proporción”【34†L641-L644】. Además, existen opciones avanzadas para fijar tamaño real si se necesita【34†L694-L700】【34†L704-L709】.
  - *Formatting Guide (Scaling):* explica la lógica detrás de estos comportamientos. Señala que en Text Zones los componentes de texto tienen “Autoscale” activado por defecto: el tamaño base se ancla en pantallas grandes y se reduce en pantallas pequeñas【40†L394-L402】. Para imágenes, enumera casos: si la imagen es más pequeña que el objeto, se muestra a 100%; si tienen diferente proporción, se escala sin recortar【40†L376-L384】. Recomienda probar en 4:3 y 16:9 para ver efectos.

- **Ejemplos públicos (Open Materials):** El repositorio de Gorilla (openmaterials) incluye ejemplos de tareas que ilustran responsividad. En el *Drag and Drop Horizontal Images* (Task Builder 1) las instrucciones señalan: “utiliza Flexbox... las imágenes deben redimensionarse/ser responsivas”【9†L869-L874】. Hay versiones para desktop y mobile, ambas enfatizan que las imágenes se ajustan dinámicamente al ancho disponible. Estos ejemplos son código Gorilla guardado, confirmando que usan CSS flexible para adaptar layout.

- **Recursos estándar:** Para conceptos no específicos de Gorilla (viewport, rem, media queries, pointer), citamos fuentes reconocidas como MDN. Por ejemplo, MDN describe la meta viewport (con `width=device-width`) como esencial para diseño responsivo【46†L655-L663】, y enumera `pointer: coarse/fine` para diferenciar dispositivos de precisión【48†L233-L241】. El MDN “Diseño responsivo” en español confirma el uso de grids fluidos, imágenes fluidas (`max-width:100%`) y media queries como pilares del RWD【44†L312-L321】.

**Fragmentos de código hallados:** Además de los snippets propios sugeridos, la documentación Gorilla incluye ejemplos (no siempre visibles sin login) y configuraciones (por ejemplo, opciones CSS de zonificación). La evidencia citada demuestra las reglas implícitas: uso de `max-width: 100%` en imágenes, texto con autoscale, eventos táctiles sugeridos en móviles. Para sincronización de estímulos, Gorilla gestiona internamente el renderizado de pantalla; al cambiar tamaño, las coordenadas proporcionales preservan los timings relativos.

## Análisis técnico

- **Compatibilidad navegadores:** Las técnicas de Gorilla (CSS flexbox, media queries, viewport meta) son compatibles con la mayoría de navegadores modernos (Chrome, Firefox, Edge, Safari). Flexbox tiene soporte desde IE11 (aunque hoy raro usar IE), y `@media` es universal. Aspect-ratio en CSS es reciente pero ampliamente soportado (o se puede simular con padding hack). El approach de Gorilla es aplicable casi en cualquier navegador actual. Para iOS/Android, el uso de viewport meta y puntero táctil está soportado【46†L655-L663】【48†L233-L241】. La advertencia es que animaciones CSS/transform en móviles podrían tener ligeros delays (pero Gorilla ya tuvo en cuenta que *clicks* desbloquean audio, etc. – ver su solución de silent audio para autoplay【5†L268-L275】).

- **Rendimiento:** Mantener un layout responsivo introduce sobrecarga mínima. El grid y Stage de Gorilla evita cálculos JS excesivos para cada cambio, salvo al iniciar y redimensionar. Si implementamos con JS (script de scale) hay que optimizar el evento `resize` (debounce) para no recalcular miles de veces. Carga de assets: Gorilla recomienda tamaños pequeños (imágenes <50KB) para no penalizar *loading*【34†L646-L650】. En una app propia, usar `srcset` o `picture` para servir imágenes según densidad y tamaño reduce carga. La transformación CSS (scale) es GPU-acelerada y eficiente. Sin embargo, abusar de escala continua en transiciones puede solapar la GPU. En general, la estrategia de Gorilla es ligera: la mayor parte es CSS puro, con algo de JS en el builder (no expuesto al investigador).

- **Accesibilidad:** La responsividad bien implementada beneficia accesibilidad (visión clara en móviles, texto legible). Contraindicaciones: no fijar tamaños en px pequeños, permitir zoom (como señala MDN【46†L699-L702】). Gorilla “autoscale” de texto ayuda a evitar texto minúsculo. Recomendamos usar contrastes adecuados y etiquetas semánticas en la app (Gorilla por defecto genera HTML semántico). Las queries `(pointer: coarse)` evitan interfaces finas en touch (mejora accesibilidad física). Asimismo, la sugerencia de Gorilla de no forzar autokeyboard en móvil (usar botones) mejora la UX. Respecto a sincronización de estímulos: dimensionar el Stage no altera tiempos de estímulos, ya que la “posición” es proporcional, no basada en pixeles ni FPS. Aun así, si cambia el tamaño, las coordenadas de zona cambian ligeramente; es crítico que Gorilla recalibre automáticamente estas posiciones antes de cada trial, lo cual su framework maneja. En nuestra implementación, debe revisarse que recalcular layout no rompa sincronización temporal (p. ej. que un estímulo que se programó a 500ms siga a 500ms en cualquier pantalla). Dado que Gorilla mide tiempos con precisión JS interna, en una app casera se debe usar `performance.now()` o `requestAnimationFrame` para timing preciso al redimensionar.

**Pros de la estrategia de Gorilla:** Consistencia visual garantizada, fácil configuración via interfaces gráficas, simetría entre pantallas, menos decisiones de diseño manual. Se evitan reglas CSS específicas de media-queries para casi todo, pues el Stage/grid hace “magia” internamente【11†L82-L90】【40†L394-L402】. Además, se aborda directamente el problema crítico en experimentos online: no presentar la interfaz equivocada a un participante (Gorilla obliga a “branch by device”【20†L66-L69】). 

**Contras / limitaciones:** Exige crear y mantener múltiples versiones de cada tarea, lo que duplica esfuerzo de diseño. Si los dispositivos cambian de tamaño (rotación o navegador redimensionado), el Stage fija puede dejar espacio vacío (letterboxing) o mostrar barras negras, lo que estéticamente no es ideal (pero es funcionalmente consistente). No es una estrategia “fluida completa”: uno debe decidir proporciones (4:3 vs 16:9). Tampoco es trivial de replicar fuera de Gorilla sin codeo; por ejemplo, el grid 24×18 es una convención interna. El autoscale de texto puede no adaptarse perfectamente a todos los idiomas (textos largos en idiomas con palabras grandes pueden necesitar ajustes manuales). Finalmente, algunos navegadores antiguos (por ejemplo Safari < 9) no soportan bien todas las características CSS modernas (flexbox gaps, aspect-ratio); habría que prever polyfills si se apunta muy atrás.

- **Sincronización de estímulos:** Al cambiar tamaño o escala, los experimentos de psicología deben mantener la relación espacial y temporal de los estímulos. Gorilla maneja esto: la escala del Stage es uniforme, de modo que, aunque los estímulos se vean más grandes o pequeños en pantalla, sus posiciones relativas y los tiempos de aparición siguen la programación original (no se aplica ninguna aceleración temporal). En una implementación propia, es crucial que las animaciones/timers no dependan del tamaño en pixeles (por ejemplo, no usar `setTimeout` con delays recalculados por escala). Recomendamos fijar tiempos en milisegundos (p. ej. `1000ms`) y confiar en `requestAnimationFrame` para cambios de estado, garantizando que la física del experimento (latencias, duraciones) sea independiente de la resolución. Un potencial problema es *layout shift* al redimensionar: si se cambia drásticamente un elemento en medio de una prueba, el participante puede distraerse. Lo ideal es definir el tamaño del Stage antes de iniciar el experimento y no cambiarlo a mitad de sesión. Gorilla simplemente no redibuja el layout mientras corre el task; las versiones móviles vs desktop se escogen antes de la tarea.

## Implementación práctica en una app web responsiva

1. **Configurar el viewport:** En el HTML inicial de la app incluir:
   ```html
   <meta name="viewport" content="width=device-width, initial-scale=1.0">
   ```
   Esto asegura escalado correcto en móviles【46†L655-L663】. No deshabilite el zoom (evite `user-scalable=no`) para cumplir accesibilidad【46†L699-L702】.

2. **Crear el contenedor Stage:** Defina un elemento que actuará como el “Stage”. Por ejemplo:
   ```html
   <div class="stage">
     <!-- Aquí van los elementos del experimento -->
   </div>
   ```
   Y en CSS:
   ```css
   .stage {
     position: relative;
     width: 100%;
     aspect-ratio: 4 / 3;       /* Mantiene proporción 4:3 */
     max-height: 100vh;         /* No excede el alto de ventana */
     margin: 0 auto;
     background: #000;          /* Color de fondo opcional (area vacía) */
     overflow: hidden;
   }
   ```
   Esto garantiza que `.stage` ocupe el ancho completo disponible y ajuste la altura automáticamente para mantener 4:3. En modo móvil vertical conviene permitir un layout “Stage 16:9 portrait”: puede cambiarse `aspect-ratio: 9/16;` o gestionar con media query:
   ```css
   @media (orientation: portrait) {
     .stage { aspect-ratio: 9 / 16; }
   }
   ```

3. **Estilizar contenidos dentro del Stage:** Use unidades relativas (%, vh, vw) o calculadas en función del Stage. Por ejemplo:
   ```css
   .stimulus {
     position: absolute;
     width: 20%;    /* 20% del ancho del Stage (cada unidad ≈ 4.166%) */
     height: 20%;
     top: 40%;      /* posición centrada vertical */
     left: 40%;     /* centrado horizontal */
   }
   ```
   O si emula el grid de Gorilla (24 columnas): 1 unidad = 4.166%. Se puede calcular en JS también.

4. **Flexible layout con Flexbox/Grid:** Para colecciones de botones o items, use contenedores flexibles:
   ```css
   .container {
     display: flex;
     flex-wrap: wrap;
     justify-content: center;
     gap: 1rem;
   }
   .item {
     flex: 0 0 30%;    /* cada item ocupa ~30% de ancho */
   }
   ```
   Así los elementos fluirán en filas que se adaptan al ancho.

5. **Media queries para ajustes finos:** Además del Stage, puede usar CSS adicional:
   ```css
   /* Tipografía responsiva */
   html { font-size: 16px; }
   @media (max-width: 768px) {
     html { font-size: 14px; }
   }
   @media (max-width: 480px) {
     html { font-size: 12px; }
   }
   /* Diferentes layouts */
   @media (pointer: coarse) {
     button { padding: 1rem 1.5rem; }  /* botones más grandes en táctil */
   }
   @media (orientation: portrait) {
     .sidebar { display: none; }
   }
   ```
   Estas reglas refinan la interfaz: reducen fuentes en pantallas pequeñas, aumentan áreas táctiles, ocultan/reestructuran elementos por orientación o tamaño.

6. **Eventos táctiles vs puntero:** En JS, detecte el tipo de dispositivo con `window.matchMedia("(pointer: coarse)")` o examine `navigator.maxTouchPoints`. Por ejemplo:
   ```js
   if (window.matchMedia("(pointer: coarse)").matches) {
     // Configurar eventos de touch (touchstart) en lugar de click
   }
   ```
   Y ajuste lógica según sea teléfono/táctil o desktop. Por ejemplo, no esperar `keydown` en móviles si la tarea fue diseñada para teclado; en su lugar, use botones en pantalla, siguiendo el consejo de Gorilla【20†L174-L179】.

7. **Assets y gráficos:** Use SVGs cuando sea posible para iconografía/diagramas. Para fotos/imagen de estímulos, genere múltiples resoluciones (2x, 3x) y especifíquelas con `srcset` en `<img>` para alta DPI. Ejemplo:
   ```html
   <img src="image.png"
        srcset="image.png 1x, image@2x.png 2x"
        alt="Estímulo">
   ```
   O use CSS `background-image` con consultas `image-set()`. Asegúrese de precargar medios antes del experimento para evitar saltos de carga. Gorilla advierte no usar GIFs no repetitivos (por precarga)【34†L717-L724】.

8. **Sincronización de estímulos:** Fije el tamaño inicial antes de iniciar cada prueba. Si adapta la escala en cualquier evento (load/resize), hágalo *fuera* del bucle de presentación de estímulos. Use `performance.now()` o `Date.now()` para medir tiempos de respuesta y detenciones, evitando frenar el hilo principal con cálculos voluminosos. Si usa `requestAnimationFrame` para animaciones de estímulos, escale las coordenadas, no los tiempos.

**Alternativas:** Si no puede replicar exactamente (p.ej. no quiere implementar Stage con JS), puede usar un enfoque CSS puro con `vw/vh`: dimensionar elementos en proporción a la ventana (p. ej. `width: 50vw; height: 50vh;`). Sin embargo, esto no garantiza la relación fija entre ancho/alto. También existen librerías JS (como FitText, FitSVG) que ajustan contenedores, pero Gorilla no las menciona. Si no se usa el Stage, al menos aplicar las buenas prácticas de RWD convencionales (media queries y flexbox) dará un resultado aceptable, aunque no idéntico a la experiencia Gorilla.

## Tabla comparativa de técnicas

| Técnica                    | Uso en Gorilla                                   | Ventajas                                            | Limitaciones                                      | Ejemplo de código (simplificado)                          |
|----------------------------|--------------------------------------------------|-----------------------------------------------------|---------------------------------------------------|-----------------------------------------------------------|
| **Contenedor Stage fijo**  | Caja 4:3 (o 16:9) con grid proporcional【11†L82-L90】  | Layout uniforme en cualquier pantalla【11†L60-L68】 | Requiere manejo de espacio sobrante (letterbox)   | `.stage { aspect-ratio:4/3; width:100%; max-height:100vh; }` |
| **Grid proporcional (24×18)** | Posiciones y tamaños en unidades del Stage【11†L97-L105】 | Escalado automático de elementos (sin pixeles fijos) | Menos intuitivo para desarrolladores sin herramienta | Posición X: (`unidad_x/24`*100)% del ancho del Stage    |
| **Zonas autoscale (texto)** | Text/RichText Zone ajustan fuente【32†L464-L472】【40†L394-L402】 | Texto siempre legible (evita overflow)             | Puede reducir mucho texto largo (requiere testear) | `autoscale: on; /* implícito en Task Builder 2 */`       |
| **Zonas autoscale (imagen)** | Image Zone maximiza imágenes manteniendo ratio【34†L641-L644】 | Las imágenes caben en el área, sin estirarse    | Imágenes pequeñas no crecen (no upscaled)         | `img { max-width:100%; height:auto; }`                   |
| **Flexbox para layout**    | Ejemplo de drag-drop usa Flexbox para columnas【9†L869-L874】 | Distribuye elementos dinámicamente               | Soporte limitado en IE<9 (ya poco relevante)      | `.container{display:flex; flex-wrap:wrap;}`              |
| **Media queries**         | Gorilla sugiere mobile vs desktop (pero no da CSS específico) | Control de estilos para cada rango de ancho      | Requiere definir manualmente breakpoints         | `@media (max-width:480px){ /* móvil */ }`                |
| **Viewport meta**         | Implícito en cualquier tarea web (no documentado) | Establece escala correcta en móviles【46†L655-L663】 | Si falta, media queries fallan                  | `<meta name="viewport" content="width=device-width, initial-scale=1">` |
| **Pointer queries**       | No documentado directamente, pero relevante      | Diferenciar táctil vs puntero【48†L233-L241】     | Requiere ajustes extras en CSS/JS                | `@media (pointer:coarse){ button{padding:1rem;} }`        |
| **Unidad relativa (rem/em)** | Gorilla usa Autoscale en texto (p.ej. 150% en MDN)【46†L651-L659】 | Tipografía escalable, facilita RWD               | Depende de tamaño base correctamente definido    | `html{font-size:16px;} @media(max-width:768px){html{font-size:14px;}}` |
| **SVG vs raster**         | Gorilla soporta png/jpeg, no menciona SVG.      | SVGes escalan nítidos a cualquier DPI             | SVG no adecuado para fotos detalladas            | `<img src="stim.svg" alt="...">`                         |

Cada técnica debe adaptarse al contexto de la app. Por ejemplo, Gorilla no usa media queries CSS explícitamente (sus layouts son estáticos por versión), pero nosotros sí debemos hacerlo. Los ejemplos de código son ilustrativos; en Gorilla muchas de estas reglas están implícitas en el framework y la interfaz gráfica.

## Recomendaciones finales

Para replicar una estrategia similar en una aplicación web de experimentos online, se recomienda:

- **Diseñar con el *Stage* en mente:** Mantener un área de presentación centralizada con aspecto constante. Esto evita que los elementos críticos cambien de lugar inesperadamente en diferentes dispositivos. Se puede lograr con CSS `aspect-ratio` o calculando escala con JavaScript. Mantener los estímulos en unidades proporcionales garantiza que, al cambiar de dispositivo, la tarea luzca igual (relación estímulo-tamaño).

- **Multiples vistas adaptadas:** Al igual que Gorilla, si la lógica de la tarea lo permite, prever versiones separadas para móvil y escritorio. Esto puede simplificarse pidiendo al participante su dispositivo al inicio. En el flujo del experimento, usar lógica de branching para lanzar el layout correcto. Por ejemplo, si se detecta ancho < 600px, cargar la plantilla móvil. Así se evita forzar campos de texto en móviles (usar botones en su lugar).

- **HTML5 y CSS modernos:** Use `viewport`, flexbox o grid, consultas media y unidades relativas de forma estándar. Aproveche `@media (orientation: portrait)` para ajustes cuando el usuario rote el dispositivo. Use `max-width:100%` para imágenes fluídas. Emplee fuentes escalables y verifique la legibilidad en tamaños pequeños.

- **Accesibilidad y eventos:** No bloquee el zoom, use tips de MDN sobre meta viewport y accesibilidad【46†L699-L702】. Asegúrese de que todos los elementos interactivos sean lo suficientemente grandes en pantallas táctiles (por ejemplo, usando consultas `pointer: coarse` como guía). Proporcione alternativas de entrada (por ejemplo, *tecla* “continuar” en escritorio vs botón grande en móvil).

- **Sincronización del experimento:** Inicialice la escala **antes** de mostrar estímulos. Si la pantalla cambia (e.g. usuario rota o redimensiona), considere reiniciar la tarea para evitar arrastrar problemas de timing. Valide que los cronómetros y animaciones usen tiempos relativos, no dependen de frame rate ni tamaño.

- **Probar ampliamente:** Gorilla recomienda probar las tareas en todos los tamaños posibles (4:3, 16:9, full screen)【40†L376-L384】. Haga lo mismo: emule smartphone, tablet, distintos monitores. Verifique que zonas no solapen ni se disperses demasiado.

Si no se dispone de la infraestructura exacta de Gorilla, estas recomendaciones logran un resultado equivalente. En caso de limitaciones, centrarse en meta viewport, media queries y contenedores flexibles producirá una app usable en múltiples dispositivos, aunque quizás con menor sincronización automática que Gorilla ofrece. En última instancia, replicar exactamente el sistema de Stage/grid de Gorilla no está documentado públicamente en detalle; sería un esfuerzo de ingeniería. De todas formas, siguiendo las buenas prácticas generales y las recomendaciones de Gorilla para responsividad, se puede garantizar que los experimentos online funcionen de forma consistente en móvil, tablet y escritorio, minimizando pérdida de datos por interfaces inadecuadas【20†L66-L69】【19†L3320-L3328】.

