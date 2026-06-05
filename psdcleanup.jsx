/**
 * ps_layer_cleanup.jsx
 * =====================================================================
 * High-speed Photoshop layer cleanup script using Action Manager (AM)
 * wherever possible to avoid slow DOM traversal.
 *
 * Operations (in safe execution order):
 *   PRE-A  Unlock all pixel/position/transparency locks on every layer
 *   PRE-B  Apply & remove layer masks (bakes mask into pixels)
 *   PRE-C  Merge linked layers
 *   PRE-D  Flatten fill layers (solid colour, gradient, pattern)  ← NEW
 *   PRE-E  Rasterize shape layers                                 ← NEW
 *
 *   MAIN PASS (top-down, index-stable):
 *   1.  Delete hidden layers & hidden groups
 *   2.  Delete empty layers (zero-bound pixel layers)
 *   3.  Remove empty groups — multi-pass until none remain        ← NEW
 *   4.  Strip spaces & special characters from layer names
 *   5.  Trim transparent pixels on pixel layers
 *   6.  Rasterize Smart Objects + flatten layer effects
 *         (Normal / Pass Through blend modes only)
 *   7.  Collapse clipping mask chains into their base layer
 *
 * Speed strategies:
 *   - Action Manager (executeAction / executeActionGet) for all ops
 *   - suspendHistory wraps entire run into a single undo state
 *   - Pre-passes run typed loops (fill/shape detection via lyrK enum)
 *     so the main pass never re-checks those layer kinds
 *   - Empty-group removal uses a repeat-until-stable loop so deeply
 *     nested empties don't require multiple script runs
 *   - Merge linked is global/upfront — maximum layer count reduction
 *     before per-layer work begins
 * =====================================================================
 */

// ─── ID helpers ───────────────────────────────────────────────────────────────
function cTID(s) { return app.charIDToTypeID(s); }
function sTID(s) { return app.stringIDToTypeID(s); }

// ─── Constants ────────────────────────────────────────────────────────────────
var NORMAL_MODE  = cTID("Nrml");
var PASS_THROUGH = sTID("passThrough");
var NAME_KEY     = cTID("Nm  ");
var VISIBLE_KEY  = sTID("visible");
var BLEND_KEY    = cTID("Md  ");
var LAYER_TYPE   = sTID("layerKind");

// lyrK enumeration values
var KIND_PIXEL       = cTID("pxl ");   // normal pixel layer
var KIND_GROUP       = cTID("lyrG");   // group / folder
var KIND_SO          = sTID("smartObjectLayer");
var KIND_TEXT        = cTID("txtr");   // type layer
var KIND_SHAPE       = cTID("vctr");   // shape / vector layer  ← used by PRE-E
var KIND_SOLID_FILL  = cTID("SClr");   // solid colour fill     ← used by PRE-D
var KIND_GRADIENT    = cTID("GrFl");   // gradient fill         ← used by PRE-D
var KIND_PATTERN     = cTID("Ptrn");   // pattern fill          ← used by PRE-D
var KIND_ADJUSTMENT  = cTID("AdjL");   // adjustment layer

// Protection / lock descriptor keys
var KEY_PROTECT          = sTID("protection");
var KEY_TRANSPARENCY     = sTID("transparencyLocked");
var KEY_COMPOSITING      = sTID("compositingLocked");
var KEY_POSITION         = sTID("positionLocked");
var KEY_ARTBOARD_ENABLED = sTID("artboardEditEnabled");

// ─── Core AM helpers ──────────────────────────────────────────────────────────

/** Select layer by 0-based-from-top index without forcing visibility */
function selectLayerByIndex(idx) {
    var ref  = new ActionReference();
    ref.putIndex(cTID("Lyr "), idx);
    var desc = new ActionDescriptor();
    desc.putReference(cTID("null"), ref);
    desc.putBoolean(sTID("makeVisible"), false);
    executeAction(cTID("slct"), desc, DialogModes.NO);
}

/** Return full descriptor for layer at index idx */
function getLayerDesc(idx) {
    var ref = new ActionReference();
    ref.putIndex(cTID("Lyr "), idx);
    return executeActionGet(ref);
}

/** Delete the currently active layer (and all its children if a group) */
function amDeleteLayer() {
    var ref  = new ActionReference();
    ref.putEnumerated(cTID("Lyr "), cTID("Ordn"), cTID("Trgt"));
    var desc = new ActionDescriptor();
    desc.putReference(cTID("null"), ref);
    executeAction(cTID("Dlt "), desc, DialogModes.NO);
}

