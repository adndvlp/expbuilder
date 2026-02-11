import { ColumnMapping, ColumnMappingEntry } from "../../types";
import { mapFileToUrl } from "../../../../utils/mapFileToUrl";

type Props = {
  isInLoop: boolean | undefined;
  uploadedFiles: any[];
  pluginName: string;
  columnMapping: ColumnMapping;
  getColumnValue: (
    mapping: ColumnMappingEntry | undefined,
    row?: Record<string, any>,
    defaultValue?: any,
    key?: string,
  ) => any;
  trialNameSanitized: string;
  activeParameters: any[];
  csvJson: any[];
  parameters: any[];
};

export default function MappedJson({
  isInLoop,
  uploadedFiles,
  pluginName,
  columnMapping,
  trialNameSanitized,
  activeParameters,
  csvJson,
  parameters,
  getColumnValue,
}: Props) {
  const safeCsvJson = csvJson || [];
  const mappedJson = (() => {
    const mapRow = (row?: Record<string, any>) => {
      const result: Record<string, any> = {};

      // Lógica especial para DynamicPlugin
      if (pluginName === "plugin-dynamic") {
        // Para DynamicPlugin, extraer components y responses desde columnMapping
        // Cuando hay CSV y el source es "typed", necesitamos replicar los valores typed en todas las filas
        const componentsMapping = columnMapping["components"];
        const responsesMapping = columnMapping["response_components"]; // ¡Corregido! Era "responses" pero el key correcto es "response_components"

        // Obtener valores base (typed o csv)
        let componentsValue = getColumnValue(
          componentsMapping,
          row,
          undefined,
          "components",
        );
        let responsesValue = getColumnValue(
          responsesMapping,
          row,
          undefined,
          "response_components",
        );

        // Si hay CSV pero el mapping es typed, usar directamente el valor typed
        if (row && componentsMapping?.source === "typed") {
          componentsValue = componentsMapping.value;
        }
        if (row && responsesMapping?.source === "typed") {
          responsesValue = responsesMapping.value;
        }

        // Helper para procesar componentes - remover valores undefined/null y mapear archivos
        const processComponentFunctions = (components: any[]) => {
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
                  } else if (
                    typeof value === "string" &&
                    row[value] !== undefined
                  ) {
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
        };

        const prefixedComponents = isInLoop
          ? `components_${trialNameSanitized}`
          : "components";
        const prefixedResponseComponents = isInLoop
          ? `response_components_${trialNameSanitized}`
          : "response_components";

        result[prefixedComponents] = processComponentFunctions(
          componentsValue || [],
        );
        result[prefixedResponseComponents] = processComponentFunctions(
          responsesValue || [],
        );

        // Procesar response_components (also needs component processing)
        const responseComponentsMapping = columnMapping["response_components"];
        if (responseComponentsMapping) {
          const prefixedResponseComponents = isInLoop
            ? `response_components_${trialNameSanitized}`
            : "response_components";

          // Get the raw value
          let responseComponentsValue;
          if (row && responseComponentsMapping.source === "typed") {
            responseComponentsValue = responseComponentsMapping.value;
          } else {
            responseComponentsValue = getColumnValue(
              responseComponentsMapping,
              row,
              undefined,
              "response_components",
            );
          }

          // Process through processComponentFunctions if it's an array of components
          if (Array.isArray(responseComponentsValue)) {
            result[prefixedResponseComponents] = processComponentFunctions(
              responseComponentsValue,
            );
          } else {
            result[prefixedResponseComponents] = responseComponentsValue;
          }
        }

        // Procesar otros parámetros del DynamicPlugin (excluding response_components)
        const additionalDynamicParams = [
          "stimuli_duration",
          "trial_duration",
          "response_ends_trial",
        ];

        additionalDynamicParams.forEach((paramKey) => {
          const paramMapping = columnMapping[paramKey];
          // Solo agregar si existe mapping Y no es source='none'
          if (paramMapping && paramMapping.source !== "none") {
            const prefixedKey = isInLoop
              ? `${paramKey}_${trialNameSanitized}`
              : paramKey;

            // Si hay CSV pero el mapping es typed, usar directamente el valor typed
            if (row && paramMapping.source === "typed") {
              result[prefixedKey] = paramMapping.value;
            } else {
              // Obtener el valor normalmente (de CSV o typed)
              result[prefixedKey] = getColumnValue(
                paramMapping,
                row,
                undefined,
                paramKey,
              );
            }
          }
        });

        return result;
      }

      // Lógica normal para otros plugins
      activeParameters.forEach((param) => {
        const { key } = param;
        const prefixedkey = isInLoop ? `${key}_${trialNameSanitized}` : key;

        // Solo procesar si existe mapping Y no es source='none'
        const mapping = columnMapping[key];
        if (!mapping || mapping.source === "none") {
          return; // Skip this parameter
        }

        // Detectar si es un parámetro de archivos multimedia
        const isMediaParameter = (key: string | undefined) => {
          if (typeof key !== "string") return false;
          const keyLower = key.toLowerCase();
          return (
            keyLower.includes("img") ||
            keyLower.includes("image") ||
            keyLower.includes("stimulus") ||
            keyLower.includes("audio") ||
            keyLower.includes("video") ||
            keyLower.includes("sound") ||
            keyLower.includes("media")
          );
        };

        if (isMediaParameter(key) && uploadedFiles.length > 0) {
          // Obtener el valor del columnMapping
          const value =
            row && row[key] !== undefined
              ? row[key]
              : getColumnValue(columnMapping[key], row, undefined, key);

          // Usar el helper mapFileToUrl para mapear archivos
          let mappedValue = mapFileToUrl(value, uploadedFiles);

          // Los plugins de video de jsPsych requieren que stimulus sea un array
          // Detectar si es un plugin de video y convertir string a array si es necesario
          const isVideoPlugin =
            pluginName.toLowerCase().includes("video") ||
            key.toLowerCase().includes("video");

          if (
            isVideoPlugin &&
            key === "stimulus" &&
            typeof mappedValue === "string"
          ) {
            mappedValue = [mappedValue];
          }

          result[prefixedkey] = mappedValue;
        } else {
          // Parámetro normal, sin procesamiento de archivos
          result[prefixedkey] = getColumnValue(
            columnMapping[key],
            row,
            undefined,
            key,
          );
        }
      });

      return result;
    };

    if (safeCsvJson.length > 0) {
      return safeCsvJson.map((row) => mapRow(row));
    } else {
      // Verificar si hay múltiples archivos separados por comas en algún parámetro
      const multipleInputsParams: { [key: string]: string[] } = {};
      let hasMultipleInputs = false;

      activeParameters.forEach((param) => {
        // Para valores con comas (múltiples archivos)
        const value = getColumnValue(
          columnMapping[param.key],
          undefined,
          undefined,
          param.key,
        );
        // Solo dividir si NO es html_string
        const paramType = parameters.find((p) => p.key === param.key)?.type;
        if (
          typeof value === "string" &&
          value.includes(",") &&
          paramType !== "html_string"
        ) {
          const values = value
            .split(",")
            .map((v) => v.trim())
            .filter((v) => v.length > 0);
          multipleInputsParams[param.key] = values;
          hasMultipleInputs = true;
        }
      });

      if (hasMultipleInputs) {
        // Encontrar el parámetro con más elementos para determinar el número de trials
        let maxTrials = 1;
        Object.values(multipleInputsParams).forEach((values) => {
          maxTrials = Math.max(maxTrials, values.length);
        });

        // Generar un trial por cada archivo detectado en el input
        return Array.from({ length: maxTrials }, (_, idx) => {
          const mockRow: Record<string, any> = {};

          // Para cada parámetro con múltiples inputs, usar solo el valor correspondiente al índice actual
          Object.keys(multipleInputsParams).forEach((key) => {
            const values = multipleInputsParams[key];
            // Usar solo UN archivo por trial
            mockRow[key] = values[idx] || values[values.length - 1];
          });

          // Para parámetros que no tienen múltiples inputs, usar el valor normal
          activeParameters.forEach((param) => {
            if (!multipleInputsParams[param.key]) {
              const value = getColumnValue(
                columnMapping[param.key],
                undefined,
                undefined,
                param.key,
              );
              if (value !== undefined) {
                mockRow[param.key] = value;
              }
            }
          });

          return mapRow(mockRow);
        });
      } else {
        // Si no hay múltiples inputs, generar un solo trial
        return [mapRow()];
      }
    }
  })();
  return { mappedJson };
}
