// Layer Visibility Manager for After Effects
// This script creates a floating palette to save/load layer visibility states

(function() {
“use strict”;

```
// Main function to create the UI
function createUI() {
    // Create the main window
    var window = new Window("dialog", "Layer Visibility Manager");
    window.orientation = "column";
    window.alignChildren = "fill";
    window.spacing = 10;
    window.margins = 16;
    
    // Title
    var titleGroup = window.add("group");
    titleGroup.orientation = "row";
    titleGroup.alignChildren = "center";
    var title = titleGroup.add("statictext", undefined, "Layer Visibility Manager");
    title.graphics.font = ScriptUI.newFont(title.graphics.font.name, ScriptUI.FontStyle.BOLD, 14);
    
    // Info text
    var infoText = window.add("statictext", undefined, "Save and load layer visibility states for the active composition.");
    infoText.preferredSize.width = 350;
    
    // Button group
    var buttonGroup = window.add("group");
    buttonGroup.orientation = "row";
    buttonGroup.alignment = "center";
    buttonGroup.spacing = 10;
    
    var saveButton = buttonGroup.add("button", undefined, "Save Config");
    var loadButton = buttonGroup.add("button", undefined, "Load Config");
    var closeButton = buttonGroup.add("button", undefined, "Close");
    
    // Save button functionality
    saveButton.onClick = function() {
        try {
            saveVisibilityConfig();
        } catch (e) {
            alert("Error saving config: " + e.toString());
        }
    };
    
    // Load button functionality
    loadButton.onClick = function() {
        try {
            loadVisibilityConfig();
        } catch (e) {
            alert("Error loading config: " + e.toString());
        }
    };
    
    // Close button functionality
    closeButton.onClick = function() {
        window.close();
    };
    
    return window;
}

// Function to save visibility configuration
function saveVisibilityConfig() {
    var comp = app.project.activeItem;
    
    if (!comp || !(comp instanceof CompItem)) {
        alert("Please select an active composition.");
        return;
    }
    
    // Collect visibility data
    var visibilityData = {
        compositionName: comp.name,
        timestamp: new Date().toISOString(),
        layers: []
    };
    
    for (var i = 1; i <= comp.numLayers; i++) {
        var layer = comp.layer(i);
        visibilityData.layers.push({
            index: i,
            name: layer.name,
            enabled: layer.enabled
        });
    }
    
    // Convert to JSON
    var jsonString = JSON.stringify(visibilityData, null, 2);
    
    // Save file dialog
    var file = File.saveDialog("Save Layer Visibility Config", "JSON files:*.json");
    
    if (file) {
        file.open("w");
        file.write(jsonString);
        file.close();
        alert("Configuration saved successfully!\n" + visibilityData.layers.length + " layers saved.");
    }
}

// Function to load visibility configuration
function loadVisibilityConfig() {
    var comp = app.project.activeItem;
    
    if (!comp || !(comp instanceof CompItem)) {
        alert("Please select an active composition.");
        return;
    }
    
    // Open file dialog
    var file = File.openDialog("Load Layer Visibility Config", "JSON files:*.json");
    
    if (file) {
        file.open("r");
        var jsonString = file.read();
        file.close();
        
        try {
            var visibilityData = JSON.parse(jsonString);
            
            if (!visibilityData.layers || !visibilityData.layers.length) {
                alert("Invalid configuration file format.");
                return;
            }
            
            // Begin undo group
            app.beginUndoGroup("Load Layer Visibility");
            
            var appliedCount = 0;
            var skippedCount = 0;
            
            // Apply visibility states
            for (var i = 0; i < visibilityData.layers.length; i++) {
                var layerData = visibilityData.layers[i];
                
                // Try to find layer by index first, then by name
                var targetLayer = null;
                
                try {
                    if (layerData.index <= comp.numLayers) {
                        targetLayer = comp.layer(layerData.index);
                        // Verify the name matches (optional safety check)
                        if (targetLayer.name !== layerData.name) {
                            // If name doesn't match, try to find by name
                            targetLayer = findLayerByName(comp, layerData.name);
                        }
                    } else {
                        // Try to find by name if index is out of range
                        targetLayer = findLayerByName(comp, layerData.name);
                    }
                    
                    if (targetLayer) {
                        targetLayer.enabled = layerData.enabled;
                        appliedCount++;
                    } else {
                        skippedCount++;
                    }
                } catch (e) {
                    skippedCount++;
                }
            }
            
            app.endUndoGroup();
            
            var message = "Configuration loaded successfully!\n";
            message += appliedCount + " layers updated";
            if (skippedCount > 0) {
                message += "\n" + skippedCount + " layers not found and skipped";
            }
            
            alert(message);
            
        } catch (e) {
            alert("Error parsing configuration file: " + e.toString());
        }
    }
}

// Helper function to find layer by name
function findLayerByName(comp, name) {
    for (var i = 1; i <= comp.numLayers; i++) {
        if (comp.layer(i).name === name) {
            return comp.layer(i);
        }
    }
    return null;
}

// Check if After Effects is available
if (typeof app === "undefined") {
    alert("This script must be run from within After Effects.");
    return;
}

// Create and show the UI
var ui = createUI();
ui.center();
ui.show();
```

})();