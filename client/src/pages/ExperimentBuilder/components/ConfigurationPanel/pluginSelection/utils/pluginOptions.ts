import type { PluginOption } from "../types";

interface UserPlugin {
  name: string;
}

const labelFor = (value: string) =>
  value.replace(/^plugin-/, "").replace(/-/g, " ");

export function getWebgazerPlugins(pluginList: string[]): string[] {
  return pluginList.filter((plugin) => /plugin-webgazer/i.test(plugin));
}

export function buildPluginOptions(
  pluginList: string[],
  plugins: UserPlugin[],
): PluginOption[] {
  const backendPlugins = Array.from(
    new Set([
      ...pluginList
        .filter(
          (plugin) =>
            !plugins.some((item) => item.name === plugin) &&
            plugin !== "plugin-dynamic",
        )
        .map((plugin) =>
          /plugin-webgazer/i.test(plugin) ? "webgazer" : plugin,
        ),
      ...plugins
        .filter((plugin) => /plugin-webgazer/i.test(plugin.name))
        .map(() => "webgazer"),
    ]),
  );

  return [
    ...backendPlugins
      .filter((plugin) => !plugins.some((item) => item.name === plugin))
      .map((value) => ({ value, label: labelFor(value) })),
    ...plugins.map(({ name }) => ({ value: name, label: labelFor(name) })),
    { value: "new-plugin", label: "Create plugin" },
  ];
}

export function nextPluginName(names: string[]): string {
  let next = 1;
  while (names.includes(String(next))) next += 1;
  return String(next);
}
