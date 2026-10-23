# SDD: distribución del grafo y dirección de conexiones en el canvas

Fecha: 2026-10-22.
Estado: implementado y verificado en la aplicación.
Referencia visual aprobada: [maqueta React Flow](demos/branching-symmetry.html).

Evolución posterior: [cadenas alineadas y conexiones curvas](branching-curves-sdd.md). Esa SDD sustituye las reglas de reparto horizontal y desvíos con esquinas de este documento y registra su implementación y validación. Los resultados de la sección 10 corresponden a la primera implementación; la maqueta enlazada ya refleja el diseño posterior de diez escenarios.

## 1. Decisión

Aplicar a la app la distribución y las conexiones aprobadas en la maqueta, conservando sus nodos, colores, conectores, controles y estilos actuales. La app ya utiliza React Flow; se mantiene esa instancia y su integración con el editor.

La maqueta es la referencia de comportamiento visual. Sus coordenadas están escritas a mano para cuatro ejemplos: no contiene un algoritmo de distribución que se pueda copiar a producción. La implementación debe calcular posiciones y rutas a partir del grafo real.

El resultado debe mostrar bifurcaciones, destinos compartidos, conexiones entre ramas, retornos y conexiones entre niveles de loops. Aunque visualmente se hable de árbol, los datos representan un grafo dirigido con ciclos y múltiples padres.

## 2. Alcance y límites

Se modifican el cálculo de posiciones, el trazado de conexiones, las puntas de flecha, la animación de los circuitos y el encuadre del canvas. Se conservan selección, creación de branches, edición, expansión de loops y sus estados de carga y error.

Este cambio no modifica navegación, evaluación de condiciones, parámetros de destino, repeticiones, resume, generación de experimentos, persistencia ni el Dynamic Plugin. No introduce campos persistidos, migraciones, compatibilidades, modos alternativos ni nuevas dependencias. Las coordenadas son datos derivados de la vista.

Las conexiones entre trials siguen siendo Branching, cualquiera que sea su posición en pantalla. Una ruta que sube, rodea un loop o vuelve al origen no crea otro tipo de navegación.

## 3. Comparación con la implementación anterior

Diagnóstico realizado antes de implementar. Los resultados de la integración figuran en la sección 10.

| Parte | Situación anterior | Trabajo necesario |
|---|---|---|
| React Flow, nodos y controles | Ya existen en `Canvas/index.tsx`, `TrialNode.tsx` y `LoopNode.tsx`. | Reutilizarlos. El HTML no se incrusta ni reemplaza el canvas. |
| Identidad y ámbito de cada entidad | Ya están en `ExpandedCanvasNodeData` y en el snapshot del grafo. | Conservar IDs, propietarios y callbacks. |
| Conexiones entre ámbitos y loops cerrados | `canonicalBranchProjection.ts` ya resuelve endpoints visibles y conserva `semanticEdgeIds`. | Reutilizar esa proyección y comprobar sus invariantes. |
| Distribución | La composición inicial se apoya en recorridos por ramas; después varios ajustes desplazan subárboles y uniones. | Hacer que la colocación considere el grafo completo y que haya una sola secuencia de decisiones geométricas. |
| Correcciones de simetría y espacio | `finalizeExpandedLoopLayout.ts` repite ajustes; `reserveLoopRouteClearance.ts` recorre las conexiones salientes. | Evitar que deshagan la nueva distribución o que un retorno se use como obligación de mover su destino hacia abajo. |
| Entrada de cada ámbito | El snapshot ya tiene `entryItemId`; el input del layout no lo recibe. | Pasarla desde `useCanvasWorkspace` para orientar los ciclos sin depender del primer registro del array. |
| Circuito centrado | La app ya consolida cada loop abierto en un circuito sobre sus conectores superior e inferior. | Conservarlo. No trasladar los anclajes laterales que tuvo inicialmente la maqueta. |
| Sentido de los puntos | El path actual de la app empieza arriba y termina abajo, rodeando el ámbito. | Invertirlo conforme a la última preferencia aprobada: bajar por la izquierda y subir por la derecha. |
| Flechas | `LoopRoutingEdge` ya transmite los markers a `BaseEdge`; el constructor no los asigna. | Añadir markers del mismo color, coherentes con el path dibujado. |
| Encuadre | `CanvasViewportFitter` usa `fitView`, cuyo cálculo considera los nodos. | Incluir también rutas exteriores, circuitos y controles que sobresalen. |

