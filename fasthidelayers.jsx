// =============================================================================
// PHOTOSHOP LAYER EXPORTER
// Exports each layer as a trimmed PNG using Action Descriptors for speed.
//
// HOW TO USE:
//   1. Open your PSD in Photoshop
//   2. Edit the CONFIG section below to match your needs
//   3. Run via File > Scripts > Browse and select this file
//
// PER-LAYER TAGS:
//   Add tag/property overrides to the LAYER_TAGS object using the layer's
//   exact name as the key. Any layer not listed uses the DEFAULT_EXPORT config.
//
// SUPPORTED LAYER TYPES:
//   - Pixel layers
//   - Shape layers
//   - Type layers
//   - Smart objects
//   - Grouped layers (each child exported individually unless SKIP_GROUP_FOLDERS = true)
//
// NOTE: Adjustment layers and Clipping Masks are skipped by default.
// =============================================================================


// =============================================================================
// CONFIG
// =============================================================================

var CONFIG = {

    // Folder to save exported PNGs. Leave blank ("") to be prompted each run.
    OUTPUT_FOLDER: "",

    // If true, skips layers whose names start with "_" (treat as private/hidden)
    SKIP_UNDERSCORE_LAYERS: true,

    // If true, skips layers that are currently hidden in the PSD
    SKIP_HIDDEN_LAYERS: false,

    // If true, group/folder layers themselves are not exported — only their children
    SKIP_GROUP_FOLDERS: true,

    // If true, skips adjustment layers (levels, curves, hue/sat, etc.)
    SKIP_ADJUSTMENT_LAYERS: true,

    // If true, appends the parent group name to the filename: "GroupName_LayerName.png"
    PREFIX_GROUP_NAME: false,

    // PNG bit depth: 24 (RGB, no alpha) or 32 (RGBA, with transparency)
    PNG_BIT_DEPTH: 32,

    // If true, writes a log file next to the exported PNGs
    WRITE_LOG: true

};


// =============================================================================
// PER-LAYER TAG OVERRIDES
// Add entries here to customize export behaviour per layer by exact layer name.
//
// Available tag properties:
//   skip          {Boolean}  - If true, this layer is not exported
//   suffix        {String}   - Appended to filename before .png  e.g. "_icon"
//   pngBitDepth   {Number}   - Override PNG_BIT_DEPTH for this layer (24 or 32)
//   paddingPx     {Number}   - Add N pixels of transparent padding around the trimmed bounds
//   customName    {String}   - Override the filename entirely (no extension needed)
//
// Example:
//   "Background": { skip: true },
//   "Logo":       { suffix: "_main", paddingPx: 10 },
//   "HUD Frame":  { customName: "ui_hud_frame", pngBitDepth: 32 }
// =============================================================================

var LAYER_TAGS = {

    // Add your per-layer overrides here:
    // "Layer Name": { skip: false, suffix: "", pngBitDepth: 32, paddingPx: 0, customName: "" }

};


// =============================================================================
// MAIN — do not edit below unless you know what you're doing
// =============================================================================

