# SDD: fijar GCC 12 en el job de publicación Linux para recompilar módulos nativos

Estado: implementado y verificado localmente el 2026-11-26. Nada se implementó al redactar este documento; la implementación posterior fue autorizada y se ejecutó mediante TDD. La verificación final (AC01/AC02) requiere una corrida real del pipeline por el usuario.

Fecha: 2026-11-26. Código revisado: `fc8f8a2a218e5f366d7f521dc825eb372c425d03`, rama `bugs`.

## 1. Resultado acordado

El job `linux-x64` de [build.yml](../.github/workflows/build.yml) vuelve a empaquetar y publicar los artefactos `deb`/`rpm` (`npm run build:electron -- --linux deb rpm --x64 --publish always`) sin que `@electron/rebuild` falle al recompilar el módulo nativo `re2`.

El fix fija GCC 12 y G++ 12 como compiladores de ese job mediante variables `CC`/`CXX`, sin tocar el producto, las dependencias, la configuración de electron-builder ni los demás jobs del workflow.

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
- name: Pin GCC 12 for native module rebuilds
  run: |
    sudo apt-get update
    sudo apt-get install -y gcc-12 g++-12
    echo "CC=gcc-12" >> "$GITHUB_ENV"
    echo "CXX=g++-12" >> "$GITHUB_ENV"
```

Las variables `CC`/`CXX` escritas en `GITHUB_ENV` aplican a todos los pasos siguientes del job, de modo que tanto `Build and publish` como `Build (no publish)` recompilan los módulos nativos con GCC 12, que acepta el abseil incluido en re2.

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
| [build.yml](../.github/workflows/build.yml) | Añadir el paso `Pin GCC 12 for native module rebuilds` en `linux-x64`, entre `Install dependencies` y `Build client`. Sin otros cambios. |

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

La implementación termina cuando el job `linux-x64` empaqueta y publica con GCC 12, el error de re2/abseil no reaparece, y el resto del workflow queda intacto. La verificación final requiere una corrida real del pipeline por el usuario.

## 10. Entrega — 2026-11-26

Se implementó el punto 1 mediante TDD.

`build.yml` añade el paso `Pin GCC 12 for native module rebuilds` en el job `linux-x64`, entre `Install dependencies` y `Build client`: instala `gcc-12`/`g++-12` y escribe `CC=gcc-12`/`CXX=g++-12` en `GITHUB_ENV`, de modo que ambos pasos de build (publicar y no publicar) recompilan los módulos nativos con GCC 12.

El job `linux-arm64` queda fuera del alcance acordado: corre en `ubuntu-24.04-arm` con GCC 13, que acepta el abseil incluido en re2; si su imagen migrara a GCC 15, aplica el mismo paso.

### TDD y verificación

Las pruebas RED fallaron porque el paso no existía (2 fallos en [ci-workflows.test.js](../__tests__/ci-workflows.test.js)). Después:

| Comprobación | Resultado |
|---|---|
| Tests del workflow (AC03–AC05) | 20 pruebas aprobadas en `ci-workflows.test.js`: posición del paso entre `Install dependencies` y `Build client`, contenido de `gcc-12`/`g++-12`/`CC`/`CXX`, y ausencia del pin en `test`, `tag`, `mac` y `win`. |
| Parseo YAML del workflow | Aprobado; jobs y orden de pasos de `linux-x64` verificados. |
| Suite jest completa (raíz + servidor) | 684 pruebas aprobadas, 0 fallos (una corrida intermedia mostró un flake transitorio que no se reprodujo en las dos corridas posteriores). |
| `git diff --check` | Aprobado. |

Queda pendiente la verificación final AC01/AC02: una corrida del pipeline en GitHub (rama con `[build]` sin publicar y publicación en main), que ejecuta el usuario.

Se actualizó el [índice](INDEX.md) con esta SDD. Nombre de commit sugerido para que el usuario lo ejecute: `ci(linux): pin gcc-12 for electron-builder native rebuilds`.

La condición de cierre funcional depende de la corrida real del pipeline; el cambio y sus pruebas quedan listos y verificados localmente.
