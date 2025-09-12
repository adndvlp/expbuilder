import React from "react";

type TrialActionsProps = {
  onDelete: () => void;
  // onSave: () => void;
};

const TrialActions: React.FC<TrialActionsProps> = ({
  onDelete,
  //  onSave
}) => (
  <div className="mt-8 gap-6 justify-center">
    {/* <button
      onClick={onSave}
      className="mt-4 save-button mb-4 w-full p-3 bg-green-600 hover:bg-green-700 font-medium rounded"
    >
      Save trial
    </button> */}
    <br />
    <button
      onClick={() => {
        if (window.confirm("Are you sure on deleting this trial?")) {
          onDelete();
        }
      }}
      className="w-full p-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded remove-button"
    >
      Delete trial
    </button>
  </div>
);

export default TrialActions;