/**
 * Rasterize active layer including any applied layer style.
 * Works for: smart objects, shapes, fill layers, type layers, effects.
 * Using "layerStyle" as the rasterize target bakes effects in the same call.
 */
function amRasterizeWithEffects() {
    var ref  = new ActionReference();
    ref.putEnumerated(cTID("Lyr "), cTID("Ordn"), cTID("Trgt"));
    var desc = new ActionDescriptor();
    desc.putReference(cTID("null"), ref);
    desc.putEnumerated(sTID("what"), sTID("rasterizeContent"), sTID("layerStyle"));
    executeAction(sTID("rasterizeLayer"), desc, DialogModes.NO);
}

/**
 * Rasterize active layer WITHOUT baking effects.
 * Used for shapes/fills when we only want the vector/fill content as pixels
 * and will handle effects separately (or they don't have any).
 */
function amRasterizeContent() {
    var ref  = new ActionReference();
    ref.putEnumerated(cTID("Lyr "), cTID("Ordn"), cTID("Trgt"));
    var desc = new ActionDescriptor();
    desc.putReference(cTID("null"), ref);
    desc.putEnumerated(sTID("what"), sTID("rasterizeContent"), sTID("rasterizeContent"));
    executeAction(sTID("rasterizeLayer"), desc, DialogModes.NO);
}

/** Merge Down active layer into the layer immediately below it */
function amMergeDown() {
    executeAction(cTID("Mrg2"), new ActionDescriptor(), DialogModes.NO);
}

/** Ungroup the active group, leaving its children in place */
function amUngroup() {
    executeAction(sTID("ungroupLayersEvent"), new ActionDescriptor(), DialogModes.NO);
}

/** Rename the active layer */
function amRenameLayer(newName) {
    var ref  = new ActionReference();
    ref.putEnumerated(cTID("Lyr "), cTID("Ordn"), cTID("Trgt"));
    var desc = new ActionDescriptor();
    desc.putReference(cTID("null"), ref);
    var layerDesc = new ActionDescriptor();
    layerDesc.putString(NAME_KEY, newName);
    desc.putObject(cTID("T   "), cTID("Lyr "), layerDesc);
    executeAction(cTID("setd"), desc, DialogModes.NO);
}

// ─── Layer kind helpers ───────────────────────────────────────────────────────

/**
 * Return the lyrK enumeration VALUE for a descriptor, or -1 on failure.
 * All isXxx() helpers below call this once and compare.
 */
function getLayerKind(desc) {
    try { return desc.getEnumerationValue(LAYER_TYPE); }
    catch(e) { return -1; }
}

function isGroup(desc)      { return getLayerKind(desc) === KIND_GROUP; }
function isSmartObject(desc){ return getLayerKind(desc) === KIND_SO; }
function isShapeLayer(desc) { return getLayerKind(desc) === KIND_SHAPE; }

/** Returns true if descriptor is any of the three fill layer kinds */
function isFillLayer(desc) {
    var k = getLayerKind(desc);
    return (k === KIND_SOLID_FILL || k === KIND_GRADIENT || k === KIND_PATTERN);
}

/** Returns true if blending mode is Normal or Pass Through */
function isNormalBlend(desc) {
    try {
        var v = desc.getEnumerationValue(BLEND_KEY);
        return (v === NORMAL_MODE || v === PASS_THROUGH);
    } catch(e) { return true; }
}

/** Returns true if layer has any layer effects descriptor */
function hasLayerEffects(desc) {
    try { return desc.hasKey(sTID("layerEffects")); }
    catch(e) { return false; }
}

/** Returns true if this layer is clipped to the layer below it */
function isClipped(desc) {
    try { return desc.getBoolean(sTID("grouped")); }
    catch(e) { return false; }
}

/** Returns true if layer descriptor has any lock active */
function hasAnyLock(desc) {
    try {
        if (!desc.hasKey(KEY_PROTECT)) return false;
        var p = desc.getObjectValue(KEY_PROTECT);
        return (p.getBoolean(KEY_TRANSPARENCY)     ||
                p.getBoolean(KEY_COMPOSITING)      ||
                p.getBoolean(KEY_POSITION)         ||
                p.getBoolean(KEY_ARTBOARD_ENABLED));
    } catch(e) { return false; }
}

