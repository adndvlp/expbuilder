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

      // Crear el modelo de la encuesta (forzar recreación para aplicar nuevos temas)
      const model = new Model(surveyJson);

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
