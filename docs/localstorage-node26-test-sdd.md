# SDD: estabilizar el test de reclutamiento/retoma frente al localStorage global de Node 26

Estado: implementado y verificado localmente el 2026-11-26. Nada se implementó al redactar este documento; la implementación posterior fue autorizada y se ejecutó mediante TDD.

Fecha: 2026-11-26. Código revisado: `fc8f8a2a218e5f366d7f521dc825eb372c425d03`, rama `bugs`.

## 1. Resultado acordado

Los dos casos `completion uses the session recruitment settings after another save 0/1` de `publicRecruitmentResume.test.ts` pasan en cualquier versión de Node, incluida Node 26, sin depender del global `localStorage` del runtime ni de flags de invocación como `--localstorage-file`.

El cambio es exclusivamente de pruebas: se hace autocontenido el sandbox del primer `it.each`, con el mismo patrón que ya usa el segundo `it.each` del mismo archivo. No se modifica el código generado ni ningún archivo de producción.

## 2. Evidencia del problema

### 2.1 Fallo observado

Ejecutando la suite unitaria del cliente en Node 26 con las dependencias del lockfile (vitest 4.1.7, jsdom 29.1.1):

```
FAIL src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/__tests__/publicRecruitmentResume.test.ts
× completion uses the session recruitment settings after another save 0
× completion uses the session recruitment settings after another save 1
TypeError: Cannot read properties of undefined (reading 'removeItem')
```

El fallo se reproduce idéntico en un worktree limpio del HEAD `fc8f8a2`; es preexistente y ajeno a la [SDD de exportación](export-ipc-limit-sdd.md), que lo registra en su entrega 3.

### 2.2 Mecánica del test

El primer `it.each` construye el código generado (`publicInitCode` + `publicFinishCode`) y lo evalúa con `new Function('saved', 'success', 'complete', 'location', <cuerpo>)`. El cuerpo del sandbox declara `_publicStorageKeys`, `sessionRef`, `window` y otros dobles, pero **no declara `localStorage`**.

El código generado invoca `localStorage.removeItem(...)` en el flujo de completar/retomar. Los identificadores libres de un `new Function` se resuelven contra el objeto global real, no contra el sandbox. Por eso el test depende de que el global del entorno de pruebas ofrezca `localStorage`.

El segundo `it.each` del mismo archivo declara explícitamente `const localStorage = { getItem: () => null, setItem() {}, removeItem() {} }` en su sandbox y por eso pasa.

### 2.3 Causa raíz

Node 26 incorpora un global `localStorage` experimental respaldado por archivo. Sin el flag `--localstorage-file`, el getter global devuelve `undefined` y emite:

```
ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
```

Sonda ejecutada dentro del entorno vitest/jsdom en Node 26:

```
href: http://localhost:3000/
typeof localStorage: undefined
typeof globalThis.localStorage: undefined
```

jsdom puro en Node 26 sí expone `window.localStorage` como objeto; la interferencia es del global de Node con la población del entorno vitest. El código evaluado resuelve `localStorage` a ese getter roto, obtiene `undefined` y falla al llamar `removeItem`.

Por eso los 1862 tests restantes pasan: casi todos definen su propio stub (por ejemplo `installLocalStorage` en el harness del shell de Settings) y no dependen del global.

## 3. Solución acordada

Añadir al sandbox del primer `it.each` el mismo stub que ya usa el segundo:

```ts
const localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
```

Razones:

- Hace el test autocontenido y determinista en cualquier versión de Node.
- Reproduce el patrón ya existente en el mismo archivo.
- No cambia aserciones, cobertura ni el código generado.
- La producción no está afectada: los navegadores reales siempre exponen `localStorage`; la peculiaridad es exclusiva del entorno de pruebas.

## 4. Alternativas descartadas

| Alternativa | Motivo del rechazo |
|---|---|
| Fijar o ejecutar con Node 20/22 (`engines`, `.nvmrc`, CI) | No garantiza las máquinas de desarrollo con Node 26; no resuelve el test en sí. |
| Invocar vitest con `NODE_OPTIONS=--localstorage-file=...` | Parche de invocación frágil que no viaja con el repositorio. |
| Blindar el código generado (`typeof localStorage !== 'undefined'`) | Cambia producto por una peculiaridad del entorno de test; amplía el alcance sin necesidad. |
| Cambiar vitest/jsdom de versión | Fuera de alcance; el lockfile actual es el comprometido en el repositorio. |

