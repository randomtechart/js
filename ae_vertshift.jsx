// After Effects Script: Vertical Mask Shift
// Shifts all masks on selected layers vertically by user-defined pixel value

(function() {
// Check if a composition is active
var comp = app.project.activeItem;
if (!comp || !(comp instanceof CompItem)) {
alert(“Please select a composition.”);
return;
}


// Get selected layers
var selectedLayers = comp.selectedLayers;
if (selectedLayers.length === 0) {
    alert("Please select at least one layer.");
    return;
}

// Prompt user for vertical shift value
var shiftValue = prompt("Enter vertical shift value in pixels:", "0");
if (shiftValue === null) {
    return; // User cancelled
}

// Convert to number and validate
shiftValue = parseFloat(shiftValue);
if (isNaN(shiftValue)) {
    alert("Please enter a valid number.");
    return;
}

// Begin undo group
app.beginUndoGroup("Vertical Mask Shift");

try {
    var totalMasksShifted = 0;
    
    // Loop through selected layers
    for (var i = 0; i < selectedLayers.length; i++) {
        var layer = selectedLayers[i];
        
        // Check if layer has masks
        if (layer.mask && layer.mask.numProperties > 0) {
            // Loop through all masks on the layer
            for (var j = 1; j <= layer.mask.numProperties; j++) {
                var mask = layer.mask(j);
                
                // Get the mask path property
                var maskPath = mask.property("ADBE Mask Shape");
                
                if (maskPath && maskPath.canSetExpression) {
                    // Get current time
                    var currentTime = comp.time;
                    
                    // Get the current mask shape value
                    var shape = maskPath.valueAtTime(currentTime, false);
                    
                    // Shift all vertices vertically
                    var vertices = shape.vertices;
                    var inTangents = shape.inTangents;
                    var outTangents = shape.outTangents;
                    
                    for (var k = 0; k < vertices.length; k++) {
                        vertices[k][1] += shiftValue; // Shift Y coordinate
                    }
                    
                    // Create new shape with shifted vertices
                    var newShape = new Shape();
                    newShape.vertices = vertices;
                    newShape.inTangents = inTangents;
                    newShape.outTangents = outTangents;
                    newShape.closed = shape.closed;
                    
                    // Apply the new shape
                    maskPath.setValueAtTime(currentTime, newShape);
                    
                    totalMasksShifted++;
                }
            }
        }
    }
    
    if (totalMasksShifted > 0) {
        alert("Successfully shifted " + totalMasksShifted + " mask(s) vertically by " + shiftValue + " pixels.");
    } else {
        alert("No masks found on selected layers.");
    }
    
} catch (error) {
    alert("Error: " + error.toString());
} finally {
    // End undo group
    app.endUndoGroup();
}


})();