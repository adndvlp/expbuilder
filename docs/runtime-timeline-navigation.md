# Navegación con timelines nativos

Los experimentos generados por el editor usan `nativeTimelineNavigation.ts`, dentro del coordinador de navegación del cliente. Local, public y el preview de una selección conectan el mismo coordinador. El generador de `server/agent` conserva su implementación independiente.

## Compilación y ejecución

El manifiesto conserva las direcciones de trials y loops, su cadena de propietarios y dos listas por scope: la secuencia inicial y las posiciones completas del grafo. Las alternativas de branching en el timeline principal se insertan cuando son elegidas. Las posiciones completas permiten continuar después de un destino compartido aunque no aparezca en la secuencia inicial.

Los generadores registran las definiciones de trials y loops. `attach` construye el timeline principal y cada entrada crea sus propios wrappers. Un loop conserva `timeline_variables`, sampling, repeticiones y `loop_function` de jsPsych. Cada fila reconstruye su cola: la ruta elegida en una fila no modifica la siguiente.

Una transición compara el camino del destino con los scopes activos. Modifica únicamente el tramo futuro del ancestro común. Si abandona loops, aborta por nombre el loop activo más externo que debe cerrar. La limpieza de frames y órdenes se realiza antes del aborto, porque jsPsych no llama a `on_timeline_finish` en un timeline abortado. La entrada a otro loop incluye todos los procedimientos que aportan sus variables.

Una conexión ordinaria del último elemento hacia fuera se conserva hasta que terminan todas las filas y repeticiones. Una salida condicional o un jump puede abandonarlas inmediatamente. Una ruta que entra a un destino concreto conserva su nivel de terminación cuando ese destino elige otra rama dentro del mismo loop. Un destino compartido recupera la continuación correspondiente a su posición en el grafo.

## Decisiones, guardado y recuperación

Branching se evalúa una vez, con el resultado de su origen, en `on_finish`. El callback de persistencia no vuelve a consultar el último trial para decidir la ruta. Los parámetros se entregan al destino una sola vez, incluso si su entrada atraviesa varios loops.

Jump usa las mismas reglas de transición. Pausa la ejecución, espera el resultado del origen y todas las escrituras pendientes, inserta una entrada futura y continúa con la misma instancia de jsPsych y la misma sesión. Un salto hacia una posición anterior crea una entrada nueva; no retrocede el cursor interno del timeline. Los artefactos sin un plan de scopes nativos conservan el protocolo anterior de jump con recarga.

El checkpoint v2 guarda las filas, el orden muestreado, la repetición, los resultados del ciclo condicional y las colas de los scopes activos. Al completar una respuesta que elige una rama, apunta al tramo futuro elegido. Así, una recarga durante el intervalo entre trials no vuelve a entrar al loop abandonado. El checkpoint de inicio conserva los parámetros que todavía debe aplicar el trial.

El preview limita sus direcciones a la selección compilada. Una conexión hacia fuera de esa selección no inserta un trial ausente. Sin guardado, los resultados se reconocen en memoria para que un jump pueda continuar.

## Pruebas

Las pruebas del coordinador verifican retención y aborto de scopes, continuidad de destinos compartidos, consumo de parámetros, barreras de persistencia y checkpoints de transición. Los escenarios de Chrome ejecutan el bundle de producción y comprueban las secuencias y los resultados guardados: loops de tres niveles, loops hermanos, salidas a distintos ancestros, CSV con repeticiones, ciclos condicionales, resume y jumps sin recarga. Public se comprueba usando sus callbacks reales con escrituras de IndexedDB y red simuladas con demora.

Los cambios se aplican al regenerar los artefactos del experimento; no reescriben los HTML ya construidos ni los experimentos guardados en la base de datos.
