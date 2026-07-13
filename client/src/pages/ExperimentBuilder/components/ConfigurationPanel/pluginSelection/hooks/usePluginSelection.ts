import { useEffect, useState } from "react";
import usePlugins from "../../../../hooks/usePlugins";
import { fetchPluginList, hasPluginMetadata } from "../services/pluginMetadata";
import type {
  PluginOption,
  PluginSelectionHookArgs,
  PluginSelectionViewModel,
} from "../types";
import {
  buildPluginOptions,
  getWebgazerPlugins,
  nextPluginName,
} from "../utils/pluginOptions";

export function usePluginSelection({
  selectedTrial,
  updateTrial,
}: PluginSelectionHookArgs): PluginSelectionViewModel {
  const [selectedId, setSelectedId] = useState("plugin-dynamic");
  const [pluginList, setPluginList] = useState<string[]>([]);
  const [pluginEditor, setPluginEditor] = useState(false);
  const [metadata404, setMetadata404] = useState(false);
  const [useJsPsychPlugins, setUseJsPsychPlugins] = useState(false);
  const { isSaving, plugins, metadataError, setPlugins, setMetadataError } =
    usePlugins();

  useEffect(() => {
    if (isSaving) return;
    void fetchPluginList()
      .then(setPluginList)
      .catch((error) =>
        setMetadataError(`Could not load plugin list: ${error}`),
      );
  }, [isSaving]);

  useEffect(() => {
    if (!selectedTrial?.plugin) {
      setSelectedId("plugin-dynamic");
      setUseJsPsychPlugins(false);
      setMetadataError("");
      setMetadata404(false);
      return;
    }
    if (isSaving) return;

    const plugin = selectedTrial.plugin;
    setSelectedId(plugin);
    setUseJsPsychPlugins(plugin !== "plugin-dynamic");
    if (plugin === "webgazer" || plugin === "plugin-dynamic") {
      setMetadataError("");
      setMetadata404(false);
      return;
    }

    void hasPluginMetadata(plugin)
      .then((found) => {
        setMetadataError(found ? "" : `No valid info object in ${plugin}`);
        setMetadata404(!found);
      })
      .catch(() => {
        setMetadataError(`No valid info object in ${plugin}`);
        setMetadata404(true);
      });
  }, [selectedTrial, isSaving]);

  const handleSwitchChange = (checked: boolean) => {
    setUseJsPsychPlugins(checked);
    if (!checked && selectedTrial) {
      setSelectedId("plugin-dynamic");
      updateTrial(selectedTrial.id, { plugin: "plugin-dynamic" });
    }
  };

  const handleChange = (option: PluginOption | null) => {
    if (!option || !selectedTrial) return;
    setSelectedId(option.value);
    if (option.value === "new-plugin") {
      const name = nextPluginName(plugins.map((plugin) => plugin.name));
      setPluginEditor(true);
      setPlugins([
        ...plugins,
        {
          name,
          scripTag: `/plugins/${name}.js`,
          pluginCode: "",
          index: plugins.length,
        },
      ]);
      updateTrial(selectedTrial.id, { plugin: name });
      setSelectedId(name);
      return;
    }
    updateTrial(selectedTrial.id, { plugin: option.value });
    setPluginEditor(
      plugins.some((plugin) => plugin.name === option.value) ||
        option.value === "custom",
    );
  };

  return {
    filteredPluginOptions: buildPluginOptions(pluginList, plugins),
    handleChange,
    handleSwitchChange,
    isCustomPlugin: plugins.some((plugin) => plugin.name === selectedId),
    metadata404,
    metadataError,
    pluginEditor,
    selectedId,
    setPluginEditor,
    useJsPsychPlugins,
    webgazerPlugins: getWebgazerPlugins(pluginList),
  };
}
