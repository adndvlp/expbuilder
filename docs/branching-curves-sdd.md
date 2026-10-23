# SDD: cadenas alineadas y conexiones curvas en el canvas

Fecha: 2026-10-22.
Estado: implementado y verificado en la app.
Referencia: [maqueta React Flow, diez escenarios](demos/branching-symmetry.html).
Base existente: [primera implementación de simetría](branching-symmetry-sdd.md).

## 1. Resultado esperado

Las cadenas de nodos permanecen alineadas verticalmente. Las conexiones que omiten nodos intermedios se abren en curvas amplias por fuera de la cadena y regresan al destino, conforme a la maqueta aprobada. Las bifurcaciones con recorridos independientes siguen distribuyéndose a los lados.

Caso que motivó el cambio:

```text
Loop 1
   ↓
Final ensayo
   ↓
Loop 2
   ↓
Final experimento
```

Añadir una conexión directa de Loop 1 a Loop 2 conserva ese eje. La conexión rosa rodea Final ensayo. Los nodos no se desplazan para dejar sitio a esa línea.

Con Loop 1 abierto, su trial Ensayo ocupa el eje de la cadena; el marcador azul del loop permanece al costado. Final ensayo, Loop 2 y Final experimento conservan ese mismo eje.

La maqueta usa coordenadas manuales. Aprueba el aspecto y las relaciones geométricas; sus coordenadas y carriles no se copian como casos especiales a la aplicación.

## 2. Alcance

Se ajustan la colocación horizontal de los nodos, las curvas de navegación y los límites usados para encuadrar el canvas. Se reutilizan React Flow, la proyección canónica de conexiones, las entradas explícitas, la jerarquía de loops, los IDs semánticos, los colores, los nodos y sus controles.

El contrato del experimento y su ejecución no cambian: branching, condiciones, parámetros, repeticiones, fin de ruta, fin de experimento, resume, codegen y Dynamic Plugin conservan su comportamiento. No se añaden campos persistidos, migraciones, dependencias ni versiones nuevas de paquetes. Las distinciones descritas a continuación pertenecen exclusivamente al dibujo.

## 3. Diagnóstico y conflictos de integración

Diagnóstico de la implementación anterior, realizado antes del cambio:

| Área | Situación actual | Integración necesaria |
|---|---|---|
| `directedLayout.ts`, `placeDirectedBlocks` | Calcula el reparto horizontal con todos los hijos de avance y promedia preferencias entre padres. Una conexión directa que omite nodos puede abrir otra rama y desplazar la cadena. | Distinguir las relaciones que definen la distribución de las conexiones que solo necesitan un desvío. |
| `layoutScopeGraph.ts` | Proyecta conexiones sobre bloques de ámbitos e incorpora destinos externos y offsets de salida. | Mantener el eje de la cadena también al entrar y salir de loops. Una conexión lateral no debe aportar un offset que tuerza ese eje. |
| `navigationRouting.ts` | Calcula recorridos con waypoints evitando cajas. | Reutilizar las cajas y la búsqueda de espacio libre para calcular curvas. |
| `NavigationRoutingEdge.tsx` | Convierte waypoints en un path con esquinas redondeadas mediante `getRoundedPath`. | Dibujar los segmentos Bézier aprobados. Aumentar el radio de esquina no produce este diseño. |
| `canvasLayoutBounds.ts` y firma del layout | Incluyen waypoints y límites de circuitos. | Incluir controles de curvas y detectar sus cambios aunque los nodos no se muevan. |
| Pruebas geométricas | Algunas comprueban segmentos horizontales y verticales de los waypoints. | Comprobar la curva que se dibuja; conservar las garantías de identidad y ausencia de colisiones. |

**No hay conflicto con el contrato de branching ni con la ejecución de jsPsych. Sí hay reglas geométricas actuales que deben sustituirse.** No es un merge automático del HTML: cambiar solo el componente de edges dejaría pendiente el problema de alineación mostrado en las capturas.

No se está realizando un merge entre ramas Git; no se puede afirmar por adelantado que una operación futura carezca de conflictos textuales. La compatibilidad indicada aquí corresponde al diseño y al código actual revisado.

## 4. Reglas para colocar nodos

### 4.1 Cadena frente a bifurcación

Sobre el grafo de avance que ya obtiene el layout después de identificar retornos:

