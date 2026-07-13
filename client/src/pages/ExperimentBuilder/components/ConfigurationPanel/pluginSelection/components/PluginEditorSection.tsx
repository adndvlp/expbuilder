import Switch from "react-switch";
import PluginEditor from "../../../PluginEditor";

interface Props {
  isCustomPlugin: boolean;
  metadata404: boolean;
  metadataError: string;
  pluginEditor: boolean;
  selectedId: string;
  setPluginEditor: (checked: boolean) => void;
}

export default function PluginEditorSection(props: Props) {
  if (props.selectedId === "new-plugin") {
    return <PluginEditor selectedPluginName={props.selectedId} />;
  }
  if (!props.isCustomPlugin) return null;

  return (
    <div>
      <div style={rowStyle}>
        <Switch
          checked={props.pluginEditor}
          onChange={props.setPluginEditor}
          disabled={props.metadata404}
          onColor="#f1c40f"
          onHandleColor="#ffffff"
          handleDiameter={24}
          uncheckedIcon={false}
          checkedIcon={false}
          height={20}
          width={44}
        />
        <label
          style={{
            margin: 0,
            fontWeight: 500,
            color: props.metadata404 ? "#999" : "var(--text-dark)",
          }}
        >
          Edit Plugin
        </label>
      </div>
      {props.metadataError && (
        <span style={errorStyle}>⚠️ {props.metadataError}</span>
      )}
      {(props.pluginEditor || props.metadataError) && (
        <PluginEditor selectedPluginName={props.selectedId} />
      )}
    </div>
  );
}

const rowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  marginTop: "16px",
  marginBottom: "8px",
};
const errorStyle = { color: "#960909ff", marginLeft: 12, fontWeight: 600 };
