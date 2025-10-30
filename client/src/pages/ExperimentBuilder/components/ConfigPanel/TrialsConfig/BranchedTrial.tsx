import { useState, useEffect } from "react";
import useTrials from "../../../hooks/useTrials";
import { TrialOrLoop } from "../types";
import { loadPluginParameters } from "../utils/pluginParameterLoader";

type Props = {};

function BranchedTrial({}: Props) {
  const [isBranched, setIsBranched] = useState<boolean>(false);
  const [selectTrial, setSelectTrial] = useState<TrialOrLoop>();
  const { trials, selectedTrial } = useTrials();

  const [data, setData] = useState<import("../types").DataDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const pluginName =
      selectTrial && "plugin" in selectTrial
        ? (selectTrial as any).plugin
        : undefined;
    if (!pluginName) {
      setData([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    loadPluginParameters(pluginName)
      .then((result) => {
        setData(result.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setData([]);
        setLoading(false);
      });
  }, [selectTrial]);

  return (
    <div className="mb-4 p-4 border rounded bg-gray-50">
      <h5 className="mb-2">Branched Trial</h5>
      <input
        type="checkbox"
        checked={isBranched}
        onChange={(e) => setIsBranched(e.target.checked)}
      ></input>

      {isBranched && (
        <div>
          <select
            value={
              selectTrial && "plugin" in selectTrial
                ? (selectTrial as any).plugin
                : ""
            }
            onChange={(e) => {
              // Flatten all trials (individuales y dentro de loops) que tengan plugin
              const allTrials = [
                ...trials.filter((t) => !("trials" in t) && "plugin" in t),
                ...trials
                  .filter((t) => "trials" in t)
                  .flatMap((loop) => loop.trials)
                  .filter((t) => "plugin" in t),
              ];
              // Find index of selectedTrial
              const selectedIndex = allTrials.findIndex(
                (t) => t.id === selectedTrial?.id
              );
              // Only allow selection of trials before the current one
              const eligibleTrials = allTrials.slice(0, selectedIndex);
              const selected = eligibleTrials.find(
                (t) => (t as any).plugin === e.target.value
              );
              setSelectTrial(selected);
            }}
          >
            <option value="" disabled>
              Select a trial
            </option>
            {/* Only render options for trials before the current one */}
            {(() => {
              const allTrials = [
                ...trials.filter((t) => !("trials" in t) && "plugin" in t),
                ...trials
                  .filter((t) => "trials" in t)
                  .flatMap((loop) => loop.trials)
                  .filter((t) => "plugin" in t),
              ];
              const selectedIndex = allTrials.findIndex(
                (t) => t.id === selectedTrial?.id
              );
              const eligibleTrials = allTrials.slice(0, selectedIndex);
              return eligibleTrials.map((t) => (
                <option key={t.id} value={(t as any).plugin}>
                  {t.name}
                </option>
              ));
            })()}
          </select>

          {/* Render plugin data fields as inputs, do not update any state */}
          <div className="mt-4">
            {loading && <div>Loading data fields...</div>}
            {error && <div className="text-red-500">{error}</div>}
            {!loading &&
              !error &&
              data.map((field: import("../types").DataDefinition) => {
                switch (field.type) {
                  case "number":
                    return (
                      <div key={field.key} className="mb-2">
                        <label className="block text-sm font-medium mb-1">
                          {field.label || field.key}
                        </label>
                        <input
                          type="number"
                          className="border rounded px-2 py-1 w-full"
                          disabled
                        />
                      </div>
                    );
                  case "boolean":
                    return (
                      <div key={field.key} className="mb-2">
                        <label className="block text-sm font-medium mb-1">
                          {field.label || field.key}
                        </label>
                        <input type="checkbox" className="mr-2" disabled />
                      </div>
                    );
                  case "string":
                  case "html_string":
                    return (
                      <div key={field.key} className="mb-2">
                        <label className="block text-sm font-medium mb-1">
                          {field.label || field.key}
                        </label>
                        <input
                          type="text"
                          className="border rounded px-2 py-1 w-full"
                          disabled
                        />
                      </div>
                    );
                  default:
                    return (
                      <div key={field.key} className="mb-2">
                        <label className="block text-sm font-medium mb-1">
                          {field.label || field.key}
                        </label>
                        <input
                          type="text"
                          className="border rounded px-2 py-1 w-full"
                          disabled
                        />
                      </div>
                    );
                }
              })}
          </div>
        </div>
      )}
    </div>
  );
}

export default BranchedTrial;