(function () {

    var doc;
    var outputFolder;
    var logLines = [];
    var exportCount = 0;
    var skipCount = 0;
    var errorCount = 0;
    var startTime = new Date();

    // -------------------------------------------------------------------------
    // Init
    // -------------------------------------------------------------------------

    if (app.documents.length === 0) {
        alert("No document is open. Please open a PSD file and run the script again.");
        return;
    }

    doc = app.activeDocument;

    // Resolve output folder
    if (CONFIG.OUTPUT_FOLDER === "") {
        outputFolder = Folder.selectDialog("Select the output folder for exported PNGs:");
        if (outputFolder === null) {
            alert("No folder selected. Export cancelled.");
            return;
        }
    } else {
        outputFolder = new Folder(CONFIG.OUTPUT_FOLDER);
        if (!outputFolder.exists) {
            outputFolder.create();
        }
    }

    log("=== Photoshop Layer Exporter ===");
    log("Document : " + doc.name);
    log("Output   : " + outputFolder.fsName);
    log("Started  : " + startTime.toString());
    log("");

    // -------------------------------------------------------------------------
    // Step 1: Collect all layers via fast read-only DOM traversal
    // -------------------------------------------------------------------------

    var layerList = [];
    collectLayers(doc.layers, layerList, "");

    log("Layers found: " + layerList.length);
    log("");

    // -------------------------------------------------------------------------
    // Step 2: Hide ALL layers in a single fast Action Descriptor call
    // -------------------------------------------------------------------------

    hideAllLayers();

    // -------------------------------------------------------------------------
    // Step 3: Export loop — show one layer, export, hide it again
    // -------------------------------------------------------------------------

    for (var i = 0; i < layerList.length; i++) {

        var entry = layerList[i];
        var layer = entry.layer;
        var tags  = getLayerTags(layer.name);

        // --- Skip checks ---

        if (tags.skip === true) {
            log("SKIP (tag)    : " + entry.fullPath);
            skipCount++;
            continue;
        }

        if (CONFIG.SKIP_UNDERSCORE_LAYERS && layer.name.charAt(0) === "_") {
            log("SKIP (_name)  : " + entry.fullPath);
            skipCount++;
            continue;
        }

        if (CONFIG.SKIP_HIDDEN_LAYERS && entry.wasHidden) {
            log("SKIP (hidden) : " + entry.fullPath);
            skipCount++;
            continue;
        }

        if (CONFIG.SKIP_ADJUSTMENT_LAYERS && isAdjustmentLayer(layer)) {
            log("SKIP (adj)    : " + entry.fullPath);
            skipCount++;
            continue;
        }

        if (CONFIG.SKIP_GROUP_FOLDERS && layer.typename === "LayerSet") {
            log("SKIP (group)  : " + entry.fullPath);
            skipCount++;
            continue;
        }

        // --- Show this layer ---
        showLayer(layer);

        // --- Export ---
        try {
            exportLayer(layer, entry, tags, outputFolder);
            exportCount++;
        } catch (e) {
            log("ERROR         : " + entry.fullPath + " — " + e.message);
            errorCount++;
        }

        // --- Hide this layer again ---
        hideLayer(layer);

    }

    // -------------------------------------------------------------------------
    // Step 4: Restore original visibility states
    // -------------------------------------------------------------------------

    restoreVisibility(layerList);

    // -------------------------------------------------------------------------
    // Done — report
    // -------------------------------------------------------------------------

    var endTime   = new Date();
    var elapsed   = Math.round((endTime - startTime) / 1000);

    log("");
    log("=== Export Complete ===");
    log("Exported : " + exportCount);
    log("Skipped  : " + skipCount);
    log("Errors   : " + errorCount);
    log("Time     : " + elapsed + "s");

    if (CONFIG.WRITE_LOG) {
        writeLog(outputFolder);
    }

    alert(
        "Export complete!\n\n" +
        "Exported : " + exportCount + " layers\n" +
        "Skipped  : " + skipCount + "\n" +
        "Errors   : " + errorCount + "\n" +
        "Time     : " + elapsed + "s\n\n" +
        "Output   : " + outputFolder.fsName
    );

})();


// =============================================================================
// LAYER COLLECTION
// Recursively walks the layer tree, recording each layer and its original
// visibility state so we can restore it after export.
// =============================================================================

function collectLayers(layers, outList, parentPath) {

    // Photoshop layer arrays are top-to-bottom in the panel, index 0 = topmost
    for (var i = 0; i < layers.length; i++) {

        var layer    = layers[i];
        var fullPath = (parentPath === "") ? layer.name : parentPath + "/" + layer.name;

        outList.push({
            layer    : layer,
            fullPath : fullPath,
            wasHidden: !layer.visible
        });

        // Recurse into groups
        if (layer.typename === "LayerSet") {
            collectLayers(layer.layers, outList, fullPath);
        }
    }
}


