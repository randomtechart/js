function projectSelection() {
alert(“Project item selected”);
}

function layerSelection() {
alert(“Layer selected”);
}

var comp = app.project.activeItem;
if (comp && comp instanceof CompItem && comp.selectedLayers.length > 0) {
layerSelection();
} else if (app.project.selection.length > 0) {
projectSelection();
}