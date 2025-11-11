// After Effects Script with Comprehensive Error Handling
// This script demonstrates a main function calling other functions
// with complete error propagation and early termination

(function() {
‘use strict’;

```
// ============================================
// MAIN FUNCTION
// ============================================
function main() {
    try {
        alert("Starting After Effects Script...");
        
        // Check if a composition is selected
        var result = validateProject();
        if (result.error) throw new Error(result.error);
        
        // Create layers
        result = createLayers();
        if (result.error) throw new Error(result.error);
        
        // Apply effects
        result = applyEffects();
        if (result.error) throw new Error(result.error);
        
        // Animate properties
        result = animateProperties();
        if (result.error) throw new Error(result.error);
        
        alert("Script completed successfully!");
        return { success: true };
        
    } catch (e) {
        alert("Script failed: " + e.message);
        return { error: e.message };
    }
}

// ============================================
// PRIMARY FUNCTIONS
// ============================================

function validateProject() {
    try {
        // Check if project exists
        var hasProject = checkProject();
        if (hasProject.error) throw new Error(hasProject.error);
        
        // Check if composition is active
        var hasComp = checkActiveComp();
        if (hasComp.error) throw new Error(hasComp.error);
        
        return { success: true };
        
    } catch (e) {
        return { error: "Validation failed: " + e.message };
    }
}

function createLayers() {
    try {
        var comp = app.project.activeItem;
        
        // Create solid layer
        var solid = createSolidLayer(comp, "Background", [0.2, 0.2, 0.8]);
        if (solid.error) throw new Error(solid.error);
        
        // Create text layer
        var text = createTextLayer(comp, "Sample Text");
        if (text.error) throw new Error(text.error);
        
        return { success: true };
        
    } catch (e) {
        return { error: "Layer creation failed: " + e.message };
    }
}

function applyEffects() {
    try {
        var comp = app.project.activeItem;
        if (comp.numLayers < 1) {
            throw new Error("No layers found to apply effects");
        }
        
        var layer = comp.layer(1);
        
        // Add glow effect
        var glow = addGlowEffect(layer);
        if (glow.error) throw new Error(glow.error);
        
        return { success: true };
        
    } catch (e) {
        return { error: "Effect application failed: " + e.message };
    }
}

function animateProperties() {
    try {
        var comp = app.project.activeItem;
        if (comp.numLayers < 1) {
            throw new Error("No layers found to animate");
        }
        
        var layer = comp.layer(1);
        
        // Animate opacity
        var opacity = animateOpacity(layer);
        if (opacity.error) throw new Error(opacity.error);
        
        // Animate position
        var position = animatePosition(layer);
        if (position.error) throw new Error(position.error);
        
        return { success: true };
        
    } catch (e) {
        return { error: "Animation failed: " + e.message };
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function checkProject() {
    try {
        if (!app.project) {
            throw new Error("No project is open");
        }
        return { success: true };
    } catch (e) {
        return { error: e.message };
    }
}

function checkActiveComp() {
    try {
        if (!app.project.activeItem) {
            throw new Error("No active composition");
        }
        if (!(app.project.activeItem instanceof CompItem)) {
            throw new Error("Active item is not a composition");
        }
        return { success: true };
    } catch (e) {
        return { error: e.message };
    }
}

function createSolidLayer(comp, name, color) {
    try {
        if (!comp) throw new Error("Invalid composition");
        
        var solid = comp.layers.addSolid(
            color,
            name,
            comp.width,
            comp.height,
            1.0
        );
        
        if (!solid) throw new Error("Failed to create solid layer");
        
        return { success: true, layer: solid };
    } catch (e) {
        return { error: "Solid creation error: " + e.message };
    }
}

function createTextLayer(comp, textContent) {
    try {
        if (!comp) throw new Error("Invalid composition");
        
        var textLayer = comp.layers.addText(textContent);
        if (!textLayer) throw new Error("Failed to create text layer");
        
        var textProp = textLayer.property("Source Text");
        var textDoc = textProp.value;
        textDoc.fontSize = 72;
        textDoc.fillColor = [1, 1, 1];
        textProp.setValue(textDoc);
        
        return { success: true, layer: textLayer };
    } catch (e) {
        return { error: "Text layer error: " + e.message };
    }
}

function addGlowEffect(layer) {
    try {
        if (!layer) throw new Error("Invalid layer");
        
        var effect = layer.property("Effects").addProperty("ADBE Glow");
        if (!effect) throw new Error("Failed to add glow effect");
        
        effect.property("ADBE Glow-0001").setValue(50); // Glow Threshold
        effect.property("ADBE Glow-0002").setValue(20); // Glow Radius
        
        return { success: true };
    } catch (e) {
        return { error: "Glow effect error: " + e.message };
    }
}

function animateOpacity(layer) {
    try {
        if (!layer) throw new Error("Invalid layer");
        
        var opacity = layer.property("Transform").property("Opacity");
        opacity.setValueAtTime(0, 0);
        opacity.setValueAtTime(1, 100);
        
        return { success: true };
    } catch (e) {
        return { error: "Opacity animation error: " + e.message };
    }
}

function animatePosition(layer) {
    try {
        if (!layer) throw new Error("Invalid layer");
        
        var comp = layer.containingComp;
        var pos = layer.property("Transform").property("Position");
        
        pos.setValueAtTime(0, [comp.width / 2, comp.height / 2]);
        pos.setValueAtTime(2, [comp.width / 2, comp.height / 2 - 100]);
        
        return { success: true };
    } catch (e) {
        return { error: "Position animation error: " + e.message };
    }
}

// ============================================
// EXECUTE MAIN FUNCTION
// ============================================

app.beginUndoGroup("AE Script with Error Handling");
var result = main();
app.endUndoGroup();

if (result.error) {
    $.writeln("Script terminated with error: " + result.error);
}
```

})();