import { JSPSYCH_PARAMS, isBuilderUsed } from "../config";
import { EditorTheme } from "../editorConfig";

type Props = {
  activeParam: string;
  setActiveParam: (key: string) => void;
  paramHasCode: (key: string) => boolean;
  isLightMode: boolean;
  theme: EditorTheme;
};

export default function InitParamTabs({
  activeParam,
  setActiveParam,
  paramHasCode,
  isLightMode,
  theme,
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        background: theme.tabBg,
        borderBottom: `1px solid ${isLightMode ? "#ddd" : "#1e1e1e"}`,
        overflowX: "auto",
        flexShrink: 0,
      }}
    >
      {JSPSYCH_PARAMS.map((param) => {
        const isActive = param.key === activeParam;
        const hasCode = paramHasCode(param.key);
        const isBuilder =
          isBuilderUsed(param, "local") || isBuilderUsed(param, "public");
        return (
          <button
            key={param.key}
            type="button"
            onClick={() => setActiveParam(param.key)}
            title={param.description}
            style={{
              padding: "7px 14px",
              border: "none",
              borderTop: isActive
                ? `2px solid ${isBuilder ? "#f59e0b" : "#3d92b4"}`
                : "2px solid transparent",
              borderRight: `1px solid ${isLightMode ? "#ddd" : "#1e1e1e"}`,
              background: isActive ? theme.activeTabBg : "transparent",
              color: isActive
                ? isLightMode
                  ? "#222"
                  : "#ccc"
                : isLightMode
                  ? "#666"
                  : "#888",
              fontSize: 11,
              fontWeight: isActive ? 600 : 400,
              cursor: "pointer",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {param.key}
            {hasCode && (
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "#3d92b4",
                  display: "inline-block",
                }}
              />
            )}
            {isBuilder && (
              <span
                style={{
                  fontSize: 9,
                  color: "#f59e0b",
                  fontWeight: 700,
                  marginLeft: 2,
                }}
              >
                bld
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
