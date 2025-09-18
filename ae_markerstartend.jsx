// After Effects Script: Add Composition Markers at Layer Start/End
// This script adds composition markers at the beginning and end of the selected layer

(function addLayerMarkers() {

```
// Check if After Effects is available
if (typeof app === "undefined") {
    alert("This script must be run from within After Effects.");
    return;
}

// Begin undo group
app.beginUndoGroup("Add Layer Markers");

try {
    // Get the active composition
    var activeComp = app.project.activeItem;
    
    // Check if there's an active composition
    if (!activeComp || !(activeComp instanceof CompItem)) {
        alert("Please select an active composition.");
        return;
    }
    
    // Check if there are selected layers
    var selectedLayers = activeComp.selectedLayers;
    if (selectedLayers.length === 0) {
        alert("Please select at least one layer.");
        return;
    }
    
    // If multiple layers are selected, use the first one
    var selectedLayer = selectedLayers[0];
    
    if (selectedLayers.length > 1) {
        var proceed = confirm("Multiple layers selected. Do you want to use the first selected layer '" + selectedLayer.name + "'?");
        if (!proceed) {
            return;
        }
    }
    
    // Prompt user for base marker name
    var baseName = prompt("Enter base name for markers:", "Marker");
    
    // Check if user cancelled or entered empty name
    if (baseName === null) {
        return; // User cancelled
    }
    
    if (baseName === "") {
        baseName = "Marker"; // Default name if empty
    }
    
    // Calculate layer start and end times
    var layerInPoint = selectedLayer.inPoint;
    var layerOutPoint = selectedLayer.outPoint;
    
    // Create marker names
    var beginMarkerName = baseName + "_Begin";
    var endMarkerName = baseName + "_End";
    
    // Add composition markers
    var beginMarker = new MarkerValue(beginMarkerName);
    beginMarker.comment = "Start of layer: " + selectedLayer.name;
    beginMarker.duration = 0; // Point marker
    
    var endMarker = new MarkerValue(endMarkerName);
    endMarker.comment = "End of layer: " + selectedLayer.name;
    endMarker.duration = 0; // Point marker
    
    // Add markers to the composition
    activeComp.markerProperty.setValueAtTime(layerInPoint, beginMarker);
    activeComp.markerProperty.setValueAtTime(layerOutPoint, endMarker);
    
    // Show success message
    alert("Markers added successfully!\n\n" +
          "Begin Marker: '" + beginMarkerName + "' at " + formatTime(layerInPoint) + "\n" +
          "End Marker: '" + endMarkerName + "' at " + formatTime(layerOutPoint) + "\n\n" +
          "Layer: " + selectedLayer.name);
          
} catch (error) {
    alert("An error occurred: " + error.toString());
} finally {
    // End undo group
    app.endUndoGroup();
}

// Helper function to format time display
function formatTime(timeValue) {
    var comp = app.project.activeItem;
    if (comp && comp.displayStartTime !== undefined) {
        return timeToCurrentFormat(timeValue, comp.frameRate, comp.displayStartTime);
    } else {
        // Fallback formatting
        var seconds = timeValue;
        var minutes = Math.floor(seconds / 60);
        seconds = seconds % 60;
        return minutes + ":" + (seconds < 10 ? "0" : "") + seconds.toFixed(2);
    }
}
```

})();

// Alternative version with more options (uncomment to use)
/*
(function addLayerMarkersAdvanced() {

```
if (typeof app === "undefined") {
    alert("This script must be run from within After Effects.");
    return;
}

app.beginUndoGroup("Add Layer Markers (Advanced)");

try {
    var activeComp = app.project.activeItem;
    
    if (!activeComp || !(activeComp instanceof CompItem)) {
        alert("Please select an active composition.");
        return;
    }
    
    var selectedLayers = activeComp.selectedLayers;
    if (selectedLayers.length === 0) {
        alert("Please select at least one layer.");
        return;
    }
    
    // Create dialog panel
    var dialog = new Window("dialog", "Layer Marker Options");
    dialog.orientation = "column";
    dialog.alignChildren = "left";
    
    // Base name input
    var nameGroup = dialog.add("group");
    nameGroup.add("statictext", undefined, "Base Name:");
    var nameInput = nameGroup.add("edittext", undefined, "Marker");
    nameInput.characters = 20;
    
    // Options
    var optionsGroup = dialog.add("panel", undefined, "Options");
    optionsGroup.orientation = "column";
    optionsGroup.alignChildren = "left";
    
    var addBeginCheck = optionsGroup.add("checkbox", undefined, "Add Begin Marker");
    addBeginCheck.value = true;
    
    var addEndCheck = optionsGroup.add("checkbox", undefined, "Add End Marker");
    addEndCheck.value = true;
    
    var addCommentsCheck = optionsGroup.add("checkbox", undefined, "Add Comments");
    addCommentsCheck.value = true;
    
    // Layer selection if multiple
    var layerGroup = null;
    var layerDropdown = null;
    
    if (selectedLayers.length > 1) {
        layerGroup = dialog.add("panel", undefined, "Layer Selection");
        layerGroup.add("statictext", undefined, "Select layer:");
        layerDropdown = layerGroup.add("dropdownlist");
        
        for (var i = 0; i < selectedLayers.length; i++) {
            layerDropdown.add("item", selectedLayers[i].name);
        }
        layerDropdown.selection = 0;
    }
    
    // Buttons
    var buttonGroup = dialog.add("group");
    buttonGroup.alignment = "center";
    var okButton = buttonGroup.add("button", undefined, "OK");
    var cancelButton = buttonGroup.add("button", undefined, "Cancel");
    
    okButton.onClick = function() {
        dialog.close(1);
    };
    
    cancelButton.onClick = function() {
        dialog.close(0);
    };
    
    // Show dialog
    if (dialog.show() === 1) {
        var baseName = nameInput.text || "Marker";
        var selectedLayer = selectedLayers[0];
        
        if (layerDropdown && layerDropdown.selection) {
            selectedLayer = selectedLayers[layerDropdown.selection.index];
        }
        
        var layerInPoint = selectedLayer.inPoint;
        var layerOutPoint = selectedLayer.outPoint;
        
        if (addBeginCheck.value) {
            var beginMarker = new MarkerValue(baseName + "_Begin");
            if (addCommentsCheck.value) {
                beginMarker.comment = "Start of layer: " + selectedLayer.name;
            }
            activeComp.markerProperty.setValueAtTime(layerInPoint, beginMarker);
        }
        
        if (addEndCheck.value) {
            var endMarker = new MarkerValue(baseName + "_End");
            if (addCommentsCheck.value) {
                endMarker.comment = "End of layer: " + selectedLayer.name;
            }
            activeComp.markerProperty.setValueAtTime(layerOutPoint, endMarker);
        }
        
        alert("Markers added successfully for layer: " + selectedLayer.name);
    }
    
} catch (error) {
    alert("An error occurred: " + error.toString());
} finally {
    app.endUndoGroup();
}
```

})();
*/