No se ha hecho un merge entre ramas, así que no corresponde prometer ausencia de conflictos textuales. La integración es compatible con el contrato vigente. El trabajo real está en la geometría y sus consumidores; no es pegar el HTML ni sumar otro layout después del actual.

## 4. Reglas visuales obligatorias

### Nodos y simetría

- Un nodo visible por entidad, incluso si recibe muchas conexiones o se vuelve a él.
- Trials y loops cerrados de 180 × 50; marcador de loop abierto de 140 × 50, conforme a `canvasNodeGeometry.ts`.
- Las bifurcaciones sencillas se distribuyen alrededor del origen. Un destino compartido queda centrado entre sus padres cuando las demás restricciones lo permiten.
- Un destino de avance queda por debajo de todos sus predecesores de avance, con separación suficiente entre cajas.
- Una conexión nueva entre ramas participa en la distribución. No se añade únicamente una curva sobre posiciones que siguen suponiendo ramas independientes.
- Los nodos, controles y circuitos de ramas hermanas reservan espacio. Un destino compartido no se trata como propiedad exclusiva de una sola rama.
- El resultado es determinista. Cambiar selección, tema o el orden de almacenamiento de los mismos registros no modifica la geometría. Se conserva el orden de ramas declarado por el autor; los empates restantes se resuelven por identidad estable.

No se exige simetría perfecta en grafos asimétricos ni ausencia absoluta de cruces entre conexiones. Sí se exige evitar solapamientos de nodos y rutas que atraviesen nodos ajenos, y permitir identificar origen, destino y pertenencia a un loop.

### Flechas y rutas

- Todas las conexiones de navegación llevan una punta pequeña al llegar a su destino, con el mismo color y grosor de línea que en la maqueta.
- Las puntas siguen los endpoints reales del path. Una conexión de retorno conserva su dirección semántica aunque visualmente suba.
- Las conexiones de avance usan las curvas actuales cuando el recorrido está libre. Los retornos, autorreferencias y desvíos necesarios usan rutas exteriores con esquinas redondeadas.
- Las rutas exteriores reservan carriles separados de los circuitos de loops. Ninguna arista se elimina para evitar un cruce.
- Se mantiene la asignación de colores por identidad semántica mediante `assignBranchColorSlots`; la posición y la punta de flecha no cambian esa identidad.

### Loops

- Cada loop abierto conserva un único circuito azul punteado alrededor de su contenido visible, incluidos los loops hijos abiertos.
- La línea sale del conector amarillo inferior, baja por el lado izquierdo, cruza la parte inferior, sube por el derecho y regresa al conector amarillo superior. Los puntos y la flecha del circuito siguen ese mismo sentido.
- El texto y el botón del marcador no se atraviesan: el tramo izquierdo queda interrumpido por el nodo, unido a sus conectores superior e inferior.
- El circuito representa el contenedor; no es una conexión de navegación entre trials y no participa en el cálculo de niveles del grafo.
- Cerrar un loop oculta sus descendientes y proyecta las conexiones externas sobre el contenedor visible, conservando sus IDs semánticos. No crea un nuevo destino de branching hacia un loop.
- Reabrirlo restaura las conexiones hacia sus trials. Se mantiene el comportamiento vigente de carga, selección y activación del ámbito.

## 5. Cálculo de la distribución

### 5.1 Entrada y proyección

Partir del snapshot existente: entidades, conexiones canónicas, jerarquía de propietarios y entradas explícitas. Extender solamente el input de la vista para recibir las entradas de ámbitos que ya están presentes en el snapshot.

Conservar también las continuaciones estructurales declaradas por `nextItemId` al completar un loop. Las entradas y esas continuaciones aportan restricciones de colocación, sin inventar conexiones por la posición de los registros en un array. Un fallo del snapshot conserva el tratamiento de errores del canvas; no activa una reconstrucción alternativa del experimento.

