# SDD: escalado proporcional de Konva y DynamicPlugin

Estado: implementado y verificado localmente. Paquete 1.1.0 preparado; distribución en npm/CDN pendiente.

Fecha: 2026-11-04. Base de revisión: `e010997` y estado local observado. La base local y los archivos de trabajo del tester tienen cambios previos ajenos a este documento.

## 1. Objetivo y decisiones acordadas

Conservar la composición de cada ensayo al mostrarlo en pantallas diferentes. Posiciones, separaciones, imágenes, fuentes, botones y demás elementos deben cambiar de tamaño con una única escala, manteniendo sus proporciones entre sí.

La base interna será **2560 × 1450**, definida una sola vez en código compartido por el editor y el runtime. No es un límite de tamaño: la escena también se amplía cuando hay espacio suficiente.

No se guarda esa resolución en el ensayo, en sus componentes, en configuración de apariencia ni en el código generado. Tampoco se presenta como ajuste al usuario. Los presets de pantalla del editor continúan indicando el dispositivo que se quiere previsualizar.

Se conserva la medición actual del espacio disponible de jsPsych, incluidos hosts embebidos, barra de progreso y `experiment_width`. Sobre ese espacio se ajusta la composición completa, centrada y sin deformarla ni recortarla para llenar la pantalla.

## 2. Situación comprobada antes de implementar

| Área | Comportamiento anterior | Consecuencia para el cambio |
|---|---|---|
| [geometry.ts](../shared/dynamic-layout/geometry.ts) | X depende del ancho y Y del alto; ambas longitudes usan el ancho. | Cambiar la proporción de pantalla altera la separación vertical respecto al tamaño de los componentes. |
| [useDesignerComponents.ts](../client/src/pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/hooks/useDesignerComponents.ts) | Proyecta posiciones y tamaños sobre el preset seleccionado. | La pantalla previsualizada participa actualmente en el cálculo de la composición. |
| [useConfigFromComponents.ts](../client/src/pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/useConfigFromComponents.ts) | Convierte cajas y fuentes usando el ancho de esa previsualización. | Carga, edición y guardado deben usar la misma base interna. |
| [RuntimeViewport.ts](../server/dynamicplugin/layout/RuntimeViewport.ts) | Mide el host real y aplica superficies sin transformación. | La medida del host debe distinguirse de las dimensiones internas de la escena. |
| [CanvasStage.ts](../server/dynamicplugin/renderer/CanvasStage.ts) | Usa las dimensiones del stage también para reservar el buffer, multiplicadas por DPR. | Fijar el stage sin adaptar el buffer aumentaría innecesariamente la memoria en pantallas pequeñas. |
| [ResponseTimingManager.ts](../server/dynamicplugin/utils/ResponseTimingManager.ts) e [index.ts](../server/dynamicplugin/index.ts) | Convierten punteros y exportan posiciones suponiendo que escena y área disponible coinciden. | Deben distinguir coordenadas internas, del host y del navegador. |
| Pruebas de viewport | Algunas exigen posiciones basadas en todo el alto disponible y buffers del tamaño completo del host. | Esas expectativas se sustituyen por el contrato de composición proporcional. |
| [publish.js](../server/routes/experiments/publish.js) | La publicación carga el paquete DynamicPlugin versionado desde CDN. | Cambiar únicamente el bundle local no actualiza la ejecución pública. |

La documentación de plugins también describe `screenLayouts` y `resolveScreenLayout`, que no aparecen como implementación vigente en las fuentes revisadas. Se corregirán esas descripciones; no se introduce un selector de diseños por resolución.

## 3. Alcance

Incluye el editor visual, su copia HTML de los componentes, Run Demo, ejecución local y artefactos públicos nuevos. Cubre texto, imagen y botón como escenario principal, y la integración de vídeo, HTML, inputs, sliders, Survey, Sketchpad y carga de archivos. Los componentes sin representación visual mantienen sus funciones.

Incluye selección, arrastre, redimensionado, edición de texto, grilla, snapping, portapapeles, historial, zonas de respuesta, medidas exportadas, buffers gráficos y superficies persistentes entre ensayos.

Los datos de navegación, condiciones, CSV, respuestas, sesiones anteriores, archivos y programas del usuario no se reescriben. Los valores procedentes de CSV o funciones se resuelven antes de calcular la geometría del ensayo, con sus reglas actuales.