/** Returns true if descriptor indicates a pixel mask exists */
function hasMask(desc) {
    try { return desc.getBoolean(sTID("hasUserMask")); }
    catch(e) { return false; }
}

/** Returns true if descriptor indicates a vector mask exists */
function hasVectorMask(desc) {
    try { return desc.getBoolean(sTID("hasVectorMask")); }
    catch(e) { return false; }
}

// ─── DOM fallback helpers (used only where AM can't give the data) ────────────

/** True if the active layer is a pixel layer with zero bounds (truly empty) */
function isPixelLayerEmpty(doc) {
    var lyr = doc.activeLayer;
    if (lyr.kind !== LayerKind.NORMAL) return false;
    try {
        var b = lyr.bounds;
        return (b[0].value === 0 && b[1].value === 0 &&
                b[2].value === 0 && b[3].value === 0);
    } catch(e) { return false; }
}

/** True if the active layer is a group with zero children */
function isGroupEmpty(doc) {
    var lyr = doc.activeLayer;
    if (lyr.typename !== "LayerSet") return false;
    return (lyr.layers.length === 0);
}

// ─── Pre-pass operations ──────────────────────────────────────────────────────

/** Clear all lock flags on the active layer in a single AM setd call */
function amUnlockAllPixels() {
    var ref      = new ActionReference();
    ref.putEnumerated(cTID("Lyr "), cTID("Ordn"), cTID("Trgt"));
    var protDesc = new ActionDescriptor();
    protDesc.putBoolean(KEY_TRANSPARENCY,     false);
    protDesc.putBoolean(KEY_COMPOSITING,      false);
    protDesc.putBoolean(KEY_POSITION,         false);
    protDesc.putBoolean(KEY_ARTBOARD_ENABLED, false);
    var layerDesc = new ActionDescriptor();
    layerDesc.putObject(KEY_PROTECT, KEY_PROTECT, protDesc);
    var desc = new ActionDescriptor();
    desc.putReference(cTID("null"), ref);
    desc.putObject(cTID("T   "), cTID("Lyr "), layerDesc);
    executeAction(cTID("setd"), desc, DialogModes.NO);
}

/**
 * Apply pixel mask and/or vector mask on the active layer, baking both
 * into the layer's pixel data and removing the mask channels.
 * Returns true if at least one mask was applied.
 */
function amApplyLayerMask() {
    var applied = false;
    try {
        // ── pixel mask ──
        var pixRef = new ActionReference();
        pixRef.putEnumerated(cTID("Chnl"), cTID("Chnl"), cTID("Msk "));
        var hasPix = false;
        try { executeActionGet(pixRef); hasPix = true; } catch(e) {}
        if (hasPix) {
            var selDesc = new ActionDescriptor();
            selDesc.putReference(cTID("null"), pixRef);
            executeAction(cTID("slct"), selDesc, DialogModes.NO);
            executeAction(sTID("applyMask"), new ActionDescriptor(), DialogModes.NO);
            applied = true;
        }
        // ── vector mask ──
        var vmRef = new ActionReference();
        vmRef.putEnumerated(cTID("Path"), sTID("pathClassEvent"), sTID("vectorMask"));
        var hasVM = false;
        try { executeActionGet(vmRef); hasVM = true; } catch(e) {}
        if (hasVM) {
            var vmDesc = new ActionDescriptor();
            vmDesc.putBoolean(sTID("delete"), true);
            executeAction(sTID("applyMask"), vmDesc, DialogModes.NO);
            applied = true;
        }
    } catch(e) {}
    return applied;
}

/**
 * Merge all linked layer sets globally.
 * Scans for linked layers, selects one from each set, fires MrgL.
 * Repeats until no linked layers remain or the safety ceiling is hit.
 * Returns count of merge operations performed.
 */
function amMergeAllLinked(doc) {
    var count = 0;
    for (var pass = 0; pass < 200; pass++) {
        var linkedIdx = -1;
        for (var i = 0; i < doc.layers.length; i++) {
            try {
                var d = getLayerDesc(i);
                var linked = false;
                try { linked = d.getBoolean(sTID("linked")); } catch(e) {}
                if (linked) { linkedIdx = i; break; }
            } catch(e) {}
        }
        if (linkedIdx === -1) break;
        selectLayerByIndex(linkedIdx);
        try {
            executeAction(cTID("MrgL"), new ActionDescriptor(), DialogModes.NO);
            count++;
        } catch(e) { break; }
    }
    return count;
}