- Si existe A → B → C y también A → C, la conexión directa A → C se dibuja, pero no abre otra columna. A, B y C forman una cadena alineada.
- Si existen A → B y A → C con recorridos independientes, se conserva la bifurcación. Un destino compartido vuelve a reunir las rutas.
- Añadir o quitar una conexión que omite pasos de una cadena no cambia las posiciones de sus nodos. Añadir una ruta independiente sí puede cambiar la distribución.
- Los retornos y las autorreferencias reciben curvas exteriores sin imponer que su destino se coloque debajo del origen.

Para reconocer el primer caso, utilizar las conexiones cuya eliminación deja otro camino de avance entre sus mismos extremos: reducción transitiva del grafo acíclico, aplicada únicamente a la distribución horizontal. No se elimina ninguna conexión real, condición, ID semántico ni punta de flecha. Los niveles verticales siguen respetando el conjunto completo de avances.

La reducción se calcula sobre pares de extremos visibles, agrupando las conexiones paralelas para el cálculo geométrico. Dos condiciones con el mismo destino no constituyen por sí solas un camino alternativo. La salida conserva su identidad y proyección semántica originales.

Reutilizar la ordenación y las adyacencias existentes, con resultados de alcanzabilidad compartidos; no enumerar todos los recorridos posibles. Conservar el orden de ramas declarado y los desempates estables. El orden de almacenamiento de registros, la selección y el tema no determinan posiciones.

La recogida de nodos y conexiones no calcula primero posiciones de árbol para después descartarlas. El layout de grafo es el único responsable de colocar los bloques. Una salida a otro ámbito tampoco puede cambiar de posición en el orden declarado para centrarla como caso especial.

El orden acompaña a las conexiones semánticas originales al proyectarlas sobre contenedores. No se reconstruye exclusivamente mediante el ID del destino visible, porque al cerrar un loop ese ID representa al contenedor y deja de ser el ID del trial de destino.

### 4.2 Loops y ámbitos

Aplicar la misma regla al grafo proyectado de cada ámbito. La entrada y la continuación de un bloque que pertenecen a una cadena comparten el eje de esa cadena, aunque la caja del loop sea más ancha por su marcador o por contenido lateral.

Los destinos externos que usa `layoutScopeGraph` para calcular la geometría no pueden reintroducir como bifurcaciones las conexiones directas ya reconocidas como desvíos. Propagar el anclaje de entrada y continuación del bloque sin promediarlo con esos carriles exteriores.

Al cerrar un loop, su nodo visible ocupa el eje que representaba su contenido. Al abrirlo, el marcador pasa al costado y el contenido recupera el eje. Se mantienen la proyección de endpoints, sus IDs semánticos, los callbacks y los estados de carga y error actuales.

El espacio de nodos, controles y contenido de loops sí participa en evitar solapamientos. El espacio de una curva lateral amplía el área dibujada y el encuadre; no desplaza un nodo intermedio para acomodar esa curva.

## 5. Trazado aprobado

### 5.1 Curvas de navegación

Las conexiones adyacentes libres conservan su trazado directo o Bézier. Las conexiones largas y los retornos se abren hacia un carril lateral con curvas continuas, sin los tramos rectangulares de la versión anterior.

El caso simple usa dos segmentos Bézier cúbicos unidos en el punto exterior. Comparten tangente en la unión. La salida y la llegada respetan la dirección de los conectores: la flecha termina en el conector superior del destino, incluso cuando el recorrido vuelve a un nodo anterior.

La amplitud se calcula con las posiciones finales y el espacio libre. Varias conexiones pueden ocupar carriles a izquierda y derecha, separados de los nodos y controles. La selección del lado y el orden de carriles son deterministas; no dependen del orden de procesamiento de los registros.

Los retornos cortos y las autorreferencias se trazan antes que los desvíos largos. Se prueban amplitudes compactas antes de ampliar el arco. La anchura del carril no impone un crecimiento vertical del retorno. Los carriles solo cuentan como ocupados en el intervalo vertical que comparten; un retorno lejano no agranda otro recorrido. Las curvas pueden compartir un lado y cruzarse, como en el HTML aprobado. Ninguna curva se convierte en un obstáculo para otras conexiones; no se exige colocar un desvío en el lado opuesto a una autorreferencia.

Conservar los colores y tamaños de flecha ya aprobados. No introducir otro tipo de branching ni una opción de usuario para elegir entre el trazado viejo y el nuevo.

### 5.2 Evitar colisiones

Validar el recorrido curvo contra las cajas de nodos y controles, con un margen visual. Los puntos de control no son una polilínea: comprobar sus segmentos rectos no demuestra que la curva sea segura.

