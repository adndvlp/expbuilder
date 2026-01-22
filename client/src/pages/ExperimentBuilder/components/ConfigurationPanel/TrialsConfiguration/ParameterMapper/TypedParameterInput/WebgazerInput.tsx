import { Dispatch, SetStateAction } from "react";
import { ColumnMappingEntry } from "..";

type Props = {
  localInputValues: Record<string, string>;
  setLocalInputValues: Dispatch<SetStateAction<Record<string, string>>>;
  label: string;
  paramKey: string;
  entry: ColumnMappingEntry;
  onSave?: ((key: string, value: any) => void) | undefined;
  setColumnMapping: Dispatch<
    SetStateAction<Record<string, ColumnMappingEntry>>
  >;
};

function WebgazerInput({
  localInputValues,
  setLocalInputValues,
  label,
  paramKey,
  entry,
  onSave,
  setColumnMapping,
}: Props) {
  return (
    <input
      type="text"
      className="w-full p-2 border rounded mt-2"
      placeholder={`Escribe ${label.toLowerCase()}`}
      // 2. El valor del input es el texto temporal si existe,
      //    o el valor del estado principal formateado si no.
      value={
        localInputValues[paramKey] ?? // El operador '??' es clave aquí
        (Array.isArray(entry.value)
          ? JSON.stringify(entry.value)
              // .slice(1, -1)
              .replace(/],\[/g, "], [")
          : "")
      }
      onChange={(e) => {
        // 3. onChange actualiza el estado de texto TEMPORAL.
        setLocalInputValues((prev) => ({
          ...prev,
          [paramKey]: e.target.value,
        }));
      }}
      onBlur={() => {
        // 4. onBlur lee el texto temporal, lo procesa y actualiza el estado PRINCIPAL.
        const input = localInputValues[paramKey];

        // Si no hay nada en el estado local, no hagas nada.
        if (input === undefined) return;

        if (input.trim() === "") {
          const newValue = {
            source: "typed" as const,
            value: [],
          };
          setColumnMapping((prev) => ({
            ...prev,
            [paramKey]: newValue,
          }));
          if (onSave) {
            setTimeout(() => onSave(paramKey, newValue), 100);
          }
          return;
        }

        let finalValue;
        try {
          // Si el usuario ya puso los corchetes exteriores
          finalValue = JSON.parse(input.trim());
          const newValue = {
            source: "typed" as const,
            value: finalValue,
          };
          setColumnMapping((prev) => ({
            ...prev,
            [paramKey]: newValue,
          }));
          if (onSave) {
            setTimeout(() => onSave(paramKey, newValue), 100);
          }
        } catch {
          try {
            finalValue = JSON.parse(`[${input.trim()}]`);
            const newValue = {
              source: "typed" as const,
              value: finalValue,
            };
            setColumnMapping((prev) => ({
              ...prev,
              [paramKey]: newValue,
            }));
            if (onSave) {
              setTimeout(() => onSave(paramKey, newValue), 100);
            }
            // Limpia el valor temporal después de un guardado exitoso
            setLocalInputValues((prev) => {
              const newState = { ...prev };
              delete newState[paramKey];
              return newState;
            });
          } catch (error) {
            console.error("Input format error:", error);
            // No actualices si hay error, el texto incorrecto
            // permanecerá en el input para que el usuario lo corrija.
          }
        }
      }}
    />
  );
}

export default WebgazerInput;
