import { useEffect, useState } from "react";
import type { Loop, Trial } from "../../types";

type GetLoop = (id: string | number) => Promise<Loop | null>;

export function useParentLoop(trial: Trial | null, getLoop: GetLoop) {
  const [parentLoop, setParentLoop] = useState<Loop | null>(null);

  useEffect(() => {
    const loadParentLoop = async () => {
      if (!trial?.parentLoopId) {
        setParentLoop(null);
        return;
      }

      setParentLoop(await getLoop(trial.parentLoopId));
    };

    void loadParentLoop();
  }, [getLoop, trial?.parentLoopId]);

  return parentLoop;
}
