// Composition Tags Checker for After Effects - Minimal Version
// Checks footage layers for missing composition tags at in/out points

(function() {
var layersMissingTags = [];


function scanProjectForMissingTags() {
    var project = app.project;
    
    if (!project || project.numItems === 0) {
        return null;
    }
    
    layersMissingTags = [];
    
    app.beginUndoGroup("Scanning for Missing Composition Tags");
    
    try {
        for (var i = 1; i <= project.numItems; i++) {
            var item = project.item(i);
            if (item instanceof CompItem) {
                scanComposition(item);
            }
        }
        
        app.endUndoGroup();
        return layersMissingTags;
        
    } catch (error) {
        app.endUndoGroup();
        return null;
    }
}

function scanComposition(comp) {
    try {
        var compMarkers = comp.markerProperty;
        
        for (var layerIndex = 1; layerIndex <= comp.numLayers; layerIndex++) {
            var layer = comp.layer(layerIndex);
            checkLayerForMissingTags(layer, comp, layerIndex, compMarkers);
        }
    } catch (error) {
        // Continue scanning other comps
    }
}

function checkLayerForMissingTags(layer, comp, layerIndex, compMarkers) {
    try {
        var source = layer.source;
        
        // Only check footage layers
        if (!source || !(source instanceof FootageItem) || !(source.mainSource instanceof FileSource)) {
            return;
        }
        
        var layerInPoint = layer.inPoint;
        var layerOutPoint = layer.outPoint;
        
        var hasInTag = hasCompositionTagAtTime(compMarkers, layerInPoint);
        var hasOutTag = hasCompositionTagAtTime(compMarkers, layerOutPoint);
        
        if (!hasInTag || !hasOutTag) {
            layersMissingTags.push({
                compName: comp.name,
                layerName: layer.name,
                layerIndex: layerIndex,
                footageName: source.name,
                missingInTag: !hasInTag,
                missingOutTag: !hasOutTag
            });
        }
        
    } catch (error) {
        // Continue scanning other layers
    }
}

function hasCompositionTagAtTime(markerProperty, timeValue) {
    try {
        if (!markerProperty || markerProperty.numKeys === 0) {
            return false;
        }
        
        for (var i = 1; i <= markerProperty.numKeys; i++) {
            var markerTime = markerProperty.keyTime(i);
            var tolerance = 0.04;
            
            if (Math.abs(markerTime - timeValue) < tolerance) {
                return true;
            }
        }
        
        return false;
        
    } catch (error) {
        return false;
    }
}

// Main execution
if (!app.project) {
    alert("Please open a project first.");
    return;
}

var data = scanProjectForMissingTags();

if (data === null) {
    alert("Scan failed or no compositions found.");
    return;
}

if (data.length === 0) {
    alert("✓ All footage layers have composition tags at in/out points!");
} else {
    var message = "Found " + data.length + " footage layer(s) missing tags:\n\n";
    for (var i = 0; i < data.length; i++) {
        var item = data[i];
        var missingTags = "";
        if (item.missingInTag && item.missingOutTag) {
            missingTags = "In & Out tags";
        } else if (item.missingInTag) {
            missingTags = "In tag";
        } else {
            missingTags = "Out tag";
        }
        message += "• " + item.compName + " → " + item.layerName + " (Missing: " + missingTags + ")\n";
    }
    alert(message);
}


})();