Conservar las utilidades de identidad, las dimensiones, la proyección sobre contenedores cerrados y la consolidación de circuitos. Separar en memoria las conexiones del experimento de las restricciones utilizadas para colocarlo. Las restricciones no se escriben en los datos del experimento.

Una eliminación temporal de ciclos para calcular posiciones nunca elimina las conexiones que se dibujan. La sanitización defensiva del layout tampoco puede convertir el orden de almacenamiento en una ruta nueva del experimento.

### 5.2 Avances y retornos para el dibujo

Realizar un recorrido determinista desde la entrada declarada de cada ámbito. Las aristas hacia un nodo que está en el recorrido activo se reservan como retornos; las autorreferencias se tratan de la misma forma. Los componentes desconectados se procesan después, con un orden estable, sin conectarlos artificialmente a la entrada.

Las demás conexiones forman la base acíclica del cálculo de niveles. Asignar a cada nodo el nivel necesario para quedar después de todos sus predecesores de avance, no solamente del primero que lo descubrió. Conservar todos los retornos para el trazado posterior.

La distinción avance/retorno pertenece exclusivamente al layout. No introduce tipos de branching, validaciones de navegación ni límites de visitas.

### 5.3 Posiciones y jerarquía

Calcular los ámbitos abiertos desde los hijos hacia sus padres. Cada ámbito aporta su tamaño completo, marcador y espacio reservado para el circuito. En el padre se utiliza ese bloque, conservando la correspondencia con los trials interiores.

Las conexiones entre ámbitos se consideran en el ancestro común que contiene sus extremos, proyectándolas sobre los bloques correspondientes. Las conexiones interiores se resuelven en su propio ámbito. Una proyección que forma un ciclo se trata como retorno para el dibujo; no cambia los propietarios reales ni mueve un destino anterior debajo de su origen.

Dentro de cada nivel, ordenar y separar las cajas usando sus tamaños y las posiciones de padres e hijos. Centrar bifurcaciones y destinos compartidos cuando sea compatible con la separación y la jerarquía. Usar desempates estables y un número fijo de pasadas de ordenación; no iterar hasta una supuesta convergencia sin límite.

Los ajustes de espacio se hacen sobre estas mismas restricciones de avance. En particular, un retorno hacia un trial anterior no se pasa a `reserveLoopRouteClearance` como una salida que obliga a desplazarlo debajo del circuito. Los ajustes actuales que compitan con esta colocación se sustituyen; no se ejecutan después para volver a imponer el árbol anterior.

### 5.4 Rutas, apariencia y viewport

Con las posiciones finales, calcular circuitos y rutas exteriores considerando las cajas de nodos, controles y los carriles ya reservados. Las rutas llevan su dirección de origen a destino; las puntas se asignan después de elegir el path.

Para los circuitos, invertir el orden actual de puntos de `getLoopCircuitPoints` y conservar sus anclajes centrados. No invertir globalmente la animación CSS, porque afectaría a otras conexiones animadas.

Añadir `MarkerType.ArrowClosed` con las medidas aprobadas en la maqueta: navegación de 20 × 20 unidades de marker y circuitos de 16 × 16. Reutilizar los colores de la app, incluidos ambos temas.

El resultado de la geometría aporta también los límites de rutas y controles al encuadre. `CanvasViewportFitter` utiliza esos límites con el viewport real, conservando el zoom máximo de ajuste de 1.15 y sus interacciones actuales. La firma del layout debe detectar cambios de geometría de las rutas, aunque no cambien los endpoints.

## 6. Casos de aceptación de la maqueta

| Caso | Grafo | Resultado |
|---|---|---|
| Destino compartido | A → B/C; B → D; añadir C → D. | D pasa de estar bajo B a estar centrado entre B y C. Solo existe un D. |
| Conexión entre ramas | A → B/C; B → D; C → E; D/E → F; añadir D → E. | E queda después de C y D; F después de D y E. D → F rodea E sin atravesarlo. |
| Regreso al inicio | Diamante anterior y D → A. | A conserva su posición de entrada; se dibuja el retorno por fuera, sin duplicar A ni desplazarlo debajo de D. |
| Salidas entre loops | Tres niveles; R conecta con Q en el padre, S en el abuelo y T en el principal. | Se muestran los tres destinos con sus propietarios correctos. R → Q puede regresar; no fuerza Q por debajo de R. Los tres circuitos conservan espacio y sentido. |

