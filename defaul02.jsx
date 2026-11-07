// DefaultMarkerFrame0.jsx
// After Effects ExtendScript: Default marker / frame 0 shift tool
//
// What it does, per comp (active comp + all child comps, children first):
//   1. If footage/precomps start at frame 0, shifts EVERY layer and every comp marker one frame later.
//   2. Cleans "Default" out of marker comments that contain other text ("Default Intro" -> "Intro").
//   3. Makes sure exactly one marker commented "Default" sits at frame 0
//      (moves a stray one, deletes duplicates, creates one if missing).
//   4. If the shift pushes layers/markers past the comp end, asks you whether to extend the comp or trim.
// Nothing changes until you press Apply. The whole run is one undo step.
//
// Install: File > Scripts > Run Script File, or drop in Scripts/ScriptUI Panels to dock it.
// Needs "Allow Scripts to Write Files and Access Network" (Preferences > Scripting & Expressions)
// for Save report and the backup copy.

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
    var MARKER_PROPS = ["duration", "chapter", "url", "frameTarget", "cuePointName",
                        "eventCuePoint", "label", "protectedRegion"];

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

    function pad2(n) {
        return (n < 10 ? "0" : "") + n;
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

    function frameOf(t, fd) {
        return Math.round(t / fd);
    }

    function uniq(arr) {
        var seen = {}, out = [], i;
        for (i = 0; i < arr.length; i++) {
            if (!seen[arr[i]]) {
                seen[arr[i]] = true;
                out.push(arr[i]);
            }
        }
        return out;
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
    // Marker helpers. Markers are read into memory, edited as a list of
    // {t, mv}, then written back once, so there are never time collisions
    // inside the marker property while editing.
    // ------------------------------------------------------------------
    // Copies every MarkerValue field so duration/chapter/url/etc. survive re-adding.
    function cloneMarker(mv, comment) {
        var m = new MarkerValue(comment !== undefined ? comment : mv.comment), i, p;
        for (i = 0; i < MARKER_PROPS.length; i++) {
            p = MARKER_PROPS[i];
            try { m[p] = mv[p]; } catch (e) {}
        }
        try { m.setParameters(mv.getParameters()); } catch (e2) {}
        return m;
    }

    function readMarkers(comp) {
        var mp = comp.markerProperty, out = [], i;
        for (i = 1; i <= mp.numKeys; i++) {
            out.push({ t: mp.keyTime(i), mv: mp.keyValue(i) });
        }
        return out;
    }

    function sortMarkers(list) {
        list.sort(function (a, b) { return a.t - b.t; });
    }

    function markerSig(list) {
        var parts = [], i, m;
        for (i = 0; i < list.length; i++) {
            m = list[i];
            parts.push(m.t.toFixed(6) + "|" + m.mv.comment + "|" + m.mv.duration);
        }
        return parts.join("\n");
    }

    function writeMarkers(comp, list) {
        var mp = comp.markerProperty, i;
        for (i = mp.numKeys; i >= 1; i--) mp.removeKey(i);
        sortMarkers(list);
        for (i = 0; i < list.length; i++) mp.setValueAtTime(list[i].t, list[i].mv);
    }

    function extendComp(comp, newDur) {
        var fd = comp.frameDuration, oldDur = comp.duration;
        var waEnd = comp.workAreaStart + comp.workAreaDuration;
        var wasFull = Math.abs(waEnd - oldDur) < fd / 2;
        comp.duration = Math.round(newDur / fd) * fd;
        if (wasFull) comp.workAreaDuration = comp.duration - comp.workAreaStart;
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
            bumpAt0: false,        // a non-Default marker sits on frame 0 and must make room
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
                else row.strays.push(frameOf(t, fd));
            } else if (a.kind === "token") {
                if (!row.willShift && isNearZero(t, comp)) {
                    row.splitAt0 = true;
                    after = "Default @0 + " + a.cleaned + " @1";
                } else {
                    after = a.cleaned;
                }
                row.tokenFixes.push({ frame: frameOf(t, fd), before: mv.comment, after: after });
            } else if (!row.willShift && isNearZero(t, comp)) {
                row.bumpAt0 = true;
            }

            if (row.willShift && t < comp.duration - eps && t + fd > comp.duration - eps) {
                row.overflowMarkers.push(frameOf(t, fd));
            }
        }

        row.defaultStatus = row.defaultAt0 ? "Yes" : (row.splitAt0 ? "Via split" : "No");

        // ---- planned action summary ----
        acts = [];
        if (row.willShift) acts.push("Shift +1f");
        if (row.tokenFixes.length) acts.push("Clean " + row.tokenFixes.length);
        have0 = row.defaultAt0 || row.splitAt0;
        if (row.bumpAt0) acts.push("Bump f0 marker");
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
    //   - postOrder lists children before parents, used by the apply phase
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

    // scopeIndex 0 = active comp + children, 1 = selected comps + children.
    // rootIds (optional) re-scans the same roots as an earlier scan, which matters because
    // clicking a row opens that comp and changes the active item.
    function runScan(scopeIndex, skipText, rootIds) {
        var ctx = { rows: [], postOrder: [], visited: {}, skipped: 0, skip: parseSkipList(skipText),
                    rootIds: [], parents: {} };
        var roots = [], i, k, sel, item, r, cid, pn;

        if (rootIds && rootIds.length) {
            for (i = 0; i < rootIds.length; i++) {
                try {
                    item = app.project.itemByID(rootIds[i]);
                    if (item instanceof CompItem) roots.push(item);
                } catch (e) {}
            }
        } else if (scopeIndex === 0) {
            if (app.project.activeItem instanceof CompItem) roots.push(app.project.activeItem);
        } else {
            sel = app.project.selection;
            for (i = 0; i < sel.length; i++) {
                if (sel[i] instanceof CompItem) roots.push(sel[i]);
            }
        }
        if (!roots.length) return null;

        for (i = 0; i < roots.length; i++) {
            ctx.rootIds.push(roots[i].id);
            traverse(roots[i], 0, ctx);
        }

        // who uses whom, so the log can say which parents were not extended
        for (i = 0; i < ctx.rows.length; i++) {
            r = ctx.rows[i];
            for (k = 0; k < r.children.length; k++) {
                cid = r.children[k];
                if (!ctx.parents[cid]) ctx.parents[cid] = [];
                ctx.parents[cid].push(r.name);
            }
        }
        for (pn in ctx.parents) {
            if (ctx.parents.hasOwnProperty(pn)) ctx.parents[pn] = uniq(ctx.parents[pn]);
        }
        return ctx;
    }

    // ------------------------------------------------------------------
    // Apply one comp. Order:
    //   shift layers + markers -> clean tokens -> enforce Default (bumping anything on f0)
    //   -> overflow handling -> write markers.
    // ------------------------------------------------------------------
    function applyComp(comp, row, decision, parentNames, log) {
        var fd = comp.frameDuration;
        var eps = fd / 2;
        var oldDur = comp.duration;
        var n = comp.numLayers;
        var preOut = [], wasLocked = [], ovLayers = [], outside = [];
        var i, j, L, list, sigBefore, m, a, exacts, others, keep, used, f, need, d, total, bumped;

        try {
            // Unlock (restored in finally) and remember pre-shift out points.
            for (i = 1; i <= n; i++) {
                L = comp.layer(i);
                preOut[i] = L.outPoint;
                wasLocked[i] = L.locked;
                if (L.locked) L.locked = false;
            }

            // ---- 1. shift every layer ----
            if (row.willShift) {
                for (i = 1; i <= n; i++) {
                    L = comp.layer(i);
                    L.startTime = L.startTime + fd;
                }
                log("  Shifted " + n + " layer(s) +1 frame");
                for (i = 1; i <= n; i++) {
                    L = comp.layer(i);
                    if (preOut[i] <= oldDur + eps && L.outPoint > oldDur + eps) ovLayers.push(L);
                }
            }

            // ---- markers: read, shift, clean, enforce ----
            list = readMarkers(comp);
            sigBefore = markerSig(list);

            if (row.willShift) {
                for (i = 0; i < list.length; i++) list[i].t += fd;
                if (list.length) log("  Shifted " + list.length + " marker(s) +1 frame");
            }

            // 2. clean tokens in place
            for (i = 0; i < list.length; i++) {
                a = analyzeComment(list[i].mv.comment);
                if (a.kind === "token") {
                    log("  Cleaned marker f" + frameOf(list[i].t, fd) + ": \"" + list[i].mv.comment + "\" -> \"" + a.cleaned + "\"");
                    list[i].mv = cloneMarker(list[i].mv, a.cleaned);
                }
            }

            // 3. enforce Default at frame 0
            exacts = [];
            others = [];
            for (i = 0; i < list.length; i++) {
                if (analyzeComment(list[i].mv.comment).kind === "exact") exacts.push(list[i]);
                else others.push(list[i]);
            }

            keep = null;
            for (i = 0; i < exacts.length; i++) {
                if (isNearZero(exacts[i].t, comp)) { keep = exacts[i]; break; }
            }
            if (!keep && exacts.length) {
                keep = exacts[0];
                log("  Moved Default f" + frameOf(keep.t, fd) + " -> f0");
            }
            if (keep) {
                if (exacts.length > 1) log("  Deleted " + (exacts.length - 1) + " duplicate Default marker(s)");
                if (trim(keep.mv.comment) !== TOKEN) keep.mv = cloneMarker(keep.mv, TOKEN);
                keep.t = 0;
            } else {
                keep = { t: 0, mv: new MarkerValue(TOKEN) };
                log("  Created Default at f0");
            }

            // Anything else on frame 0 makes room: bump to the next free frame.
            used = {};
            for (i = 0; i < others.length; i++) {
                if (!isNearZero(others[i].t, comp)) used[frameOf(others[i].t, fd)] = true;
            }
            sortMarkers(others);
            bumped = 0;
            for (i = 0; i < others.length; i++) {
                if (isNearZero(others[i].t, comp)) {
                    f = 1;
                    while (used[f]) f++;
                    used[f] = true;
                    others[i].t = f * fd;
                    bumped++;
                    log("  Moved marker \"" + others[i].mv.comment + "\" f0 -> f" + f + (f > 1 ? " (next free frame)" : ""));
                }
            }

            list = others;
            list.push(keep);
            sortMarkers(list);

            // ---- 4. overflow ----
            for (i = 0; i < list.length; i++) {
                if (list[i].t >= comp.duration - eps) outside.push(list[i]);
            }

            if (ovLayers.length || outside.length) {
                d = decision;
                if (!d) {
                    d = { fit: "extend", markers: "extend" };
                    log("  ! Overflow was not in the scan; extended the comp");
                }

                if (d.fit === "extend") {
                    need = oldDur;
                    for (i = 0; i < ovLayers.length; i++) need = Math.max(need, ovLayers[i].outPoint);
                    for (i = 0; i < outside.length; i++) need = Math.max(need, outside[i].t + fd);
                    extendComp(comp, need);
                    log("  Extended comp to " + comp.duration.toFixed(3) + "s (+" + Math.round((comp.duration - oldDur) / fd) + " frame(s))");
                } else {
                    for (i = 0; i < ovLayers.length; i++) {
                        L = ovLayers[i];
                        if (L.inPoint < oldDur - eps) {
                            L.outPoint = oldDur;
                        } else {
                            log("  ! Layer \"" + L.name + "\" now starts at/after the comp end; could not trim it");
                        }
                    }
                    if (ovLayers.length) log("  Trimmed " + ovLayers.length + " layer(s) to the comp end");

                    if (outside.length) {
                        if (d.markers === "extend") {
                            need = oldDur;
                            for (i = 0; i < outside.length; i++) need = Math.max(need, outside[i].t + fd);
                            extendComp(comp, need);
                            log("  Extended comp to " + comp.duration.toFixed(3) + "s for " + outside.length + " marker(s)");
                        } else if (d.markers === "delete") {
                            for (i = 0; i < outside.length; i++) {
                                for (j = list.length - 1; j >= 0; j--) {
                                    if (list[j] === outside[i]) list.splice(j, 1);
                                }
                            }
                            log("  Deleted " + outside.length + " marker(s) past the comp end");
                        } else {
                            // move to the last free frames, latest marker gets the last frame
                            used = {};
                            for (i = 0; i < list.length; i++) {
                                if (list[i].t < comp.duration - eps) used[frameOf(list[i].t, fd)] = true;
                            }
                            total = Math.round(comp.duration / fd);
                            outside.sort(function (p, q) { return q.t - p.t; });
                            for (i = 0; i < outside.length; i++) {
                                f = total - 1;
                                while (f > 0 && used[f]) f--;
                                if (used[f]) {
                                    for (j = list.length - 1; j >= 0; j--) {
                                        if (list[j] === outside[i]) list.splice(j, 1);
                                    }
                                    log("  ! No free frame for marker \"" + outside[i].mv.comment + "\"; deleted it");
                                } else {
                                    used[f] = true;
                                    outside[i].t = f * fd;
                                    if (f !== total - 1) {
                                        log("  ! Marker \"" + outside[i].mv.comment + "\" took f" + f +
                                            " because later frames were occupied (marker order may change)");
                                    }
                                }
                            }
                            log("  Moved " + outside.length + " marker(s) to the end of the comp");
                        }
                    }
                }

                if (comp.duration > oldDur && parentNames && parentNames.length) {
                    log("  NOTE: precomp layers in [" + parentNames.join(", ") + "] were not extended");
                }
            }

            // ---- 5. write markers only if something changed ----
            if (markerSig(list) !== sigBefore) writeMarkers(comp, list);

            if (row.exprWarn.length) log("  ! " + row.exprWarn.length + " layer(s) have time-based expressions; check them");
            if (row.remapWarn.length) log("  ! " + row.remapWarn.length + " layer(s) use time remapping; check them");
            if (row.hiddenPrecomps.length) log("  Hidden precomps: " + fmtNames(row.hiddenPrecomps));
        } finally {
            for (i = 1; i <= n; i++) {
                if (wasLocked[i]) {
                    try { comp.layer(i).locked = true; } catch (e) {}
                }
            }
        }
    }

    // ------------------------------------------------------------------
    // Formatting for the list and report
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

    function buildReport(ctx, logLines) {
        var out = ["Default Marker / Frame 0 report", new Date().toString(), ""], i, r;
        if (ctx) {
            out.push(summarize(ctx), "");
            for (i = 0; i < ctx.rows.length; i++) {
                r = ctx.rows[i];
                out.push(rep("  ", r.depth) + r.name + (r.use ? "" : "  [not selected]"));
                out.push(rep("  ", r.depth) + "    Default @0: " + r.defaultStatus +
                         " | Strays: " + fmtStrays(r) + " | Footage @0: " + r.footageAt0.length);
                out.push(rep("  ", r.depth) + "    Token fixes: " + fmtTokens(r));
                out.push(rep("  ", r.depth) + "    Hidden precomps: " + fmtNames(r.hiddenPrecomps) +
                         " | Overflow: " + fmtOverflow(r) + " | Warnings: " + fmtWarn(r));
                out.push(rep("  ", r.depth) + "    Planned: " + r.planned);
            }
        } else {
            out.push("(no scan)");
        }
        if (logLines.length) {
            out.push("", "Apply log", "---------");
            for (i = 0; i < logLines.length; i++) out.push(logLines[i]);
        }
        return out.join("\n");
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
                alert("That comp no longer exists. Press Refresh.");
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
            alert("Could not select layers (stack changed since the scan?). Press Refresh.\n\n" + err.toString());
        }
    }

    // ------------------------------------------------------------------
    // Dialogs, backup, clipboard
    // ------------------------------------------------------------------
    function askOverflow(title, text) {
        var dlg = new Window("dialog", title);
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];

        var info = dlg.add("statictext", undefined, text, { multiline: true });
        info.preferredSize = [460, 100];

        var p1 = dlg.add("panel", undefined, "Layers and markers that run past the comp end");
        p1.alignChildren = ["left", "top"];
        var rbExtend = p1.add("radiobutton", undefined, "Extend the comp so everything fits");
        var rbTrim = p1.add("radiobutton", undefined, "Trim layers to the comp end");
        rbExtend.value = true;

        var p2 = dlg.add("panel", undefined, "Markers that fall outside (used when trimming)");
        p2.alignChildren = ["left", "top"];
        var rbLast = p2.add("radiobutton", undefined, "Move them to the last frame");
        var rbDel = p2.add("radiobutton", undefined, "Delete them");
        var rbExt = p2.add("radiobutton", undefined, "Extend the comp just enough for the markers");
        rbLast.value = true;
        p2.enabled = false;

        rbExtend.onClick = function () { p2.enabled = false; };
        rbTrim.onClick = function () { p2.enabled = true; };

        var bg = dlg.add("group");
        bg.alignment = ["right", "bottom"];
        bg.add("button", undefined, "OK", { name: "ok" });
        bg.add("button", undefined, "Cancel", { name: "cancel" });

        if (dlg.show() !== 1) return null;
        return {
            fit: rbTrim.value ? "trim" : "extend",
            markers: rbDel.value ? "delete" : (rbExt.value ? "extend" : "last")
        };
    }

    // Returns {global, byComp} or null if the user cancelled.
    function collectDecisions(todo, perComp) {
        var ov = [], i, r, lines, dec, out = { global: null, byComp: {} };
        for (i = 0; i < todo.length; i++) {
            if (todo[i].overflowLayers.length || todo[i].overflowMarkers.length) ov.push(todo[i]);
        }
        if (!ov.length) return out;

        if (perComp) {
            for (i = 0; i < ov.length; i++) {
                r = ov[i];
                dec = askOverflow("Overflow: " + r.name,
                    "The one-frame shift pushes " + fmtOverflow(r) + " past the end of \"" + r.name + "\".");
                if (!dec) return null;
                out.byComp[r.id] = dec;
            }
        } else {
            lines = [];
            for (i = 0; i < ov.length && i < 8; i++) lines.push("  " + ov[i].name + ": " + fmtOverflow(ov[i]));
            if (ov.length > 8) lines.push("  ...and " + (ov.length - 8) + " more");
            dec = askOverflow("Overflow",
                "The one-frame shift pushes layers or markers past the comp end in " + ov.length +
                " comp(s). This choice applies to all of them.\n\n" + lines.join("\n"));
            if (!dec) return null;
            out.global = dec;
        }
        return out;
    }

    function decisionFor(decisions, id) {
        return decisions.byComp[id] || decisions.global || null;
    }

    // Saves the project, then copies the saved file next to it. Returns true on success.
    function makeBackup(log) {
        var f = app.project.file, d, stamp, name, m, backupName, target;
        if (!f) {
            alert("Save the project first, or untick \"Save backup copy first\".");
            return false;
        }
        try {
            app.project.save();
        } catch (e) {
            alert("Could not save the project before backing up:\n" + e.toString());
            return false;
        }
        d = new Date();
        stamp = d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + "-" +
                pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
        name = decodeURI(f.name);
        m = name.match(/^(.*)(\.[^.]+)$/);
        backupName = m ? (m[1] + "_backup_" + stamp + m[2]) : (name + "_backup_" + stamp);
        target = new File(f.parent.fsName + "/" + backupName);
        if (!f.copy(target.fsName)) {
            alert("Could not write the backup copy. Check the scripting file-access preference.");
            return false;
        }
        log("Backup saved: " + target.fsName);
        return true;
    }

    function saveReport(text) {
        var f = File.saveDialog("Save report", "Text:*.txt");
        if (!f) return;
        f.encoding = "UTF-8";
        if (!f.open("w")) {
            alert("Could not write the file. Enable \"Allow Scripts to Write Files and Access Network\".");
            return;
        }
        f.write(text);
        f.close();
    }

    // Best effort: writes a temp file and pipes it to pbcopy / clip.
    function copyReport(text) {
        var tmp = new File(Folder.temp.fsName + "/dmf0_report.txt"), cmd;
        tmp.encoding = "UTF-8";
        if (!tmp.open("w")) {
            alert("Could not write a temp file for the clipboard. Use Save report instead.");
            return;
        }
        tmp.write(text);
        tmp.close();
        if ($.os.indexOf("Windows") !== -1) cmd = 'cmd.exe /c clip < "' + tmp.fsName + '"';
        else cmd = 'pbcopy < "' + tmp.fsName + '"';
        try { system.callSystem(cmd); } catch (e) { alert("Clipboard copy failed. Use Save report instead."); }
    }

    // Best effort: hold Esc to stop between comps.
    function escDown() {
        try {
            return ScriptUI.environment.keyboardState.keyName === "Escape";
        } catch (e) {
            return false;
        }
    }

    // ------------------------------------------------------------------
    // UI
    // ------------------------------------------------------------------
    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj
                : new Window("palette", "Default Marker / Frame 0", undefined, { resizeable: true });
        var state = { ctx: null, rootIds: null, log: [] };

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.margins = 10;
        win.spacing = 8;

        // ---- top controls ----
        var top = win.add("group");
        top.alignChildren = ["left", "center"];
        top.add("statictext", undefined, "Scope:");
        var scopeDD = top.add("dropdownlist", undefined, ["Active comp + children", "Selected comps + children"]);
        scopeDD.selection = 0;
        top.add("statictext", undefined, "Skip:");
        var skipTxt = top.add("edittext", undefined, "");
        skipTxt.characters = 18;
        skipTxt.helpTip = "Comp name patterns to skip, comma separated. Wildcard *, e.g. _ref*, OLD_*";
        var scanBtn = top.add("button", undefined, "Scan");
        scanBtn.helpTip = "Pick the root comp(s) again from the active comp / Project selection and scan.";
        var refreshBtn = top.add("button", undefined, "Refresh");
        refreshBtn.helpTip = "Re-scan the same root comp(s) as the last scan (clicking rows changes the active comp).";

        // ---- options ----
        var opts = win.add("group");
        opts.alignChildren = ["left", "center"];
        var chkBackup = opts.add("checkbox", undefined, "Save backup copy first");
        chkBackup.value = true;
        var chkPerComp = opts.add("checkbox", undefined, "Review overflow per comp");
        chkPerComp.value = false;

        // ---- list ----
        var list = win.add("listbox", undefined, [], {
            numberOfColumns: 10,
            showHeaders: true,
            multiselect: false,
            columnTitles: ["Use", "Comp", "Default @0", "Stray Defaults", "Token fixes",
                           "Footage @0", "Hidden precomps", "Overflow", "Warnings", "Planned action"],
            columnWidths: [34, 200, 70, 90, 200, 70, 120, 100, 90, 180]
        });
        list.preferredSize = [1000, 260];
        list.alignment = ["fill", "fill"];
        list.helpTip = "Click a row to open that comp and select its flagged layers. Double-click to toggle Use.";

        var status = win.add("statictext", undefined, "", { truncate: "end" });
        status.alignment = ["fill", "bottom"];

        var pb = win.add("progressbar", undefined, 0, 100);
        pb.alignment = ["fill", "bottom"];
        pb.visible = false;

        var logBox = win.add("edittext", undefined, "", { multiline: true, readonly: true, scrolling: true });
        logBox.preferredSize = [1000, 110];
        logBox.alignment = ["fill", "bottom"];

        var btns = win.add("group");
        btns.alignment = ["right", "bottom"];
        var applyBtn = btns.add("button", undefined, "Apply");
        var copyBtn = btns.add("button", undefined, "Copy report");
        var saveBtn = btns.add("button", undefined, "Save report...");
        var closeBtn = btns.add("button", undefined, "Close");

        // ---- helpers ----
        function appendLog(line) {
            state.log.push(line);
            logBox.text += line + "\n";
        }

        function showCtx(ctx) {
            var i, item;
            state.ctx = ctx;
            list.removeAll();
            for (i = 0; i < ctx.rows.length; i++) {
                item = list.add("item", "");
                setRowText(item, ctx.rows[i]);
            }
            status.text = summarize(ctx);
            $.writeln("[DefaultMarkerFrame0] " + status.text);
        }

        function scanIndex() {
            return scopeDD.selection ? scopeDD.selection.index : 0;
        }

        function doScan() {
            var ctx;
            state.ctx = null;
            list.removeAll();
            ctx = runScan(scanIndex(), skipTxt.text, null);
            if (!ctx) {
                state.rootIds = null;
                status.text = "Open a comp (or select comps in the Project panel), then press Scan.";
                return;
            }
            state.rootIds = ctx.rootIds;
            showCtx(ctx);
        }

        function doRefresh() {
            var useMap = {}, i, ctx;
            if (!state.rootIds) { doScan(); return; }
            if (state.ctx) {
                for (i = 0; i < state.ctx.rows.length; i++) useMap[state.ctx.rows[i].id] = state.ctx.rows[i].use;
            }
            ctx = runScan(scanIndex(), skipTxt.text, state.rootIds);
            if (!ctx) {
                status.text = "The scanned comp(s) no longer exist. Press Scan.";
                list.removeAll();
                state.ctx = null;
                return;
            }
            for (i = 0; i < ctx.rows.length; i++) {
                if (useMap[ctx.rows[i].id] === false) ctx.rows[i].use = false;
            }
            showCtx(ctx);
        }

        // ---- apply ----
        function doApply() {
            var useMap = {}, i, ctx, todo = [], todoMap = {}, order = [], decisions, cancelled = false;
            var done = 0, errors = 0, comp, row, id, remaining;

            if (!state.ctx) { status.text = "Scan first."; return; }

            // Fresh scan of the same roots so the plan matches the project right now.
            for (i = 0; i < state.ctx.rows.length; i++) useMap[state.ctx.rows[i].id] = state.ctx.rows[i].use;
            ctx = runScan(scanIndex(), skipTxt.text, state.rootIds);
            if (!ctx) { status.text = "The scanned comp(s) no longer exist. Press Scan."; return; }
            for (i = 0; i < ctx.rows.length; i++) {
                if (useMap[ctx.rows[i].id] === false) ctx.rows[i].use = false;
            }
            showCtx(ctx);

            for (i = 0; i < ctx.rows.length; i++) {
                if (ctx.rows[i].use && ctx.rows[i].planned !== "OK") {
                    todo.push(ctx.rows[i]);
                    todoMap[ctx.rows[i].id] = ctx.rows[i];
                }
            }
            if (!todo.length) { status.text = "Nothing to apply. " + summarize(ctx); return; }

            decisions = collectDecisions(todo, chkPerComp.value);
            if (!decisions) { status.text = "Apply cancelled."; return; }

            if (!confirm("Apply changes to " + todo.length + " comp(s)?\n\n" +
                         (chkBackup.value ? "The project will be saved, then a backup copy is written next to it.\n" : "No backup copy will be made.\n") +
                         "The whole run is one undo step (Edit > Undo).")) {
                status.text = "Apply cancelled.";
                return;
            }

            logBox.text = "";
            state.log = [];
            appendLog("=== Apply " + new Date().toString() + " ===");
            if (chkBackup.value && !makeBackup(appendLog)) { status.text = "Apply stopped: backup failed."; return; }

            for (i = 0; i < ctx.postOrder.length; i++) {
                if (todoMap[ctx.postOrder[i]]) order.push(ctx.postOrder[i]);
            }

            pb.value = 0;
            pb.visible = true;
            applyBtn.enabled = false;

            app.beginUndoGroup("Default Marker / Frame 0");
            try {
                for (i = 0; i < order.length; i++) {
                    if (escDown()) { cancelled = true; break; }
                    id = order[i];
                    row = todoMap[id];
                    pb.value = Math.round((i / order.length) * 100);
                    status.text = "Applying " + (i + 1) + "/" + order.length + ": " + row.name + "  (hold Esc to stop)";
                    win.update();

                    appendLog("Comp \"" + row.name + "\" [" + row.planned + "]");
                    try {
                        comp = app.project.itemByID(id);
                        if (!(comp instanceof CompItem)) throw new Error("comp not found");
                        applyComp(comp, row, decisionFor(decisions, id), ctx.parents[id], appendLog);
                        done++;
                    } catch (err) {
                        errors++;
                        appendLog("  ERROR: " + err.toString() + (err.line ? " (line " + err.line + ")" : "") +
                                  " - this comp may be partly changed");
                    }
                }
            } finally {
                app.endUndoGroup();
            }

            pb.value = 100;
            pb.visible = false;
            applyBtn.enabled = true;

            appendLog(cancelled ? "Stopped early: " + done + " comp(s) done. Edit > Undo reverts everything applied so far."
                                : "Finished: " + done + " comp(s) done, " + errors + " error(s). Edit > Undo reverts the whole run.");

            // Verify: anything still needing work (and anything that still wants a shift = run-twice guard)
            doRefresh();
            remaining = [];
            for (i = 0; i < state.ctx.rows.length; i++) {
                row = state.ctx.rows[i];
                if (todoMap[row.id] && row.planned !== "OK") remaining.push(row.name + " [" + row.planned + "]");
            }
            if (remaining.length) {
                appendLog("Verify: " + remaining.length + " comp(s) still show planned work:");
                for (i = 0; i < remaining.length; i++) appendLog("  " + remaining[i]);
            } else if (!cancelled) {
                appendLog("Verify: all applied comps now report OK.");
            }
            status.text = (cancelled ? "Stopped. " : "Done. ") + summarize(state.ctx);
        }

        // ---- events ----
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

        scanBtn.onClick = doScan;
        refreshBtn.onClick = doRefresh;
        scopeDD.onChange = doScan;
        applyBtn.onClick = doApply;
        copyBtn.onClick = function () { copyReport(buildReport(state.ctx, state.log)); };
        saveBtn.onClick = function () { saveReport(buildReport(state.ctx, state.log)); };
        closeBtn.onClick = function () {
            if (win instanceof Window) win.close();
        };

        win.onResizing = win.onResize = function () { this.layout.resize(); };

        doScan();
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
