// Missing Footage Scanner for After Effects - Minimal Version
// Scans all compositions for missing footage and returns data

(function() {
var missingFootageData = [];


function scanProjectForMissingFootage() {
    var project = app.project;
    
    if (!project || project.numItems === 0) {
        return null;
    }
    
    missingFootageData = [];
    
    app.beginUndoGroup("Scanning for Missing Footage");
    
    try {
        for (var i = 1; i <= project.numItems; i++) {
            var item = project.item(i);
            if (item instanceof CompItem) {
                scanComposition(item);
            }
        }
        
        app.endUndoGroup();
        return missingFootageData;
        
    } catch (error) {
        app.endUndoGroup();
        return null;
    }
}

function scanComposition(comp) {
    try {
        for (var layerIndex = 1; layerIndex <= comp.numLayers; layerIndex++) {
            var layer = comp.layer(layerIndex);
            scanLayer(layer, comp, layerIndex);
        }
    } catch (error) {
        missingFootageData.push({
            compName: comp.name,
            layerName: "ERROR SCANNING COMP",
            layerIndex: 0,
            footageName: "Error: " + error.toString(),
            filePath: "N/A",
            footageType: "ERROR",
            missingStatus: "SCAN_ERROR"
        });
    }
}

function scanLayer(layer, comp, layerIndex) {
    try {
        var source = layer.source;
        
        if (!source) {
            return;
        }
        
        if (source instanceof FootageItem) {
            scanFootageItem(source, layer, comp, layerIndex);
        } else if (source instanceof CompItem) {
            scanComposition(source);
        }
        
    } catch (error) {
        missingFootageData.push({
            compName: comp.name,
            layerName: layer.name || "Layer " + layerIndex,
            layerIndex: layerIndex,
            footageName: "ERROR SCANNING LAYER",
            filePath: "Error: " + error.toString(),
            footageType: "ERROR",
            missingStatus: "SCAN_ERROR"
        });
    }
}

function scanFootageItem(footageItem, layer, comp, layerIndex) {
    try {
        var isMissing = false;
        var missingStatus = "OK";
        var filePath = "N/A";
        var footageType = "UNKNOWN";
        
        if (footageItem.mainSource instanceof FileSource) {
            var fileSource = footageItem.mainSource;
            filePath = fileSource.file ? fileSource.file.fsName : "No file path";
            footageType = "FILE";
            
            if (!fileSource.file || !fileSource.file.exists) {
                isMissing = true;
                missingStatus = "MISSING_FILE";
            }
            
        } else if (footageItem.mainSource instanceof SolidSource) {
            footageType = "SOLID";
            filePath = "Solid Color";
            
        } else if (footageItem.mainSource instanceof PlaceholderSource) {
            footageType = "PLACEHOLDER";
            filePath = "Placeholder";
            isMissing = true;
            missingStatus = "PLACEHOLDER";
            
        } else {
            footageType = "OTHER";
            filePath = "Unknown source type";
        }
        
        if (footageItem.footageMissing) {
            isMissing = true;
            missingStatus = "FOOTAGE_MISSING_FLAG";
        }
        
        if (isMissing) {
            missingFootageData.push({
                compName: comp.name,
                layerName: layer.name || "Layer " + layerIndex,
                layerIndex: layerIndex,
                footageName: footageItem.name,
                filePath: filePath,
                footageType: footageType,
                missingStatus: missingStatus
            });
        }
        
    } catch (error) {
        missingFootageData.push({
            compName: comp.name,
            layerName: layer.name || "Layer " + layerIndex,
            layerIndex: layerIndex,
            footageName: footageItem.name || "Unknown Footage",
            filePath: "Error: " + error.toString(),
            footageType: "ERROR",
            missingStatus: "SCAN_ERROR"
        });
    }
}

// Main execution
if (!app.project) {
    alert("Please open a project first.");
    return;
}

var data = scanProjectForMissingFootage();

if (data === null) {
    alert("Scan failed or no items found.");
    return;
}

if (data.length === 0) {
    alert("✓ No missing footage found in project!");
} else {
    var message = "Found " + data.length + " missing footage item(s):\n\n";
    for (var i = 0; i < data.length; i++) {
        var item = data[i];
        message += "• " + item.compName + " → " + item.layerName + " (" + item.footageName + ")\n";
    }
    alert(message);
}


})();