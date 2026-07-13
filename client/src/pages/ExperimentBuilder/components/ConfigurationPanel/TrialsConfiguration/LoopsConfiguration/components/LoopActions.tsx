interface Props {
  canSave: boolean;
  onDelete: () => void;
  onSave: () => void;
}

export default function LoopActions({ canSave, onDelete, onSave }: Props) {
  return (
    <>
      <button
        onClick={onSave}
        className="mt-4 save-button mb-4 w-full p-3 bg-green-600 hover:bg-green-700 font-medium rounded"
        disabled={!canSave}
      >
        Save loop
      </button>
      <br />
      <button
        className="w-full p-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded remove-button"
        onClick={onDelete}
      >
        Delete loop
      </button>
    </>
  );
}