Este cambio no modifica el escalado de otros plugins de jsPsych ni añade una migración para reconstruir la resolución histórica de los ensayos. La retirada de migraciones temporales sigue el registro de [temporary-migrations.md](temporary-migrations.md) y pertenece a una tarea distinta.

## 4. Geometría común

### 4.1 Base y unidades

Se propone `shared/dynamic-layout/scene.ts` para declarar la base constante y las operaciones de ajuste y transformación. `geometry.ts` conserva las conversiones relativas, utilizadas con la base interna en los caminos de DynamicPlugin.

El contrato guardado sigue usando:

- Coordenadas centradas entre −100 y 100, con Y positiva hacia arriba.
- `width` y `height` como porcentajes del ancho del diseño, conservando la unidad vigente de ambos campos.
- Fuentes relativas existentes como porcentajes del mismo ancho.
- Dimensiones, fuentes, padding, bordes y radios expresados en píxeles como unidades internas del diseño. Se escalan junto con la escena, en lugar de quedar fijos en la pantalla del participante.

Se conserva la prioridad actual de fuentes relativas sobre las variantes en píxeles. No se infiere el tamaño de la pantalla que utilizó el autor. Los ensayos existentes se interpretan con sus valores actuales sobre la nueva base común; no se garantiza reproducir todas las apariencias históricas dependientes de otro viewport.

Para una coordenada guardada `(x, y)` y una longitud relativa `p`:

```text
designX = ((x + 100) / 200) × 2560
designY = ((100 − y) / 200) × 1450
designLength = (p / 100) × 2560
```

### 4.2 Ajuste al espacio disponible

Sea `A` el rectángulo disponible medido por jsPsych: origen `(left, top)`, ancho `W` y alto `H`, en píxeles CSS del navegador.

```text
s = min(W / 2560, H / 1450)
displayWidth  = 2560 × s
displayHeight = 1450 × s
offsetX = (W − displayWidth) / 2
offsetY = (H − displayHeight) / 2

hostX = offsetX + s × designX
hostY = offsetY + s × designY
clientX = A.left + hostX
clientY = A.top  + hostY
```

No se limita `s` a 1. Un host sin dimensiones válidas conserva la espera de inicio actual; no presenta una escena con escala cero ni toma provisionalmente la pantalla completa como sustituto.

Ejemplos para un área disponible sin otros descuentos, redondeados a tres decimales:

| Área disponible | Escala | Escena mostrada | Espacio por lado: horizontal / vertical |
|---|---:|---|---|
| 2560 × 1450 | 1 | 2560 × 1450 | 0 / 0 |
| 1280 × 725 | 0.5 | 1280 × 725 | 0 / 0 |
| 390 × 844 | 0.152344 | 390 × 220.898 | 0 / 311.551 |
| 3840 × 2160 | 1.489655 | 3813.517 × 2160 | 13.241 / 0 |

El espacio libre usa la apariencia guardada del experimento. En un celular vertical, la composición horizontal ocupará una parte del alto; conservar la composición completa no equivale a llenar todas las proporciones de pantalla.

### 4.3 Contexto efímero y transformación inversa

El contexto de ejecución distingue explícitamente `hostRect`, `logicalSize`, `sceneRect`, `scale`, `dpr`, `rasterScale` y `revision`. `logicalSize` proviene de la constante compartida; el resto se calcula en memoria. No se serializa en configuraciones de ensayos o componentes.

La conversión inversa para interacción es:

```text
designX = (clientX − A.left − offsetX) / s
designY = (clientY − A.top  − offsetY) / s
```

Las operaciones usan la precisión completa durante el cálculo. Se redondea al exportar resultados según su formato vigente. Una función que espera medidas internas no recibe silenciosamente las medidas físicas del host.

## 5. Konva y previsualización

El modelo del diseñador usa la base interna para cargar, proyectar y modificar los componentes. Cambiar el preset solo modifica la transformación de presentación. No altera sus posiciones internas, su historial ni los parámetros guardados, y no provoca autosave.

La implementación debe:

