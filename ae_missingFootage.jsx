// Missing Footage Scanner for After Effects
// Version 1.0
// Scans all compositions for missing footage and generates detailed report

(function() {


var SCRIPT_NAME = "Missing Footage Scanner";
var VERSION = "1.0";

// Data structure to store missing footage information
var missingFootageData = [];

// Main scanning function
function scanProjectForMissingFootage() {
    var project = app.project;
    
    if (!project) {
        alert("No project is currently open.");
        return null;
    }
    
    if (project.numItems === 0) {
        alert("Project contains no items.");
        return null;
    }
    
    missingFootageData = []; // Reset data
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
    
    // Progress tracking
    app.beginUndoGroup("Scanning for Missing Footage");
    
    try {
        // Scan each composition
        for (var i = 1; i <= project.numItems; i++) {
            var item = project.item(i);
            
            if (item instanceof CompItem) {
                scannedComps++;
                
                // Update progress (if we want to show progress)
                var progress = Math.round((scannedComps / totalComps) * 100);
                
                // Scan this composition
                scanComposition(item);
            }
        }
        
        app.endUndoGroup();
        return missingFootageData;
        
    } catch (error) {
        app.endUndoGroup();
        alert("Error during scanning: " + error.toString());
        return null;
    }
}

// Scan individual composition
function scanComposition(comp) {
    try {
        // Scan each layer in the composition
        for (var layerIndex = 1; layerIndex <= comp.numLayers; layerIndex++) {
            var layer = comp.layer(layerIndex);
            scanLayer(layer, comp, layerIndex);
        }
    } catch (error) {
        // Log error but continue scanning other comps
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

// Scan individual layer
function scanLayer(layer, comp, layerIndex) {
    try {
        var source = layer.source;
        
        if (!source) {
            // Layer has no source (solid, text, etc.)
            return;
        }
        
        // Check if source is footage item
        if (source instanceof FootageItem) {
            scanFootageItem(source, layer, comp, layerIndex);
        }
        // Check if source is a composition (pre-comp)
        else if (source instanceof CompItem) {
            // Recursively scan pre-compositions
            scanComposition(source);
        }
        
    } catch (error) {
        // Record error for this specific layer
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

// Scan footage item for missing files
function scanFootageItem(footageItem, layer, comp, layerIndex) {
    try {
        var isMissing = false;
        var missingStatus = "OK";
        var filePath = "N/A";
        var footageType = "UNKNOWN";
        
        // Determine footage type
        if (footageItem.mainSource instanceof FileSource) {
            var fileSource = footageItem.mainSource;
            filePath = fileSource.file ? fileSource.file.fsName : "No file path";
            footageType = "FILE";
            
            // Check if file is missing
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
        
        // Additional checks for missing footage
        if (footageItem.footageMissing) {
            isMissing = true;
            missingStatus = "FOOTAGE_MISSING_FLAG";
        }
        
        // Only add to results if footage is missing or we want all footage
        if (isMissing) {
            missingFootageData.push({
                compName: comp.name,
                layerName: layer.name || "Layer " + layerIndex,
                layerIndex: layerIndex,
                footageName: footageItem.name,
                filePath: filePath,
                footageType: footageType,
                missingStatus: missingStatus,
                footageWidth: footageItem.width || 0,
                footageHeight: footageItem.height || 0,
                footageDuration: footageItem.duration || 0,
                footageFrameRate: footageItem.frameRate || 0
            });
        }
        
    } catch (error) {
        // Record error for this specific footage item
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

// Generate text report
function generateTextReport(data) {
    var report = "";
    report += "========================================\n";
    report += "       MISSING FOOTAGE REPORT\n";
    report += "========================================\n";
    report += "Generated: " + new Date().toString() + "\n";
    report += "Project: " + (app.project.file ? app.project.file.name : "Untitled Project") + "\n";
    report += "Total Missing Items: " + data.length + "\n";
    report += "========================================\n\n";
    
    if (data.length === 0) {
        report += "✓ No missing footage found in project!\n";
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
            report += "    Type: " + item.footageType + "\n";
            report += "    Status: " + item.missingStatus + "\n";
            report += "    Path: " + item.filePath + "\n";
            
            if (item.footageWidth && item.footageHeight) {
                report += "    Dimensions: " + item.footageWidth + "x" + item.footageHeight + "\n";
            }
            
            report += "\n";
        }
        report += "\n";
    }
    
    return report;
}

// Generate CSV report
function generateCSVReport(data) {
    var csv = "Comp Name,Layer Name,Layer Index,Footage Name,File Path,Footage Type,Missing Status,Width,Height,Duration,Frame Rate\n";
    
    for (var i = 0; i < data.length; i++) {
        var item = data[i];
        
        // Escape commas and quotes in text fields
        var compName = escapeCSV(item.compName);
        var layerName = escapeCSV(item.layerName);
        var footageName = escapeCSV(item.footageName);
        var filePath = escapeCSV(item.filePath);
        
        csv += compName + "," + 
               layerName + "," + 
               item.layerIndex + "," + 
               footageName + "," + 
               filePath + "," + 
               item.footageType + "," + 
               item.missingStatus + "," + 
               (item.footageWidth || "") + "," + 
               (item.footageHeight || "") + "," + 
               (item.footageDuration || "") + "," + 
               (item.footageFrameRate || "") + "\n";
    }
    
    return csv;
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
    win.preferredSize.width = 500;
    win.preferredSize.height = 400;
    
    // Header
    var headerGroup = win.add("group");
    headerGroup.add("statictext", undefined, "Scan project for missing footage");
    
    // Scan button
    var scanGroup = win.add("group");
    var scanBtn = scanGroup.add("button", undefined, "Scan Project");
    var statusText = scanGroup.add("statictext", undefined, "Ready to scan...");
    statusText.preferredSize.width = 200;
    
    // Results area
    var resultsPanel = win.add("panel", undefined, "Results");
    resultsPanel.orientation = "column";
    resultsPanel.alignChildren = "fill";
    resultsPanel.preferredSize.height = 250;
    
    var resultsList = resultsPanel.add("listbox");
    resultsList.preferredSize.height = 200;
    
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
        statusText.text = "Scanning...";
        scanBtn.enabled = false;
        
        // Small delay to allow UI update
        app.scheduleTask("var result = arguments[0](); arguments[1](result);", 10, false, 
            function() { return scanProjectForMissingFootage(); },
            function(data) {
                scanBtn.enabled = true;
                
                if (data === null) {
                    statusText.text = "Scan failed or cancelled";
                    return;
                }
                
                // Update results list
                resultsList.removeAll();
                
                if (data.length === 0) {
                    statusText.text = "✓ No missing footage found!";
                    summaryText.text = "All footage is properly linked.";
                    resultsList.add("item", "No missing footage found in project");
                } else {
                    statusText.text = "Found " + data.length + " missing item(s)";
                    summaryText.text = "Found " + data.length + " missing footage item(s) across project";
                    
                    for (var i = 0; i < data.length; i++) {
                        var item = data[i];
                        var listText = item.compName + " → Layer " + item.layerIndex + ": " + item.layerName + " (" + item.footageName + ")";
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
        if (missingFootageData.length > 0) {
            var report = generateTextReport(missingFootageData);
            var savedPath = saveReportToFile(report, "Missing_Footage_Report.txt", "Text Report");
            if (savedPath) {
                alert("Text report saved to:\n" + savedPath);
            }
        }
    };
    
    exportCSVBtn.onClick = function() {
        if (missingFootageData.length > 0) {
            var csv = generateCSVReport(missingFootageData);
            var savedPath = saveReportToFile(csv, "Missing_Footage_Report.csv", "CSV Report");
            if (savedPath) {
                alert("CSV report saved to:\n" + savedPath);
            }
        }
    };
    
    copyBtn.onClick = function() {
        if (missingFootageData.length > 0) {
            var report = generateTextReport(missingFootageData);
            // Copy to clipboard (this is a simplified version - actual clipboard access may vary)
            system.callSystem("echo \"" + report.replace(/"/g, '\\"') + "\" | pbcopy");
            alert("Report copied to clipboard!");
        }
    };
    
    closeBtn.onClick = function() {
        win.close();
    };
    
    return win;
}

// Quick scan function (no UI)
function quickScan() {
    var data = scanProjectForMissingFootage();
    if (data === null) return;
    
    if (data.length === 0) {
        alert("✓ No missing footage found in project!");
    } else {
        var report = generateTextReport(data);
        alert(report);
    }
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

// Alternative: Quick scan without UI (uncomment to use)
// quickScan();

// Run the script
main();


})();