// =============================================================================
// ACTION DESCRIPTOR HELPERS
// These bypass the DOM for visibility operations — much faster than
// setting layer.visible on each layer individually.
// =============================================================================

// Hide ALL layers in the document in a single call
function hideAllLayers() {
    try {
        // Select all layers
        var selDesc = new ActionDescriptor();
        var selRef  = new ActionReference();
        selRef.putEnumerated(
            charIDToTypeID("Lyr "),
            charIDToTypeID("Ordn"),
            charIDToTypeID("Al  ")
        );
        selDesc.putReference(charIDToTypeID("null"), selRef);
        executeAction(stringIDToTypeID("selectAllLayers"), selDesc, DialogModes.NO);

        // Hide the selection
        var hideDesc = new ActionDescriptor();
        var hideList = new ActionList();
        var hideRef  = new ActionReference();
        hideRef.putEnumerated(
            charIDToTypeID("Lyr "),
            charIDToTypeID("Ordn"),
            charIDToTypeID("Trgt")
        );
        hideList.putReference(hideRef);
        hideDesc.putList(charIDToTypeID("null"), hideList);
        executeAction(charIDToTypeID("Hd  "), hideDesc, DialogModes.NO);

    } catch (e) {
        // Fallback: DOM loop (slower but safe)
        setAllLayersVisible(app.activeDocument.layers, false);
    }
}

// Show a single layer via Action Descriptor
function showLayer(layer) {
    try {
        var desc = new ActionDescriptor();
        var list = new ActionList();
        var ref  = new ActionReference();
        ref.putIdentifier(charIDToTypeID("Lyr "), layer.id);
        list.putReference(ref);
        desc.putList(charIDToTypeID("null"), list);
        executeAction(charIDToTypeID("Shw "), desc, DialogModes.NO);
    } catch (e) {
        layer.visible = true; // DOM fallback
    }
}

// Hide a single layer via Action Descriptor
function hideLayer(layer) {
    try {
        var desc = new ActionDescriptor();
        var list = new ActionList();
        var ref  = new ActionReference();
        ref.putIdentifier(charIDToTypeID("Lyr "), layer.id);
        list.putReference(ref);
        desc.putList(charIDToTypeID("null"), list);
        executeAction(charIDToTypeID("Hd  "), desc, DialogModes.NO);
    } catch (e) {
        layer.visible = false; // DOM fallback
    }
}

// DOM fallback — recursive visibility setter
function setAllLayersVisible(layers, visible) {
    for (var i = 0; i < layers.length; i++) {
        layers[i].visible = visible;
        if (layers[i].typename === "LayerSet") {
            setAllLayersVisible(layers[i].layers, visible);
        }
    }
}

// Restore all layers to their original visibility state after export
function restoreVisibility(layerList) {
    for (var i = 0; i < layerList.length; i++) {
        var entry = layerList[i];
        if (!entry.wasHidden) {
            showLayer(entry.layer);
        }
        // Hidden layers stay hidden — hideAllLayers() already covers them
    }
}


// =============================================================================
// EXPORT
// Duplicates the active document state (single visible layer), flattens,
// trims to bounds, and saves as PNG.
// =============================================================================

