// After Effects Script: Image Stacking and Animation
// This script duplicates images, stacks them vertically, animates them, and creates horizontal layouts

(function() {
// Check if After Effects is available
if (typeof app === “undefined” || !app.project) {
alert(“This script must be run in After Effects with an active project.”);
return;
}

```
app.beginUndoGroup("Image Stacking and Animation");

try {
    // Get user input for image selection
    var sourceItem = promptForImage();
    if (!sourceItem) {
        alert("No image selected. Script cancelled.");
        return;
    }
    
    // Get number of duplicates
    var numDuplicates = promptForNumber("How many duplicates of the image do you want?", 5, 1, 100);
    if (numDuplicates === null) return;
    
    // Create the main stacked composition
    var mainComp = createStackedComposition(sourceItem, numDuplicates);
    if (!mainComp) {
        alert("Failed to create main composition.");
        return;
    }
    
    // Get number of composition duplicates
    var numCompDuplicates = promptForNumber("How many duplicates of this composition do you want?", 3, 1, 20);
    if (numCompDuplicates === null) return;
    
    // Create the horizontal layout composition
    createHorizontalLayout(mainComp, numCompDuplicates);
    
    alert("Script completed successfully!");
    
} catch (error) {
    alert("Error: " + error.toString());
} finally {
    app.endUndoGroup();
}

// Function to prompt user to select an image from project
function promptForImage() {
    var items = [];
    var itemNames = [];
    
    // Collect all footage items (images/videos)
    for (var i = 1; i <= app.project.numItems; i++) {
        var item = app.project.item(i);
        if (item instanceof FootageItem && item.mainSource instanceof FileSource) {
            items.push(item);
            itemNames.push(item.name);
        }
    }
    
    if (items.length === 0) {
        alert("No footage items found in project. Please import an image first.");
        return null;
    }
    
    // Create selection dialog
    var dialog = new Window("dialog", "Select Image");
    dialog.orientation = "column";
    dialog.alignChildren = "left";
    
    dialog.add("statictext", undefined, "Select an image to duplicate:");
    
    var listBox = dialog.add("listbox", undefined, itemNames);
    listBox.preferredSize.width = 300;
    listBox.preferredSize.height = 150;
    listBox.selection = 0;
    
    var buttonGroup = dialog.add("group");
    var okBtn = buttonGroup.add("button", undefined, "OK");
    var cancelBtn = buttonGroup.add("button", undefined, "Cancel");
    
    okBtn.onClick = function() {
        dialog.close(1);
    };
    
    cancelBtn.onClick = function() {
        dialog.close(0);
    };
    
    if (dialog.show() === 1 && listBox.selection !== null) {
        return items[listBox.selection.index];
    }
    
    return null;
}

// Function to prompt for numeric input
function promptForNumber(message, defaultValue, min, max) {
    var dialog = new Window("dialog", "Input Required");
    dialog.orientation = "column";
    dialog.alignChildren = "left";
    
    dialog.add("statictext", undefined, message);
    
    var inputGroup = dialog.add("group");
    inputGroup.add("statictext", undefined, "Number:");
    var input = inputGroup.add("edittext", undefined, defaultValue.toString());
    input.preferredSize.width = 100;
    
    var buttonGroup = dialog.add("group");
    var okBtn = buttonGroup.add("button", undefined, "OK");
    var cancelBtn = buttonGroup.add("button", undefined, "Cancel");
    
    okBtn.onClick = function() {
        var value = parseInt(input.text);
        if (isNaN(value) || value < min || value > max) {
            alert("Please enter a number between " + min + " and " + max);
            return;
        }
        dialog.close(1);
    };
    
    cancelBtn.onClick = function() {
        dialog.close(0);
    };
    
    if (dialog.show() === 1) {
        return parseInt(input.text);
    }
    
    return null;
}

// Function to create the main stacked composition
function createStackedComposition(sourceItem, numDuplicates) {
    // Get image dimensions
    var imageWidth = sourceItem.width;
    var imageHeight = sourceItem.height;
    
    // Calculate composition dimensions
    var compWidth = imageWidth;
    var compHeight = (numDuplicates - 1) * imageHeight;
    
    // Create composition
    var compName = sourceItem.name.replace(/\.[^\.]+$/, "") + "_Stacked_" + numDuplicates;
    var comp = app.project.items.addComp(compName, compWidth, compHeight, 1.0, 10.0, 30);
    
    var layers = [];
    
    // Add and position layers
    for (var i = 0; i < numDuplicates; i++) {
        var layer = comp.layers.add(sourceItem);
        
        // Position each layer
        var yPos = (i * imageHeight) + (imageHeight / 2);
        layer.transform.position.setValue([compWidth / 2, yPos]);
        
        layers.push(layer);
    }
    
    // Set keyframes for animation
    for (var j = 0; j < layers.length; j++) {
        var layer = layers[j];
        var positionProp = layer.transform.position;
        
        // Keyframe at frame 10 (current position)
        comp.time = 9 / 30; // Frame 10 in seconds (30fps)
        var currentPos = positionProp.value;
        positionProp.setValueAtTime(comp.time, currentPos);
        
        // Keyframe at frame 20 (shifted down)
        comp.time = 19 / 30; // Frame 20 in seconds (30fps)
        var newPos = [currentPos[0], currentPos[1] + imageHeight];
        positionProp.setValueAtTime(comp.time, newPos);
    }
    
    // Reset comp time
    comp.time = 0;
    
    return comp;
}

// Function to create horizontal layout composition
function createHorizontalLayout(sourceComp, numDuplicates) {
    var compWidth = sourceComp.width;
    var compHeight = sourceComp.height;
    var padding = 10;
    
    // Calculate layout composition dimensions
    var layoutWidth = (numDuplicates * compWidth) + ((numDuplicates - 1) * padding);
    var layoutHeight = compHeight;
    
    // Create layout composition
    var layoutCompName = sourceComp.name + "_Layout_" + numDuplicates;
    var layoutComp = app.project.items.addComp(layoutCompName, layoutWidth, layoutHeight, 1.0, sourceComp.duration, sourceComp.frameRate);
    
    // Add and position composition layers
    for (var i = 0; i < numDuplicates; i++) {
        var layer = layoutComp.layers.add(sourceComp);
        
        // Calculate horizontal position
        var xPos = (compWidth / 2) + (i * (compWidth + padding));
        var yPos = layoutHeight / 2;
        
        layer.transform.position.setValue([xPos, yPos]);
    }
    
    // Select the layout composition in project panel
    layoutComp.selected = true;
    
    return layoutComp;
}
```

})();