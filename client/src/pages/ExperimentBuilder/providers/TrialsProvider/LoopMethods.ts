import useCreateLoop from "./hooks/useCreateLoop";
import useDeleteLoop from "./hooks/useDeleteLoop";
import useGetLoop from "./hooks/useGetLoop";
import useUpdateLoop from "./hooks/useUpdateLoop";
import useUpdateLoopField from "./hooks/useUpdateLoopField";
import { LoopMethodsProps } from "./types";

export default function LoopMethods(props: LoopMethodsProps) {
  const createLoop = useCreateLoop(props);
  const getLoop = useGetLoop(props);
  const dependencies = { ...props, getLoop };
  const updateLoop = useUpdateLoop(dependencies);
  const updateLoopField = useUpdateLoopField(dependencies);
  const deleteLoop = useDeleteLoop(dependencies);

  return { createLoop, getLoop, updateLoop, updateLoopField, deleteLoop };
}
