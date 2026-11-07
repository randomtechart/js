// DefaultMarkerFrame0.jsx
// After Effects ExtendScript: Default marker / frame 0 shift tool
//
// BUILD STEP 1-2 of the plan: traversal, read-only scan, and the UI list.
// Read-only: the only things this version touches are the viewer (opening a comp)
// and layer selection when you click a row. Apply is intentionally disabled.
//
// Run from File > Scripts > Run Script File, or drop it in
// Scripts/ScriptUI Panels to dock it.

#target aftereffects

(function DefaultMarkerFrame0(thisObj) {

    // ------------------------------------------------------------------
    // Config
    // ------------------------------------------------------------------
    var TOKEN = "Default";
    // "Default" as a whole word, case-sensitive, followed by comma, whitespace or end.
    var TOKEN_TEST = /(^|[\s,])Default(?=[\s,]|$)/;
    var TOKEN_STRIP = /(^|[\s,])Default(?=[\s,]|$)/g;
    var EXPR_RE = /\btime\b|valueAtTime|key\s*\(|loopIn|loopOut/;

    // ------------------------------------------------------------------
    // Small helpers
    // ------------------------------------------------------------------
    function trim(s) {
        return String(s).replace(/^\s+|\s+$/g, "");
    }

    function rep(s, n) {
        var out = "";
        while (n-- > 0) out += s;
        return out;
    }

    function wildcardToRegExp(p) {
        var esc = p.replace(/[\-\[\]\/\{\}\(\)\+\?\.\\\^\$\|]/g, "\\$&").replace(/\*/g, ".*");
        return new RegExp("^" + esc + "$", "i");
    }

    function parseSkipList(text) {
        var parts = String(text).split(/[,;\n]/), out = [], i, p;
        for (i = 0; i < parts.length; i++) {
            p = trim(parts[i]);
            if (p) out.push(wildcardToRegExp(p));
        }
        return out;
    }

    function isSkipped(name, patterns) {
        var i;
        for (i = 0; i < patterns.length; i++) {
            if (patterns[i].test(name)) return true;
        }
        return false;
    }

    // Raw comp time, within half a frame of 0.
    function isNearZero(t, comp) {
        return Math.abs(t) < comp.frameDuration / 2;
    }

    function toFrame(t, comp) {
        return Math.round(t / comp.frameDuration);
    }

    // ------------------------------------------------------------------
    // Marker comment analysis
    //   exact : comment is "Default" (also "Default," etc. that clean to empty)
    //   token : Default plus other text; cleaned = comment with the token removed
    //   none  : no Default token
    // ------------------------------------------------------------------
    function analyzeComment(comment) {
        var c = trim(comment), cleaned;
        if (c === TOKEN) return { kind: "exact" };
        if (!TOKEN_TEST.test(c)) return { kind: "none" };
        cleaned = c.replace(TOKEN_STRIP, "$1")
                   .replace(/,(\s*,)+/g, ",")
                   .replace(/^[\s,]+|[\s,]+$/g, "")
                   .replace(/\s{2,}/g, " ");
        if (cleaned === "") return { kind: "exact" };
        return { kind: "token", cleaned: cleaned };
    }

    // ------------------------------------------------------------------
    // Layer helpers
    // ------------------------------------------------------------------
    // Footage for the frame 0 check = footage items and precomps.
    // Solids, nulls, adjustment layers, text, shapes, cameras, lights are excluded.
    function isFootageLayer(layer) {
        var s;
        if (!(layer instanceof AVLayer)) return false;
        s = layer.source;
        if (!s) return false;
        if (s instanceof CompItem) return true;
        if (s instanceof FootageItem) {
            if (layer.nullLayer) return false;
            try {
                if (s.mainSource instanceof SolidSource) return false;
            } catch (e) {}
            return true;
        }
        return false;
    }

    function isPrecompLayer(layer) {
        return (layer instanceof AVLayer) && layer.source instanceof CompItem;
    }

    function hasRiskyExpression(group) {
        var i, p;
        for (i = 1; i <= group.numProperties; i++) {
            p = group.property(i);
            if (p.propertyType === PropertyType.PROPERTY) {
                try {
                    if (p.expressionEnabled && EXPR_RE.test(p.expression)) return true;
                } catch (e) {}
            } else if (hasRiskyExpression(p)) {
                return true;
            }
        }
        return false;
    }

    // ------------------------------------------------------------------
    // Scan one comp (read-only)
    // ------------------------------------------------------------------
    function scanComp(comp, depth) {
        var fd = comp.frameDuration;
        var eps = fd / 2;
        var row = {
            id: comp.id,
            name: comp.name,
            depth: depth,
            use: true,
            defaultAt0: false,
            splitAt0: false,
            defaultStatus: "No",
            strays: [],            // frames of exact Default markers not at 0
            tokenFixes: [],        // {frame, before, after}
            footageAt0: [],        // {index, name}
            hiddenPrecomps: [],    // {index, name}
            overflowLayers: [],    // {index, name}
            overflowMarkers: [],   // frames
            exprWarn: [],          // {index, name}
            remapWarn: [],         // {index, name}
            children: [],          // comp ids of precomp layers
            willShift: false,
            planned: ""
        };
        var i, layer, t, mv, a, after, mp, acts, have0, dupes;

        // ---- layers ----
        for (i = 1; i <= comp.numLayers; i++) {
            layer = comp.layer(i);

            if (isFootageLayer(layer) && isNearZero(layer.inPoint, comp)) {
                row.footageAt0.push({ index: i, name: layer.name });
            }

            if (isPrecompLayer(layer)) {
                row.children.push(layer.source.id);
                if (!layer.enabled) row.hiddenPrecomps.push({ index: i, name: layer.name });
            }

            try {
                if (layer instanceof AVLayer && layer.timeRemapEnabled) {
                    row.remapWarn.push({ index: i, name: layer.name });
                }
            } catch (e1) {}

            try {
                if (hasRiskyExpression(layer)) row.exprWarn.push({ index: i, name: layer.name });
            } catch (e2) {}
        }

        row.willShift = row.footageAt0.length > 0;

        // ---- overflow after a simulated one-frame shift ----
        if (row.willShift) {
            for (i = 1; i <= comp.numLayers; i++) {
                layer = comp.layer(i);
                // Only layers that fit before the shift and would not after it.
                if (layer.outPoint <= comp.duration + eps && layer.outPoint + fd > comp.duration + eps) {
                    row.overflowLayers.push({ index: i, name: layer.name });
                }
            }
        }

        // ---- comp markers ----
        mp = comp.markerProperty;
        for (i = 1; i <= mp.numKeys; i++) {
            t = mp.keyTime(i);
            mv = mp.keyValue(i);
            a = analyzeComment(mv.comment);

            if (a.kind === "exact") {
                if (isNearZero(t, comp)) row.defaultAt0 = true;
                else row.strays.push(toFrame(t, comp));
            } else if (a.kind === "token") {
                if (!row.willShift && isNearZero(t, comp)) {
                    row.splitAt0 = true;
                    after = "Default @0 + " + a.cleaned + " @1";
                } else {
                    after = a.cleaned;
                }
                row.tokenFixes.push({ frame: toFrame(t, comp), before: mv.comment, after: after });
            }

            if (row.willShift && t < comp.duration - eps && t + fd > comp.duration - eps) {
                row.overflowMarkers.push(toFrame(t, comp));
            }
        }

        row.defaultStatus = row.defaultAt0 ? "Yes" : (row.splitAt0 ? "Via split" : "No");

        // ---- planned action summary ----
        acts = [];
        if (row.willShift) acts.push("Shift +1f");
        if (row.tokenFixes.length) acts.push("Clean " + row.tokenFixes.length);
        have0 = row.defaultAt0 || row.splitAt0;
        if (!have0 && row.strays.length) acts.push("Move Default f" + row.strays[0]);
        else if (!have0) acts.push("Create Default");
        dupes = have0 ? row.strays.length : Math.max(0, row.strays.length - 1);
        if (dupes) acts.push("Delete " + dupes + " dup");
        if (row.overflowLayers.length || row.overflowMarkers.length) acts.push("Resolve overflow");
        row.planned = acts.length ? acts.join("; ") : "OK";

        return row;
    }

    // ------------------------------------------------------------------
    // Traversal
    //   - visited set by comp id: shared precomps scanned once, cycles can't loop
    //   - a comp matching the skip list is not scanned, and neither is its subtree
    //     (children are still found if reached through another, non-skipped comp)
    //   - postOrder lists children before parents, for the apply phase later
    // ------------------------------------------------------------------
    function traverse(comp, depth, ctx) {
        var row, i, child;
        if (ctx.visited[comp.id]) return;
        ctx.visited[comp.id] = true;

        if (isSkipped(comp.name, ctx.skip)) {
            ctx.skipped++;
            return;
        }

        row = scanComp(comp, depth);
        ctx.rows.push(row);

        for (i = 0; i < row.children.length; i++) {
            child = app.project.itemByID(row.children[i]);
            if (child instanceof CompItem) traverse(child, depth + 1, ctx);
        }
        ctx.postOrder.push(comp.id);
    }

    // scopeIndex 0 = active comp + children, 1 = selected comps + children
    function runScan(scopeIndex, skipText) {
        var ctx = { rows: [], postOrder: [], visited: {}, skipped: 0, skip: parseSkipList(skipText) };
        var roots = [], i, sel;

        if (scopeIndex === 0) {
            if (app.project.activeItem instanceof CompItem) roots.push(app.project.activeItem);
        } else {
            sel = app.project.selection;
            for (i = 0; i < sel.length; i++) {
                if (sel[i] instanceof CompItem) roots.push(sel[i]);
            }
        }
        if (!roots.length) return null;

        for (i = 0; i < roots.length; i++) traverse(roots[i], 0, ctx);
        return ctx;
    }

    // ------------------------------------------------------------------
    // Formatting for the list
    // ------------------------------------------------------------------
    function fmtStrays(r) {
        var out = [], n = Math.min(3, r.strays.length), i;
        if (!r.strays.length) return "-";
        for (i = 0; i < n; i++) out.push("f" + r.strays[i]);
        return r.strays.length + " (" + out.join(", ") + (r.strays.length > n ? ", ..." : "") + ")";
    }

    function fmtTokens(r) {
        var out = [], n = Math.min(2, r.tokenFixes.length), i, t;
        if (!r.tokenFixes.length) return "-";
        for (i = 0; i < n; i++) {
            t = r.tokenFixes[i];
            out.push("f" + t.frame + ": " + t.before + " -> " + t.after);
        }
        if (r.tokenFixes.length > n) out.push("+" + (r.tokenFixes.length - n) + " more");
        return out.join(" | ");
    }

    function fmtNames(list) {
        var out = [], n = Math.min(2, list.length), i;
        if (!list.length) return "-";
        for (i = 0; i < n; i++) out.push(list[i].name);
        return list.length + ": " + out.join(", ") + (list.length > n ? ", ..." : "");
    }

    function fmtOverflow(r) {
        var parts = [];
        if (r.overflowLayers.length) parts.push(r.overflowLayers.length + " layer(s)");
        if (r.overflowMarkers.length) parts.push(r.overflowMarkers.length + " marker(s)");
        return parts.length ? parts.join(", ") : "-";
    }

    function fmtWarn(r) {
        var parts = [];
        if (r.exprWarn.length) parts.push(r.exprWarn.length + " expr");
        if (r.remapWarn.length) parts.push(r.remapWarn.length + " remap");
        return parts.length ? parts.join(", ") : "-";
    }

    function setRowText(item, r) {
        item.text = r.use ? "[x]" : "[ ]";
        item.subItems[0].text = rep("    ", r.depth) + (r.depth ? "> " : "") + r.name;
        item.subItems[1].text = r.defaultStatus;
        item.subItems[2].text = fmtStrays(r);
        item.subItems[3].text = fmtTokens(r);
        item.subItems[4].text = r.footageAt0.length ? r.footageAt0.length + " layer(s)" : "No";
        item.subItems[5].text = fmtNames(r.hiddenPrecomps);
        item.subItems[6].text = fmtOverflow(r);
        item.subItems[7].text = fmtWarn(r);
        item.subItems[8].text = r.planned;
    }

    function summarize(ctx) {
        var s = { shift: 0, noDefault: 0, overflow: 0, hidden: 0, warn: 0 }, i, r, txt;
        for (i = 0; i < ctx.rows.length; i++) {
            r = ctx.rows[i];
            if (r.willShift) s.shift++;
            if (r.defaultStatus === "No") s.noDefault++;
            if (r.overflowLayers.length || r.overflowMarkers.length) s.overflow++;
            s.hidden += r.hiddenPrecomps.length;
            if (r.exprWarn.length || r.remapWarn.length) s.warn++;
        }
        txt = ctx.rows.length + " comps | " + s.shift + " need shift | " + s.noDefault +
              " missing Default | " + s.overflow + " overflow | " + s.hidden +
              " hidden precomps | " + s.warn + " with warnings";
        if (ctx.skipped) txt += " | " + ctx.skipped + " skipped";
        return txt;
    }

    // ------------------------------------------------------------------
    // Row click: open the comp and select the flagged layers
    // (footage at frame 0, hidden precomps, overflowing layers)
    // ------------------------------------------------------------------
    function collectFlagged(r) {
        var groups = [r.footageAt0, r.hiddenPrecomps, r.overflowLayers], seen = {}, out = [], g, k, e;
        for (g = 0; g < groups.length; g++) {
            for (k = 0; k < groups[g].length; k++) {
                e = groups[g][k];
                if (!seen[e.index]) {
                    seen[e.index] = true;
                    out.push(e);
                }
            }
        }
        return out;
    }

    function focusRow(r) {
        var comp, i, flagged, k, L;
        try {
            comp = app.project.itemByID(r.id);
            if (!(comp instanceof CompItem)) {
                alert("That comp no longer exists. Press Rescan.");
                return;
            }
            comp.openInViewer();
            for (i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
            flagged = collectFlagged(r);
            for (k = 0; k < flagged.length; k++) {
                if (flagged[k].index <= comp.numLayers) {
                    L = comp.layer(flagged[k].index);
                    // Verify by name in case the stack changed since the scan.
                    if (L.name === flagged[k].name) L.selected = true;
                }
            }
        } catch (err) {
            alert("Could not select layers (stack changed since the scan?). Press Rescan.\n\n" + err.toString());
        }
    }

    // ------------------------------------------------------------------
    // UI
    // ------------------------------------------------------------------
    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj
                : new Window("palette", "Default Marker / Frame 0", undefined, { resizeable: true });
        var state = { ctx: null };

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.margins = 10;
        win.spacing = 8;

        var top = win.add("group");
        top.alignChildren = ["left", "center"];
        top.add("statictext", undefined, "Scope:");
        var scopeDD = top.add("dropdownlist", undefined, ["Active comp + children", "Selected comps + children"]);
        scopeDD.selection = 0;
        top.add("statictext", undefined, "Skip:");
        var skipTxt = top.add("edittext", undefined, "");
        skipTxt.characters = 18;
        skipTxt.helpTip = "Comp name patterns to skip, comma separated. Wildcard *, e.g. _ref*, OLD_*";
        var rescanBtn = top.add("button", undefined, "Rescan");

        var list = win.add("listbox", undefined, [], {
            numberOfColumns: 10,
            showHeaders: true,
            multiselect: false,
            columnTitles: ["Use", "Comp", "Default @0", "Stray Defaults", "Token fixes",
                           "Footage @0", "Hidden precomps", "Overflow", "Warnings", "Planned action"],
            columnWidths: [34, 200, 70, 90, 200, 70, 120, 100, 90, 180]
        });
        list.preferredSize = [1000, 320];
        list.alignment = ["fill", "fill"];
        list.helpTip = "Click a row to open that comp and select its flagged layers. Double-click to toggle Use.";

        var status = win.add("statictext", undefined, "", { truncate: "end" });
        status.alignment = ["fill", "bottom"];

        var btns = win.add("group");
        btns.alignment = ["right", "bottom"];
        var applyBtn = btns.add("button", undefined, "Apply (next build step)");
        applyBtn.enabled = false;
        var closeBtn = btns.add("button", undefined, "Close");

        function rescan() {
            var ctx, i, item;
            state.ctx = null;
            list.removeAll();

            ctx = runScan(scopeDD.selection ? scopeDD.selection.index : 0, skipTxt.text);
            if (!ctx) {
                status.text = "Open a comp (or select comps in the Project panel), then press Rescan.";
                return;
            }

            state.ctx = ctx;
            for (i = 0; i < ctx.rows.length; i++) {
                item = list.add("item", "");
                setRowText(item, ctx.rows[i]);
            }
            status.text = summarize(ctx);
            $.writeln("[DefaultMarkerFrame0] " + status.text);
        }

        list.onChange = function () {
            var sel = list.selection;
            if (!sel || !state.ctx) return;
            focusRow(state.ctx.rows[sel.index]);
        };

        list.onDoubleClick = function () {
            var sel = list.selection, r;
            if (!sel || !state.ctx) return;
            r = state.ctx.rows[sel.index];
            r.use = !r.use;
            sel.text = r.use ? "[x]" : "[ ]";
        };

        rescanBtn.onClick = rescan;
        scopeDD.onChange = rescan;
        closeBtn.onClick = function () {
            if (win instanceof Window) win.close();
        };

        win.onResizing = win.onResize = function () { this.layout.resize(); };

        rescan();
        return win;
    }

    var ui = buildUI(thisObj);
    if (ui instanceof Window) {
        ui.center();
        ui.show();
    } else {
        ui.layout.layout(true);
    }

})(this);