## 5. Alcance y límites

- Únicamente el archivo `client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/__tests__/publicRecruitmentResume.test.ts`.
- No tocar `publicInitCode.ts`, `publicFinishCode.ts`, `publicBootstrapCode.ts` ni el generador.
- No cambiar aserciones ni el contrato de los dos casos.
- No pin/actualizar Node, vitest o jsdom como parte de esta SDD.
- No abordar otros desajustes de Node 26 que puedan existir fuera de este caso.

## 6. Inventario de cambios

| Área | Trabajo previsto |
|---|---|
| [publicRecruitmentResume.test.ts](../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/__tests__/publicRecruitmentResume.test.ts) | Añadir el stub de `localStorage` al sandbox del primer `it.each`. Sin otros cambios. |

## 7. Criterios de aceptación

| ID | Caso | Resultado obligatorio |
|---|---|---|
| AC01 | Ejecutar el archivo en Node 26 | Los dos casos fallan antes (RED ya registrado) y pasan después del cambio. |
| AC02 | Ejecutar el archivo en Node 26 | No se emite el warning experimental de Node sobre `--localstorage-file`. |
| AC03 | Segundo `it.each` (preview gate) | Sigue pasando sin modificación. |
| AC04 | Suite unitaria completa del cliente | Sin nuevos fallos; desaparecen los 2 fallos preexistentes registrados en la SDD de exportación. |
| AC05 | Diff | Limitado al archivo de test indicado; cero cambios de producción. |
| AC06 | Lint del archivo y `git diff --check` | Sin errores nuevos. |

## 8. Orden de implementación

1. **Aplicar el stub.** El fallo actual en Node 26 actúa como RED; tras el cambio, GREEN.
2. **Verificación.** Archivo individual y suite unitaria completa del cliente en Node 26.
3. **Documentación.** Registrar resultados reales en esta SDD y actualizar el índice.

Los puntos son entregas separadas. La implementación no comienza sin autorización y se detiene al terminar el punto solicitado. Redactar esta SDD no ejecuta ninguno de esos puntos.

## 9. Condición de cierre

La implementación termina cuando los dos casos pasan en Node 26 sin warnings, la suite unitaria del cliente queda verde salvo su línea base previa conocida, y no existe ningún cambio de producción. Queda documentado que el origen es la interferencia del global experimental `localStorage` de Node 26 con el entorno de pruebas, no el código generado.

## 10. Entrega — 2026-11-26

Se añadió el stub de `localStorage` al sandbox del primer `it.each` de [publicRecruitmentResume.test.ts](../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/__tests__/publicRecruitmentResume.test.ts), idéntico al que ya usaba el segundo `it.each` del mismo archivo. No se modificó ninguna aserción ni archivo de producción.

El fallo registrado en Node 26 actuó como RED. Después del cambio:

| Comprobación | Resultado |
|---|---|
| Archivo individual en Node 26 (AC01–AC03) | 4 pruebas aprobadas de 4; sin `ExperimentalWarning` de Node. |
| Suite unitaria completa del cliente (AC04) | 1864 pruebas aprobadas, 0 fallos. Los 2 fallos preexistentes desaparecen y el resto de la suite, incluida la [SDD de exportación](export-ipc-limit-sdd.md), permanece verde. |
| Diff (AC05) | 1 archivo de test, 1 inserción; cero cambios de producción. |
| Lint del archivo y `git diff --check` (AC06) | Sin errores. |

Se actualizó el [índice](INDEX.md) con esta SDD. Nombre de commit sugerido para que el usuario lo ejecute: `test(public): stub localStorage in the recruitment resume sandbox for Node 26`.

La condición de cierre queda satisfecha con evidencia local. La interferencia queda documentada como peculiaridad del entorno de pruebas en Node 26; el código generado y los navegadores reales no están afectados.
