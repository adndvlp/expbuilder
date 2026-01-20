// Survey Preview - Renderiza el preview en tiempo real con survey-core
import React, { useEffect, useState } from "react";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import "survey-core/survey-core.min.css";

interface SurveyPreviewProps {
  surveyJson: Record<string, unknown>;
}

const SurveyPreview: React.FC<SurveyPreviewProps> = ({ surveyJson }) => {
  const [survey, setSurvey] = useState<Model | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      // Validar que haya al menos estructura básica
      if (!surveyJson || Object.keys(surveyJson).length === 0) {
        setSurvey(null);
        setError(null);
        return;
      }

      // Sanitizar el JSON antes de crear el modelo para evitar valores nulos
      // (por ejemplo rateValues === null causa errores en survey-core)
      const sanitizeSurveyJson = (input: Record<string, unknown>) => {
        const copy = JSON.parse(JSON.stringify(input));

        if (Array.isArray(copy.elements)) {
          copy.elements = copy.elements.map((el: Record<string, unknown>) => {
            // Normalizar rateValues para preguntas de tipo 'rating'
            if (el && el.type === "rating") {
              if (el.rateValues == null) {
                // si es null o undefined -> dejar como arreglo vacío
                el.rateValues = [];
              } else if (!Array.isArray(el.rateValues)) {
                el.rateValues = [];
              } else {
                // asegurar que cada rateValue tenga value y text y filtrar vacíos
                el.rateValues = el.rateValues
                  .map((rv: Record<string, unknown> | null) => {
                    if (rv == null) return null;
                    const rvRecord = rv as Record<string, unknown>;
                    const text =
                      rvRecord["text"] != null
                        ? String(rvRecord["text"])
                        : String(rvRecord["value"] ?? "");
                    const value =
                      rvRecord["value"] != null
                        ? String(rvRecord["value"])
                        : text;
                    // Filtrar entradas con text vacío
                    if (!text.trim()) return null;
                    return { value, text };
                  })
                  .filter((rv) => rv !== null);
              }

              // Si hay rateValues personalizados, remover rateMin/rateMax para evitar conflictos
              if (Array.isArray(el.rateValues) && el.rateValues.length > 0) {
                delete el.rateMin;
                delete el.rateMax;
              } else {
                // Si no hay rateValues, asegurar que rateMin y rateMax existan
                if (el.rateMin == null) el.rateMin = 1;
                if (el.rateMax == null) el.rateMax = 5;
              }
            }

            // Asegurar choices es un arreglo cuando existe
            if (
              el &&
              (el.type === "radiogroup" ||
                el.type === "checkbox" ||
                el.type === "dropdown" ||
                el.type === "imagepicker")
            ) {
              if (el.choices == null) {
                el.choices = [];
              } else if (!Array.isArray(el.choices)) {
                el.choices = [];
              } else {
                // normalizar choices que sean strings -> objetos con value/text
                el.choices = el.choices.map(
                  (c: string | Record<string, unknown>) => {
                    if (typeof c === "string") return { value: c, text: c };
                    // si es objeto, al menos garantizar text y value
                    const cRecord = c as Record<string, unknown>;
                    const text =
                      cRecord["text"] != null
                        ? String(cRecord["text"])
                        : String(cRecord["value"] ?? "");
                    const value =
                      cRecord["value"] != null
                        ? String(cRecord["value"])
                        : text;
                    if (cRecord["imageLink"] != null)
                      return {
                        value,
                        text,
                        imageLink: String(cRecord["imageLink"]),
                      };
                    return { value, text };
                  }
                );
              }
            }

            return el;
          });
        }

        return copy;
      };

      const sanitized = sanitizeSurveyJson(
        surveyJson as Record<string, unknown>
      );

      // Crear el modelo de la encuesta (forzar recreación para aplicar nuevos temas)
      const model = new Model(sanitized);

      // Modo de visualización (no guarda respuestas)
      model.mode = "display";

      // Aplicar tema personalizado del usuario
      const customTheme =
        (surveyJson.themeVariables as Record<string, string>) || {};

      if (Object.keys(customTheme).length > 0) {
        model.applyTheme({
          cssVariables: customTheme,
          themeName: "plain",
          colorPalette: "light",
          isPanelless: false,
        });
      }

      setSurvey(model);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid survey JSON");
      setSurvey(null);
    }
  }, [surveyJson]);

  if (error) {
    return (
      <div
        style={{
          padding: "24px",
          textAlign: "center",
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: "8px",
          color: "#dc2626",
        }}
      >
        <strong>Preview Error:</strong> {error}
      </div>
    );
  }

  if (!survey) {
    return (
      <div
        style={{
          padding: "48px",
          textAlign: "center",
          background: "var(--neutral-light)",
          border: "2px dashed #d1d5db",
          borderRadius: "8px",
          color: "var(--text-dark)",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
        <div style={{ fontSize: "16px", fontWeight: 500, marginBottom: "8px" }}>
          Preview Area
        </div>
        <div style={{ fontSize: "14px" }}>
          Your survey will appear here as you build it
        </div>
      </div>
    );
  }

  return (
    <div>
      <Survey
        key={JSON.stringify(surveyJson.themeVariables || {})}
        model={survey}
      />
    </div>
  );
};

export default SurveyPreview;
