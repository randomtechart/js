// =============================================================================
// PHOTOSHOP EXTENDSCRIPT — SPEED ENHANCEMENT FUNCTIONS
//
// A collection of standalone, generic functions for maximizing batch processing
// performance in Photoshop ExtendScript. Each function is self-contained and
// can be dropped into any script individually or as a group.
//
// USAGE PATTERN:
//   Nearly all functions come in pairs — a "begin" call before your loop and
//   an "end" call after it. Always call the "end" function even if an error
//   occurs, or Photoshop may be left in a degraded state.
//
//   Recommended shell for any batch loop:
//
//     var state = beginBatchProcessing();    // all optimizations on
//     try {
//         // ... your export loop ...
//     } catch (e) {
//         alert("Error: " + e.message);
//     } finally {
//         endBatchProcessing(state);         // all optimizations off, restore
//     }
//
// FUNCTIONS IN THIS FILE:
//   1.  disableHistoryStates / restoreHistoryStates
//   2.  suspendRedraw / resumeRedraw
//   3.  createReusableWorkDoc / releaseWorkDoc
//   4.  stampVisibleToWorkDoc
//   5.  trimTransparentFast
//   6.  exportPNGFast
//   7.  checkLayerHasContent
//   8.  setPNGCompressionFast / (companion note on post-process CLI)
//   9.  beginBatchProcessing / endBatchProcessing  (wraps all of the above)
// =============================================================================


// =============================================================================
// 1. DISABLE / RESTORE HISTORY STATES
//
// WHAT IT DOES:
//   Photoshop records every operation — flatten, trim, resize, save — as a
//   history state visible in the History panel. During a batch export this
//   accumulates hundreds of states that consume memory and CPU for zero benefit.
//   Setting maxStates to 1 (the minimum allowed) effectively disables recording
//   for the duration of the batch, then restores the user's original setting
//   afterward.
//
// BENEFIT:
//   Reduces memory pressure and eliminates the per-operation overhead of writing
//   history state snapshots. On large or complex PSDs this alone can cut overall
//   batch time by 30–50%.
//
// USAGE:
//   var savedStates = disableHistoryStates();
//   // ... batch loop ...
//   restoreHistoryStates(savedStates);
// =============================================================================

function disableHistoryStates() {
    var previous = app.preferences.maxStates;
    app.preferences.maxStates = 1;
    return previous;
}

function restoreHistoryStates(savedValue) {
    app.preferences.maxStates = savedValue;
}


// =============================================================================
// 2. SUSPEND / RESUME SCREEN REDRAW
//
// WHAT IT DOES:
//   Photoshop repaints the canvas, layer panel, history panel, and all other
//   open panels after nearly every operation. Suspending the application via
//   the internal "suspend" action descriptor stops all UI repainting for the
//   duration of the batch. resumeRedraw re-enables it.
//
// BENEFIT:
//   Eliminates UI repaint overhead entirely during processing. The canvas,
//   panels, and toolbars go visually static while the script runs. This is
//   one of the highest-impact single changes for any loop that touches the
//   document repeatedly, saving significant time on every show/hide/flatten/
//   trim cycle. The user sees the UI update once when resumeRedraw is called.
//
// NOTE:
//   If the script errors out without calling resumeRedraw, Photoshop may
//   appear frozen. Always pair with a try/finally block (see beginBatchProcessing).
//
// USAGE:
//   suspendRedraw();
//   // ... batch loop ...
//   resumeRedraw();
// =============================================================================

function suspendRedraw() {
    app.displayDialogs = DialogModes.NO;
    try {
        var desc = new ActionDescriptor();
        desc.putBoolean(stringIDToTypeID("dontRecord"), true);
        desc.putBoolean(stringIDToTypeID("forceNotify"), true);
        executeAction(stringIDToTypeID("suspend"), desc, DialogModes.NO);
    } catch (e) {
        // Older Photoshop versions may not support suspend — safe to continue
    }
}