1. Usar la base común en `useDesignerComponents`, conversiones de coordenadas, carga, sincronización con el inspector y serialización. Sustituir en esos cálculos el uso del preset como base.
2. Mantener el preset como marco de pantalla simulado. Calcular dentro de él la escena con `s` y sus espacios laterales.
3. Conservar el ajuste del marco al espacio del modal. Si ese ajuste es `f`, la escala visual total de la escena en el editor es `f × s`; sus desplazamientos también se multiplican por `f`.
4. Aplicar la misma transformación a Konva, la capa HTML, la edición de texto y las representaciones de selección. Cargar y medir el contenido HTML en unidades internas antes de escalarlo.
5. Convertir las posiciones del puntero a la escena antes de arrastrar, soltar, redimensionar o pegar. Contemplar el padding de los handles de Konva una sola vez.
6. Calcular grilla, snapping, guías, límites y portapapeles sobre el diseño. Las tolerancias de interacción expresadas en píxeles visibles se convierten mediante la escala total.
7. Mantener el formato relativo vigente al guardar. Guardar y reabrir debe conservar la geometría; cambiar solo la previsualización debe conservar también el resultado serializado.

El límite a 1 que puede usar el modal para reducir un iframe o un marco es una decisión de visualización del editor. No se traslada a la escala `s` del ensayo.

Run Demo conserva su iframe con las dimensiones del preset y su ajuste exterior al modal. Dentro del iframe, DynamicPlugin realiza exactamente el ajuste que hará para un participante con ese espacio disponible.

## 6. Runtime: host y escena

`RuntimeViewportController` continúa siendo el propietario de la medición y de las notificaciones de resize, scroll, fullscreen y DPR. Sobre cada medición calcula la transformación compartida.

Se establece esta estructura:

```text
Host de jsPsych
└── Contenedor de DynamicPlugin: rectángulo disponible real
    └── Escena: 2560 × 1450 internos, centrada y escalada
        ├── Canvas WebGL
        ├── Elementos DOM e inputs
        └── Elementos de seguimiento y respuesta
```

El contenedor exterior mantiene el identificador actual y las medidas reales del área disponible. La escena interior tiene dimensiones internas constantes, `transform-origin: top left`, la escala común y los desplazamientos calculados. Es el contenedor de referencia para los tamaños CSS de sus componentes.

Los componentes reciben el contexto antes de renderizar y usan las dimensiones internas para el layout. La ventana se consulta para medir el espacio disponible cuando corresponde, nunca como una segunda base de composición dentro de un componente.

El registro de stages debe pertenecer al elemento que contiene realmente los canvases. Se actualizan sus accesos en render, resize, métricas, limpieza y transición entre ensayos; añadir una capa DOM no puede dejar stages fuera de `getCanvasStages`.

Al cambiar el host se actualizan transformación, densidad gráfica y métricas dependientes. Se conservan nodos interactivos, respuestas, caret, selección, archivos, página de Survey, trazos y reproducción de vídeo. No se reinician el ensayo, sus callbacks ni los horarios de presentación.

La superficie persistente de imágenes recibe el mismo ajuste que la escena normal. Un canvas trasladado a un puente visual utiliza su rectángulo visible ya transformado; no recibe la escala por segunda vez. El puente se invalida cuando un resize haga obsoleta su captura, conservando las reglas actuales de entrega visual y destrucción.

## 7. Componentes y contenido

Texto, imágenes, botones, controles DOM y cajas de HTML comparten el mismo espacio interno. Los tamaños automáticos, límites, padding y saltos de línea se calculan allí. Redimensionar la pantalla no vuelve a distribuir el contenido ni reduce fuentes por una regla distinta a la escala común.

La copia HTML del editor debe usar esas mismas dimensiones internas. Se revisan sus estilos y conversiones de unidades para que ninguna dimensión controlada por el Builder dependa accidentalmente del viewport del modal.

Survey, Sketchpad y FileUpload conservan sus parámetros de tamaño propios; sus resultados visuales se incluyen en la transformación común. No se comienza a exportarles una caja del editor que su runtime no utiliza.

Las unidades de contenedor de los componentes se resuelven contra la escena interna. El CSS o JavaScript arbitrario del usuario que consulta directamente `vw`, `vh`, `window.innerWidth` o `window.innerHeight` conserva la semántica del navegador. Este SDD no reescribe esos programas ni promete convertir automáticamente su lógica en coordenadas del diseño. Ese límite debe documentarse para contenido personalizado; no afecta a los parámetros estándar de texto, imagen y botón.

## 8. Clics, zonas de respuesta y datos exportados

