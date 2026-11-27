# SDD: fijar el compilador GCC del job de publicación Linux para recompilar módulos nativos

Estado: implementado y verificado localmente el 2026-11-26 con GCC 14 (corrección sobre el primer intento con GCC 12). Nada se implementó al redactar este documento; la implementación posterior fue autorizada y se ejecutó mediante TDD. La verificación final (AC01/AC02) requiere una corrida real del pipeline por el usuario.

Fecha: 2026-11-26. Código revisado: `fc8f8a2a218e5f366d7f521dc825eb372c425d03`, rama `bugs`.

## 1. Resultado acordado

El job `linux-x64` de [build.yml](../.github/workflows/build.yml) vuelve a empaquetar y publicar los artefactos `deb`/`rpm` (`npm run build:electron -- --linux deb rpm --x64 --publish always`) sin que `@electron/rebuild` falle al recompilar el módulo nativo `re2`.

El fix fija GCC 14 y G++ 14 como compiladores de ese job mediante variables `CC`/`CXX`, sin tocar el producto, las dependencias, la configuración de electron-builder ni los demás jobs del workflow (la primera versión fijó GCC 12 y se corrigió en la sección 10).

## 2. Evidencia del problema

### 2.1 Fallo observado

En la ejecución de publicación Linux (Ubuntu, kernel `7.0.0-1019-azure`, GCC 15):

```
CXX(target) Release/obj.target/re2/vendor/re2/re2/compile.o
/usr/lib/gcc/x86_64-linux-gnu/15/include/bmi2intrin.h:25:3:
error: #error "Never use <bmi2intrin.h> directly; include <x86gprintrin.h> instead."
make: *** [re2.target.mk:266: Release/obj.target/re2/vendor/re2/re2/compile.o] Error 1
node-gyp failed to rebuild '/home/runner/work/expbuilder/expbuilder/node_modules/re2'
```

### 2.2 Cadena causal

1. `electron-builder 26.15.7` ejecuta `@electron/rebuild` contra los headers de Electron 43 para todos los módulos nativos del árbol.
2. `re2@1.26.1` es dependencia transitiva de `firebase-tools@15.28.1` → `superstatic@10.0.0` (verificado con `npm ls re2`) y es un módulo nativo basado en NAN.
3. El `abseil-cpp` incluido en re2 hace `#include <bmi2intrin.h>` directo, construcción que GCC 15 rechaza por diseño (`x86gprintrin.h` es el encabezado correcto).
4. El job corre en `ubuntu-latest`, cuya imagen trae GCC 15.

Es una incompatibilidad conocida entre abseil anterior al fix y GCC 15. No la causan los cambios de código recientes (exportación por IPC, estabilización de tests, escalado de botones), que no tocan el pipeline ni las dependencias.

## 3. Solución acordada (opción A)

Añadir un paso en el job `linux-x64`, después de `Install dependencies` y antes de los pasos de build:

```yaml
- name: Pin GCC 14 for native module rebuilds
  run: |
    sudo apt-get update
    sudo apt-get install -y gcc-14 g++-14
    echo "CC=gcc-14" >> "$GITHUB_ENV"
    echo "CXX=g++-14" >> "$GITHUB_ENV"
```

Las variables `CC`/`CXX` escritas en `GITHUB_ENV` aplican a todos los pasos siguientes del job, de modo que tanto `Build and publish` como `Build (no publish)` recompilan los módulos nativos con GCC 14, que acepta el abseil incluido en re2 y los headers de V8 de Electron 43.

## 4. Alternativas descartadas

| Alternativa | Motivo del rechazo |
|---|---|
| `"npmRebuild": false` en la configuración de electron-builder | Desactiva la recompilación de todos los módulos nativos; puede dejar dependencias con ABI de Node bajo Electron. Riesgo global innecesario para un problema localizado. |
| Override de `re2` a una versión con abseil corregido | Cambia una dependencia transitiva de firebase-tools; requiere validar compatibilidad del ecosistema y no elimina la posibilidad de que otro nativo falle con GCC 15 en el futuro. |
| Pasar el job a `ubuntu-22.04` | Fija un runner que se depreca antes que el compilador; obliga a migrar de nuevo a corto plazo. |
| Parchar el abseil incluido en `node_modules` | Frágil: se pierde en cada `npm ci` y complica el mantenimiento. |

## 5. Alcance y límites