// ─── NEW: Flatten fill layers (PRE-D) ─────────────────────────────────────────
/**
 * Iterates all layers and rasterizes solid colour, gradient, and pattern fill
 * layers into pixel layers. Fill layers with non-Normal blend modes are left
 * alone (same rule as smart objects — rasterizing a multiply fill would lose
 * the blending intent).
 *
 * Uses amRasterizeWithEffects so any layer style is baked in the same call.
 * Returns count of fill layers rasterized.
 */
function flattenAllFillLayers(doc) {
    var count = 0;
    var i = 0;
    while (i < doc.layers.length) {
        var desc;
        try { desc = getLayerDesc(i); } catch(e) { i++; continue; }

        if (isFillLayer(desc) && isNormalBlend(desc)) {
            selectLayerByIndex(i);
            try {
                amRasterizeWithEffects();
                count++;
                // Index stays the same — rasterized layer occupies same slot
            } catch(e) {}
        }
        i++;
    }
    return count;
}

// ─── NEW: Rasterize shape layers (PRE-E) ──────────────────────────────────────
/**
 * Iterates all layers and rasterizes vector shape layers into pixel layers.
 * Shapes with non-Normal blend modes are left alone (same safe rule).
 *
 * Shape layers may have stroke/fill effects stored as layer styles, so we use
 * amRasterizeWithEffects to bake the style in the same pass.
 * Returns count of shape layers rasterized.
 */
function rasterizeAllShapeLayers(doc) {
    var count = 0;
    var i = 0;
    while (i < doc.layers.length) {
        var desc;
        try { desc = getLayerDesc(i); } catch(e) { i++; continue; }

        if (isShapeLayer(desc) && isNormalBlend(desc)) {
            selectLayerByIndex(i);
            try {
                amRasterizeWithEffects();
                count++;
            } catch(e) {}
        }
        i++;
    }
    return count;
}

// ─── NEW: Remove all empty groups (multi-pass) ────────────────────────────────
/**
 * Deletes all empty groups from the document.
 *
 * Why multi-pass: a group becomes empty only after its children are deleted.
 * After one pass removes leaf-level empty groups, their parent groups may now
 * also be empty. We repeat until a full scan finds zero empty groups.
 *
 * Each pass scans top-down; when an empty group is found and deleted the index
 * stays put (next layer slides into that slot), so we don't increment.
 *
 * Returns total number of empty groups deleted across all passes.
 */
function removeAllEmptyGroups(doc) {
    var total    = 0;
    var maxPasses = 50; // deeply nested empty chains won't exceed this

    for (var pass = 0; pass < maxPasses; pass++) {
        var deletedThisPass = 0;
        var i = 0;

        while (i < doc.layers.length) {
            var desc;
            try { desc = getLayerDesc(i); } catch(e) { i++; continue; }

            if (isGroup(desc)) {
                selectLayerByIndex(i);
                if (isGroupEmpty(doc)) {
                    amDeleteLayer();
                    deletedThisPass++;
                    total++;
                    // Don't increment i — next layer now occupies this slot
                    continue;
                }
            }
            i++;
        }

        // If nothing was deleted this pass the document is stable — stop early
        if (deletedThisPass === 0) break;
    }
    return total;
}

// ─── Trim transparent pixels (per pixel layer) ────────────────────────────────
/**
 * Loads layer transparency as a selection then calls trim to crop the layer's
 * pixel data to its non-transparent bounding box.
 * Pixel layers only — groups, fills, shapes, adjustments are skipped upstream.
 */
function amTrimLayerTransparency() {
    try {
        // Load transparency channel as selection
        var ref  = new ActionReference();
        ref.putProperty(cTID("Chnl"), cTID("fsel"));
        var desc = new ActionDescriptor();
        desc.putReference(cTID("null"), ref);
        var srcRef = new ActionReference();
        srcRef.putEnumerated(cTID("Chnl"), cTID("Chnl"), cTID("Trsp"));
        desc.putReference(cTID("T   "), srcRef);
        executeAction(cTID("setd"), desc, DialogModes.NO);

        // Quick bounds check — bail if selection is empty
        try {
            var selRef   = new ActionReference();
            selRef.putProperty(cTID("Chnl"), cTID("fsel"));
            var selState = executeActionGet(selRef);
            var bounds   = selState.getObjectValue(sTID("selectionBounds"));
            if (bounds.getInteger(cTID("Wdth")) === 0 ||
                bounds.getInteger(cTID("Hght")) === 0) {
                var deDesc = new ActionDescriptor();
                deDesc.putEnumerated(cTID("null"), cTID("Ordn"), cTID("Al  "));
                executeAction(cTID("Dslc"), deDesc, DialogModes.NO);
                return false;
            }
        } catch(e) {}

        executeAction(sTID("trim"), new ActionDescriptor(), DialogModes.NO);

        var deselectDesc = new ActionDescriptor();
        deselectDesc.putEnumerated(cTID("null"), cTID("Ordn"), cTID("Al  "));
        executeAction(cTID("Dslc"), deselectDesc, DialogModes.NO);
        return true;
    } catch(e) {
        try {
            var d2 = new ActionDescriptor();
            d2.putEnumerated(cTID("null"), cTID("Ordn"), cTID("Al  "));
            executeAction(cTID("Dslc"), d2, DialogModes.NO);
        } catch(e2) {}
        return false;
    }
}