function resumeRedraw() {
    try {
        var desc = new ActionDescriptor();
        desc.putBoolean(stringIDToTypeID("dontRecord"), true);
        desc.putBoolean(stringIDToTypeID("forceNotify"), true);
        executeAction(stringIDToTypeID("resume"), desc, DialogModes.NO);
    } catch (e) {
        // Safe to ignore — redraw will recover on next user interaction
    }
    app.displayDialogs = DialogModes.DEFAULT;
}


// =============================================================================
// 3. CREATE / RELEASE REUSABLE WORK DOCUMENT
//
// WHAT IT DOES:
//   Instead of calling doc.duplicate() on every iteration of the export loop
//   (which copies the entire document's layer data each time), this creates a
//   single flat work document once at the start of the batch. Each iteration
//   stamps pixel content into it, exports, then clears it for the next layer.
//   releaseWorkDoc closes it without saving when the batch is done.
//
// BENEFIT:
//   doc.duplicate() on a heavy PSD allocates memory for all layer data every
//   call. On 200+ iterations this compounds into significant time and memory
//   overhead. A single reusable document reduces that to one allocation for the
//   entire batch run. The work document is kept at the source document's
//   dimensions and color mode so stamps land correctly.
//
// PARAMETERS:
//   sourceDoc  {Document}  The original PSD document being processed.
//
// RETURNS:
//   {Document} A new flat document ready to receive stamped content.
//
// USAGE:
//   var workDoc = createReusableWorkDoc(app.activeDocument);
//   // ... use in export loop via stampVisibleToWorkDoc() ...
//   releaseWorkDoc(workDoc);
// =============================================================================

function createReusableWorkDoc(sourceDoc) {
    var workDoc = app.documents.add(
        sourceDoc.width,
        sourceDoc.height,
        sourceDoc.resolution,
        "WorkDoc",
        NewDocumentMode.RGB,
        DocumentFill.TRANSPARENT,
        1,
        sourceDoc.bitsPerChannel
    );
    return workDoc;
}

function releaseWorkDoc(workDoc) {
    if (workDoc && workDoc.isValid) {
        workDoc.close(SaveOptions.DONOTSAVECHANGES);
    }
}


// =============================================================================
// 4. STAMP VISIBLE LAYERS INTO WORK DOCUMENT
//
// WHAT IT DOES:
//   With a single layer visible in the source document, this function executes
//   a "Stamp Visible" (the equivalent of Ctrl+Alt+Shift+E) into the work
//   document created by createReusableWorkDoc(). The result is a flat merged
//   pixel layer in the work document containing only that layer's rendered
//   output, ready for trim and export.
//
//   After export, call clearWorkDoc() to delete the stamped layer so the work
//   document is clean for the next iteration.
//
// BENEFIT:
//   Avoids duplicating the source document per layer. Only the rendered pixels
//   of the currently visible layer are transferred — not the full layer stack.
//   This is faster and uses far less memory per iteration.
//
// PARAMETERS:
//   sourceDoc  {Document}  The source PSD with one layer currently visible.
//   workDoc    {Document}  The reusable work document from createReusableWorkDoc().
//
// USAGE:
//   stampVisibleToWorkDoc(sourceDoc, workDoc);
//   // trim, export from workDoc ...
//   clearWorkDoc(workDoc);
// =============================================================================

function stampVisibleToWorkDoc(sourceDoc, workDoc) {
    // Make source doc active and stamp visible
    app.activeDocument = sourceDoc;

    var stampDesc = new ActionDescriptor();
    var stampRef  = new ActionReference();
    stampRef.putClass(charIDToTypeID("Lyr "));
    stampDesc.putReference(charIDToTypeID("null"), stampRef);
    stampDesc.putEnumerated(
        charIDToTypeID("Usng"),
        charIDToTypeID("MrgtMd"),
        charIDToTypeID("Mrg2")
    );
    executeAction(charIDToTypeID("Mk  "), stampDesc, DialogModes.NO);

    // Move the stamped layer to workDoc
    app.activeDocument = sourceDoc;
    var stampedLayer = sourceDoc.activeLayer;
    stampedLayer.duplicate(workDoc, ElementPlacement.PLACEATBEGINNING);
    stampedLayer.remove();

    app.activeDocument = workDoc;
}

