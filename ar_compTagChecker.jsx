// Composition Tags Checker for After Effects
// Version 1.0
// Checks footage layers for missing composition tags at in/out points

(function() {


var SCRIPT_NAME = "Composition Tags Checker";
var VERSION = "1.0";

// Data structure to store layers missing tags
var layersMissingTags = [];

// Main scanning function
function scanProjectForMissingTags() {
    var project = app.project;
    
    if (!project) {
        alert("No project is currently open.");
        return null;
    }
    
    if (project.numItems === 0) {
        alert("Project contains no items.");
        return null;
    }
    
    layersMissingTags = []; // Reset data
    var totalComps = 0;
    var scannedComps = 0;
    
    // Count total compositions first
    for (var i = 1; i <= project.numItems; i++) {
        var item = project.item(i);
        if (item instanceof CompItem) {
            totalComps++;
        }
    }
    
    if (totalComps === 0) {
        alert("No compositions found in project.");
        return null;
    }
    
    app.beginUndoGroup("Scanning for Missing Composition Tags");
    
    try {
        // Scan each composition
        for (var i = 1; i <= project.numItems; i++) {
            var item = project.item(i);
            
            if (item instanceof CompItem) {
                scannedComps++;
                scanComposition(item);
            }
        }
        
        app.endUndoGroup();
        return layersMissingTags;
        
    } catch (error) {
        app.endUndoGroup();
        alert("Error during scanning: " + error.toString());
        return null;
    }
}

// Scan individual composition for layers missing tags
function scanComposition(comp) {
    try {
        // Get all composition markers/tags
        var compMarkers = comp.markerProperty;
        
        // Scan each layer in the composition
        for (var layerIndex = 1; layerIndex <= comp.numLayers; layerIndex++) {
            var layer = comp.layer(layerIndex);
            checkLayerForMissingTags(layer, comp, layerIndex, compMarkers);
        }
    } catch (error) {
        // Log error but continue scanning other comps
        layersMissingTags.push({
            compName: comp.name,
            footageName: "ERROR SCANNING COMP",
            layerLabel: "N/A",
            layerIndex: 0,
            layerName: "Error: " + error.toString(),
            missingInTag: true,
            missingOutTag: true,
            inPoint: 0,
            outPoint: 0,
            errorType: "SCAN_ERROR"
        });
    }
}

// Check if layer is footage and has missing tags
function checkLayerForMissingTags(layer, comp, layerIndex, compMarkers) {
    try {
        var source = layer.source;
        
        // Only check footage layers (skip solids, text, shapes, etc.)
        if (!source || !(source instanceof FootageItem)) {
            return;
        }
        
        // Skip if source is not a file-based footage
        if (!(source.mainSource instanceof FileSource)) {
            return;
        }
        
        // Get layer timing information
        var layerInPoint = layer.inPoint;
        var layerOutPoint = layer.outPoint;
        
        // Check for composition tags at in and out points
        var hasInTag = hasCompositionTagAtTime(compMarkers, layerInPoint);
        var hasOutTag = hasCompositionTagAtTime(compMarkers, layerOutPoint);
        
        // If either tag is missing, add to results
        if (!hasInTag || !hasOutTag) {
            
            // Get layer label (color label)
            var layerLabel = getLayerLabelName(layer.label);
            
            layersMissingTags.push({
                compName: comp.name,
                footageName: source.name,
                layerLabel: layerLabel,
                layerIndex: layerIndex,
                layerName: layer.name,
                missingInTag: !hasInTag,
                missingOutTag: !hasOutTag,
                inPoint: layerInPoint,
                outPoint: layerOutPoint,
                layerDuration: layerOutPoint - layerInPoint,
                sourceFile: source.mainSource.file ? source.mainSource.file.fsName : "No file path"
            });
        }
        
    } catch (error) {
        // Record error for this specific layer
        layersMissingTags.push({
            compName: comp.name,
            footageName: source ? source.name : "Unknown",
            layerLabel: "ERROR",
            layerIndex: layerIndex,
            layerName: layer.name || "Layer " + layerIndex,
            missingInTag: true,
            missingOutTag: true,
            inPoint: 0,
            outPoint: 0,
            errorType: "LAYER_SCAN_ERROR: " + error.toString()
        });
    }
}

// Check if there's a composition marker/tag at specific time
function hasCompositionTagAtTime(markerProperty, timeValue) {
    try {
        if (!markerProperty || markerProperty.numKeys === 0) {
            return false;
        }
        
        // Check each marker to see if it's at the specified time
        for (var i = 1; i <= markerProperty.numKeys; i++) {
            var markerTime = markerProperty.keyTime(i);
            
            // Allow small tolerance for floating point precision (1 frame at 29.97fps ≈ 0.0334 seconds)
            var tolerance = 0.04; 
            
            if (Math.abs(markerTime - timeValue) < tolerance) {
                return true;
            }
        }
        
        return false;
        
    } catch (error) {
        // If we can't check markers, assume no tag exists
        return false;
    }
}

// Convert layer label number to readable name
function getLayerLabelName(labelNumber) {
    var labelNames = [
        "None",      // 0
        "Red",       // 1
        "Yellow",    // 2
        "Aqua",      // 3
        "Pink",      // 4
        "Lavender",  // 5
        "Peach",     // 6
        "Sea Foam",  // 7
        "Blue",      // 8
        "Green",     // 9
        "Purple",    // 10
        "Orange",    // 11
        "Brown",     // 12
        "Fuchsia",   // 13
        "Cyan",      // 14
        "Sandstone", // 15
        "Dark Green" // 16
    ];
    
    if (labelNumber >= 0 && labelNumber < labelNames.length) {
        return labelNames[labelNumber];
    }
    
    return "Unknown (" + labelNumber + ")";
}

// Generate text report
function generateTextReport(data) {
    var report = "";
    report += "========================================\n";
    report += "    COMPOSITION TAGS CHECKER REPORT\n";
    report += "========================================\n";
    report += "Generated: " + new Date().toString() + "\n";
    report += "Project: " + (app.project.file ? app.project.file.name : "Untitled Project") + "\n";
    report += "Total Footage Layers Missing Tags: " + data.length + "\n";
    report += "========================================\n\n";
    
    if (data.length === 0) {
        report += "✓ All footage layers have composition tags at in/out points!\n";
        return report;
    }
    
    // Group by composition
    var compGroups = {};
    for (var i = 0; i < data.length; i++) {
        var item = data[i];
        if (!compGroups[item.compName]) {
            compGroups[item.compName] = [];
        }
        compGroups[item.compName].push(item);
    }
    
    // Generate report for each composition
    for (var compName in compGroups) {
        report += "COMPOSITION: " + compName + "\n";
        report += "----------------------------------------\n";
        
        var compItems = compGroups[compName];
        for (var j = 0; j < compItems.length; j++) {
            var item = compItems[j];
            
            report += "  Layer " + item.layerIndex + ": " + item.layerName + "\n";
            report += "    Footage: " + item.footageName + "\n";
            report += "    Label: " + item.layerLabel + "\n";
            report += "    In Point: " + formatTime(item.inPoint) + " (" + item.inPoint.toFixed(3) + "s)";
            
            if (item.missingInTag) {
                report += " ❌ MISSING TAG";
            } else {
                report += " ✓ Has tag";
            }
            report += "\n";
            
            report += "    Out Point: " + formatTime(item.outPoint) + " (" + item.outPoint.toFixed(3) + "s)";
            
            if (item.missingOutTag) {
                report += " ❌ MISSING TAG";
            } else {
                report += " ✓ Has tag";
            }
            report += "\n";
            
            if (item.layerDuration) {
                report += "    Duration: " + formatTime(item.layerDuration) + "\n";
            }
            
            if (item.sourceFile) {
                report += "    File: " + item.sourceFile + "\n";
            }
            
            if (item.errorType) {
                report += "    Error: " + item.errorType + "\n";
            }
            
            report += "\n";
        }
        report += "\n";
    }
    
    return report;
}

// Generate CSV report
function generateCSVReport(data) {
    var csv = "Comp Name,Footage Name,Layer Label,Layer Index,Layer Name,Missing In Tag,Missing Out Tag,In Point (seconds),Out Point (seconds),Duration,Source File\n";
    
    for (var i = 0; i < data.length; i++) {
        var item = data[i];
        
        // Escape commas and quotes in text fields
        var compName = escapeCSV(item.compName);
        var footageName = escapeCSV(item.footageName);
        var layerName = escapeCSV(item.layerName);
        var sourceFile = escapeCSV(item.sourceFile || "");
        
        csv += compName + "," + 
               footageName + "," + 
               item.layerLabel + "," + 
               item.layerIndex + "," + 
               layerName + "," + 
               (item.missingInTag ? "YES" : "NO") + "," + 
               (item.missingOutTag ? "YES" : "NO") + "," + 
               (item.inPoint || 0).toFixed(3) + "," + 
               (item.outPoint || 0).toFixed(3) + "," + 
               (item.layerDuration || 0).toFixed(3) + "," + 
               sourceFile + "\n";
    }
    
    return csv;
}

// Helper function to format time as MM:SS.mmm
function formatTime(timeInSeconds) {
    if (!timeInSeconds && timeInSeconds !== 0) return "00:00.000";
    
    var totalMilliseconds = Math.round(timeInSeconds * 1000);
    var minutes = Math.floor(totalMilliseconds / 60000);
    var seconds = Math.floor((totalMilliseconds % 60000) / 1000);
    var milliseconds = totalMilliseconds % 1000;
    
    return (minutes < 10 ? "0" : "") + minutes + ":" +
           (seconds < 10 ? "0" : "") + seconds + "." +
           (milliseconds < 100 ? "0" : "") + (milliseconds < 10 ? "0" : "") + milliseconds;
}

// Helper function to escape CSV values
function escapeCSV(value) {
    if (!value) return "";
    var stringValue = value.toString();
    if (stringValue.indexOf(',') !== -1 || stringValue.indexOf('"') !== -1 || stringValue.indexOf('\n') !== -1) {
        return '"' + stringValue.replace(/"/g, '""') + '"';
    }
    return stringValue;
}

// Save report to file
function saveReportToFile(content, filename, description) {
    try {
        var file = File.saveDialog("Save " + description, filename);
        if (file) {
            file.open("w");
            file.write(content);
            file.close();
            return file.fsName;
        }
    } catch (error) {
        alert("Error saving file: " + error.toString());
    }
    return null;
}

// Create UI
function createUI() {
    var win = new Window("dialog", SCRIPT_NAME + " v" + VERSION);
    win.orientation = "column";
    win.alignChildren = "fill";
    win.preferredSize.width = 600;
    win.preferredSize.height = 450;
    
    // Header
    var headerGroup = win.add("group");
    headerGroup.add("statictext", undefined, "Check footage layers for missing composition tags at in/out points");
    
    // Scan button
    var scanGroup = win.add("group");
    var scanBtn = scanGroup.add("button", undefined, "Scan Project");
    var statusText = scanGroup.add("statictext", undefined, "Ready to scan...");
    statusText.preferredSize.width = 300;
    
    // Results area
    var resultsPanel = win.add("panel", undefined, "Results");
    resultsPanel.orientation = "column";
    resultsPanel.alignChildren = "fill";
    resultsPanel.preferredSize.height = 280;
    
    var resultsList = resultsPanel.add("listbox");
    resultsList.preferredSize.height = 220;
    
    // Add columns header (visual guide)
    var headerText = resultsPanel.add("statictext", undefined, "Results show: Comp → Layer Index: Layer Name (Footage) - Missing Tags");
    headerText.justify = "center";
    
    // Summary
    var summaryText = resultsPanel.add("statictext", undefined, "No scan performed yet");
    
    // Export buttons
    var exportPanel = win.add("panel", undefined, "Export Results");
    exportPanel.orientation = "row";
    exportPanel.alignChildren = "center";
    
    var exportTxtBtn = exportPanel.add("button", undefined, "Export as Text");
    var exportCSVBtn = exportPanel.add("button", undefined, "Export as CSV");
    var copyBtn = exportPanel.add("button", undefined, "Copy to Clipboard");
    
    // Control buttons
    var buttonGroup = win.add("group");
    var closeBtn = buttonGroup.add("button", undefined, "Close");
    
    // Initially disable export buttons
    exportTxtBtn.enabled = false;
    exportCSVBtn.enabled = false;
    copyBtn.enabled = false;
    
    // Event handlers
    scanBtn.onClick = function() {
        statusText.text = "Scanning compositions...";
        scanBtn.enabled = false;
        
        // Small delay to allow UI update
        app.scheduleTask("var result = arguments[0](); arguments[1](result);", 10, false, 
            function() { return scanProjectForMissingTags(); },
            function(data) {
                scanBtn.enabled = true;
                
                if (data === null) {
                    statusText.text = "Scan failed or cancelled";
                    return;
                }
                
                // Update results list
                resultsList.removeAll();
                
                if (data.length === 0) {
                    statusText.text = "✓ All footage layers have proper tags!";
                    summaryText.text = "All footage layers have composition tags at their in/out points.";
                    resultsList.add("item", "✓ No missing tags found - all footage layers are properly tagged!");
                } else {
                    statusText.text = "Found " + data.length + " layer(s) missing tags";
                    summaryText.text = "Found " + data.length + " footage layer(s) missing composition tags";
                    
                    for (var i = 0; i < data.length; i++) {
                        var item = data[i];
                        
                        var missingTagsText = "";
                        if (item.missingInTag && item.missingOutTag) {
                            missingTagsText = "Missing: In & Out tags";
                        } else if (item.missingInTag) {
                            missingTagsText = "Missing: In tag";
                        } else if (item.missingOutTag) {
                            missingTagsText = "Missing: Out tag";
                        }
                        
                        var listText = item.compName + " → Layer " + item.layerIndex + ": " + 
                                     item.layerName + " (" + item.footageName + ") - " + missingTagsText;
                        
                        if (item.layerLabel && item.layerLabel !== "None") {
                            listText += " [" + item.layerLabel + "]";
                        }
                        
                        resultsList.add("item", listText);
                    }
                    
                    // Enable export buttons
                    exportTxtBtn.enabled = true;
                    exportCSVBtn.enabled = true;
                    copyBtn.enabled = true;
                }
            }
        );
    };
    
    exportTxtBtn.onClick = function() {
        if (layersMissingTags.length > 0) {
            var report = generateTextReport(layersMissingTags);
            var savedPath = saveReportToFile(report, "Missing_Composition_Tags_Report.txt", "Text Report");
            if (savedPath) {
                alert("Text report saved to:\n" + savedPath);
            }
        }
    };
    
    exportCSVBtn.onClick = function() {
        if (layersMissingTags.length > 0) {
            var csv = generateCSVReport(layersMissingTags);
            var savedPath = saveReportToFile(csv, "Missing_Composition_Tags_Report.csv", "CSV Report");
            if (savedPath) {
                alert("CSV report saved to:\n" + savedPath);
            }
        }
    };
    
    copyBtn.onClick = function() {
        if (layersMissingTags.length > 0) {
            var report = generateTextReport(layersMissingTags);
            // Note: Clipboard functionality may vary by system
            alert("Report generated. Use Export buttons to save the report.");
        }
    };
    
    closeBtn.onClick = function() {
        win.close();
    };
    
    return win;
}

// Main execution
function main() {
    if (parseFloat(app.version) < 13.0) {
        alert("This script requires After Effects CS6 or later.");
        return;
    }
    
    if (!app.project) {
        alert("Please open a project first.");
        return;
    }
    
    // Show UI
    var ui = createUI();
    ui.show();
}

// Run the script
main();


})();