Los casos se comprueban con conexiones activadas y retiradas, loops abiertos y cerrados, y ambos temas. Los valores exactos de coordenadas del HTML no son requisitos: sí lo son estas relaciones y el estilo aprobado.

Añadir autorreferencias, varios componentes desconectados, destinos con más de dos padres, loops hermanos y una jerarquía generada de mayor profundidad. El algoritmo no contiene casos especiales para los nombres ni el número de niveles de los cuatro ejemplos.

## 7. Integración prevista

| Área | Modificación |
|---|---|
| `hooks/useCanvasWorkspace.ts` y el input de `buildUnifiedFlowLayout.ts` | Transmitir las entradas explícitas del snapshot y conservar los callbacks actuales. |
| `services/composeExpandedLoopLayout.ts`, renderers y finalizadores | Integrar el cálculo del grafo y retirar las decisiones geométricas que compitan con él. Conservar la proyección semántica y la identidad de las entidades. |
| `services/expandedLayoutTypes.ts` | Expresar rutas y límites derivados de la vista, sin cambiar tipos persistidos del experimento. |
| `services/loopScopeGeometry.ts` y las reservas de espacio | Reutilizar la geometría de ámbitos, aplicada a las posiciones finales y a restricciones de avance. |
| `services/loopRoutingPath.ts` | Adoptar el sentido aprobado del circuito. |
| `services/buildUnifiedFlowLayout.ts` y componentes de edges | Asignar markers y dibujar rutas de retorno, desvío y autorreferencia. Registrar un edge de navegación específico si el trazado estándar no alcanza. |
| `components/CanvasViewportFitter.tsx` y `getCanvasLayoutSignature.ts` | Encuadrar toda la geometría y detectar sus cambios. |

Los helpers nuevos se limitan al cálculo de niveles, colocación y rutas que no tenga un equivalente reutilizable. No se incorpora un segundo canvas, un segundo sistema de autoría ni un motor alternativo seleccionable. No se modifican CSS y componentes de nodos para imitar el HTML: el HTML ya toma su estilo de ellos.

## 8. TDD y validación

1. Antes de implementar la colocación, añadir regresiones de los cuatro grafos sobre el punto de entrada real del layout. Deben comprobar relaciones geométricas, preservación de aristas y ausencia de duplicados, no una copia literal del algoritmo ni coordenadas arbitrarias.
2. Añadir pruebas de ciclos con entrada explícita y registros permutados; misma geometría para el mismo grafo y orden de ramas. Verificar que las entradas y los datos recibidos no se mutan.
3. Extender las pruebas existentes de circuitos, uniones, envolventes de ramas hermanas y espacio para salidas. Cambiar las expectativas del sentido del circuito de forma explícita; conservar las garantías de pertenencia y separación.
4. Probar en navegador las puntas sobre curvas y retornos, los anclajes centrados, el sentido real de la animación, ambos temas y el encuadre de carriles exteriores. Abrir y cerrar loops y usar selección y el botón de añadir branch en la app.
5. Ejecutar las pruebas de canvas afectadas, los E2E de canvas y la comprobación de tipos/límites de archivos. Al cerrar la implementación, ejecutar `npm run tests` desde la raíz para verificar también las regresiones del proyecto. Informar las etapas completadas: el runner se detiene ante un fallo y no permite afirmar que se ejecutaron las etapas posteriores.

Los tests de navegador viven en la suite existente y deben quedar incluidos en sus patrones de descubrimiento. Los escenarios usan fixtures; no modifican `server/database/db.json` ni experimentos del usuario.

La implementación y la validación se completaron según los resultados de la sección 10.

## 9. Conflictos y conclusión de integración

No hay un conflicto de contrato entre las flechas, la maqueta y el branching actual. Las flechas indican la misma dirección que las conexiones existentes. Tampoco se necesita cambiar de librería ni reescribir los nodos.