Se distinguen tres espacios sin reutilizar uno como si fuera otro:

| Espacio | Uso |
|---|---|
| Navegador, píxeles CSS `clientX/clientY` | Eventos originales y campos actuales `response_client_x/y`. |
| Host, píxeles CSS relativos al contenedor exterior | Campos actuales `response_canvas_x/y`, rectángulo del contenedor y posiciones exportadas de componentes. Incluye el desplazamiento de la escena dentro del host. |
| Diseño, unidades internas | Geometría y pruebas de impacto de los componentes dibujados en canvas; interacción de Konva. |

`ResponseTimingManager` convierte el mismo evento a los espacios necesarios. La detección de un botón dibujado utiliza el punto interno; los resultados públicos conservan medidas reales en píxeles CSS. Las comprobaciones DOM basadas en `getBoundingClientRect` siguen comparándose con puntos del navegador.

Un toque en una banda libre no activa un botón o componente situado dentro de la escena. `ClickResponseComponent` conserva su opción explícita de captura de toda el área disponible y la semántica de `relative_to_element`; cuando la captura total está activa, el objetivo incluye el host exterior.

Las posiciones `*_coordinates` se obtienen de la geometría interna transformada al host. Los tamaños `*_size` deben expresarse en píxeles CSS visibles: se revisan `getRenderedSize` y sus fallbacks para aplicar la escala exactamente una vez. No se cambian nombres de columnas, tiempos de respuesta, calibración ni datos históricos.

Los marcadores de clic y los trazos de Sketchpad deben usar la conversión que corresponda a su contenedor, verificando también los caminos sin response timing y las entradas táctiles.

## 9. Resolución gráfica y memoria

La base interna no determina directamente la cantidad de píxeles reservados. Para densidad de pantalla `dpr`:

```text
rasterScale = s × dpr
bufferWidth  = max(1, round(2560 × rasterScale))
bufferHeight = max(1, round(1450 × rasterScale))
```

El canvas conserva un tamaño CSS interno de 2560 × 1450 y se muestra con la transformación común. El buffer corresponde al tamaño visible multiplicado por DPR. En WebGL, `u_resolution` conserva las dimensiones internas y `gl.viewport` utiliza las del buffer.

`dpr` sigue significando la densidad real del dispositivo en diagnósticos. Se introduce explícitamente la densidad de rasterización, sin disfrazar `s × dpr` como si fuera el DPR del dispositivo.

Las texturas generadas para texto y botones usan también `rasterScale` al reservar sus canvases y dibujar sobre ellos. Crear primero un buffer de la base por DPR y reducirlo después no satisface este contrato. El constructor, `resize` y la reutilización de stages deben recibir la densidad correcta desde el principio.

Los cambios de DPR o de escala pueden regenerar los recursos gráficos dependientes de la resolución, conservando la geometría interna, las respuestas y el estado de temporización. Cambiar solo la posición del host no necesita otra textura. Se mantienen las reglas de liberación de recursos al sustituirlos y terminar el ensayo.

## 10. Guardado, código generado y distribución

El esquema guardado no añade dimensiones de pantalla o del diseño. `MappedJson`, los loops y los overrides siguen transportando los parámetros vigentes; las constantes y transformaciones pertenecen al código de editor/runtime.

Los ensayos existentes y los ZIP se leen con ese mismo modelo. No se restauran campos retirados, no se reconstruyen tamaños históricos y no se modifica la base local para habilitar el escalado. Los testers deberán revisar la composición de sus ensayos con la nueva interpretación común.

La ejecución local y Run Demo usan el bundle compilado desde las fuentes modificadas. Los artefactos públicos nuevos deben cargar una versión nueva del paquete que contenga el mismo cambio. La entrega debe mantener coherentes `server/dynamicplugin/package.json`, la versión declarada por el plugin, el lockfile y la versión de respaldo de la URL pública.

La implementación incluye verificar el artefacto producido por la ruta real de publicación. Las pruebas locales pueden interceptar la URL versionada para servir el bundle recién construido; ese resultado no demuestra que la versión ya esté disponible en la CDN. La disponibilidad real del paquete es una condición de la entrega pública y requiere su paso de publicación correspondiente.

Los HTML y programas históricos no se reescriben en bloque. Un experimento público ya publicado conserva su versión hasta que se regenere y publique de nuevo.