Utilizar subdivisión acotada de los segmentos Bézier y sus envolventes para comprobar intersecciones, con tolerancia explícita en unidades del canvas. Si el arco invade una caja, ajustar su amplitud y ampliar el carril exterior dentro de una búsqueda acotada. Mantener la familia de dos Bézier enlazadas que usa la maqueta; una colisión no activa un recorrido ortogonal con esquinas redondeadas.

No resolver una colisión omitiendo una conexión ni moviendo los nodos de la cadena. No incorporar un segundo motor de layout o una búsqueda sin límite de iteraciones. Los cruces entre edges pueden ser inevitables y no implican una nueva conexión entre ellos.

Los límites punteados de un loop no son muros: una conexión entre ámbitos puede cruzarlos. Debe seguir siendo clara la pertenencia de los nodos y evitarse la superposición prolongada de una curva con el circuito.

El trazador de navegación no usa los metadatos de pertenencia a un loop para ampliar solo uno de sus carriles. Con las mismas posiciones y obstáculos, cambiar esos metadatos no modifica la curva.

### 5.3 Circuitos de loops

Conservar los circuitos azules punteados y su contorno actual. La aprobación de curvas de navegación no transforma el perímetro del loop en un arco.

El circuito sigue unido a los conectores amarillos centrados del marcador: sale por abajo, baja a la izquierda, cruza la parte inferior, sube por la derecha y llega por arriba. Se conserva el sentido de los puntos y la flecha aprobado anteriormente.

## 6. Geometría compartida y encuadre

El cálculo de la curva produce segmentos y límites derivados de la vista. El renderer y el encuadre consumen esa misma geometría; no mantienen fórmulas distintas para representar una conexión.

Extender los datos internos de los edges en `expandedLayoutTypes.ts` con la información mínima necesaria para las curvas. Sustituir el consumo de waypoints como path ortogonal de navegación y actualizar sus consumidores; no conservar dos implementaciones seleccionables. Los helpers de esquinas que siguen usando los circuitos de loops permanecen.

`canvasLayoutBounds.ts` incluye las curvas, las flechas, los circuitos y los controles que sobresalen. Es válido usar la envolvente de los controles Bézier como cota conservadora. `getCanvasLayoutSignature.ts` incorpora los datos geométricos nuevos, y `CanvasViewportFitter` conserva sus gestos y política actual de zoom.

Al dibujar, el path se vincula a los extremos reales de los handles que entrega React Flow. Estos están en el borde exterior del conector amarillo, mientras que el cálculo inicial parte del borde del nodo. Se conserva la tangente vertical y un margen de 16 unidades en los límites de las curvas para incluir ese ajuste y las flechas. No se cambia el estilo ni el tamaño de los conectores.

El control adyacente se traslada junto con su extremo para conservar el vector tangente planificado; el renderer no impone otra amplitud mínima. `CanvasViewportFitter` es el único responsable del encuadre automático, incluidos los límites de curvas y circuitos.

## 7. Casos de aceptación

Los diez escenarios del HTML son referencias de relaciones geométricas, no de coordenadas absolutas:

| Caso | Comprobación principal |
|---|---|
| 1. Destino compartido | B y C comparten un único D, centrado cuando las restricciones lo permiten. |
| 2. Conexión entre ramas | Se respetan los predecesores de E y F; la conexión D → F rodea E con una curva. |
| 3. Regreso al inicio | A conserva la entrada; D → A forma un retorno exterior con su flecha correcta. |
| 4. Salidas entre loops | Las salidas a padre, abuelo y principal conservan destinos y ámbitos. |
| 5. Captura con loops cerrados | Loop 1, Final ensayo, Loop 2 y Final experimento comparten eje. La rosa rodea Final ensayo. |
| 6. Captura con Loop 1 abierto | Ensayo y la continuación comparten eje; el marcador permanece lateral. |
| 7. Varias conexiones que omiten nodos | A → B → C → D → E permanece alineada al activar y retirar los arcos de ambos lados. |
| 8. Avances y regresos | Las curvas de retorno y avance conservan dirección y no desplazan la cadena. |
| 9. Loops anidados | Entrada, Ensayo, Cierre y Final conservan el eje al proyectar conexiones y abrir o cerrar contenedores. |
| 10. Bifurcación y conexión larga | Las rutas independientes se abren a los lados; el arco Inicio → Final no altera esa distribución. |

Añadir autorreferencias, conexiones paralelas, componentes desconectados, varios destinos compartidos, loops hermanos y una jerarquía generada más profunda. No introducir condiciones especiales para nombres, IDs o un número fijo de niveles.

