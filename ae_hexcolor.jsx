// After Effects Script: Create Solid Layer from Hex Code
// Save this as a .jsx file and run it from File > Scripts > Run Script File

(function createSolidFromHex() {
app.beginUndoGroup(“Create Solid from Hex”);


try {
    // Check if a project exists
    if (!app.project) {
        alert("Please open a project first.");
        return;
    }
    
    // Check if there's an active composition
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
        alert("Please select a composition first.");
        return;
    }
    
    // Prompt user for hex code
    var hexCode = prompt("Enter hex color code (e.g., #FF5733 or FF5733):", "#FF5733");
    
    if (!hexCode) {
        return; // User cancelled
    }
    
    // Remove # if present
    hexCode = hexCode.replace('#', '');
    
    // Validate hex code
    if (!/^[0-9A-Fa-f]{6}$/.test(hexCode)) {
        alert("Invalid hex code. Please use 6-digit hex format (e.g., FF5733).");
        return;
    }
    
    // Convert hex to RGB (0-1 range for After Effects)
    var r = parseInt(hexCode.substring(0, 2), 16) / 255;
    var g = parseInt(hexCode.substring(2, 4), 16) / 255;
    var b = parseInt(hexCode.substring(4, 6), 16) / 255;
    
    // Prompt for solid name
    var solidName = prompt("Enter solid layer name:", "Color Solid #" + hexCode);
    
    if (!solidName) {
        solidName = "Color Solid #" + hexCode;
    }
    
    // Create solid layer with composition dimensions
    var solidLayer = comp.layers.addSolid(
        [r, g, b],
        solidName,
        comp.width,
        comp.height,
        comp.pixelAspect,
        comp.duration
    );
    
    alert("Solid layer created successfully!\nHex: #" + hexCode + "\nRGB: " + 
          Math.round(r*255) + ", " + Math.round(g*255) + ", " + Math.round(b*255));
    
} catch (e) {
    alert("Error: " + e.toString());
}

app.endUndoGroup();


})();