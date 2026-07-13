import Switch from "react-switch";
import type { Loop, LoopCondition } from "../../../types";
import ConditionalLoop from "../ConditionalLoop";

interface Props {
  conditions: LoopCondition[];
  isConditional: boolean;
  loop?: Loop;
  onSaveConditions: (conditions: LoopCondition[]) => void;
  saveField: (field: string, value: unknown) => void;
  setConditions: (conditions: LoopCondition[]) => void;
  setIsConditional: (value: boolean) => void;
  setShowModal: (value: boolean) => void;
  showModal: boolean;
  showSaveIndicator: (field?: string) => void;
  updateLoop: (id: string | number, changes: Partial<Loop>) => Promise<unknown>;
}

export default function LoopConditionsSection(props: Props) {
  const toggle = (checked: boolean) => {
    props.setIsConditional(checked);
    if (!checked) {
      props.setConditions([]);
      if (props.loop) {
        void props
          .updateLoop(props.loop.id, {
            isConditionalLoop: false,
            loopConditions: [],
          })
          .then(() => props.showSaveIndicator("loop conditions"));
      }
    } else {
      props.saveField("isConditionalLoop", checked);
    }
  };

  return (
    <>
      <div className="mb-2 p-4 border rounded bg-gray-50">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-bold mb-1">Loop Conditions</div>
            <p className="text-sm text-gray-600">
              Make this loop repeat based on trial data
            </p>
          </div>
          <Switch
            checked={props.isConditional}
            onChange={toggle}
            onColor="#f1c40f"
            onHandleColor="#ffffff"
            handleDiameter={24}
            uncheckedIcon={false}
            checkedIcon={false}
            height={20}
            width={44}
          />
        </div>
        {props.isConditional && (
          <div className="mt-3">
            <button
              onClick={() => props.setShowModal(true)}
              className="w-full p-3 rounded font-medium transition"
              style={{
                background:
                  "linear-gradient(135deg, var(--primary-blue), var(--light-blue))",
                color: "var(--text-light)",
              }}
            >
              {props.conditions.length > 0
                ? `Edit Loop Conditions (${props.conditions.length})`
                : "Configure Loop Conditions"}
            </button>
            {props.conditions.length > 0 && (
              <div className="mt-2 text-sm text-gray-600">
                <strong>Active conditions:</strong> {props.conditions.length}{" "}
                condition(s) configured
              </div>
            )}
          </div>
        )}
      </div>
      {props.showModal && props.loop && (
        <div
          style={modalOverlayStyle}
          onClick={() => props.setShowModal(false)}
        >
          <div onClick={(event) => event.stopPropagation()}>
            <ConditionalLoop
              loop={props.loop as any}
              onClose={() => props.setShowModal(false)}
              onSave={props.onSaveConditions}
            />
          </div>
        </div>
      )}
    </>
  );
}

const modalOverlayStyle = {
  position: "fixed" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
};
