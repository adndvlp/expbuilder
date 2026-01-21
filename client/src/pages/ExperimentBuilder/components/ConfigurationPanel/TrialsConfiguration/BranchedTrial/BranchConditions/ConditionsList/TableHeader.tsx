import { Condition } from "../../types";

type Props = {
  findTrialById: (trialId: string | number) => any;
  condition: Condition;
};

function TableHeader({ condition, findTrialById }: Props) {
  return (
    <thead>
      <tr
        style={{
          backgroundColor: "rgba(78, 205, 196, 0.15)",
        }}
      >
        <th
          className="px-2 py-2 text-left text-sm font-semibold"
          style={{
            color: "var(--text-dark)",
            borderBottom: "2px solid var(--neutral-mid)",
            minWidth: "300px",
          }}
        >
          Column
        </th>
        <th
          className="px-2 py-2 text-left text-sm font-semibold"
          style={{
            color: "var(--text-dark)",
            borderBottom: "2px solid var(--neutral-mid)",
            minWidth: "80px",
          }}
        >
          Op
        </th>
        <th
          className="px-2 py-2 text-left text-sm font-semibold"
          style={{
            color: "var(--text-dark)",
            borderBottom: "2px solid var(--neutral-mid)",
            minWidth: "150px",
          }}
        >
          Value
        </th>
        <th
          className="px-1 py-2 text-center text-sm font-semibold"
          style={{
            color: "var(--text-dark)",
            borderBottom: "2px solid var(--neutral-mid)",
            minWidth: "50px",
          }}
        ></th>
        <th
          className="px-2 py-2 text-center text-sm font-semibold"
          style={{
            color: "var(--gold)",
            borderBottom: "2px solid var(--neutral-mid)",
            minWidth: "180px",
          }}
        >
          THEN Go To
        </th>
        {(() => {
          const targetTrial = condition.nextTrialId
            ? findTrialById(condition.nextTrialId)
            : null;
          const isTargetDynamic = targetTrial?.plugin === "plugin-dynamic";

          // Check if any parameter requires survey_json (for conditional Question column)
          const hasSurveyJsonParam = condition.customParameters
            ? Object.keys(condition.customParameters).some((key) => {
                if (!key.includes("::")) return false;
                const parts = key.split("::");
                if (parts.length < 3) return false;
                const [fieldType, componentIdx, paramKey] = parts;
                if (paramKey !== "survey_json") return false;

                const compArr =
                  targetTrial?.columnMapping?.[fieldType]?.value || [];
                const comp = compArr.find(
                  (c: any) =>
                    (c.name && typeof c.name === "object" && "value" in c.name
                      ? c.name.value
                      : c.name) === componentIdx,
                );
                return comp?.type === "SurveyComponent";
              })
            : false;

          if (isTargetDynamic) {
            return (
              <>
                <th
                  className="px-2 py-2 text-center text-sm font-semibold"
                  style={{
                    color: "var(--gold)",
                    borderBottom: "2px solid var(--neutral-mid)",
                    minWidth: "150px",
                  }}
                >
                  Field Type
                </th>
                <th
                  className="px-2 py-2 text-center text-sm font-semibold"
                  style={{
                    color: "var(--gold)",
                    borderBottom: "2px solid var(--neutral-mid)",
                    minWidth: "180px",
                  }}
                >
                  Component
                </th>
                <th
                  className="px-2 py-2 text-center text-sm font-semibold"
                  style={{
                    color: "var(--gold)",
                    borderBottom: "2px solid var(--neutral-mid)",
                    minWidth: "150px",
                  }}
                >
                  Property
                </th>
                {hasSurveyJsonParam && (
                  <th
                    className="px-2 py-2 text-center text-sm font-semibold"
                    style={{
                      color: "var(--gold)",
                      borderBottom: "2px solid var(--neutral-mid)",
                      minWidth: "150px",
                    }}
                  >
                    Question
                  </th>
                )}
                <th
                  className="px-2 py-2 text-center text-sm font-semibold"
                  style={{
                    color: "var(--gold)",
                    borderBottom: "2px solid var(--neutral-mid)",
                    minWidth: "200px",
                  }}
                >
                  Value
                </th>
              </>
            );
          } else {
            return (
              <>
                <th
                  className="px-2 py-2 text-center text-sm font-semibold"
                  style={{
                    color: "var(--gold)",
                    borderBottom: "2px solid var(--neutral-mid)",
                    minWidth: "200px",
                  }}
                >
                  Override Params
                </th>
                <th
                  className="px-2 py-2 text-center text-sm font-semibold"
                  style={{
                    color: "var(--gold)",
                    borderBottom: "2px solid var(--neutral-mid)",
                    minWidth: "250px",
                  }}
                >
                  Value
                </th>
              </>
            );
          }
        })()}
      </tr>
    </thead>
  );
}

export default TableHeader;