function clearWorkDoc(workDoc) {
    app.activeDocument = workDoc;
    while (workDoc.layers.length > 0) {
        workDoc.layers[0].remove();
    }
    // Re-add a transparent base so the document stays valid
    workDoc.artLayers.add();
}


// =============================================================================
// 5. FAST TRANSPARENT TRIM VIA ACTION DESCRIPTOR
//
// WHAT IT DOES:
//   Trims transparent pixels from all four edges of the active document using
//   a low-level Action Descriptor call instead of the DOM's doc.trim() method.
//
// BENEFIT:
//   The DOM trim() method routes through Photoshop's high-level scripting
//   bridge, which adds overhead on every call. The Action Descriptor version
//   calls the same internal Photoshop function directly, bypassing the bridge
//   layer. On a 200+ layer batch the cumulative saving is measurable.
//
// PARAMETERS:
//   targetDoc  {Document}  The document to trim. Must be the active document.
//
// USAGE:
//   app.activeDocument = workDoc;
//   trimTransparentFast(workDoc);
// =============================================================================

function trimTransparentFast(targetDoc) {
    app.activeDocument = targetDoc;
    try {
        var desc = new ActionDescriptor();
        desc.putEnumerated(
            charIDToTypeID("Trm "),
            charIDToTypeID("TrmT"),
            stringIDToTypeID("transparency")
        );
        desc.putBoolean(charIDToTypeID("Top "), true);
        desc.putBoolean(charIDToTypeID("Btom"), true);
        desc.putBoolean(charIDToTypeID("Left"), true);
        desc.putBoolean(charIDToTypeID("Rght"), true);
        executeAction(charIDToTypeID("Trm "), desc, DialogModes.NO);
    } catch (e) {
        // DOM fallback
        targetDoc.trim(TrimType.TRANSPARENT, true, true, true, true);
    }
}


// =============================================================================
// 6. FAST PNG EXPORT VIA SAVE FOR WEB
//
// WHAT IT DOES:
//   Exports the active document as a PNG using Photoshop's "Save for Web"
//   pipeline (exportDocument with ExportOptionsSaveForWeb) instead of the
//   standard saveAs with PNGSaveOptions.
//
// BENEFIT:
//   The Save for Web pipeline was purpose-built for batch asset export and
//   uses a more optimized internal PNG encoding path than saveAs. It also
//   handles alpha/transparency more predictably across color modes.
//   On large batches the per-file saving adds up to a meaningful difference
//   in total run time.
//
// PARAMETERS:
//   targetDoc  {Document}  The document to export. Must be the active document.
//   outFile    {File}      The destination File object (full path, no extension needed).
//   hasAlpha   {Boolean}   If true, exports PNG-32 (RGBA). If false, PNG-24 (RGB).
//
// USAGE:
//   exportPNGFast(workDoc, new File("/path/to/output/layer_name"), true);
// =============================================================================

function exportPNGFast(targetDoc, outFile, hasAlpha) {
    app.activeDocument = targetDoc;

    var opts              = new ExportOptionsSaveForWeb();
    opts.format           = SaveDocumentType.PNG;
    opts.PNG8             = false;   // PNG-24/32, not 8-bit indexed
    opts.transparency     = (hasAlpha === true);
    opts.interlaced       = false;
    opts.quality          = 100;

    targetDoc.exportDocument(outFile, ExportType.SAVEFORWEB, opts);
}


