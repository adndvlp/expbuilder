# Auditoría del layout de branching

Fecha: 22 de octubre de 2026.

## Alcance

Revisión de los cambios de distribución y curvas del canvas, incluidos los archivos nuevos sin seguimiento de Git, sus consumidores y sus pruebas. Referencias: `docs/demos/branching-symmetry.html`, `docs/branching-symmetry-sdd.md` y `docs/branching-curves-sdd.md`.

Esta revisión no es una auditoría de todas las funcionalidades históricas del proyecto. No cambia contratos de branching, ejecución de jsPsych, codegen, datos del usuario ni estilos de nodos.

## Hallazgos corregidos

| Hallazgo | Problema de raíz | Corrección |
|---|---|---|
| El retorno consultaba el perímetro de su loop para ampliar solamente el carril derecho. | Mezclaba la pertenencia al loop con la selección geométrica del lado. Un nodo lejano del ámbito podía cambiar un retorno local sin mover sus extremos. | `routeNavigationEdges` recibe exclusivamente los nodos y edges finales. No consulta ámbitos ni circuitos. Los dos lados se evalúan con las mismas cajas de obstáculos. |
| El recorrido inicial calculaba posiciones de árbol que el layout de grafo descartaba. | Convivían dos cálculos de distribución; el primero añadía trabajo y reglas sin determinar el resultado final. | Los colectores de ámbitos materializan nodos y conexiones con posiciones provisionales cero. Solo `layoutScopeGraph` y su algoritmo de bloques asignan las posiciones finales. Se conservan la proyección y las conexiones existentes. |
| React Flow y `CanvasViewportFitter` solicitaban el encuadre inicial. | Dos responsables podían ajustar el mismo viewport con límites diferentes: nodos frente a nodos más curvas y circuitos. | Un único responsable, `CanvasViewportFitter`, consume los límites completos. La prueba de navegación reutiliza la espera compartida por la animación real, en lugar de mantener otro cálculo de espera. |
| Al unir la curva con los handles medidos, el renderer imponía un mínimo de ocho unidades a sus tangentes. | El renderer reinterpretaba la geometría planificada mediante un ajuste local arbitrario. | Traslada cada control extremo junto con su extremo. Conserva el vector tangente y no modifica la curva original. |
| Una bifurcación impar con una única salida exterior recolocaba esa salida en el centro. | Una excepción por tipo de destino prevalecía sobre el orden de ramas declarado. | Se elimina la excepción y el indicador `external` de los bloques del algoritmo de colocación. Las salidas se distribuyen mediante el mismo orden que los demás destinos. |
| El orden se intentaba reconstruir usando el ID del nodo visible. | Al proyectar un destino a un loop cerrado, el ID visible ya no era el ID del trial declarado en las ramas. El algoritmo perdía su prioridad y terminaba ordenando por IDs. | El compositor obtiene las prioridades de los trials originales y las conserva mediante los IDs semánticos de las conexiones. La clasificación global y la colocación por ámbito consumen ese mismo orden, también al abrir y cerrar contenedores. |

Antes de esta auditoría también se habían retirado dos correcciones equivocadas de esta misma implementación: la alternativa rectangular para curvas de navegación y la reserva de una autorreferencia como obstáculo para otras conexiones. No forman parte de la solución actual. Los circuitos azules punteados conservan su contorno propio, tal como se aprobó.

## Estructura que se conserva

1. Recoger nodos y conexiones y proyectar los endpoints de contenedores abiertos o cerrados.
2. Ordenar el grafo de avance, conservando retornos en el dibujo. Aplicar reducción transitiva solo a las relaciones que determinan la distribución horizontal; conservar todas las conexiones reales.
3. Colocar los bloques de cada ámbito una sola vez, con entradas, continuaciones, orden declarado y separación de cajas.
4. Calcular las curvas a partir de esas posiciones. Validarlas contra cajas de nodos y controles mediante subdivisión de Bézier. Los edges pueden cruzarse y compartir un lado.
5. Dibujar y encuadrar consumiendo la geometría calculada.