// ─── Name sanitiser ───────────────────────────────────────────────────────────

function sanitiseName(name) {
    var c = name.replace(/[^A-Za-z0-9_\-\.]/g, "_");
    c = c.replace(/_+/g, "_");
    c = c.replace(/^_+|_+$/g, "");
    return c.length > 0 ? c : "layer";
}

function needsSanitise(name) {
    return /[^A-Za-z0-9_\-\.]/.test(name);
}

// ─── Main entry ───────────────────────────────────────────────────────────────

function runCleanupInner() {
    var doc = app.activeDocument;

    var stats = {
        unlocked:          0,
        masksApplied:      0,
        linkedMerged:      0,
        fillsFlattened:    0,   // NEW
        shapesRasterized:  0,   // NEW
        emptyGroupsRemoved:0,   // NEW
        trimmed:           0,
        deleted:           0,
        renamed:           0,
        rasterized:        0,
        effectsFlattened:  0,
        clippingCollapsed: 0
    };

    // ══════════════════════════════════════════════════════════════════════════
    // PRE-PASS A — Unlock all layers
    // Must run first so every subsequent operation can touch every layer.
    // ══════════════════════════════════════════════════════════════════════════
    for (var u = 0; u < doc.layers.length; u++) {
        try {
            if (hasAnyLock(getLayerDesc(u))) {
                selectLayerByIndex(u);
                amUnlockAllPixels();
                stats.unlocked++;
            }
        } catch(e) {}
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PRE-PASS B — Apply all layer masks
    // Bake before any structural changes shift indices.
    // ══════════════════════════════════════════════════════════════════════════
    for (var m = 0; m < doc.layers.length; m++) {
        try {
            var mDesc = getLayerDesc(m);
            if (hasMask(mDesc) || hasVectorMask(mDesc)) {
                selectLayerByIndex(m);
                if (amApplyLayerMask()) stats.masksApplied++;
            }
        } catch(e) {}
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PRE-PASS C — Merge all linked sets
    // Global reduction before per-layer work — fewer layers = faster main pass.
    // ══════════════════════════════════════════════════════════════════════════
    stats.linkedMerged = amMergeAllLinked(doc);

    // ══════════════════════════════════════════════════════════════════════════
    // PRE-PASS D — Flatten all fill layers (solid colour / gradient / pattern)
    // Done before the main pass so fill layers become pixel layers and are
    // correctly identified as rasterizable by the SO/effects step below.
    // ══════════════════════════════════════════════════════════════════════════
    stats.fillsFlattened = flattenAllFillLayers(doc);

    // ══════════════════════════════════════════════════════════════════════════
    // PRE-PASS E — Rasterize all shape layers
    // Same rationale: convert to pixel layers before the main pass so the
    // trim and effects steps can operate on them normally.
    // ══════════════════════════════════════════════════════════════════════════
    stats.shapesRasterized = rasterizeAllShapeLayers(doc);

    // ══════════════════════════════════════════════════════════════════════════
    // MAIN PASS — top-down, index-stable
    // ══════════════════════════════════════════════════════════════════════════
    var i = 0;
    while (i < doc.layers.length) {
        var desc;
        try { desc = getLayerDesc(i); } catch(e) { i++; continue; }

        var name    = descGetString(desc, NAME_KEY);
        var visible = descGetBool(desc, VISIBLE_KEY);
        var group   = isGroup(desc);

        // ── 1. Delete hidden layers / groups ──────────────────────────────────
        if (!visible) {
            selectLayerByIndex(i);
            amDeleteLayer();
            stats.deleted++;
            continue; // slot now occupied by next layer — don't increment
        }

        // ── 2. Delete empty pixel layers ──────────────────────────────────────
        if (!group) {
            selectLayerByIndex(i);
            if (isPixelLayerEmpty(doc)) {
                amDeleteLayer();
                stats.deleted++;
                continue;
            }
        }

        // ── 3. Sanitise layer name ─────────────────────────────────────────────
        if (needsSanitise(name)) {
            var clean = sanitiseName(name);
            selectLayerByIndex(i);
            amRenameLayer(clean);
            stats.renamed++;
            name = clean;
        }

        // ── 4. Trim transparent pixels (pixel layers only) ────────────────────
        if (!group) {
            selectLayerByIndex(i);
            if (amTrimLayerTransparency()) stats.trimmed++;
        }

        // ── 5. Rasterize smart objects + flatten remaining layer effects ───────
        //    Guard: Normal / Pass Through blend only
        if (!group) {
            var normalBlend = isNormalBlend(desc);
            var smart       = isSmartObject(desc);
            var hasFX       = hasLayerEffects(desc);

            if (normalBlend && (smart || hasFX)) {
                selectLayerByIndex(i);
                amRasterizeWithEffects();
                if (smart) stats.rasterized++;
                if (hasFX) stats.effectsFlattened++;
            }
        }

        // ── 6. Collapse clipping mask chains ──────────────────────────────────
        // When the layer at i is the base (not clipped) but the layer at i-1
        // IS clipped, walk up to find the top of the chain and merge down.
        if (!group && i > 0) {
            var aboveDesc;
            try { aboveDesc = getLayerDesc(i - 1); } catch(e) { aboveDesc = null; }

            if (aboveDesc && isClipped(aboveDesc) && !isClipped(desc)) {
                var chainTop = i - 1;
                while (chainTop > 0) {
                    var checkDesc;
                    try { checkDesc = getLayerDesc(chainTop - 1); } catch(e) { break; }
                    if (!isClipped(checkDesc)) break;
                    chainTop--;
                }
                // chainTop = topmost clipped layer index
                // mergeCount - 1 = number of merge-down operations needed
                var mergeCount = i - chainTop;
                for (var mc = 0; mc < mergeCount - 1; mc++) {
                    selectLayerByIndex(chainTop);
                    amMergeDown();
                    stats.clippingCollapsed++;
                }
                i = chainTop + 1;
                continue;
            }
        }

        i++;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // POST-PASS — Remove all empty groups (multi-pass until stable)
    // Run after the main pass so groups emptied by deletion above are caught.
    // Runs its own repeat-until-stable loop internally.
    // ══════════════════════════════════════════════════════════════════════════
    stats.emptyGroupsRemoved = removeAllEmptyGroups(doc);

    // ── Report ─────────────────────────────────────────────────────────────────
    alert(
        "Layer Cleanup Complete\n" +
        "──────────────────────────────\n" +
        "Unlocked layers:        " + stats.unlocked           + "\n" +
        "Masks applied:          " + stats.masksApplied       + "\n" +
        "Linked sets merged:     " + stats.linkedMerged       + "\n" +
        "Fill layers flattened:  " + stats.fillsFlattened     + "\n" +
        "Shape layers rasterized:" + stats.shapesRasterized   + "\n" +
        "Trimmed (transparency): " + stats.trimmed            + "\n" +
        "Deleted (hidden/empty): " + stats.deleted            + "\n" +
        "Empty groups removed:   " + stats.emptyGroupsRemoved + "\n" +
        "Renamed (sanitised):    " + stats.renamed            + "\n" +
        "Rasterized (SO):        " + stats.rasterized         + "\n" +
        "Effects flattened:      " + stats.effectsFlattened   + "\n" +
        "Clipping collapsed:     " + stats.clippingCollapsed
    );
}

// ─── Descriptor reading helpers (used in main pass) ───────────────────────────

function descGetString(desc, key) {
    try { return desc.getString(key); } catch(e) { return ""; }
}

function descGetBool(desc, key) {
    try { return desc.getBoolean(key); } catch(e) { return true; }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

try {
    var _doc = app.activeDocument; // throws if no document is open
    _doc.suspendHistory("Layer Cleanup", "runCleanupInner()");
} catch(e) {
    alert("ps_layer_cleanup.jsx Error:\n" + e.message + "\nLine: " + e.line);
}
