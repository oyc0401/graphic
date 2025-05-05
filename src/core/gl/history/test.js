export interface HistoryItem {
  group?: string;
  layerId: number;
  tool: string;
  rect?: DirtyRect;
  pixelReader?: PixelReader;
  skipHistory: boolean;
  applyHistory(HistoryItem): HistoryItem;
  showSelection?: boolean;
  selectionRect?: Rect;
}

// enterBrushTool();
startBrushTool(p0);
strokeBrushTool(p1);
strokeBrushTool(p2);
strokeBrushTool(p3);
endBrushTool();
saveLayerHistory() // history 1 (일부 layer 저장)

startBrushTool(p4);
strokeBrushTool(p4);
strokeBrushTool(p5);
endBrushTool(); 
saveLayerHistory() // history 2 (일부 layer 저장)
// exitBrushTool();

//

enterLiquifyTool(); 
startLiquifyTool(p0); // enter이후 첫 드로우면 fullDirtyRect 초기화
strokeLiquifyTool(p1);
strokeLiquifyTool(p2);
strokeLiquifyTool(p3);
endLiquifyTool(); // history 3 (smallDirtyRect만큼 displace 저장), tool:liquify
exitLiquifyTool(); // skipable history 4, history 5 (전체 displace 저장), (전체 layer 저장) tool:liquify


enterSelectTool();
select(p1, p2);
exitSelectTool();

enterSelectionTool(); // layer 일부 수정하는 history, selection 만드는 history
move(x, y, width, height); // selection 이동시키는 history
move(x, y, width, height);
move(x, y, width, height);
exitSelectionTool(); // layer에 selection 적용하는 history, selection 숨기는 history


let tool = undo();
if (tool == "liquify") {
}
