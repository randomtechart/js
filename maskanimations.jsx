// Animated Mask Transitions Library for After Effects
// Version 1.0

(function() {

// Main script configuration
var SCRIPT_NAME = "Animated Mask Transitions";
var VERSION = "1.0";

// Transition Library - Template for easy expansion
var TRANSITION_LIBRARY = {
    // Wipe Transitions
    "Horizontal Wipe Left": {
        category: "Wipes",
        description: "Horizontal wipe from right to left",
        maskPath: function(comp) {
            var w = comp.width, h = comp.height;
            return [
                [w + 50, 0], [w + 50, h], [w + 50, h], [w + 50, 0]
            ];
        },
        endPath: function(comp) {
            var w = comp.width, h = comp.height;
            return [
                [-50, 0], [-50, h], [w + 50, h], [w + 50, 0]
            ];
        },
        duration: 1.0,
        easing: [0.25, 0.1, 0.25, 1.0]
    },
    
    "Horizontal Wipe Right": {
        category: "Wipes",
        description: "Horizontal wipe from left to right",
        maskPath: function(comp) {
            var w = comp.width, h = comp.height;
            return [
                [-50, 0], [-50, h], [-50, h], [-50, 0]
            ];
        },
        endPath: function(comp) {
            var w = comp.width, h = comp.height;
            return [
                [-50, 0], [-50, h], [w + 50, h], [w + 50, 0]
            ];
        },
        duration: 1.0,
        easing: [0.25, 0.1, 0.25, 1.0]
    },
    
    "Vertical Wipe Up": {
        category: "Wipes",
        description: "Vertical wipe from bottom to top",
        maskPath: function(comp) {
            var w = comp.width, h = comp.height;
            return [
                [0, h + 50], [w, h + 50], [w, h + 50], [0, h + 50]
            ];
        },
        endPath: function(comp) {
            var w = comp.width, h = comp.height;
            return [
                [0, -50], [w, -50], [w, h + 50], [0, h + 50]
            ];
        },
        duration: 1.0,
        easing: [0.25, 0.1, 0.25, 1.0]
    },
    
    "Vertical Wipe Down": {
        category: "Wipes",
        description: "Vertical wipe from top to bottom",
        maskPath: function(comp) {
            var w = comp.width, h = comp.height;
            return [
                [0, -50], [w, -50], [w, -50], [0, -50]
            ];
        },
        endPath: function(comp) {
            var w = comp.width, h = comp.height;
            return [
                [0, -50], [w, -50], [w, h + 50], [0, h + 50]
            ];
        },
        duration: 1.0,
        easing: [0.25, 0.1, 0.25, 1.0]
    },
    
    // Circular Transitions
    "Circle Expand": {
        category: "Circles",
        description: "Circular expansion from center",
        maskPath: function(comp) {
            var centerX = comp.width / 2;
            var centerY = comp.height / 2;
            return createCirclePath(centerX, centerY, 0);
        },
        endPath: function(comp) {
            var centerX = comp.width / 2;
            var centerY = comp.height / 2;
            var maxRadius = Math.sqrt(Math.pow(comp.width, 2) + Math.pow(comp.height, 2)) / 2 + 50;
            return createCirclePath(centerX, centerY, maxRadius);
        },
        duration: 1.2,
        easing: [0.4, 0.0, 0.2, 1.0]
    },
    
    "Circle Contract": {
        category: "Circles",
        description: "Circular contraction to center",
        maskPath: function(comp) {
            var centerX = comp.width / 2;
            var centerY = comp.height / 2;
            var maxRadius = Math.sqrt(Math.pow(comp.width, 2) + Math.pow(comp.height, 2)) / 2 + 50;
            return createCirclePath(centerX, centerY, maxRadius);
        },
        endPath: function(comp) {
            var centerX = comp.width / 2;
            var centerY = comp.height / 2;
            return createCirclePath(centerX, centerY, 0);
        },
        duration: 1.2,
        easing: [0.4, 0.0, 0.2, 1.0]
    },
    
    "Circle Top Left": {
        category: "Circles",
        description: "Circular expansion from top left",
        maskPath: function(comp) {
            return createCirclePath(0, 0, 0);
        },
        endPath: function(comp) {
            var maxRadius = Math.sqrt(Math.pow(comp.width, 2) + Math.pow(comp.height, 2)) + 50;
            return createCirclePath(0, 0, maxRadius);
        },
        duration: 1.2,
        easing: [0.4, 0.0, 0.2, 1.0]
    },
    
    "Circle Bottom Right": {
        category: "Circles",
        description: "Circular expansion from bottom right",
        maskPath: function(comp) {
            return createCirclePath(comp.width, comp.height, 0);
        },
        endPath: function(comp) {
            var maxRadius = Math.sqrt(Math.pow(comp.width, 2) + Math.pow(comp.height, 2)) + 50;
            return createCirclePath(comp.width, comp.height, maxRadius);
        },
        duration: 1.2,
        easing: [0.4, 0.0, 0.2, 1.0]
    },
    
    // Diagonal Transitions
    "Diagonal Wipe TL-BR": {
        category: "Diagonals",
        description: "Diagonal wipe from top-left to bottom-right",
        maskPath: function(comp) {
            var w = comp.width, h = comp.height;
            return [
                [-50, -50], [0, -100], [0, -100], [-50, -50]
            ];
        },
        endPath: function(comp) {
            var w = comp.width, h = comp.height;
            return [
                [-50, -50], [w + 50, h + 50], [w + 100, h], [50, -100]
            ];
        },
        duration: 1.1,
        easing: [0.25, 0.1, 0.25, 1.0]
    },
    
    "Diagonal Wipe TR-BL": {
        category: "Diagonals",
        description: "Diagonal wipe from top-right to bottom-left",
        maskPath: function(comp) {
            var w = comp.width, h = comp.height;
            return [
                [w + 50, -50], [w + 100, 0], [w + 100, 0], [w + 50, -50]
            ];
        },
        endPath: function(comp) {
            var w = comp.width, h = comp.height;
            return [
                [w + 50, -50], [-50, h + 50], [-100, h], [w - 50, -100]
            ];
        },
        duration: 1.1,
        easing: [0.25, 0.1, 0.25, 1.0]
    },
    
    // Split Transitions
    "Horizontal Split": {
        category: "Splits",
        description: "Horizontal split from center",
        maskPath: function(comp) {
            var w = comp.width, h = comp.height;
            var centerY = h / 2;
            return [
                [0, centerY - 5], [w, centerY - 5], [w, centerY + 5], [0, centerY + 5]
            ];
        },
        endPath: function(comp) {
            var w = comp.width, h = comp.height;
            return [
                [0, -50], [w, -50], [w, h + 50], [0, h + 50]
            ];
        },
        duration: 1.0,
        easing: [0.4, 0.0, 0.2, 1.0]
    },
    
    "Vertical Split": {
        category: "Splits",
        description: "Vertical split from center",
        maskPath: function(comp) {
            var w = comp.width, h = comp.height;
            var centerX = w / 2;
            return [
                [centerX - 5, 0], [centerX + 5, 0], [centerX + 5, h], [centerX - 5, h]
            ];
        },
        endPath: function(comp) {
            var w = comp.width, h = comp.height;
            return [
                [-50, 0], [w + 50, 0], [w + 50, h], [-50, h]
            ];
        },
        duration: 1.0,
        easing: [0.4, 0.0, 0.2, 1.0]
    },
    
    // Corner Transitions
    "Four Corners": {
        category: "Corners",
        description: "Expansion from all four corners",
        maskPath: function(comp) {
            var w = comp.width, h = comp.height;
            return [
                [0, 0], [0, 0], [0, 0], [0, 0],
                [w, 0], [w, 0], [w, 0], [w, 0],
                [w, h], [w, h], [w, h], [w, h],
                [0, h], [0, h], [0, h], [0, h]
            ];
        },
        endPath: function(comp) {
            var w = comp.width, h = comp.height;
            return [
                [-50, -50], [w + 50, -50], [w + 50, h + 50], [-50, h + 50]
            ];
        },
        duration: 1.3,
        easing: [0.4, 0.0, 0.2, 1.0],
        isComplex: true
    },
    
    // Iris Transitions
    "Iris Rectangle": {
        category: "Iris",
        description: "Rectangular iris opening from center",
        maskPath: function(comp) {
            var centerX = comp.width / 2;
            var centerY = comp.height / 2;
            return [
                [centerX, centerY], [centerX, centerY], [centerX, centerY], [centerX, centerY]
            ];
        },
        endPath: function(comp) {
            var w = comp.width, h = comp.height;
            return [
                [-50, -50], [w + 50, -50], [w + 50, h + 50], [-50, h + 50]
            ];
        },
        duration: 1.1,
        easing: [0.4, 0.0, 0.6, 1.0]
    },
    
    // Clock Wipe
    "Clock Wipe": {
        category: "Special",
        description: "Clock-style radial wipe",
        maskPath: function(comp) {
            var centerX = comp.width / 2;
            var centerY = comp.height / 2;
            return createClockPath(centerX, centerY, 0, comp);
        },
        endPath: function(comp) {
            var centerX = comp.width / 2;
            var centerY = comp.height / 2;
            return createClockPath(centerX, centerY, 360, comp);
        },
        duration: 1.5,
        easing: [0.25, 0.1, 0.25, 1.0],
        isComplex: true
    },
    
    // Blinds Transitions
    "Horizontal Blinds": {
        category: "Blinds",
        description: "Horizontal blinds effect",
        maskPath: function(comp) {
            return createBlindsPath(comp, true, 0);
        },
        endPath: function(comp) {
            return createBlindsPath(comp, true, 1);
        },
        duration: 1.2,
        easing: [0.25, 0.1, 0.25, 1.0],
        isComplex: true
    },
    
    "Vertical Blinds": {
        category: "Blinds",
        description: "Vertical blinds effect",
        maskPath: function(comp) {
            return createBlindsPath(comp, false, 0);
        },
        endPath: function(comp) {
            return createBlindsPath(comp, false, 1);
        },
        duration: 1.2,
        easing: [0.25, 0.1, 0.25, 1.0],
        isComplex: true
    },
    
    // Diamond Transition
    "Diamond": {
        category: "Shapes",
        description: "Diamond shape expansion",
        maskPath: function(comp) {
            var centerX = comp.width / 2;
            var centerY = comp.height / 2;
            return [
                [centerX, centerY], [centerX, centerY], [centerX, centerY], [centerX, centerY]
            ];
        },
        endPath: function(comp) {
            var w = comp.width, h = comp.height;
            var centerX = w / 2;
            var centerY = h / 2;
            var maxDist = Math.max(w, h) + 100;
            return [
                [centerX, centerY - maxDist],
                [centerX + maxDist, centerY],
                [centerX, centerY + maxDist],
                [centerX - maxDist, centerY]
            ];
        },
        duration: 1.2,
        easing: [0.4, 0.0, 0.2, 1.0]
    },
    
    // Spiral Transition
    "Spiral": {
        category: "Special",
        description: "Spiral reveal effect",
        maskPath: function(comp) {
            var centerX = comp.width / 2;
            var centerY = comp.height / 2;
            return createSpiralPath(centerX, centerY, 0, comp);
        },
        endPath: function(comp) {
            var centerX = comp.width / 2;
            var centerY = comp.height / 2;
            return createSpiralPath(centerX, centerY, 1, comp);
        },
        duration: 2.0,
        easing: [0.25, 0.1, 0.25, 1.0],
        isComplex: true
    },
    
    // Heart Shape
    "Heart": {
        category: "Shapes",
        description: "Heart shape expansion",
        maskPath: function(comp) {
            var centerX = comp.width / 2;
            var centerY = comp.height / 2;
            return [
                [centerX, centerY], [centerX, centerY], [centerX, centerY], [centerX, centerY]
            ];
        },
        endPath: function(comp) {
            var centerX = comp.width / 2;
            var centerY = comp.height / 2;
            var scale = Math.max(comp.width, comp.height) / 200;
            return createHeartPath(centerX, centerY, scale);
        },
        duration: 1.5,
        easing: [0.4, 0.0, 0.6, 1.0],
        isComplex: true
    }
};

// Helper Functions for Complex Paths
function createCirclePath(centerX, centerY, radius) {
    var path = [];
    var segments = 8;
    for (var i = 0; i <= segments; i++) {
        var angle = (i / segments) * 2 * Math.PI;
        var x = centerX + radius * Math.cos(angle);
        var y = centerY + radius * Math.sin(angle);
        path.push([x, y]);
    }
    return path;
}

function createClockPath(centerX, centerY, angle, comp) {
    var maxRadius = Math.sqrt(Math.pow(comp.width, 2) + Math.pow(comp.height, 2));
    var path = [[centerX, centerY]];
    
    var startAngle = -Math.PI / 2; // Start from top
    var endAngle = startAngle + (angle * Math.PI / 180);
    
    for (var i = 0; i <= angle; i += 15) {
        var currentAngle = startAngle + (i * Math.PI / 180);
        var x = centerX + maxRadius * Math.cos(currentAngle);
        var y = centerY + maxRadius * Math.sin(currentAngle);
        path.push([x, y]);
    }
    
    return path;
}

function createBlindsPath(comp, horizontal, progress) {
    var path = [];
    var strips = 8;
    var w = comp.width, h = comp.height;
    
    if (horizontal) {
        var stripHeight = h / strips;
        for (var i = 0; i < strips; i++) {
            var y = i * stripHeight;
            var stripWidth = w * progress;
            var x = (w - stripWidth) / 2;
            
            path.push([x, y]);
            path.push([x + stripWidth, y]);
            path.push([x + stripWidth, y + stripHeight]);
            path.push([x, y + stripHeight]);
        }
    } else {
        var stripWidth = w / strips;
        for (var i = 0; i < strips; i++) {
            var x = i * stripWidth;
            var stripHeight = h * progress;
            var y = (h - stripHeight) / 2;
            
            path.push([x, y]);
            path.push([x + stripWidth, y]);
            path.push([x + stripWidth, y + stripHeight]);
            path.push([x, y + stripHeight]);
        }
    }
    
    return path;
}

function createSpiralPath(centerX, centerY, progress, comp) {
    var path = [[centerX, centerY]];
    var maxRadius = Math.sqrt(Math.pow(comp.width, 2) + Math.pow(comp.height, 2)) / 2;
    var turns = 3;
    var totalAngle = turns * 2 * Math.PI * progress;
    
    for (var i = 0; i <= totalAngle * 180 / Math.PI; i += 5) {
        var angle = i * Math.PI / 180;
        var radius = (angle / (turns * 2 * Math.PI)) * maxRadius;
        var x = centerX + radius * Math.cos(angle);
        var y = centerY + radius * Math.sin(angle);
        path.push([x, y]);
    }
    
    return path;
}

function createHeartPath(centerX, centerY, scale) {
    var path = [];
    for (var t = 0; t <= 2 * Math.PI; t += 0.1) {
        var x = centerX + scale * 16 * Math.pow(Math.sin(t), 3);
        var y = centerY - scale * (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));
        path.push([x, y]);
    }
    return path;
}

// Main Transition Application Function
function applyTransition(transitionName, layer, startTime) {
    if (!layer || !layer.property("ADBE Mask Parade")) {
        alert("Please select a layer that supports masks.");
        return false;
    }
    
    var transition = TRANSITION_LIBRARY[transitionName];
    if (!transition) {
        alert("Transition '" + transitionName + "' not found.");
        return false;
    }
    
    var comp = layer.containingComp;
    if (!comp) {
        alert("Layer must be in a composition.");
        return false;
    }
    
    app.beginUndoGroup("Apply Mask Transition: " + transitionName);
    
    try {
        // Create new mask
        var masks = layer.property("ADBE Mask Parade");
        var newMask = masks.addProperty("ADBE Mask Atom");
        var maskPath = newMask.property("ADBE Mask Shape");
        var maskOpacity = newMask.property("ADBE Mask Opacity");
        
        // Set mask mode to Add
        newMask.property("ADBE Mask Mode").setValue(6403); // MaskMode.ADD
        
        // Create initial path
        var initialPath = new Shape();
        initialPath.vertices = transition.maskPath(comp);
        initialPath.closed = true;
        
        // Create end path
        var endPath = new Shape();
        endPath.vertices = transition.endPath(comp);
        endPath.closed = true;
        
        // Set initial keyframe
        maskPath.setValueAtTime(startTime, initialPath);
        
        // Set end keyframe
        var endTime = startTime + transition.duration;
        maskPath.setValueAtTime(endTime, endPath);
        
        // Apply easing
        if (transition.easing) {
            var keyIn = new KeyframeEase(transition.easing[2], transition.easing[3]);
            var keyOut = new KeyframeEase(transition.easing[0], transition.easing[1]);
            
            maskPath.setTemporalEaseAtKey(1, [keyOut], [keyIn]);
            maskPath.setTemporalEaseAtKey(2, [keyOut], [keyIn]);
        }
        
        // Set mask opacity to 100%
        maskOpacity.setValue(100);
        
        app.endUndoGroup();
        return true;
        
    } catch (error) {
        app.endUndoGroup();
        alert("Error applying transition: " + error.toString());
        return false;
    }
}

// UI Creation
function createUI() {
    var win = new Window("dialog", SCRIPT_NAME + " v" + VERSION);
    win.orientation = "column";
    win.alignChildren = "fill";
    win.preferredSize.width = 400;
    
    // Header
    var headerGroup = win.add("group");
    headerGroup.add("statictext", undefined, SCRIPT_NAME);
    
    // Category filter
    var filterGroup = win.add("group");
    filterGroup.add("statictext", undefined, "Category:");
    var categoryDropdown = filterGroup.add("dropdownlist", undefined, ["All"]);
    
    // Get unique categories
    var categories = ["All"];
    for (var name in TRANSITION_LIBRARY) {
        var cat = TRANSITION_LIBRARY[name].category;
        if (categories.indexOf(cat) === -1) {
            categories.push(cat);
        }
    }
    
    // Populate category dropdown
    for (var i = 1; i < categories.length; i++) {
        categoryDropdown.add("item", categories[i]);
    }
    categoryDropdown.selection = 0;
    
    // Transition list
    var listGroup = win.add("group");
    listGroup.orientation = "column";
    listGroup.alignChildren = "fill";
    
    var transitionList = listGroup.add("listbox");
    transitionList.preferredSize.height = 200;
    
    // Description panel
    var descGroup = win.add("group");
    descGroup.orientation = "column";
    descGroup.alignChildren = "fill";
    
    var descriptionText = descGroup.add("statictext", undefined, "Select a transition to see description", {multiline: true});
    descriptionText.preferredSize.height = 40;
    
    // Settings
    var settingsGroup = win.add("panel", undefined, "Settings");
    settingsGroup.orientation = "column";
    settingsGroup.alignChildren = "fill";
    
    var timeGroup = settingsGroup.add("group");
    timeGroup.add("statictext", undefined, "Start Time:");
    var startTimeEdit = timeGroup.add("edittext", undefined, "0");
    startTimeEdit.characters = 10;
    timeGroup.add("statictext", undefined, "seconds");
    
    // Buttons
    var buttonGroup = win.add("group");
    var applyBtn = buttonGroup.add("button", undefined, "Apply Transition");
    var cancelBtn = buttonGroup.add("button", undefined, "Cancel");
    
    // Populate transition list
    function populateList(category) {
        transitionList.removeAll();
        for (var name in TRANSITION_LIBRARY) {
            var transition = TRANSITION_LIBRARY[name];
            if (category === "All" || transition.category === category) {
                var item = transitionList.add("item", name);
                item.transitionName = name;
            }
        }
    }
    
    // Event handlers
    categoryDropdown.onChange = function() {
        populateList(this.selection.text);
    };
    
    transitionList.onSelectionChange = function() {
        if (this.selection) {
            var transition = TRANSITION_LIBRARY[this.selection.transitionName];
            descriptionText.text = transition.description + "\nDuration: " + transition.duration + "s";
        }
    };
    
    applyBtn.onClick = function() {
        if (!transitionList.selection) {
            alert("Please select a transition.");
            return;
        }
        
        var activeComp = app.project.activeItem;
        if (!activeComp || !(activeComp instanceof CompItem)) {
            alert("Please select a composition.");
            return;
        }
        
        var selectedLayers = activeComp.selectedLayers;
        if (selectedLayers.length === 0) {
            alert("Please select at least one layer.");
            return;
        }
        
        var startTime = parseFloat(startTimeEdit.text) || 0;
        var transitionName = transitionList.selection.transitionName;
        
        // Apply to all selected layers
        var successCount = 0;
        for (var i = 0; i < selectedLayers.length; i++) {
            if (applyTransition(transitionName, selectedLayers[i], startTime)) {
                successCount++;
            }
        }
        
        if (successCount > 0) {
            alert("Applied transition to " + successCount + " layer(s).");
            win.close();
        }
    };
    
    cancelBtn.onClick = function() {
        win.close();
    };
    
    // Initial population
    populateList("All");
    
    return win;
}

// Template for adding new transitions
// Copy this template and modify to add new transitions to the library
/*
"New Transition Name": {
    category: "Category Name",
    description: "Description of the transition effect",
    maskPath: function(comp) {
        // Return initial mask path vertices as array of [x, y] coordinates
        // comp.width and comp.height are available
        return [[0, 0], [comp.width, 0], [comp.width, comp.height], [0, comp.height]];
    },
    endPath: function(comp) {
        // Return final mask path vertices as array of [x, y] coordinates
        return [[0, 0], [comp.width, 0], [comp.width, comp.height], [0, comp.height]];
    },
    duration: 1.0, // Duration in seconds
    easing: [0.25, 0.1, 0.25, 1.0], // [outTangent, outInfluence, inTangent, inInfluence]
    isComplex: false // Set to true for complex paths that need special handling
}
*/

// Main execution
function main() {
    if (parseFloat(app.version) < 13.0) {
        alert("This script requires After Effects CS6 or later.");
        return;
    }
    
    var ui = createUI();
    ui.show();
}

// Run the script
main();


})();