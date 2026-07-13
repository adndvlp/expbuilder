interface Props {
  currentTrialExists: boolean;
  hasDynamicTrial: boolean;
  hasSurveyJsonParam: boolean;
}

export default function RulesTableHeader({
  currentTrialExists,
  hasDynamicTrial,
  hasSurveyJsonParam,
}: Props) {
  const hasDynamicTrialInRules = hasDynamicTrial;
  const currentTrial = currentTrialExists;
  return (
    <thead>
      <tr
        style={{
          backgroundColor: "rgba(255, 209, 102, 0.15)",
        }}
      >
        <th
          className="px-2 py-2 text-left text-sm font-semibold"
          style={{
            color: "var(--text-dark)",
            borderBottom: "2px solid var(--neutral-mid)",
            width: "15%",
            minWidth: "180px",
          }}
        >
          From Trial
        </th>
        {hasDynamicTrialInRules ? (
          <>
            <th
              className="px-2 py-2 text-left text-sm font-semibold"
              style={{
                color: "var(--text-dark)",
                borderBottom: "2px solid var(--neutral-mid)",
                width: "12%",
                minWidth: "120px",
              }}
            >
              Field Type
            </th>
            <th
              className="px-2 py-2 text-left text-sm font-semibold"
              style={{
                color: "var(--text-dark)",
                borderBottom: "2px solid var(--neutral-mid)",
                width: "15%",
                minWidth: "150px",
              }}
            >
              Component
            </th>
            <th
              className="px-2 py-2 text-left text-sm font-semibold"
              style={{
                color: "var(--text-dark)",
                borderBottom: "2px solid var(--neutral-mid)",
                width: "15%",
                minWidth: "150px",
              }}
            >
              Property
            </th>
          </>
        ) : (
          <th
            className="px-2 py-2 text-left text-sm font-semibold"
            style={{
              color: "var(--text-dark)",
              borderBottom: "2px solid var(--neutral-mid)",
              width: "18%",
              minWidth: "200px",
            }}
          >
            Data Field
          </th>
        )}
        <th
          className="px-2 py-2 text-left text-sm font-semibold"
          style={{
            color: "var(--text-dark)",
            borderBottom: "2px solid var(--neutral-mid)",
            width: "10%",
            minWidth: "100px",
          }}
        >
          Operator
        </th>
        <th
          className="px-2 py-2 text-left text-sm font-semibold"
          style={{
            color: "var(--text-dark)",
            borderBottom: "2px solid var(--neutral-mid)",
            width: "15%",
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
            width: "5%",
            minWidth: "50px",
          }}
        ></th>
        {currentTrial ? (
          <>
            <th
              className="px-2 py-2 text-center text-sm font-semibold"
              style={{
                color: "var(--gold)",
                borderBottom: "2px solid var(--neutral-mid)",
                borderLeft: "2px solid var(--gold)",
                backgroundColor: "rgba(255, 209, 102, 0.1)",
                width: "12%",
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
                backgroundColor: "rgba(255, 209, 102, 0.1)",
                width: "12%",
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
                backgroundColor: "rgba(255, 209, 102, 0.1)",
                width: "12%",
                minWidth: "150px",
              }}
            >
              Parameter
            </th>
            {hasSurveyJsonParam && (
              <th
                className="px-2 py-2 text-center text-sm font-semibold"
                style={{
                  color: "var(--gold)",
                  borderBottom: "2px solid var(--neutral-mid)",
                  backgroundColor: "rgba(255, 209, 102, 0.1)",
                  width: "12%",
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
                backgroundColor: "rgba(255, 209, 102, 0.1)",
                width: "12%",
                minWidth: "200px",
              }}
            >
              Value
            </th>
          </>
        ) : (
          <>
            <th
              className="px-2 py-2 text-center text-sm font-semibold"
              style={{
                color: "var(--gold)",
                borderBottom: "2px solid var(--neutral-mid)",
                borderLeft: "2px solid var(--gold)",
                backgroundColor: "rgba(255, 209, 102, 0.1)",
                width: "15%",
                minWidth: "200px",
              }}
            >
              Override Param
            </th>
            <th
              className="px-2 py-2 text-center text-sm font-semibold"
              style={{
                color: "var(--gold)",
                borderBottom: "2px solid var(--neutral-mid)",
                backgroundColor: "rgba(255, 209, 102, 0.1)",
                width: "15%",
                minWidth: "250px",
              }}
            >
              Value
            </th>
          </>
        )}
      </tr>
    </thead>
  );
}