## 8. TDD e implementación prevista

1. Añadir primero regresiones sobre `buildUnifiedFlowLayout` con las cadenas y conexiones de los casos 5–10. Comprobar igualdad del eje, estabilidad al añadir desvíos y conservación de todos los IDs semánticos. Deben fallar con el reparto horizontal actual.
2. Ajustar `directedLayout.ts` y `layoutScopeGraph.ts` para separar la distribución de cadenas de los desvíos. Mantener los tests existentes de bifurcaciones, destinos compartidos, entradas explícitas y jerarquía.
3. Añadir pruebas de las curvas: endpoints, tangentes, unión, autorreferencias, límites y ausencia de intersecciones con cajas. Sustituir las aserciones que asumen exclusivamente segmentos horizontales o verticales.
4. Integrar el trazado en `navigationRouting.ts` y `NavigationRoutingEdge.tsx`, junto con los tipos, la firma y el encuadre. Reutilizar módulos y helpers existentes; extraer solo la geometría que deba compartir el renderer con los demás consumidores.
5. Extender los E2E existentes con las dos capturas convertidas en fixtures. Medir nodos y paths en el mismo fotograma, comprobar la curva SVG real y revisar visualmente los diez ejemplos en la app, con ambos temas y apertura/cierre de loops.
6. Ejecutar los checks de canvas afectados, tipos y límites de archivos. Al terminar la implementación, ejecutar `npm run tests` desde la raíz e informar qué etapas completó el runner. Los resultados de la implementación anterior no validan este cambio pendiente.

Los fixtures no modifican `server/database/db.json` ni los experimentos del usuario. La revisión de este documento no requiere ejecutar la suite de la app.

## 9. Estado y criterio de cierre

La maqueta aprobada ya contiene las curvas en los diez escenarios. Se comprobó en Chrome que no atraviesan las cajas de los nodos y que los seis escenarios nuevos conservan las posiciones al activar o retirar sus conexiones adicionales. También se revisaron cambios de apertura de loops en los casos 5 y 9.

Esas comprobaciones corresponden al HTML con coordenadas manuales. La implementación automática se ha integrado en la app y sus resultados se registran a continuación.

## 10. Implementación y validación

- `layoutGraphReduction.ts` reconoce las conexiones transitivas para el reparto horizontal; `directedLayout.ts` conserva todos los avances para calcular niveles. La proyección distingue un par de bloques que contiene simultáneamente una continuación esencial y una conexión directa que omite pasos.
- `layoutScopeGraph.ts` propaga esa información entre ámbitos, conserva los anclajes de las cadenas y evita que una conexión exterior vuelva a abrir una columna.
- `navigationCurve.ts` comparte la geometría Bézier, su validación por subdivisión, la conversión a SVG y el enlace con los conectores medidos. `findNavigationCurve` calcula las curvas para todas las conexiones a partir de los extremos, obstáculos y carriles disponibles. `navigationRouting.ts` proporciona esa geometría y las reservas de espacio de la vista.
- `NavigationRoutingEdge.tsx` dibuja las curvas; el encuadre y la firma consumen sus controles. Los datos de navegación ya no usan waypoints como contrato de dibujo. Los circuitos mantienen su trazado y sentido.
- Se corrigió una duplicación de edges al coincidir una continuación declarada de loop con una conexión canónica: el compositor ahora reutiliza el conjunto de claves que resulta de la proyección canónica. La corrección evita que React conserve paths de estados anteriores al expandir un loop.
- La interfaz conserva la expansión por una sola ruta: abrir un loop hermano en la raíz cierra el anterior. Las pruebas de la interfaz respetan ese comportamiento; no se añadió expansión simultánea de hermanos.

Se añadieron primero las regresiones de alineación y curvas. También se añadieron regresiones para los edges duplicados, la continuación anidada y los endpoints reales de los conectores antes de corregir esos fallos.

Validación focalizada completada: 241 pruebas relacionadas con canvas y branching, y 20 E2E de los escenarios aprobados en ambos temas. Los E2E comprueban alineación, cantidad de nodos y conexiones, curvas SVG reales, endpoints de los handles, flechas, ausencia de cruces por cajas y encuadre. Se inspeccionaron capturas de la app, incluidos el caso original abierto/cerrado y los loops anidados.

Las interacciones de cierre y reapertura esperan a que termine el encuadre animado antes de pulsar el siguiente control. Se conservan las comprobaciones de visibilidad, alineación y colisiones. La prueba afectada pasó también ocho repeticiones con cuatro workers.

