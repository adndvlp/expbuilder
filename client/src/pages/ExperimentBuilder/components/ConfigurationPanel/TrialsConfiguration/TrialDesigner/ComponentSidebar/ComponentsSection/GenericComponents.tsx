import { ComponentType } from "../../types";

type Props = {
  addComponent: (type: ComponentType) => void;
  type: ComponentType;
  label: string;
};

function GenericComponents({ addComponent, type, label }: Props) {
  return (
    <button
      onClick={() => addComponent(type)}
      style={{
        width: "100%",
        padding: "12px 16px",
        border: "2px solid #d1d5db",
        borderRadius: "8px",
        background: "white",
        cursor: "pointer",
        textAlign: "left",
        fontSize: "15px",
        fontWeight: 600,
        color: "#374151",
        transition: "all 0.2s",
        marginBottom: "10px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.background = "#f3f4f6";
        e.currentTarget.style.borderColor = "#9ca3af";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = "white";
        e.currentTarget.style.borderColor = "#d1d5db";
      }}
    >
      {label}
    </button>
  );
}

export default GenericComponents;