## 11. Inventario de implementación

Las rutas abreviadas del diseñador se refieren a `client/src/pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/`.

| Archivo o área | Trabajo previsto |
|---|---|
| `shared/dynamic-layout/scene.ts`, nuevo | Base única, ajuste proporcional y conversiones entre escena y host. |
| [shared/dynamic-layout/geometry.ts](../shared/dynamic-layout/geometry.ts) | Integración de las unidades relativas con la base común y sus inversas. |
| `TrialDesigner/index.tsx`, `hooks/useDesignerComponents.ts`, `hooks/useDesignerPanels.ts` | Separar modelo interno, marco seleccionado y ajuste del modal. |
| `useLoadComponents.ts`, `syncConfigToComponent.ts`, `useConfigFromComponents.ts` | Carga y guardado independientes del preset. |
| `KonvaCanvas.tsx`, `experimentalScene/`, `TextEditingOverlay.tsx` | Transformación compartida de dibujo, HTML, medición y selección. |
| `hooks/useDesignerActions.ts`, snapping, grilla, guías, drag/drop y clipboard | Conversión inversa, límites internos e historial entre previsualizaciones. |
| [ExperimentPreview.tsx](../client/src/pages/ExperimentBuilder/components/ExperimentPreview.tsx) | Integración del iframe, sin una segunda base de composición ni regeneración por cambiar solo su tamaño. |
| [RuntimeViewport.ts](../server/dynamicplugin/layout/RuntimeViewport.ts), [domLayout.ts](../server/dynamicplugin/layout/domLayout.ts) | Medición real, contexto y aplicación diferenciada al host y a la escena. |
| [index.ts](../server/dynamicplugin/index.ts) | Contenedores, etapas de presentación, superficies persistentes, métricas y posiciones exportadas. |
| [CanvasStage.ts](../server/dynamicplugin/renderer/CanvasStage.ts) | Separar tamaño interno y buffer, incluyendo creación y reutilización. |
| `server/dynamicplugin/components/` y `response_components/` | Layout interno, rasterización, zonas de respuesta, tamaños visibles y controles DOM. |
| [ResponseTimingManager.ts](../server/dynamicplugin/utils/ResponseTimingManager.ts) | Separar coordenadas para impacto y datos públicos. |
| [publish.js](../server/routes/experiments/publish.js), paquete y bundle DynamicPlugin | Coherencia entre entrega local y pública. |
| Pruebas de diseñador, geometría compartida, componentes y runtime | Contrato proporcional y regresiones de estado/interacción. |
| [04-PLUGINS.md](04-PLUGINS.md), [07-DYNAMIC_PLUGIN.md](07-DYNAMIC_PLUGIN.md), documentación de ejecución y runtime | Sustituir descripciones del escalado anterior y de selectores de layouts inexistentes. |

No se requiere otra excepción de limpieza en el cliente, una alteración de rutas de guardado para la resolución ni un nuevo migrador.

## 12. Conflictos y tratamiento

| Conflicto o dependencia | Tratamiento definido |
|---|---|
| Posiciones verticales y longitudes reaccionan a ejes diferentes | Calcular ambas en la base común y aplicar una única escala. |
| El preset del editor participa en el modelo y la serialización | Reservarlo al marco visible; usar siempre la base común para el modelo. |
| Konva y su copia HTML tienen capas y mediciones propias | Compartir escala, origen y dimensiones internas entre ambas. |
| Canvas, DOM y botones con tamaño automático pueden escalar de forma diferente | Resolver sus cajas y fuentes antes de transformar la escena completa. |
| Coordenadas internas confundidas con resultados del participante | Conversión explícita; mantener los resultados en sus espacios CSS actuales. |
| Una base grande podría multiplicar la memoria gráfica | Buffers y texturas dependientes del tamaño mostrado y DPR desde su creación. |
| Superficies persistentes o puentes visuales podrían recibir dos escalas | Aplicar el ajuste a la escena persistente; conservar la captura física del puente sin volver a transformarla. |
| Pruebas que exigen repartir posiciones por todo el alto del host | Sustituir esas expectativas por invariantes de proporción, manteniendo cobertura de respuestas y estado. |
| Publicación con bundle anterior | Versión nueva coherente y verificación separada de disponibilidad real en CDN. |
| Contenido arbitrario que consulta el viewport | Límite explícito de la sección 7; no convertir su código automáticamente. |