Pasaron la comprobación de tipos, el lint de los módulos modificados, el límite de 300 líneas y `git diff --check`.

La ejecución de `npm run tests` previa a las correcciones de las capturas siguientes terminó con **código 0**, completando sus ocho etapas:

| Etapa | Resultado |
|---|---|
| Límite de líneas del cliente | Aprobado. |
| Build del bundle de jsPsych | Aprobado. |
| Servidor | 627 pruebas aprobadas. |
| Cliente | 1.703 pruebas aprobadas en 417 archivos. |
| Functions | 528 pruebas aprobadas. |
| E2E del editor | 160 pruebas aprobadas. |
| E2E del runtime generado | 77 pruebas aprobadas. |
| E2E públicos/cloud | 4 pruebas de proveedores y 1 recorrido de navegador aprobados. |

Total: **3.100 pruebas aprobadas**. Las cinco pruebas cloud aparecen omitidas en la etapa ordinaria del servidor porque requieren `RUN_CLOUD_E2E`; se ejecutaron y aprobaron en la última etapa del runner. No quedaron fuera del recorrido completo.

### Corrección posterior a las capturas de las 20:00 y 20:01

La validación anterior no cubría retornos cortos junto a una bifurcación ni una autorreferencia junto a una conexión que omite esa bifurcación. En el primer caso, la amplitud mínima de 100 unidades hacía que los arcos chocaran con otras filas y activaran el corredor de esquinas pequeñas. En el segundo, la amplitud también crecía con la distancia al carril, produciendo el óvalo excesivo.

Se añadieron primero regresiones que reprodujeron ambos fallos. Se cubre además una autorreferencia sobre una cadena vertical con un desvío que la omite. Los casos se comprueban también en el navegador, en ambos temas, con curvas reales, flechas, conectores, encuadre y capturas de la app.

### Unificación posterior a la captura de las 20:29

Añadir un trial antes de la bifurcación mostró que conservar la alternativa rectangular seguía contradiciendo el aspecto aprobado. Se reprodujo primero el fallo: la conexión larga generaba doce segmentos en lugar de las dos Bézier de la maqueta.

Se eliminan `navigationCorridor.ts`, la conversión de corredores a esquinas y su selección como alternativa. Todas las conexiones usan `findNavigationCurve`: conserva el Bézier directo cuando procede; para un desvío, retorno o autorreferencia ajusta las amplitudes y la anchura de las dos cúbicas enlazadas. La búsqueda está limitada a doce ampliaciones y valida cada candidato contra la misma geometría de obstáculos. No consulta nombres de trials ni números fijos de niveles del experimento. Los circuitos azules punteados mantienen su contorno propio.

Además de la captura, las regresiones generan grafos con 0, 1, 2, 4, 8 y 16 trials previos, bifurcación, autorreferencia, desvíos y retorno al inicio; comprueban las curvas y la ausencia de cruces por nodos.

### Retirada de la restricción entre conexiones

Se retiró la reserva del espacio de una autorreferencia como obstáculo para otras curvas, junto con el cálculo de esa envolvente y las pruebas que exigían evitarla. Esa restricción no formaba parte del HTML aprobado. El cálculo conserva ambos lados como candidatos y permite los cruces entre edges; los obstáculos que valida son las cajas de los nodos.

Validación al retirar la restricción: 66 pruebas geométricas y 28 E2E de canvas aprobados, con revisión visual de las capturas. Tipos, lint y límites de archivos aprobados. La ejecución completa durante estas correcciones pasó servidor, cliente, Functions, editor, runtime y los cuatro proveedores cloud; el recorrido público de navegador agotó su espera por `mega-conditional-source`. Esa ejecución completa no se considera aprobada.

La repetición aislada del E2E público terminó con `Failed to fetch` durante la creación de trials en `createResolvedMegaExperiment`, antes de publicar. No se modificó ese test ni la lógica de authoring para ocultar el fallo.

### Auditoría de reglas y cálculos superpuestos

Se documentan los hallazgos, las correcciones estructurales y su validación en [branching-layout-audit.md](branching-layout-audit.md). Este registro distingue las comprobaciones actuales de los resultados históricos anteriores.

La ejecución final tras la auditoría completó las ocho etapas de `npm run tests` con código 0: 3.128 pruebas aprobadas, incluido el recorrido público de navegador. El informe contiene el desglose y las correcciones de las mediciones asíncronas de las pruebas.