- Únicamente el job `linux-x64` de `.github/workflows/build.yml`.
- No cambiar jobs de macOS, Windows, tests ni tags.
- No cambiar `package.json`, el lockfile, la configuración `build` de electron-builder ni el código del producto.
- No ejecutar la publicación como parte de redactar o implementar esta especificación; la verificación final es una corrida real del pipeline por el usuario.

## 6. Inventario de cambios

| Área | Trabajo previsto |
|---|---|
| [build.yml](../.github/workflows/build.yml) | Añadir el paso `Pin GCC 14 for native module rebuilds` en `linux-x64`, entre `Install dependencies` y `Build client`. Sin otros cambios. |

## 7. Criterios de aceptación

| ID | Caso | Resultado obligatorio |
|---|---|---|
| AC01 | Corrida de publicación Linux (`[build]` en main o workflow_dispatch) | `@electron/rebuild` recompila re2 sin el error de `bmi2intrin.h`; se generan y publican `deb` y `rpm`. |
| AC02 | Corrida sin publicación (rama que no es main) | Empaquetado correcto con el mismo compilador; los artefactos se suben como artifacts. |
| AC03 | Sintaxis del workflow | El YAML parsea y GitHub Actions valida el archivo. |
| AC04 | Jobs restantes | macOS, Windows y tests sin cambios ni efectos colaterales. |
| AC05 | Diff | Limitado a `.github/workflows/build.yml`; cero cambios en producto o dependencias. |

## 8. Orden de implementación

1. **Añadir el paso** en el job `linux-x64` y validar la sintaxis YAML localmente.
2. **Verificación en el pipeline** por el usuario: una corrida con `[build]` en una rama (sin publicar) y la publicación en main.
3. **Documentación.** Registrar los resultados reales en esta SDD y actualizar el índice.

Los puntos son entregas separadas. La implementación no comienza sin autorización. Redactar esta SDD no ejecuta ninguno de esos puntos.

## 9. Condición de cierre

La implementación termina cuando el job `linux-x64` empaqueta y publica con GCC 14, el error de re2 no reaparece, y el resto del workflow queda intacto. La verificación final requiere una corrida real del pipeline por el usuario.

## 10. Corrección — GCC 12 es insuficiente; se fija GCC 14 — 2026-11-26

La corrida de publicación con el pin de GCC 12 (commit `dd1a405`) eliminó el error de `bmi2intrin.h`, pero destapó otro: los headers de V8 de Electron 43 no parsean con GCC 12:

```
v8config.h:854:20: error: expected identifier before '__attribute__'
# define V8_EXPORT __attribute__((visibility("default")))
v8-primitive.h:658:4: error: expected primary-expression before 'public'
```

Análisis de la ventana de compiladores:

| GCC | V8/Electron 43 (Chromium moderno exige GCC ≥ 13) | abseil incluido en re2 |
|---|---|---|
| 12 | ❌ no parsea los headers nuevos | ✅ |
| 13–14 | ✅ | ✅ (el `#error` de `bmi2intrin.h` solo existe desde GCC 15) |
| 15 | ✅ | ❌ error de `bmi2intrin.h` |

La versión correcta es **GCC 14**: acepta los headers de V8 y el abseil antiguo. Se actualizó el paso a `gcc-14`/`g++-14` con `CC=gcc-14`/`CXX=g++-14`, manteniendo la posición y el resto del diseño.

### TDD y verificación

Las pruebas RED fallaron porque el workflow seguía usando GCC 12 (2 fallos en [ci-workflows.test.js](../__tests__/ci-workflows.test.js)). Después:

| Comprobación | Resultado |
|---|---|
| Tests del workflow | 20 pruebas aprobadas: paso con `gcc-14`/`g++-14` y `CC`/`CXX` correctos entre `Install dependencies` y `Build client`, y ausencia del pin en los demás jobs. |
| Parseo YAML del workflow | Aprobado. |
| `git diff --check` | Aprobado. |

La verificación final sigue siendo la corrida real del pipeline (AC01/AC02). Nombre de commit sugerido: `ci(linux): pin gcc-14 so electron-builder can rebuild re2 under the Electron 43 toolchain`.

## 11. Entrega — 2026-11-26 (registro del primer intento)

La entrega original fijó GCC 12 (commit `dd1a405`, registrado en la sección anterior): instalaba `gcc-12`/`g++-12` y escribía `CC=gcc-12`/`CXX=g++-12` en `GITHUB_ENV`, con 20 pruebas del workflow aprobadas y la suite jest completa en verde (684 pruebas). Esa entrega resolvía el fallo de abseil/GCC 15 pero resultó incompatible con los headers de Electron 43; queda reemplazada por la corrección a GCC 14 de la sección 10.