No se identificó un bloqueo de diseño para la composición estándar acordada. El espacio libre en pantallas con otra proporción es una consecuencia definida del ajuste. La entrega pública depende de distribuir el plugin actualizado; el código personalizado con reglas propias de viewport tiene el límite descrito.

## 13. Plan TDD y aceptación

Primero se añaden pruebas que fallen con las reglas actuales y demuestren el cambio de comportamiento. Después se implementa cada integración y se actualizan las expectativas antiguas correspondientes. No se sustituyen los fallos por umbrales más amplios ni se eliminan pruebas de estado para hacer pasar el escalado.

| Grupo | Casos y resultado exigido |
|---|---|
| Ajuste compartido | Los cuatro ejemplos numéricos de la sección 4, host inválido, inversa de puntos y crecimiento por encima de la base. |
| Composición | Una bienvenida con texto, imagen y botón conserva las razones entre separaciones, tamaños y fuentes en desktop, móvil vertical y horizontal. Los saltos de línea estándar permanecen iguales al cambiar solo la pantalla. |
| Editor | Cambiar presets conserva modelo, configuración serializada, historial y contador de autosave. Arrastrar o redimensionar, guardar, reabrir y deshacer conserva la geometría esperada. |
| Konva y HTML | Apariencia y zonas de selección coinciden tras centrar y escalar; edición de texto, grilla y snapping siguen el elemento visible. |
| Host real | Respetar `experiment_width`, offsets, barra de progreso, host inicialmente oculto, fullscreen, iframe y rotación del dispositivo. |
| Respuestas | Clic y toque en botones escalados; bandas libres; captura total explícita; rutas con y sin response timing; coordenadas y tamaños exportados en CSS real. |
| Estado | Conservar nodo y contenido de inputs, caret, slider, Survey, archivos, vídeo y dibujo durante resize y cambios de DPR. |
| Presentación | Conservar un solo onset/offset programado, continuidad de imágenes persistentes, alineación de puentes y ausencia de reinicios del ensayo. |
| Gráficos | Buffers y texturas generadas usan la escala de rasterización desde su creación; comprobar DPR 1, 2 y 3, nitidez y liberación de recursos sustituidos. |
| Datos y codegen | CSV, loops, overrides y guardado funcionan sin transportar la base interna. No se agregan campos de resolución a ensayos o componentes. |
| Entrega | El mismo ensayo compilado cumple el contrato en ejecución local, preview y artefacto de publicación con el bundle nuevo. |

Las invariantes geométricas se comprueban con medidas independientes de los helpers de producción: por ejemplo, distancia entre dos centros dividida por el ancho de la imagen. No basta con comparar la salida de dos funciones que comparten el mismo error. Las tolerancias cubren únicamente redondeo de píxeles y rasterización.

Se amplían las pruebas vigentes de `designerRelativeEditing`, `trialDesignerViewport`, `trialDesignerConfig`, `viewportGridGeometry`, `viewportGridInteraction`, `codegenGenerators/relativeViewportExports` y `experimentPreview/viewportResize`, junto con las nuevas pruebas focalizadas de transformación.

En navegador se adapta `responsive-viewport-runtime.spec.ts` y sus helpers de host, estado, ciclo de vida y temporización. Se mantienen sus comprobaciones útiles de identidad de nodos, datos persistidos y fallos de runtime. Los escenarios de integración se crean mediante `ScenarioAuthor`, se compilan con el generador real y se ejecutan contra una base temporal.

Estas pruebas comprueban un comportamiento permanente de escalado. No se retiran al terminar la transición de testers; las pruebas exclusivas de migraciones temporales mantienen su ciclo de retirada separado.

## 14. Secuencia de implementación y verificación

1. Añadir la fase roja de las invariantes de ajuste y de la bienvenida proporcional.
2. Implementar la geometría compartida y su contrato de coordenadas.
3. Adaptar juntos host, escena, stage y densidad inicial de texturas, evitando una reserva intermedia de la base por DPR.
4. Integrar componentes, clics, resultados y superficies persistentes.
5. Adaptar el modelo del editor, serialización, capas, herramientas e iframe.
6. Completar las pruebas de estado, datos, DPR y rutas de ejecución; actualizar únicamente expectativas del comportamiento sustituido.
7. Compilar plugin y cliente, ejecutar tipos, lint de archivos editados, límite de líneas y `git diff --check`; revisar documentación y datos exportados.
8. Preparar el versionado y verificar el artefacto público. La distribución del paquete y su disponibilidad real se registran como paso de entrega independiente de las pruebas locales.

