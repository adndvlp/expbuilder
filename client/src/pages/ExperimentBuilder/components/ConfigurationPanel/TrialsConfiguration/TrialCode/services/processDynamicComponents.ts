import { mapFileToUrl } from "../../../../../utils/mapFileToUrl";

// Helper para procesar componentes - remover valores undefined/null y mapear archivos
export function processDynamicComponents(
  components: any[],
  row: Record<string, any> | undefined,
  uploadedFiles: any[],
) {
  if (!Array.isArray(components)) return components;

  return components.map((comp: any) => {
    if (!comp || typeof comp !== "object") return comp;

    const processedComp = { ...comp };

    // Procesar cada propiedad que está en formato {source, value}
    // y extraer el valor real
    Object.keys(processedComp).forEach((prop) => {
      // Ignorar type y propiedades estructurales
      if (prop === "type") {
        return;
      }

      const propValue = processedComp[prop];

      // Si la propiedad está en formato {source, value}, procesarla
      if (
        propValue &&
        typeof propValue === "object" &&
        "source" in propValue &&
        "value" in propValue
      ) {
        const { source, value } = propValue;

        // Si es CSV y hay row, resolver la columna
        if (source === "csv" && row) {
          if (Array.isArray(value)) {
            // Si el valor es un array, mapear cada elemento
            const resolved = value.map((item) => {
              if (typeof item === "string" && row[item] !== undefined) {
                return row[item];
              }
              return item;
            });
            processedComp[prop] = resolved;
          } else if (typeof value === "string" && row[value] !== undefined) {
            // Si el valor es string y existe como columna en el CSV, resolverlo
            // Para choices, mantenerlo como array (requerido por jsPsych)
            const resolvedValue = row[value];
            if (prop === "choices") {
              processedComp[prop] = [resolvedValue];
            } else {
              processedComp[prop] = resolvedValue;
            }
          } else if (typeof value === "string") {
            // Si el valor es string pero no existe en row
            console.warn(
              `CSV source for ${prop} but column "${value}" not found in row`,
            );
            if (prop === "choices") {
              processedComp[prop] = [value];
            }
          }
        } else if (source === "typed") {
          // Si es typed, usar el valor directamente
          processedComp[prop] = value;
        }
      }
    });

    // Eliminar button_html si es undefined o null para no contaminar el objeto
    if ("button_html" in processedComp) {
      if (
        processedComp.button_html === undefined ||
        processedComp.button_html === null
      ) {
        delete processedComp.button_html;
      }
      // Si es función o string, dejarla como está - stringifyWithFunctions la manejará
    }

    // Luego, mapear archivos multimedia en componentes (stimulus, src, etc.)
    // IMPORTANTE: Esto debe ejecutarse DESPUÉS de resolver columnas CSV
    // Detectar propiedades que pueden contener rutas de archivos
    const mediaProperties = [
      "stimulus",
      "src",
      "source",
      "audio",
      "video",
      "image",
    ];

    if (uploadedFiles.length > 0) {
      mediaProperties.forEach((prop) => {
        if (prop in processedComp) {
          const value = processedComp[prop];
          const mappedValue = mapFileToUrl(value, uploadedFiles);

          // VideoComponent requiere que stimulus sea un array
          // Si el componente es VideoComponent y stimulus es string, convertir a array
          if (
            comp.type === "VideoComponent" &&
            prop === "stimulus" &&
            typeof mappedValue === "string"
          ) {
            processedComp[prop] = [mappedValue];
          } else {
            processedComp[prop] = mappedValue;
          }
        }
      });
    }

    return processedComp;
  });
}
