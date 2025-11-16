import React, { useState } from "react";
import KonvaTrialDesigner from "./KonvaTrialDesigner";
import { BiEdit } from "react-icons/bi";

interface VisualTrialDesignerProps {
  onConfigChange: (config: any) => void;
  initialConfig?: any;
  parameters: any[];
  columnMapping: Record<string, any>;
  setColumnMapping: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  csvColumns: string[];
  pluginName: string;
}

/**
 * VisualTrialDesigner
 *
 * Component for designing jsPsych trials visually with Konva canvas.
 * Allows drag-and-drop of stimulus and response components.
 */
const VisualTrialDesigner: React.FC<VisualTrialDesignerProps> = ({
  onConfigChange,
  initialConfig,
  parameters,
  columnMapping,
  setColumnMapping,
  csvColumns,
  pluginName,
}) => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<any>(
    initialConfig || null
  );

  const handleOpenEditor = () => {
    setIsEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
  };

  const handleConfigChange = (config: any) => {
    setCurrentConfig(config);
    onConfigChange(config);
  };

  return (
    <div className="mb-4 p-4 border rounded bg-blue-50">
      <h4 className="mb-3 text-center font-semibold">Visual Trial Designer</h4>

      <div className="text-sm text-gray-600 mb-3">
        <p>Design your trial visually by dragging and dropping components:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>
            <strong>Stimulus Components:</strong> Image, Video, Audio, HTML
          </li>
          <li>
            <strong>Response Components:</strong> Button, Keyboard, Slider
          </li>
        </ul>
      </div>

      {currentConfig && (
        <div className="mb-3 p-3 bg-white rounded border">
          <h5 className="font-semibold mb-2">Current Configuration:</h5>
          <pre className="text-xs overflow-auto max-h-40 bg-gray-50 p-2 rounded">
            {JSON.stringify(currentConfig, null, 2)}
          </pre>
        </div>
      )}

      <button
        type="button"
        onClick={handleOpenEditor}
        className="w-full px-4 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center justify-center gap-2 transition-colors font-medium"
      >
        <BiEdit size={20} />
        {currentConfig ? "Edit Trial Design" : "Open Visual Designer"}
      </button>

      <KonvaTrialDesigner
        isOpen={isEditorOpen}
        onClose={handleCloseEditor}
        onSave={handleConfigChange}
        initialConfig={currentConfig}
        parameters={parameters}
        columnMapping={columnMapping}
        setColumnMapping={setColumnMapping}
        csvColumns={csvColumns}
        pluginName={pluginName}
      />
    </div>
  );
};

export default VisualTrialDesigner;
