# Reporte de Investigación: Problemas con CSV en Dynamic Plugin

He analizado el código tanto en el servidor (`server/dynamicplugin`) como en el cliente Konva (`client/src/pages/...`) respecto al uso de variables CSV en los componentes de texto e imagen del `DynamicPlugin`.

## 1. Causa Raíz del Problema (El Cliente / Builder)

El problema principal por el cual **ningún componente del Dynamic Plugin** itera sobre los valores del CSV radica en una posible discrepancia con el nombre del plugin o en cómo se resuelve la variable CSV en el generador de código del cliente.

* En `useTrialCode.ts`, la lógica especial de DynamicPlugin se activa con: `if (pluginName === "DynamicPlugin")`
* En `MappedJson.ts`, la lógica que resuelve las columnas del CSV dentro de los componentes busca: `if (pluginName === "plugin-dynamic")`

Debido a esta discrepancia, **la lógica especial en `MappedJson.ts` podría no estarse ejecutando** si el plugin se llama "DynamicPlugin" en este contexto. Como resultado, el código generado exporta el objeto crudo de configuración (ej. `{ source: "csv", value: "color_param" }`) en lugar de reemplazarlo por el valor real de la fila del CSV para cada iteración.

## 2. TextComponent (Servidor)

Incluso si el CSV se resuelve o si el componente procesa los parámetros directamente, el `TextComponent.ts` recibe en un momento dado los valores del CSV.

* **El método `resolveParam`:** Existe una función `resolveParam` en el `TextComponent` que intenta mitigar esto. Sin embargo, al recibir un objeto con `source: "csv"`, esta función devuelve `raw.value`. Si el Builder no inyecta el valor de iteración, `raw.value` será el *nombre* de la columna (ej. "color_param") en lugar del valor real del CSV (ej. "red").
* **Falta de soporte para `jsPsych.timelineVariable`:** El plugin padre (`DynamicPlugin`) delega el renderizado a sus componentes hijos. Si los parámetros de los componentes (como `text` o `font_color`) intentan usar `jsPsych.timelineVariable("columna")` (que es el estándar de jsPsych para iterar CSVs), el componente `TextComponent` actual no lo evalúa mediante `this.jsPsych.evaluateTimelineVariable()`. Solo tiene `resolveParam` que maneja el objeto crudo `{ source: "csv", value: "..." }`.
* **Riesgo de Crash (Crash por valores numéricos):** El componente llama directamente a `text.split("%")` para procesar el modo cloze. Si recibe un número desde el CSV (por ejemplo, si una columna de CSV tiene el número `123`), esto provocará un crash en tiempo de ejecución porque `.split()` no es una función de `Number`. Se debe asegurar de convertir a string: `String(text).split("%")`.

## 3. ImageComponent (Servidor)

* **Falta de `resolveParam`:** A diferencia del `TextComponent`, el `ImageComponent.ts` **no tiene** la función `resolveParam` y simplemente asume que `config.stimulus` y otros campos son valores directos.
* Si el Builder envía `{ source: "csv", value: "columna_imagen" }`, el `ImageComponent` intentará usar esto directamente:
  ```typescript
  (image as HTMLImageElement).src = config.stimulus;
  ```
* Al intentar asignar el objeto `{ source: "csv", ... }` a la propiedad `src` de una imagen, JavaScript lo convierte a la cadena `"[object Object]"`.
* **Resultado:** La imagen fallará silenciosamente (o mostrará un ícono de imagen rota) porque el navegador intentará cargar la URL `http://.../[object Object]`. 
* Al igual que el `TextComponent`, tampoco usa `this.jsPsych.evaluateTimelineVariable()` para resolver variables de jsPsych si el Builder decidiera generar código usando ese formato.

## 4. El Cliente (Konva)

En la interfaz de Konva (`TextComponent.tsx`, `ImageComponent.tsx`), los componentes usan un método interno (como `getConfigValue`) para mostrar el valor en el lienzo de diseño:
```typescript
const v = config.value !== undefined && config.value !== null ? config.value : defaultValue;
```
Esto funciona temporalmente en la interfaz gráfica porque extrae el nombre de la columna para usarlo como "placeholder" visual mientras diseñas, pero enmascara el hecho de que el verdadero valor no se está resolviendo correctamente en el código del experimento exportado.

## Conclusión y Pasos a Seguir

El problema es bidireccional (Builder y Plugin):

1. **Reparar el Builder (`client`):** Revisar y unificar cómo se llama el plugin en `MappedJson.ts` (`plugin-dynamic` vs `DynamicPlugin`). Asegurarse de que `MappedJson` reemplace correctamente los campos `{source: 'csv', value: 'columna'}` por el valor correspondiente de cada fila del `csvJson` (lo cual ya parece intentar hacer, pero la condición del nombre del plugin lo impide).
2. **Prevenir Crashes en TextComponent (`server`):** En `server/dynamicplugin/components/TextComponent.ts`, asegurar que el texto sea un string antes de separarlo:
   ```typescript
   const parts = String(text).split("%");
   ```
3. **Unificar la evaluación de parámetros (`server`):** 
   * Si el Builder se encarga de inyectar el valor real en crudo por cada iteración, entonces `ImageComponent` necesita usar el mismo `resolveParam` que `TextComponent` para manejar el objeto `{source: "typed", value: ...}`.
   * Si el Builder genera el código usando `jsPsych.timelineVariable()`, entonces **todos** los componentes del servidor (Text, Image, etc.) deben usar `this.jsPsych.evaluateTimelineVariable(config.propiedad)` para obtener el valor real en el momento de la ejecución.