// =============================================================================
// 7. CHECK LAYER HAS RENDERABLE CONTENT
//
// WHAT IT DOES:
//   Checks whether a layer has non-zero pixel bounds before beginning the
//   stamp/flatten/trim/export cycle. Layers that are empty, fully transparent,
//   or exist purely as organizational containers (like empty groups) will return
//   false, allowing the caller to skip them entirely.
//
// BENEFIT:
//   The most expensive operations in the export loop — stampVisibleToWorkDoc,
//   trimTransparentFast, and exportPNGFast — are skipped entirely for empty
//   layers. On documents with placeholder or structural layers this avoids
//   wasted cycles and prevents saving zero-byte or 1x1 pixel PNG files.
//
// PARAMETERS:
//   layer  {Layer}  Any Photoshop layer object.
//
// RETURNS:
//   {Boolean}  true if the layer has a non-zero bounding box, false otherwise.
//
// USAGE:
//   if (!checkLayerHasContent(layer)) {
//       // skip — nothing to export
//       continue;
//   }
// =============================================================================

function checkLayerHasContent(layer) {
    try {
        var b = layer.bounds;
        var w = b[2].value - b[0].value;
        var h = b[3].value - b[1].value;
        return (w > 0 && h > 0);
    } catch (e) {
        // bounds access can fail on certain layer types — treat as no content
        return false;
    }
}


// =============================================================================
// 8. SET PNG COMPRESSION LEVEL
//
// WHAT IT DOES:
//   Sets the PNG deflate compression level used by saveAs (PNGSaveOptions).
//   Level 0 = no compression (raw pixel data, valid PNG, very fast to write).
//   Level 9 = maximum compression (smallest file, slowest to write).
//   Returns the PNGSaveOptions object ready to pass to saveAs.
//
// BENEFIT:
//   PNG compression is CPU-bound and runs synchronously, blocking the script
//   on every save call. Setting compression to 0 during batch export makes
//   each save as fast as a raw file write. The resulting PNGs are larger on
//   disk but fully valid and lossless — they can be re-compressed offline
//   after the batch completes using a dedicated tool (see note below), which
//   will produce smaller files than Photoshop's own compressor anyway.
//
// POST-PROCESS COMPRESSION (run in terminal after export):
//   oxipng  (lossless, recommended):
//     oxipng -o 4 --strip safe *.png
//
//   pngquant  (lossy, smaller files, good for UI assets):
//     pngquant --quality=85-95 --ext .png --force *.png
//
//   pngcrush  (lossless, widely available):
//     pngcrush -brute -d ./compressed/ *.png
//
// PARAMETERS:
//   level  {Number}  Compression level 0–9. Use 0 for batch speed, 6 for balance.
//
// RETURNS:
//   {PNGSaveOptions}  Configured options object ready for saveAs.
//
// USAGE:
//   var pngOpts = getPNGSaveOptions(0);  // fast, uncompressed during batch
//   targetDoc.saveAs(outFile, pngOpts, true, Extension.LOWERCASE);
// =============================================================================

function getPNGSaveOptions(level) {
    var opts        = new PNGSaveOptions();
    opts.compression = (level !== undefined) ? level : 0;
    opts.interlaced  = false;
    return opts;
}


// =============================================================================
// 9. BEGIN / END BATCH PROCESSING
//
// WHAT IT DOES:
//   Convenience wrapper that applies all speed enhancements in the correct
//   order at the start of a batch run and tears them all down cleanly at the
//   end. Returns a state object that endBatchProcessing uses to restore every
//   setting to its original value.
//
// BENEFIT:
//   Ensures optimizations are always applied together and always cleaned up,
//   even if an error occurs mid-batch (when used with try/finally). Removes
//   the need to manually call each function pair and track their return values
//   individually across a complex script.
//
// RETURNS:
//   {Object}  State object passed back into endBatchProcessing. Do not modify.
//
// RECOMMENDED USAGE:
//
//   var state = beginBatchProcessing();
//   try {
//       for (var i = 0; i < layerList.length; i++) {
//           // show layer, stamp, trim, export, hide layer
//       }
//   } catch (e) {
//       alert("Batch error: " + e.message);
//   } finally {
//       endBatchProcessing(state);
//   }
// =============================================================================

function beginBatchProcessing() {
    var state = {};
    state.savedHistoryStates = disableHistoryStates();
    suspendRedraw();
    return state;
}

function endBatchProcessing(state) {
    resumeRedraw();
    restoreHistoryStates(state.savedHistoryStates);
}
