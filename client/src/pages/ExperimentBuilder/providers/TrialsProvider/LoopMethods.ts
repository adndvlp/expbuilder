import { Dispatch, SetStateAction, useCallback } from "react";
import { Loop } from "../../components/ConfigurationPanel/types";
import { TimelineItem } from "../../contexts/TrialsContext";
const API_URL = import.meta.env.VITE_API_URL;

type Props = {
  experimentID: string | undefined;
  timeline: TimelineItem[];
  loopTimeline: TimelineItem[];
  setTimeline: Dispatch<SetStateAction<TimelineItem[]>>;
  setLoopTimeline: Dispatch<SetStateAction<TimelineItem[]>>;
  getTimeline: () => Promise<void>;
  getLoopTimeline: (loopId: string | number) => Promise<TimelineItem[]>;
  setSelectedLoop: Dispatch<SetStateAction<Loop | null>>;
  selectedLoop: Loop | null;
};

export default function LoopMethods({
  experimentID,
  loopTimeline,
  setTimeline,
  setLoopTimeline,
  getTimeline,
  getLoopTimeline,
  selectedLoop,
  setSelectedLoop,
}: Props) {
  const createLoop = useCallback(
    async (loop: Omit<Loop, "id">): Promise<Loop> => {
      // Determinar si es nested loop (si los trials tienen parentLoopId)
      const isNestedLoop = loop.parentLoopId != null;

      // OPTIMISTIC UI PRIMERO - actualizar el timeline correcto
      const optimisticUpdateFn = (prev: TimelineItem[]) => {
        // 1. Filtrar los trials/loops que ahora están dentro del nuevo loop
        const filteredTimeline = prev.filter(
          (item) => !loop.trials.includes(item.id),
        );

        // 2. Actualizar branches: reemplazar trial/loop IDs por el ID temporal del loop
        const tempLoopId = `temp-loop-${Date.now()}`;
        const updatedTimeline = filteredTimeline.map((item) => {
          // Saltar si este item está dentro del loop (evita referencias circulares)
          if (loop.trials.includes(item.id)) {
            return item;
          }

          // Si tiene branches con trials/loops del nuevo loop, reemplazarlos
          if (item.branches && item.branches.length > 0) {
            const hasAnyItemFromLoop = item.branches.some((branchId) =>
              loop.trials.includes(branchId),
            );

            if (hasAnyItemFromLoop) {
              // Remover todos los IDs que están en el loop
              const filteredBranches = item.branches.filter(
                (branchId) => !loop.trials.includes(branchId),
              );
              // Agregar el loop ID temporal si no está ya
              if (!filteredBranches.includes(tempLoopId as any)) {
                filteredBranches.push(tempLoopId as any);
              }
              return {
                ...item,
                branches: filteredBranches,
              };
            }
          }

          return item;
        });

        // 3. Agregar el nuevo loop al timeline
        return [
          ...updatedTimeline,
          {
            id: tempLoopId as any,
            type: "loop" as const,
            name: loop.name,
            branches: loop.branches || [],
            trials: loop.trials || [],
          },
        ];
      };

      if (isNestedLoop) {
        setLoopTimeline(optimisticUpdateFn);
      } else {
        setTimeline(optimisticUpdateFn);
      }

      try {
        // BACKEND - crear el loop
        const response = await fetch(`${API_URL}/api/loop/${experimentID}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(loop),
        });

        if (!response.ok) {
          throw new Error("Failed to create loop");
        }

        const data = await response.json();
        const newLoop = data.loop;

        // Actualizar parentLoopId en todos los trials/loops del loop
        for (const itemId of loop.trials) {
          try {
            // Determinar si es trial o loop
            await fetch(`${API_URL}/api/trial/${experimentID}/${itemId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ parentLoopId: newLoop.id }),
            });
          } catch (error) {
            // Si falla como trial, intentar como loop
            try {
              await fetch(`${API_URL}/api/loop/${experimentID}/${itemId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ parentLoopId: newLoop.id }),
              });
            } catch (loopError) {
              console.error(
                `Error updating parentLoopId for item ${itemId}:`,
                error,
                loopError,
              );
            }
          }
        }

        // ACTUALIZAR UI CON ID REAL - reemplazar el loop temporal con el real
        const replaceWithRealId = (prev: TimelineItem[]) =>
          prev.map((item) => {
            // Reemplazar el loop temporal con el real
            if (
              typeof item.id === "string" &&
              item.id.startsWith("temp-loop-")
            ) {
              return {
                ...item,
                id: newLoop.id,
              };
            }
            // Actualizar branches que apuntaban al ID temporal
            if (item.branches && item.branches.length > 0) {
              const updatedBranches = item.branches.map((branchId) =>
                typeof branchId === "string" &&
                branchId.startsWith("temp-loop-")
                  ? newLoop.id
                  : branchId,
              );
              return {
                ...item,
                branches: updatedBranches,
              };
            }
            return item;
          });

        if (isNestedLoop) {
          setLoopTimeline(replaceWithRealId);
        } else {
          setTimeline(replaceWithRealId);
        }

        return newLoop;
      } catch (error) {
        console.error("Error creating loop:", error);
        // Si falla, recargar timeline apropiado
        if (isNestedLoop && loop.parentLoopId) {
          await getLoopTimeline(loop.parentLoopId);
        } else {
          await getTimeline();
        }
        throw error;
      }
    },
    [experimentID, getTimeline, getLoopTimeline, setTimeline, setLoopTimeline],
  );

  const getLoop = useCallback(
    async (id: string | number): Promise<Loop | null> => {
      try {
        const response = await fetch(
          `${API_URL}/api/loop/${experimentID}/${id}`,
        );

        if (!response.ok) {
          return null;
        }

        const data = await response.json();
        return data.loop;
      } catch (error) {
        console.error("Error getting loop:", error);
        return null;
      }
    },
    [experimentID],
  );

  const updateLoop = useCallback(
    async (
      id: string | number,
      loop: Partial<Loop>,
      newBranchItem?: any, // Trial o Loop recién creado como branch
    ): Promise<Loop | null> => {
      try {
        // Determinar si es nested loop buscando en ambos timelines
        // (no podemos confiar solo en loop.parentLoopId porque puede no estar en el partial)
        let currentLoop: Loop | null = null;
        let isNestedLoop = false;

        // Buscar primero en selectedLoop
        if (selectedLoop?.id === id) {
          currentLoop = selectedLoop;
          isNestedLoop = selectedLoop.parentLoopId != null;
        }

        // Si no está seleccionado, necesitamos obtenerlo (pero sin hacer fetch innecesario)
        // Podemos inferir del contexto: si estamos actualizando desde un SubCanvas, es nested

        // OPTIMISTIC UI PRIMERO - actualizar antes del fetch
        const optimisticUpdateFn = (prev: TimelineItem[]) => {
          // 1. Actualizar el loop que se está modificando
          const updated = prev.map((item) => {
            if (item.id === id && item.type === "loop") {
              return {
                ...item,
                name: loop.name ?? item.name,
                branches: loop.branches ?? item.branches,
                trials: loop.trials ?? item.trials,
              };
            }
            return item;
          });

          // 2. Agregar items de branches que no estén en el timeline
          const updatedBranches = loop.branches;
          if (updatedBranches && updatedBranches.length > 0) {
            const existingIds = new Set(updated.map((item) => item.id));
            const missingBranchIds = updatedBranches.filter(
              (branchId: number | string) => !existingIds.has(branchId),
            );

            // Para cada branch faltante, agregarlo al timeline
            missingBranchIds.forEach((branchId: number | string) => {
              // Si es el item recién creado, usar sus datos reales
              if (newBranchItem && newBranchItem.id === branchId) {
                // Determinar type: si tiene 'plugin', es trial; si tiene 'trials', es loop
                const itemType =
                  newBranchItem.plugin !== undefined
                    ? "trial"
                    : newBranchItem.trials !== undefined
                      ? "loop"
                      : "trial";
                updated.push({
                  id: newBranchItem.id,
                  type: itemType as "trial" | "loop",
                  name: newBranchItem.name,
                  branches: newBranchItem.branches || [],
                  trials: newBranchItem.trials || [],
                });
              } else {
                // Para otros branches, usar placeholder
                updated.push({
                  id: branchId,
                  type: "trial" as const,
                  name: "Loading...",
                  branches: [],
                });
              }
            });
          }

          return updated;
        };

        // Aplicar optimistic update al timeline correcto
        if (isNestedLoop) {
          setLoopTimeline(optimisticUpdateFn);
        } else {
          setTimeline(optimisticUpdateFn);
        }

        // BACKEND - obtener loop actual y actualizar
        const currentLoopData = currentLoop || (await getLoop(id));
        if (!currentLoopData) {
          throw new Error("Loop not found");
        }

        isNestedLoop = currentLoopData.parentLoopId != null;

        const response = await fetch(
          `${API_URL}/api/loop/${experimentID}/${id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(loop),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to update loop");
        }

        const data = await response.json();
        const updatedLoop = data.loop;

        // Si se actualizó el array de trials, sincronizar parentLoopId
        if (loop.trials) {
          const oldTrials = currentLoopData.trials || [];
          const newTrials = loop.trials;

          // Trials/loops removidos del loop - limpiar parentLoopId
          const removedItems = oldTrials.filter(
            (itemId) => !newTrials.includes(itemId),
          );
          for (const itemId of removedItems) {
            try {
              // Intentar como trial primero
              await fetch(`${API_URL}/api/trial/${experimentID}/${itemId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ parentLoopId: null }),
              });
            } catch (error) {
              // Si falla, intentar como loop
              try {
                await fetch(`${API_URL}/api/loop/${experimentID}/${itemId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ parentLoopId: null }),
                });
              } catch (loopError) {
                console.error(
                  `Error clearing parentLoopId for item ${itemId}:`,
                  error,
                  loopError,
                );
              }
            }
          }

          // Trials/loops agregados al loop - asignar parentLoopId
          const addedItems = newTrials.filter(
            (itemId) => !oldTrials.includes(itemId),
          );
          for (const itemId of addedItems) {
            try {
              await fetch(`${API_URL}/api/trial/${experimentID}/${itemId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ parentLoopId: id }),
              });
            } catch (error) {
              try {
                await fetch(`${API_URL}/api/loop/${experimentID}/${itemId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ parentLoopId: id }),
                });
              } catch (loopError) {
                console.error(
                  `Error setting parentLoopId for item ${itemId}:`,
                  error,
                  loopError,
                );
              }
            }
          }
        }

        // ACTUALIZAR UI CON DATOS REALES - refinar el optimistic update
        const finalUpdateFn = (prev: TimelineItem[]) =>
          prev.map((item) =>
            item.id === id && item.type === "loop"
              ? {
                  ...item,
                  name: updatedLoop.name,
                  branches: updatedLoop.branches || [],
                  trials: updatedLoop.trials || [],
                }
              : item,
          );

        if (isNestedLoop) {
          setLoopTimeline(finalUpdateFn);
        } else {
          setTimeline(finalUpdateFn);
        }

        // Actualizar selectedLoop si es el que está seleccionado
        if (selectedLoop?.id === id) {
          setSelectedLoop(updatedLoop);
        }

        return updatedLoop;
      } catch (error) {
        console.error("Error updating loop:", error);
        // Si falla, recargar timeline apropiado
        if (selectedLoop?.parentLoopId) {
          await getLoopTimeline(selectedLoop.parentLoopId);
        } else {
          await getTimeline();
        }
        return null;
      }
    },
    [
      experimentID,
      selectedLoop,
      getTimeline,
      getLoopTimeline,
      getLoop,
      setTimeline,
      setLoopTimeline,
      setSelectedLoop,
    ],
  );

  // Actualización granular de un solo campo del loop (optimizado para autoguardado)
  const updateLoopField = useCallback(
    async (
      id: string | number,
      fieldName: string,
      value: any,
      updateSelectedLoop: boolean = true,
    ): Promise<boolean> => {
      try {
        // Determinar si es nested loop
        let isNestedLoop = false;
        if (selectedLoop?.id === id) {
          isNestedLoop = selectedLoop.parentLoopId != null;
        }

        // OPTIMISTIC UI PRIMERO
        if (
          fieldName === "name" ||
          fieldName === "branches" ||
          fieldName === "trials"
        ) {
          const optimisticUpdateFn = (prev: TimelineItem[]) =>
            prev.map((item) => {
              if (item.id === id && item.type === "loop") {
                return {
                  ...item,
                  [fieldName]: value,
                };
              }
              return item;
            });

          if (isNestedLoop) {
            setLoopTimeline(optimisticUpdateFn);
          } else {
            setTimeline(optimisticUpdateFn);
          }
        }

        // BACKEND
        const response = await fetch(
          `${API_URL}/api/loop/${experimentID}/${id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [fieldName]: value }),
          },
        );

        if (!response.ok) {
          throw new Error(`Failed to update ${fieldName}`);
        }

        const data = await response.json();
        const updatedLoop = data.loop;

        // ACTUALIZAR UI CON DATOS REALES
        if (
          fieldName === "name" ||
          fieldName === "branches" ||
          fieldName === "trials"
        ) {
          const finalUpdateFn = (prev: TimelineItem[]) =>
            prev.map((item) =>
              item.id === id && item.type === "loop"
                ? {
                    ...item,
                    name: updatedLoop.name,
                    branches: updatedLoop.branches || [],
                    trials: updatedLoop.trials || [],
                  }
                : item,
            );

          if (updatedLoop.parentLoopId) {
            setLoopTimeline(finalUpdateFn);
          } else {
            setTimeline(finalUpdateFn);
          }
        }

        // Actualizar selectedLoop si es el que está seleccionado y se solicita
        if (updateSelectedLoop && selectedLoop?.id === id) {
          setSelectedLoop(updatedLoop);
        }

        return true;
      } catch (error) {
        console.error(`Error updating ${fieldName}:`, error);

        // Si falla, recargar el loop completo para mantener consistencia
        if (selectedLoop?.id === id) {
          const freshLoop = await getLoop(id);
          if (freshLoop) {
            setSelectedLoop(freshLoop);
          }
        }

        return false;
      }
    },
    [
      experimentID,
      selectedLoop,
      getLoop,
      setTimeline,
      setLoopTimeline,
      setSelectedLoop,
    ],
  );

  const deleteLoop = useCallback(
    async (id: string | number): Promise<boolean> => {
      try {
        // Obtener loop antes de eliminar para saber sus trials, branches y si es nested
        let loopToDelete: Loop | null = null;
        let isNestedLoop = false;

        if (selectedLoop?.id === id) {
          loopToDelete = selectedLoop;
          isNestedLoop = selectedLoop.parentLoopId != null;
        } else {
          loopToDelete = await getLoop(id);
          if (loopToDelete) {
            isNestedLoop = loopToDelete.parentLoopId != null;
          }
        }

        if (!loopToDelete) {
          throw new Error("Loop not found");
        }

        // Obtener los metadatos de TODOS los trials que tienen este parentLoopId
        // (no solo los que están en loop.trials)
        let loopTrialsMetadata: TimelineItem[] = [];
        const hasDataInLoopTimeline =
          selectedLoop?.id === id && loopTimeline.length > 0;

        if (hasDataInLoopTimeline) {
          loopTrialsMetadata = loopTimeline;
        } else {
          try {
            const response = await fetch(
              `${API_URL}/api/loop-trials-metadata/${experimentID}/${id}`,
            );
            if (response.ok) {
              const data = await response.json();
              loopTrialsMetadata = data.trialsMetadata || [];
            }
          } catch (error) {
            console.error("Error fetching loop trials:", error);
          }
        }

        // ========== OPTIMISTIC UI: BORRADO INTELIGENTE ==========
        const optimisticDeleteFn = (prev: TimelineItem[]) => {
          // 1. Encontrar el loop a eliminar
          const loopIndex = prev.findIndex((item) => item.id === id);
          if (loopIndex === -1) return prev;

          const firstTrialId = loopToDelete.trials?.[0] || null;
          const loopBranches = loopToDelete.branches || [];

          // 2. Reconectar padres con el PRIMER trial del loop (mantener estructura interna)
          let updated = prev.map((item) => {
            if (item.branches && item.branches.includes(id)) {
              if (firstTrialId) {
                // Reemplazar el loop con el primer trial
                return {
                  ...item,
                  branches: item.branches.map((branchId) =>
                    branchId === id ? firstTrialId : branchId,
                  ),
                };
              } else {
                // Si el loop está vacío, simplemente remover
                return {
                  ...item,
                  branches: item.branches.filter((branchId) => branchId !== id),
                };
              }
            }
            return item;
          });

          // 3. Conectar los branches del loop con los ÚLTIMOS items de la cadena interna
          if (loopBranches.length > 0 && loopToDelete.trials) {
            // Función helper para encontrar los últimos items
            const findLastItems = (trialIds: (string | number)[]) => {
              const lastItems: (string | number)[] = [];

              for (const trialId of trialIds) {
                const item = loopTrialsMetadata.find((t) => t.id === trialId);
                if (!item) continue;

                const itemBranches = item.branches || [];

                // Verificar si alguno de sus branches está dentro del loop
                const hasBranchesInsideLoop = itemBranches.some((branchId) =>
                  trialIds.includes(branchId),
                );

                // Si no tiene branches dentro del loop, es un item final
                if (!hasBranchesInsideLoop) {
                  lastItems.push(trialId);
                }
              }

              return lastItems.length > 0 ? lastItems : [trialIds[0]];
            };

            const lastItems = findLastItems(loopToDelete.trials);

            // Actualizar al ÚLTIMO último item para agregar los branches del loop
            // (evita crear múltiples padres para el mismo branch)
            if (lastItems.length > 0) {
              const lastLastItemId = lastItems[lastItems.length - 1];

              updated = updated.map((item) => {
                if (item.id === lastLastItemId) {
                  const currentBranches = item.branches || [];
                  const newBranches = [...currentBranches];

                  // Agregar los branches del loop (evitar duplicados)
                  loopBranches.forEach((branchId) => {
                    if (!newBranches.includes(branchId)) {
                      newBranches.push(branchId);
                    }
                  });

                  return {
                    ...item,
                    branches: newBranches,
                  };
                }
                return item;
              });
            }
          }

          // 4. Eliminar el loop del timeline
          updated = updated.filter((item) => item.id !== id);

          // 5. Restaurar TODOS los trials/loops con este parentLoopId
          //    (no solo los de loop.trials, incluye branches internos)
          if (loopTrialsMetadata.length > 0) {
            // Usar todos los metadatos obtenidos (incluye branches)
            // IMPORTANTE: Los loops anidados deben dejar de tener parentLoopId
            // porque su padre acaba de ser borrado
            const restoredItems: TimelineItem[] = loopTrialsMetadata.map(
              (item) => ({
                id: item.id,
                type: item.type,
                name: item.name,
                branches: item.branches || [],
                trials: item.trials || [],
                // Los loops restaurados ya no tienen padre
                parentLoopId: undefined,
              }),
            );

            // Insertar en la posición donde estaba el loop
            updated.splice(loopIndex, 0, ...restoredItems);
          }

          return updated;
        };

        // Aplicar optimistic update al timeline correcto
        // IMPORTANTE: Verificar si el padre del nested loop realmente existe
        // (puede haber sido borrado antes, dejando el loop con parentLoopId obsoleto)
        let shouldUseLoopTimeline = false;
        if (isNestedLoop && loopToDelete.parentLoopId) {
          // Verificar si el padre existe en el timeline principal o en loopTimeline
          const parentExistsInMainTimeline = timeline.some(
            (item) =>
              item.id === loopToDelete.parentLoopId && item.type === "loop",
          );
          const parentExistsInLoopTimeline = loopTimeline.some(
            (item) =>
              item.id === loopToDelete.parentLoopId && item.type === "loop",
          );

          // Solo usar loopTimeline si el padre realmente existe
          shouldUseLoopTimeline =
            parentExistsInMainTimeline || parentExistsInLoopTimeline;
        }

        if (shouldUseLoopTimeline) {
          setLoopTimeline(optimisticDeleteFn);
        } else {
          setTimeline(optimisticDeleteFn);
        }
        // ========== FIN OPTIMISTIC UI ==========

        // Deseleccionar si es el seleccionado
        if (selectedLoop?.id === id) {
          setSelectedLoop(null);
        }

        // BACKEND - eliminar loop
        const response = await fetch(
          `${API_URL}/api/loop/${experimentID}/${id}`,
          {
            method: "DELETE",
          },
        );

        if (!response.ok) {
          throw new Error("Failed to delete loop");
        }

        return true;
      } catch (error) {
        console.error("Error deleting loop:", error);
        // Si falla, recargar timeline apropiado
        if (selectedLoop?.parentLoopId) {
          await getLoopTimeline(selectedLoop.parentLoopId);
        } else {
          await getTimeline();
        }
        return false;
      }
    },
    [
      experimentID,
      selectedLoop,
      getTimeline,
      getLoopTimeline,
      getLoop,
      setTimeline,
      setLoopTimeline,
      setSelectedLoop,
      loopTimeline,
    ],
  );

  return { createLoop, getLoop, updateLoop, updateLoopField, deleteLoop };
}