La validación focalizada incluye Vitest del diseñador y codegen, pruebas de runtime de composición/interacción y las suites de rutas afectadas por la publicación. El runner de navegador debe compilar las fuentes actuales del plugin. Si una comprobación de cobertura está bloqueada por documentación ausente, se informa por separado y se ejecutan directamente los escenarios seleccionados.

## 15. Resultado de implementación y verificación

Implementación completada el 2026-11-04 sobre la base indicada. `scene.ts` define la base y las transformaciones compartidas. El diseñador mantiene el modelo interno al cambiar de preset; el runtime mide el host y transforma una única escena. Los buffers y las texturas utilizan `rasterScale` desde su creación, mientras que las métricas conservan el DPR real. Los resultados de posición y tamaño siguen usando píxeles CSS visibles del host.

La implementación no añade una migración ni escribe dimensiones en las configuraciones guardadas. No se modificaron la base local del tester ni sus ZIP como parte de este trabajo.

### TDD y comprobaciones ejecutadas

La fase roja reprodujo cuatro fallos del modelo/serialización/contexto y el fallo de proporción de la bienvenida en móvil. Tras implementar el cambio:

| Comprobación | Resultado |
|---|---|
| Vitest: geometría, diseñador, guardado, grilla, copia HTML, codegen y resize de preview | 168 pruebas aprobadas, incluidas 13 nuevas de geometría/modelo. |
| Jest: rutas de experimentos, apariencia, configuración e importación | 109 pruebas aprobadas en 7 suites. |
| Navegador: composición proporcional, respuestas, publicación, estado, host, persistencia y fondos | 19 escenarios aprobados en la tanda final. |
| Navegador: loop ordenado con 3 y 480 filas | 2 escenarios aprobados. |
| Navegador: Konva real, copia HTML, presets, arrastre, guardado y reapertura | 1 escenario aprobado tres veces consecutivas. La prueba espera el redibujado del canvas de selección antes de hacer clic. |
| Compilación | Bundle del plugin y build de producción del cliente aprobados; el build del cliente incluye TypeScript. |
| ESLint en 34 archivos TypeScript editados/nuevos | Sin diagnósticos nuevos frente a HEAD; persisten 194 diagnósticos previos. JavaScript de publicación y runners editados: sin errores de lint. |
| Límite de líneas y espacios | `check:max-lines` y `git diff --check` aprobados. |
| Verificador de escenarios, corregido después de la validación inicial | 30 identificadores verificados en 13 archivos, sin dependencia de documentos. 14 pruebas de regresión aprobadas y los 5 escenarios de escalado aprobados usando `npm run test:runtime`. |

Las suites de navegador se ejecutaron secuencialmente en Chrome, con base temporal. Durante la validación inicial, `check:runtime-coverage` fallaba porque dependía de documentos retirados de branching; se ejecutaron directamente los escenarios indicados. Posteriormente se corrigió el verificador: ahora valida los identificadores contra declaraciones de pruebas en el código, sin leer documentos de especificación ni listas de decisiones. La comprobación del registro queda separada de los resultados de ejecución y de la cobertura de código.

### Entrega pública

La versión 1.1.0 es coherente entre paquete, lockfiles, plugin y respaldo de publicación. La consulta de npm realizada el 2026-11-04 devolvió 1.0.8 como última versión publicada; 1.1.0 estaba disponible para una nueva entrega.

Se generó `/private/tmp/proportional-release/jspsych-expbuilder-plugin-dynamic-1.1.0.tgz`, con ambos bundles y metadatos. SHA-1 de npm pack: `5b3802c9dfcdd519bc430a17e389cafdafc76e28`.

La prueba pública llama a la ruta real de publicación y ejecuta su HTML sin cambiarlo, sustituyendo el publicador externo y sirviendo el bundle local al interceptar su URL CDN versionada. Verifica el artefacto generado; no acredita disponibilidad en la CDN. Antes de usar nuevas publicaciones públicas es necesario publicar ese paquete en npm. Este trabajo no realizó esa publicación ni regeneró HTML históricos.
