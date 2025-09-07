// Photoshop Pie Chart Generator with Real-time Preview and SVG Export
// Save as .jsx file and run in Photoshop

#target photoshop

// Global variables
var doc = null;
var previewGroup = null;
var wedgeData = [];
var settings = {
radius: 100,
centerX: 200,
centerY: 200,
borderSize: 2,
canvasWidth: 400,
canvasHeight: 400
};

// Main function
function createPieChartInterface() {
// Create the dialog
var dialog = new Window(“dialog”, “Pie Chart Generator”);
dialog.orientation = “row”;
dialog.alignChildren = [“fill”, “top”];

```
// Left panel - Controls
var leftPanel = dialog.add("panel", undefined, "Controls");
leftPanel.orientation = "column";
leftPanel.alignChildren = ["fill", "top"];
leftPanel.preferredSize.width = 300;

// Number of wedges
var wedgeCountGroup = leftPanel.add("group");
wedgeCountGroup.add("statictext", undefined, "Number of Wedges:");
var wedgeCountSlider = wedgeCountGroup.add("slider", undefined, 3, 3, 12);
var wedgeCountText = wedgeCountGroup.add("edittext", undefined, "3");
wedgeCountText.characters = 3;

// Border size
var borderGroup = leftPanel.add("group");
borderGroup.add("statictext", undefined, "Border Size:");
var borderSlider = borderGroup.add("slider", undefined, 2, 0, 10);
var borderText = borderGroup.add("edittext", undefined, "2");
borderText.characters = 3;

// Radius
var radiusGroup = leftPanel.add("group");
radiusGroup.add("statictext", undefined, "Radius:");
var radiusSlider = radiusGroup.add("slider", undefined, 100, 50, 200);
var radiusText = radiusGroup.add("edittext", undefined, "100");
radiusText.characters = 4;

// Wedge controls container
var wedgePanel = leftPanel.add("panel", undefined, "Wedge Controls");
wedgePanel.orientation = "column";
wedgePanel.alignChildren = ["fill", "top"];
wedgePanel.preferredSize.height = 300;

// Right panel - Preview
var rightPanel = dialog.add("panel", undefined, "Preview");
rightPanel.orientation = "column";
rightPanel.alignChildren = ["fill", "top"];
rightPanel.preferredSize.width = 250;

var previewText = rightPanel.add("statictext", undefined, "Preview will appear in Photoshop");
previewText.alignment = "center";

// Buttons
var buttonGroup = dialog.add("group");
buttonGroup.orientation = "column";
var createButton = buttonGroup.add("button", undefined, "Create Document");
var exportButton = buttonGroup.add("button", undefined, "Export SVG");
var cancelButton = buttonGroup.add("button", undefined, "Cancel");

// Initialize wedge data
function initializeWedges(count) {
    wedgeData = [];
    var equalAngle = 360 / count;
    for (var i = 0; i < count; i++) {
        wedgeData.push({
            angle: equalAngle,
            color: getRandomColor(),
            groupName: "wedge_" + (i + 1),
            visible: true
        });
    }
    updateWedgeControls();
    updatePreview();
}

function getRandomColor() {
    var colors = [
        new SolidColor(), new SolidColor(), new SolidColor(), 
        new SolidColor(), new SolidColor(), new SolidColor()
    ];
    colors[0].rgb.red = 255; colors[0].rgb.green = 100; colors[0].rgb.blue = 100;
    colors[1].rgb.red = 100; colors[1].rgb.green = 255; colors[1].rgb.blue = 100;
    colors[2].rgb.red = 100; colors[2].rgb.green = 100; colors[2].rgb.blue = 255;
    colors[3].rgb.red = 255; colors[3].rgb.green = 255; colors[3].rgb.blue = 100;
    colors[4].rgb.red = 255; colors[4].rgb.green = 100; colors[4].rgb.blue = 255;
    colors[5].rgb.red = 100; colors[5].rgb.green = 255; colors[5].rgb.blue = 255;
    
    return colors[Math.floor(Math.random() * colors.length)];
}

function updateWedgeControls() {
    // Clear existing controls
    while (wedgePanel.children.length > 0) {
        wedgePanel.remove(wedgePanel.children[0]);
    }
    
    // Create controls for each wedge
    for (var i = 0; i < wedgeData.length; i++) {
        var wedgeGroup = wedgePanel.add("group");
        wedgeGroup.orientation = "column";
        wedgeGroup.alignChildren = ["fill", "top"];
        
        var headerGroup = wedgeGroup.add("group");
        headerGroup.add("statictext", undefined, "Wedge " + (i + 1) + ":");
        
        // Angle control
        var angleGroup = wedgeGroup.add("group");
        angleGroup.add("statictext", undefined, "Angle:");
        var angleSlider = angleGroup.add("slider", undefined, wedgeData[i].angle, 1, 359);
        var angleText = angleGroup.add("edittext", undefined, wedgeData[i].angle.toFixed(1));
        angleText.characters = 6;
        
        // Group name
        var groupGroup = wedgeGroup.add("group");
        groupGroup.add("statictext", undefined, "Group:");
        var groupText = groupGroup.add("edittext", undefined, wedgeData[i].groupName);
        groupText.characters = 12;
        
        // Visibility checkbox
        var visibilityGroup = wedgeGroup.add("group");
        var visibilityCheck = visibilityGroup.add("checkbox", undefined, "Visible");
        visibilityCheck.value = wedgeData[i].visible;
        
        // Color button (simplified - just shows RGB values)
        var colorGroup = wedgeGroup.add("group");
        colorGroup.add("statictext", undefined, "Color: RGB(" + 
            wedgeData[i].color.rgb.red + "," + 
            wedgeData[i].color.rgb.green + "," + 
            wedgeData[i].color.rgb.blue + ")");
        
        // Add separator
        wedgeGroup.add("panel", undefined, "");
        
        // Event handlers
        (function(index) {
            angleSlider.onChanging = function() {
                wedgeData[index].angle = this.value;
                angleText.text = this.value.toFixed(1);
                normalizeAngles();
                updatePreview();
            };
            
            angleText.onChanging = function() {
                var val = parseFloat(this.text);
                if (!isNaN(val) && val > 0 && val < 360) {
                    wedgeData[index].angle = val;
                    angleSlider.value = val;
                    normalizeAngles();
                    updatePreview();
                }
            };
            
            groupText.onChanging = function() {
                wedgeData[index].groupName = this.text;
            };
            
            visibilityCheck.onClick = function() {
                wedgeData[index].visible = this.value;
                updatePreview();
            };
        })(i);
    }
    
    dialog.layout.layout(true);
}

function normalizeAngles() {
    var total = 0;
    for (var i = 0; i < wedgeData.length; i++) {
        total += wedgeData[i].angle;
    }
    
    if (total !== 360) {
        var factor = 360 / total;
        for (var i = 0; i < wedgeData.length; i++) {
            wedgeData[i].angle *= factor;
        }
    }
}

function updatePreview() {
    if (!doc) return;
    
    try {
        app.activeDocument = doc;
        
        // Remove existing preview
        if (previewGroup) {
            previewGroup.remove();
        }
        
        // Create new preview group
        previewGroup = doc.layerSets.add();
        previewGroup.name = "Pie Chart Preview";
        
        createPieChart(true);
        
    } catch (e) {
        // Handle any errors silently
    }
}

function createPieChart(isPreview) {
    var currentAngle = 0;
    var targetGroup = isPreview ? previewGroup : doc;
    
    for (var i = 0; i < wedgeData.length; i++) {
        if (!wedgeData[i].visible) continue;
        
        var wedgeGroup = targetGroup.layerSets.add();
        wedgeGroup.name = wedgeData[i].groupName;
        
        // Calculate wedge path
        var startAngle = currentAngle;
        var endAngle = currentAngle + wedgeData[i].angle;
        
        // Create the wedge shape
        createWedgeShape(wedgeGroup, startAngle, endAngle, wedgeData[i].color, i);
        
        currentAngle = endAngle;
    }
    
    // Create borders if specified
    if (settings.borderSize > 0) {
        createBorders(targetGroup);
    }
}

function createWedgeShape(parentGroup, startAngle, endAngle, color, index) {
    var pathPoints = [];
    
    // Center point
    pathPoints.push([settings.centerX, settings.centerY]);
    
    // Calculate arc points
    var steps = Math.max(8, Math.ceil((endAngle - startAngle) / 5));
    for (var i = 0; i <= steps; i++) {
        var angle = startAngle + (endAngle - startAngle) * (i / steps);
        var radian = angle * Math.PI / 180;
        var x = settings.centerX + Math.cos(radian) * settings.radius;
        var y = settings.centerY + Math.sin(radian) * settings.radius;
        pathPoints.push([x, y]);
    }
    
    // Create path
    var pathArray = [];
    for (var i = 0; i < pathPoints.length; i++) {
        var pathPoint = new PathPointInfo();
        pathPoint.kind = PointKind.CORNERPOINT;
        pathPoint.anchor = pathPoints[i];
        pathPoint.leftDirection = pathPoints[i];
        pathPoint.rightDirection = pathPoints[i];
        pathArray.push(pathPoint);
    }
    
    var subPath = new SubPathInfo();
    subPath.operation = ShapeOperation.SHAPEXOR;
    subPath.closed = true;
    subPath.entireSubPath = pathArray;
    
    var pathItem = new PathItem();
    pathItem.subPathItems = [subPath];
    
    // Create shape layer
    var shapeLayer = parentGroup.pathItems.add(pathItem.name, [pathItem]);
    var fillColor = new SolidColor();
    fillColor.rgb.red = color.rgb.red;
    fillColor.rgb.green = color.rgb.green;
    fillColor.rgb.blue = color.rgb.blue;
    
    // Apply fill (this is a simplified approach)
    app.foregroundColor = fillColor;
    doc.selection.selectAll();
    doc.selection.fill(fillColor);
    doc.selection.deselect();
}

function createBorders(parentGroup) {
    // Create border paths between wedges
    var currentAngle = 0;
    
    for (var i = 0; i < wedgeData.length; i++) {
        if (!wedgeData[i].visible) continue;
        
        currentAngle += wedgeData[i].angle;
        
        // Create border line
        var radian = currentAngle * Math.PI / 180;
        var innerX = settings.centerX + Math.cos(radian) * (settings.radius * 0.3);
        var innerY = settings.centerY + Math.sin(radian) * (settings.radius * 0.3);
        var outerX = settings.centerX + Math.cos(radian) * settings.radius;
        var outerY = settings.centerY + Math.sin(radian) * settings.radius;
        
        // This would create the border line (simplified implementation)
    }
}

function exportSVG() {
    if (!doc) {
        alert("Please create a document first.");
        return;
    }
    
    var svgContent = generateSVG();
    
    // Save dialog
    var saveFile = File.saveDialog("Save SVG file", "*.svg");
    if (saveFile) {
        saveFile.open("w");
        saveFile.write(svgContent);
        saveFile.close();
        alert("SVG exported successfully!");
    }
}

function generateSVG() {
    var svg = '<?xml version="1.0" encoding="UTF-8"?>\n';
    svg += '<svg width="' + settings.canvasWidth + '" height="' + settings.canvasHeight + '" ';
    svg += 'xmlns="http://www.w3.org/2000/svg">\n';
    svg += '<defs>\n';
    svg += '<style>\n';
    svg += '.border-line { stroke: #000000; stroke-width: ' + settings.borderSize + '; fill: none; }\n';
    svg += '</style>\n';
    svg += '</defs>\n';
    
    var currentAngle = 0;
    
    for (var i = 0; i < wedgeData.length; i++) {
        if (!wedgeData[i].visible) continue;
        
        var startAngle = currentAngle;
        var endAngle = currentAngle + wedgeData[i].angle;
        
        svg += '<g id="' + wedgeData[i].groupName + '" data-group="' + wedgeData[i].groupName + '">\n';
        
        // Create wedge path
        var pathData = createWedgeSVGPath(startAngle, endAngle);
        var color = 'rgb(' + wedgeData[i].color.rgb.red + ',' + 
                   wedgeData[i].color.rgb.green + ',' + wedgeData[i].color.rgb.blue + ')';
        
        svg += '<path d="' + pathData + '" fill="' + color + '"/>\n';
        
        // Add border if specified
        if (settings.borderSize > 0) {
            var borderPath = createBorderSVGPath(endAngle);
            if (borderPath) {
                svg += '<path d="' + borderPath + '" class="border-line"/>\n';
            }
        }
        
        svg += '</g>\n';
        
        currentAngle = endAngle;
    }
    
    svg += '</svg>';
    return svg;
}

function createWedgeSVGPath(startAngle, endAngle) {
    var startRad = (startAngle - 90) * Math.PI / 180;
    var endRad = (endAngle - 90) * Math.PI / 180;
    
    var x1 = settings.centerX + Math.cos(startRad) * settings.radius;
    var y1 = settings.centerY + Math.sin(startRad) * settings.radius;
    var x2 = settings.centerX + Math.cos(endRad) * settings.radius;
    var y2 = settings.centerY + Math.sin(endRad) * settings.radius;
    
    var largeArc = (endAngle - startAngle) > 180 ? 1 : 0;
    
    var path = 'M ' + settings.centerX + ' ' + settings.centerY + ' ';
    path += 'L ' + x1 + ' ' + y1 + ' ';
    path += 'A ' + settings.radius + ' ' + settings.radius + ' 0 ' + largeArc + ' 1 ' + x2 + ' ' + y2 + ' ';
    path += 'Z';
    
    return path;
}

function createBorderSVGPath(angle) {
    if (settings.borderSize === 0) return null;
    
    var radian = (angle - 90) * Math.PI / 180;
    var innerRadius = settings.radius * 0.3;
    var x1 = settings.centerX + Math.cos(radian) * innerRadius;
    var y1 = settings.centerY + Math.sin(radian) * innerRadius;
    var x2 = settings.centerX + Math.cos(radian) * settings.radius;
    var y2 = settings.centerY + Math.sin(radian) * settings.radius;
    
    return 'M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2;
}

// Event handlers
wedgeCountSlider.onChanging = function() {
    wedgeCountText.text = Math.round(this.value).toString();
    initializeWedges(Math.round(this.value));
};

wedgeCountText.onChanging = function() {
    var val = parseInt(this.text);
    if (!isNaN(val) && val >= 3 && val <= 12) {
        wedgeCountSlider.value = val;
        initializeWedges(val);
    }
};

borderSlider.onChanging = function() {
    borderText.text = Math.round(this.value).toString();
    settings.borderSize = Math.round(this.value);
    updatePreview();
};

borderText.onChanging = function() {
    var val = parseInt(this.text);
    if (!isNaN(val) && val >= 0 && val <= 10) {
        borderSlider.value = val;
        settings.borderSize = val;
        updatePreview();
    }
};

radiusSlider.onChanging = function() {
    radiusText.text = Math.round(this.value).toString();
    settings.radius = Math.round(this.value);
    updatePreview();
};

radiusText.onChanging = function() {
    var val = parseInt(this.text);
    if (!isNaN(val) && val >= 50 && val <= 200) {
        radiusSlider.value = val;
        settings.radius = val;
        updatePreview();
    }
};

createButton.onClick = function() {
    // Create new document
    doc = app.documents.add(settings.canvasWidth, settings.canvasHeight, 72, "Pie Chart", NewDocumentMode.RGB);
    app.activeDocument = doc;
    
    createPieChart(false);
    dialog.close();
};

exportButton.onClick = function() {
    exportSVG();
};

cancelButton.onClick = function() {
    dialog.close();
};

// Initialize
initializeWedges(3);

// Show dialog
dialog.show();
```

}

// Run the script
createPieChartInterface();