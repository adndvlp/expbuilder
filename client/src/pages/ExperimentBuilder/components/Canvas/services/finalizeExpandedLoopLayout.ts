import type {
  ExpandedCanvasLayout,
  ExpandedLoopScope,
} from "./expandedLayoutTypes";
import { finalizeExpandedLayout } from "./finalizeExpandedLayout";
import { layoutExpandedLoopMarkers } from "./loopScopeGeometry";
import { reserveLoopRouteClearance } from "./reserveLoopRouteClearance";

type FinalizeExpandedLoopLayoutInput = {
  layout: ExpandedCanvasLayout;
  scopes: readonly ExpandedLoopScope[];
  markerOffset: number;
  verticalGap: number;
};

export function finalizeExpandedLoopLayout({
  layout,
  scopes,
  markerOffset,
  verticalGap,
}: FinalizeExpandedLoopLayoutInput) {
  finalizeExpandedLayout(layout, verticalGap, scopes);
  layoutExpandedLoopMarkers(layout.nodes, scopes, markerOffset);
  finalizeExpandedLayout(layout, verticalGap, scopes);
  layoutExpandedLoopMarkers(layout.nodes, scopes, markerOffset);
  reserveLoopRouteClearance(layout, scopes);
  layoutExpandedLoopMarkers(layout.nodes, scopes, markerOffset);
  return layout;
}