La reducción transitiva, los anclajes de bloques y la comprobación de colisiones resuelven restricciones generales del grafo. Se mantienen. Los tamaños, márgenes y límites de búsqueda siguen siendo parámetros geométricos explícitos; no hay condiciones por nombre de experimento, nombre de trial ni cantidad fija de niveles.

El HTML tiene coordenadas y algunos carriles manuales. Sirve como referencia de forma y relaciones visuales; no es por sí mismo un algoritmo automático de colocación. La aplicación usa la misma familia de dos curvas cúbicas enlazadas para los arcos laterales, calculando el espacio libre sobre las posiciones finales.

## Evidencia y validación

Se reprodujeron antes de corregirlos cuatro fallos mediante pruebas rojas: cambio del retorno por metadatos del ámbito, alteración de tangentes al vincular handles, reordenación de una salida exterior y pérdida del orden al proyectar destinos a loops cerrados. Las regresiones están en `client/src/__tests__/components/canvasExpandedLayout/layoutAudit.test.ts`. La última incluye las cuatro combinaciones de visibilidad de dos contenedores y cambia el orden de almacenamiento de las conexiones.

La primera ejecución completa detectó además una prueba anterior que exigía centrar la salida exterior. Se sustituyó esa expectativa por el orden declarado de los tres destinos, conservando las comprobaciones de continuación y conexiones. Esa ejecución se detuvo en la etapa del cliente con una prueba fallida y una excepción asíncrona de `TrialsConfiguration` originada en `saveIndicators.test.tsx`; no ejecutó las etapas posteriores. No se ocultó ni se modificó ese error de carga ajeno al layout.

La siguiente ejecución aprobó las etapas de servidor, cliente y Functions, y detectó una medición inconsistente en el navegador: `unified-canvas.spec.ts` leía los tres nodos de una bifurcación en llamadas separadas durante la animación del encuadre. El desvío medido fue de 0,836 píxeles. Se centraliza la lectura de los nodos en una sola evaluación del DOM, compartida por las comprobaciones de alineación y bifurcaciones. La prueba conserva su tolerancia original de 0,05 píxeles; no se amplía la tolerancia ni se añade una espera fija.

La corrección de esa medición pasó ocho repeticiones con cuatro workers. El fallo inicial ocurrió durante la animación, antes de estabilizar el encuadre; la aplicación conserva su animación y sus gestos.

Las eliminaciones del cálculo descartado y del encuadre duplicado se verifican mediante las pruebas existentes de topología, colocación, expansión, controles y navegación. No se sustituuyen las aserciones de comportamiento por comprobaciones del código fuente.

Validación focalizada de esta auditoría: 148 pruebas aprobadas en 30 archivos, incluidos los tests de branching de loops. Los 29 E2E de curvas, conectores, flechas, expansión y cierre de loops, ambos temas y controles de zoom pasaron también dentro del recorrido completo final. Se revisaron las capturas nuevas de la bifurcación con dos desvíos y autorreferencia, la cadena con loop abierto y la cadena con loops anidados. Tipos, lint, límite de 300 líneas y `git diff --check` aprobados.

La ejecución final de `npm run tests` terminó con **código 0**, completando sus ocho etapas con el estado final de esta auditoría:

| Etapa | Resultado |
|---|---|
| Límite de líneas del cliente | Aprobado. |
| Build del bundle de jsPsych | Aprobado. |
| Servidor | 627 pruebas aprobadas. |
| Cliente | 1.723 pruebas aprobadas en 419 archivos. |
| Functions | 528 pruebas aprobadas. |
| E2E del editor | 168 pruebas aprobadas. |
| E2E del runtime generado | 77 pruebas aprobadas. |
| E2E públicos/cloud | 4 pruebas de proveedores y 1 recorrido público de navegador aprobados. |

Total del runner: **3.128 pruebas aprobadas**. Las cinco pruebas cloud se omiten en la etapa ordinaria del servidor y se ejecutan en la última etapa. Las 148 pruebas focalizadas son un subconjunto de este total; las ocho repeticiones adicionales de estabilidad no se suman al total del runner.

Registro de esta ejecución: `/private/tmp/branching-layout-audit-complete-suite.log`. Los fallos de las ejecuciones intermedias quedan documentados arriba; no se presentan como ejecuciones aprobadas ni se usan resultados históricos para completar este recuento.
