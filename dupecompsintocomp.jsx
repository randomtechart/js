/*
 * Duplicate Comps From JSON
 * -------------------------------------------------------------
 * Duplicates a source comp once per JSON entry, edits the Text1 / Text2
 * source text in each duplicate, then adds the duplicate as a layer in
 * the named target comp with the given scale and position offset.
 *
 * Source comp: select ONE comp in the Project panel before running,
 * or set SOURCE_COMP_NAME below.
 *
 * JSON format (array of entries):
 * [
 *   {
 *     "targetComp": "Scene_01",
 *     "layerName":  "Lower Third A",
 *     "x": 120, "y": -80,
 *     "scale": 75,
 *     "text1": "Headline here",
 *     "text2": "Subtitle here"
 *   }
 * ]
 */

(function () {

    // ---------------- CONFIG ----------------
    var SOURCE_COMP_NAME   = "";                 // leave "" to use Project panel selection
    var TEXT1_LAYER_NAME   = "Text1";
    var TEXT2_LAYER_NAME   = "Text2";
    var OUTPUT_FOLDER_NAME = "Generated Comps";  // project folder for the duplicates
    var OFFSETS_RELATIVE   = true;               // true: x/y added to the layer's default position (target comp center)
                                                 // false: x/y used as absolute position
    var DRY_RUN            = false;              // true: validate only, change nothing
    // ----------------------------------------

    function isNum(v) {
        return typeof v === "number" && isFinite(v);
    }

    function isStr(v) {
        return typeof v === "string";
    }

    function readJSONFile(file) {
        file.encoding = "UTF-8";
        if (!file.open("r")) {
            throw new Error("Could not open file: " + file.fsName);
        }
        var raw = file.read();
        file.close();
        // Strip UTF-8 BOM if present
        if (raw.charCodeAt(0) === 0xFEFF) {
            raw = raw.substring(1);
        }
        if (typeof JSON !== "undefined" && JSON.parse) {
            return JSON.parse(raw);
        }
        // Fallback for ExtendScript without JSON. Only use with files you trust.
        return eval("(" + raw + ")");
    }

    function getSourceComp() {
        var i;
        if (SOURCE_COMP_NAME !== "") {
            for (i = 1; i <= app.project.numItems; i++) {
                var it = app.project.item(i);
                if (it instanceof CompItem && it.name === SOURCE_COMP_NAME) {
                    return it;
                }
            }
            throw new Error("Source comp \"" + SOURCE_COMP_NAME + "\" not found.");
        }
        var sel = app.project.selection;
        if (sel.length === 1 && sel[0] instanceof CompItem) {
            return sel[0];
        }
        throw new Error("Select exactly one comp in the Project panel (the source comp), or set SOURCE_COMP_NAME.");
    }

    function findCompByName(name) {
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (it instanceof CompItem && it.name === name) {
                return it;
            }
        }
        return null;
    }

    function compNameExists(name) {
        return findCompByName(name) !== null;
    }

    function uniqueCompName(base) {
        var name = base;
        var n = 2;
        while (compNameExists(name)) {
            name = base + " " + n;
            n++;
        }
        return name;
    }

    function getOrCreateFolder(name) {
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (it instanceof FolderItem && it.name === name && it.parentFolder === app.project.rootFolder) {
                return it;
            }
        }
        return app.project.items.addFolder(name);
    }

    function hasTextLayer(comp, layerName) {
        var lyr = comp.layer(layerName);
        if (!lyr) return false;
        var st = lyr.property("Source Text");
        return st !== null && st !== undefined;
    }

    function setLayerText(comp, layerName, text) {
        var lyr = comp.layer(layerName);
        var prop = lyr.property("Source Text");
        var doc = prop.value;
        doc.text = text;
        prop.setValue(doc);
    }

    // ---------- validation ----------
    function validate(entries, sourceComp) {
        var errors = [];
        var i;

        if (!(entries instanceof Array)) {
            return ["JSON root must be an array of entries."];
        }
        if (entries.length === 0) {
            return ["JSON array is empty."];
        }

        if (!hasTextLayer(sourceComp, TEXT1_LAYER_NAME)) {
            errors.push("Source comp has no text layer named \"" + TEXT1_LAYER_NAME + "\".");
        }
        if (!hasTextLayer(sourceComp, TEXT2_LAYER_NAME)) {
            errors.push("Source comp has no text layer named \"" + TEXT2_LAYER_NAME + "\".");
        }

        for (i = 0; i < entries.length; i++) {
            var e = entries[i];
            var tag = "Entry " + (i + 1) + ": ";

            if (!isStr(e.targetComp) || e.targetComp === "") {
                errors.push(tag + "\"targetComp\" must be a non-empty string.");
            } else {
                var target = findCompByName(e.targetComp);
                if (!target) {
                    errors.push(tag + "target comp \"" + e.targetComp + "\" not found.");
                } else if (target === sourceComp) {
                    errors.push(tag + "target comp cannot be the source comp.");
                }
            }
            if (!isStr(e.layerName) || e.layerName === "") {
                errors.push(tag + "\"layerName\" must be a non-empty string.");
            }
            if (!isNum(e.x))     errors.push(tag + "\"x\" must be a number.");
            if (!isNum(e.y))     errors.push(tag + "\"y\" must be a number.");
            if (!isNum(e.scale)) errors.push(tag + "\"scale\" must be a number.");
            if (e.text1 !== undefined && !isStr(e.text1)) errors.push(tag + "\"text1\" must be a string.");
            if (e.text2 !== undefined && !isStr(e.text2)) errors.push(tag + "\"text2\" must be a string.");
        }
        return errors;
    }

    // ---------- main ----------
    if (!app.project) {
        alert("No project open.");
        return;
    }

    var sourceComp, entries;

    try {
        sourceComp = getSourceComp();

        var jsonFile = File.openDialog("Select the JSON file", "JSON:*.json,All files:*.*");
        if (!jsonFile) return; // user cancelled

        entries = readJSONFile(jsonFile);
    } catch (err) {
        alert(err.message);
        return;
    }

    var problems = validate(entries, sourceComp);
    if (problems.length > 0) {
        var shown = problems.slice(0, 20).join("\n");
        if (problems.length > 20) {
            shown += "\n...and " + (problems.length - 20) + " more.";
        }
        alert("Nothing was changed. Fix these issues first:\n\n" + shown);
        return;
    }

    if (DRY_RUN) {
        alert("Dry run OK: " + entries.length + " entries validated against source comp \"" + sourceComp.name + "\".");
        return;
    }

    var created = [];
    var failed = [];

    app.beginUndoGroup("Duplicate Comps From JSON");
    try {
        var folder = getOrCreateFolder(OUTPUT_FOLDER_NAME);

        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            try {
                var target = findCompByName(e.targetComp);

                // 1. Independent copy of the source comp
                var dup = sourceComp.duplicate();
                dup.name = uniqueCompName(e.layerName + " Comp");
                dup.parentFolder = folder;

                // 2. Unique text per duplicate
                if (e.text1 !== undefined) setLayerText(dup, TEXT1_LAYER_NAME, e.text1);
                if (e.text2 !== undefined) setLayerText(dup, TEXT2_LAYER_NAME, e.text2);

                // 3. Place in target comp
                var lyr = target.layers.add(dup);
                lyr.name = e.layerName;

                // 4. Scale and position
                lyr.property("Scale").setValue([e.scale, e.scale]);

                var posProp = lyr.property("Position");
                if (OFFSETS_RELATIVE) {
                    var base = posProp.value;
                    posProp.setValue([base[0] + e.x, base[1] + e.y]);
                } else {
                    posProp.setValue([e.x, e.y]);
                }

                created.push(e.layerName + " -> " + e.targetComp);
            } catch (entryErr) {
                failed.push("Entry " + (i + 1) + " (" + e.layerName + "): " + entryErr.message);
            }
        }
    } catch (fatal) {
        alert("Script stopped: " + fatal.message);
    } finally {
        app.endUndoGroup();
    }

    var msg = "Created " + created.length + " of " + entries.length + " layers.";
    if (failed.length > 0) {
        msg += "\n\nFailed:\n" + failed.join("\n");
    }
    alert(msg);

})();
