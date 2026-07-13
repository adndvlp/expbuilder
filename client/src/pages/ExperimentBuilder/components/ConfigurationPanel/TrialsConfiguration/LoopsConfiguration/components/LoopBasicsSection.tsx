import Switch from "react-switch";

interface Props {
  randomize: boolean;
  repetitions: number;
  saveField: (field: string, value: unknown) => void;
  setRandomize: (value: boolean) => void;
  setRepetitions: (value: number) => void;
}

export default function LoopBasicsSection(props: Props) {
  return (
    <div className="mb-2 p-4 border rounded bg-gray-50">
      <div className="flex items-center mb-3">
        <div className="font-bold mr-2 mb-2">Repetitions</div>
        <input
          type="number"
          value={props.repetitions}
          min={1}
          step={1}
          onChange={(event) =>
            props.setRepetitions(
              Math.max(1, Math.floor(Number(event.target.value)) || 1),
            )
          }
          onBlur={() => props.saveField("repetitions", props.repetitions)}
          className="mr-2"
          placeholder="1"
          style={{ width: "100%" }}
        />
      </div>
      <div className="flex items-center" style={{ gap: "12px" }}>
        <Switch
          checked={props.randomize}
          onChange={(checked) => {
            props.setRandomize(checked);
            props.saveField("randomize", checked);
          }}
          onColor="#f1c40f"
          onHandleColor="#ffffff"
          handleDiameter={24}
          uncheckedIcon={false}
          checkedIcon={false}
          height={20}
          width={44}
        />
        <div className="font-bold">Randomize</div>
      </div>
    </div>
  );
}