Sí hay decisiones geométricas que deben reemplazarse o coordinarse: el reparto actual por subárboles, el ajuste de destinos compartidos, las reservas que mueven salidas, el sentido actual del circuito y el encuadre basado solo en nodos. Aplicar el nuevo cálculo y luego ejecutar sin cambios todos los ajustes anteriores podría deshacer el resultado o desplazar retornos incorrectamente.

Por tanto, es una integración de presentación sobre la estructura vigente, con sustitución del cálculo geométrico necesario. No requiere cambios en la ejecución del experimento, pero tampoco se puede considerar un merge automático del HTML. La comprobación final de ausencia de regresiones depende de las pruebas de la implementación.

## 10. Implementación y resultados

Implementado el 2026-10-22 sobre el canvas existente:

- `directedLayout.ts` determina retornos, niveles y separación simétrica. `layoutScopeGraph.ts` compone los ámbitos desde los hijos hacia los padres y conserva los destinos compartidos. Las entradas explícitas se resuelven también cuando el experimento empieza en un loop.
- Se reutilizan las proyecciones canónicas, los IDs y los callbacks del editor. La composición conserva `nextItemId`, evita conectar terminales a otros registros por su posición y reutiliza los recorridos de ramas ya calculados.
- `navigationRouting.ts` y `NavigationRoutingEdge.tsx` trazan retornos, autorreferencias y desvíos evitando los nodos. Se añadieron puntas del mismo color a las conexiones y a los circuitos.
- Los circuitos conservan los conectores amarillos centrados y avanzan hacia abajo por la izquierda y hacia arriba por la derecha, conforme a la última versión aprobada del HTML.
- `canvasLayoutBounds.ts`, `CanvasViewportFitter.tsx` y la firma del layout incluyen los carriles y los controles en el encuadre.
- Se retiraron los seis módulos de ajustes anteriores que podían competir con esta colocación: `expandedFlowGraph.ts`, `finalizeExpandedLayout.ts`, `finalizeExpandedLoopLayout.ts`, `getLoopAwareBranchBounds.ts`, `layoutScopeExitBranches.ts` y `reserveLoopRouteClearance.ts`.

Las pruebas se añadieron antes de las correcciones correspondientes. Cubren los cuatro grafos de referencia, entradas explícitas, registros permutados, terminales, autorreferencias, continuaciones declaradas y hasta ocho niveles anidados. Los E2E comprueban colores de las flechas, sentido de la animación, encuadre y ciclos de apertura/cierre en ambos temas.

También se actualizó el mock antiguo de React Flow para conservar sus exports reales. Las comprobaciones de gestos esperan a que termine el encuadre inicial y el helper de colisiones mide línea y nodo en una misma evaluación del navegador, evitando comparar fotogramas distintos. Se mantienen las comprobaciones de zoom y de ausencia de colisiones.

Verificación final: `npm run tests`, ejecutado desde la raíz, terminó con **código 0** y completó sus ocho etapas:

| Etapa | Resultado |
|---|---|
| Límite de líneas del cliente | Aprobado. |
| Build del bundle de jsPsych | Aprobado. |
| Servidor | 627 pruebas aprobadas. |
| Cliente | 1.688 pruebas aprobadas en 415 archivos. |
| Functions | 528 pruebas aprobadas. |
| E2E del editor | 144 pruebas aprobadas. |
| E2E del runtime generado | 77 pruebas aprobadas. |
| E2E públicos/cloud | 4 pruebas de proveedores y 1 recorrido de navegador aprobados. |

Total: **3.069 pruebas aprobadas**. Las dos suites cloud aparecen omitidas en la etapa ordinaria del servidor porque dependen de `RUN_CLOUD_E2E`; sus cinco pruebas se ejecutaron y aprobaron en la última etapa. No quedaron omitidas del recorrido completo.

Además pasaron `tsc -b`, el lint de los módulos nuevos y `git diff --check`. El trabajo conserva los componentes y estilos de nodos y no modifica el runtime, las dependencias ni los experimentos del usuario.
