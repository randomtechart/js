// Set Mask Modes for Selected Layers
// This script sets all masks on selected layers to Add, Subtract, or None

(function setMaskModes() {
// Check if After Effects is available
if (typeof app === “undefined”) {
alert(“This script must be run in After Effects.”);
return;
}

```
// Check if project and composition exist
if (!app.project || !app.project.activeItem || !(app.project.activeItem instanceof CompItem)) {
    alert("Please select a composition first.");
    return;
}

var comp = app.project.activeItem;
var selectedLayers = comp.selectedLayers;

// Check if any layers are selected
if (selectedLayers.length === 0) {
    alert("Please select at least one layer.");
    return;
}

// Create UI panel
var dialog = new Window("dialog", "Set Mask Modes");
dialog.orientation = "column";
dialog.alignChildren = "left";
dialog.spacing = 10;
dialog.margins = 16;

// Title
var titleGroup = dialog.add("group");
titleGroup.add("statictext", undefined, "Set all masks on selected layers to:");

// Radio buttons for mask modes
var radioGroup = dialog.add("group");
radioGroup.orientation = "column";
radioGroup.alignChildren = "left";
radioGroup.spacing = 5;

var addRadio = radioGroup.add("radiobutton", undefined, "Add");
var subtractRadio = radioGroup.add("radiobutton", undefined, "Subtract");
var noneRadio = radioGroup.add("radiobutton", undefined, "None");

// Set default selection to Add
addRadio.value = true;

// Buttons
var buttonGroup = dialog.add("group");
buttonGroup.alignment = "center";
var okButton = buttonGroup.add("button", undefined, "OK");
var cancelButton = buttonGroup.add("button", undefined, "Cancel");

// Button handlers
okButton.onClick = function() {
    dialog.close(1);
};

cancelButton.onClick = function() {
    dialog.close(0);
};

// Show dialog
var result = dialog.show();

if (result === 1) {
    // Determine selected mask mode
    var maskMode;
    if (addRadio.value) {
        maskMode = MaskMode.ADD;
    } else if (subtractRadio.value) {
        maskMode = MaskMode.SUBTRACT;
    } else if (noneRadio.value) {
        maskMode = MaskMode.NONE;
    }
    
    // Begin undo group for single undo operation
    app.beginUndoGroup("Set Mask Modes");
    
    try {
        var processedLayers = 0;
        var totalMasks = 0;
        
        // Process each selected layer
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            
            // Check if layer has masks
            if (layer.mask && layer.mask.numProperties > 0) {
                processedLayers++;
                
                // Set mode for each mask on this layer
                for (var j = 1; j <= layer.mask.numProperties; j++) {
                    var mask = layer.mask.property(j);
                    if (mask && mask.maskMode) {
                        mask.maskMode.setValue(maskMode);
                        totalMasks++;
                    }
                }
            }
        }
        
        // Show completion message
        var modeText = addRadio.value ? "Add" : (subtractRadio.value ? "Subtract" : "None");
        alert("Complete!\n\nProcessed " + processedLayers + " layers with masks.\nSet " + totalMasks + " masks to " + modeText + " mode.");
        
    } catch (error) {
        alert("Error: " + error.toString());
    } finally {
        // End undo group
        app.endUndoGroup();
    }
}
```

})();