function exportLayer(layer, entry, tags, outputFolder) {

    var doc      = app.activeDocument;
    var padding  = (tags.paddingPx !== undefined) ? parseInt(tags.paddingPx) : 0;
    var bitDepth = (tags.pngBitDepth !== undefined) ? tags.pngBitDepth : CONFIG.PNG_BIT_DEPTH;

    // Build filename
    var filename;
    if (tags.customName && tags.customName !== "") {
        filename = sanitizeFilename(tags.customName);
    } else {
        var baseName = CONFIG.PREFIX_GROUP_NAME ? entry.fullPath.replace(/\//g, "_") : layer.name;
        filename = sanitizeFilename(baseName) + (tags.suffix || "");
    }
    filename += ".png";

    var outFile = new File(outputFolder.fsName + "/" + filename);

    // Duplicate the document — we'll flatten and crop the duplicate
    var dupDoc = doc.duplicate();
    dupDoc.activeLayer = dupDoc.layers[0]; // safety

    try {

        // Flatten the duplicate down to a single merged layer
        dupDoc.flatten();

        // Trim transparent pixels
        dupDoc.trim(TrimType.TRANSPARENT, true, true, true, true);

        // If the document is now empty (layer had no pixels), bail
        if (dupDoc.width == 0 || dupDoc.height == 0) {
            dupDoc.close(SaveOptions.DONOTSAVECHANGES);
            log("SKIP (empty)  : " + entry.fullPath);
            skipCount++;
            return;
        }

        // Optional padding: expand canvas symmetrically
        if (padding > 0) {
            var newW = dupDoc.width  + (padding * 2);
            var newH = dupDoc.height + (padding * 2);
            dupDoc.resizeCanvas(newW, newH, AnchorPosition.MIDDLECENTER);
        }

        // Flatten to 8bpc RGB/RGBA for PNG export
        if (dupDoc.bitsPerChannel !== BitsPerChannelType.EIGHT) {
            dupDoc.bitsPerChannel = BitsPerChannelType.EIGHT;
        }

        // Save as PNG
        var pngOptions    = new PNGSaveOptions();
        pngOptions.interlaced   = false;
        pngOptions.compression  = 6; // 0=none, 9=max. 6 is a good balance

        dupDoc.saveAs(outFile, pngOptions, true, Extension.LOWERCASE);

        log("EXPORT        : " + entry.fullPath + "  →  " + filename);

    } finally {
        dupDoc.close(SaveOptions.DONOTSAVECHANGES);
    }
}


// =============================================================================
// UTILITIES
// =============================================================================

// Get the tag object for a layer, merged with defaults
function getLayerTags(layerName) {
    var defaults = {
        skip       : false,
        suffix     : "",
        pngBitDepth: CONFIG.PNG_BIT_DEPTH,
        paddingPx  : 0,
        customName : ""
    };

    if (LAYER_TAGS.hasOwnProperty(layerName)) {
        var overrides = LAYER_TAGS[layerName];
        for (var key in overrides) {
            if (overrides.hasOwnProperty(key)) {
                defaults[key] = overrides[key];
            }
        }
    }

    return defaults;
}

// Detect adjustment layers by type name
function isAdjustmentLayer(layer) {
    var adjustmentTypes = [
        "AdjustmentLayer",
        "BrightnessContrastLayer",
        "ColorBalanceLayer",
        "CurvesLayer",
        "ExposureLayer",
        "GradientMapLayer",
        "HueSaturationLayer",
        "InvertAdjustmentLayer",
        "LevelsLayer",
        "PhotoFilterLayer",
        "PosterizeLayer",
        "SelectiveColorLayer",
        "ThresholdLayer",
        "VibranceLayer"
    ];
    for (var i = 0; i < adjustmentTypes.length; i++) {
        if (layer.typename === adjustmentTypes[i]) return true;
    }
    return false;
}

// Strip characters illegal in filenames, replace spaces with underscores
function sanitizeFilename(name) {
    return name
        .replace(/[\\\/:\*\?"<>\|]/g, "")
        .replace(/\s+/g, "_")
        .replace(/\.+$/, "");
}

// Append a line to the in-memory log
function log(msg) {
    logLines.push(msg);
    $.writeln(msg); // Also writes to ExtendScript console
}

// Write log array to disk
function writeLog(folder) {
    try {
        var logFile = new File(folder.fsName + "/export_log.txt");
        logFile.open("w");
        logFile.write(logLines.join("\n"));
        logFile.close();
    } catch (e) {
        // Non-fatal — log write failure doesn't abort export
    }
}
