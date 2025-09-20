{
    function MaskTransferUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Mask Transfer", undefined, {resizeable:true});
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];

        // Layer selection
        win.add("statictext", undefined, "Select Source Layer:");
        var srcDropdown = win.add("dropdownlist", undefined, []);
        win.add("statictext", undefined, "Select Target Layer:");
        var tgtDropdown = win.add("dropdownlist", undefined, []);

        // Mask selection
        win.add("statictext", undefined, "Select Masks to Transfer:");
        var maskPanel = win.add("panel", undefined, "");
        maskPanel.orientation = "column";
        maskPanel.alignChildren = ["left", "top"];
        maskPanel.preferredSize.height = 150;

        // Options: scale & offset
        var scaleGroup = win.add("group");
        scaleGroup.orientation = "row";
        scaleGroup.add("statictext", undefined, "Scale X:");
        var scaleXInput = scaleGroup.add("edittext", undefined, "1"); scaleXInput.characters = 5;
        scaleGroup.add("statictext", undefined, "Scale Y:");
        var scaleYInput = scaleGroup.add("edittext", undefined, "1"); scaleYInput.characters = 5;

        var offsetGroup = win.add("group");
        offsetGroup.orientation = "row";
        offsetGroup.add("statictext", undefined, "Offset X:");
        var offsetXInput = offsetGroup.add("edittext", undefined, "0"); offsetXInput.characters = 5;
        offsetGroup.add("statictext", undefined, "Offset Y:");
        var offsetYInput = offsetGroup.add("edittext", undefined, "0"); offsetYInput.characters = 5;

        // Buttons
        var btnGroup = win.add("group");
        btnGroup.orientation = "row";
        var commitBtn = btnGroup.add("button", undefined, "Commit Masks");
        var resetBtn = btnGroup.add("button", undefined, "Reset Preview");

        function populateLayerDropdowns() {
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) return;
            srcDropdown.removeAll();
            tgtDropdown.removeAll();
            for (var i = 1; i <= comp.numLayers; i++) {
                srcDropdown.add("item", comp.layer(i).name);
                tgtDropdown.add("item", comp.layer(i).name);
            }
        }

        function populateMaskList() {
            maskPanel.children.forEach(function(c) { c.remove(); });
            if (!srcDropdown.selection) return;
            var comp = app.project.activeItem;
            var srcLayer = comp.layer(srcDropdown.selection.index + 1);
            for (var i = 1; i <= srcLayer.mask.numProperties; i++) {
                var mask = srcLayer.mask.property(i);
                maskPanel.add("checkbox", undefined, mask.name);
            }
            maskPanel.layout.layout(true);
        }

        populateLayerDropdowns();
        srcDropdown.onChange = populateMaskList;

        var previewMasks = {}; // map: sourceMaskIndex -> targetMask

        function updatePreview() {
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) return;
            if (!srcDropdown.selection || !tgtDropdown.selection) return;

            var srcLayer = comp.layer(srcDropdown.selection.index + 1);
            var tgtLayer = comp.layer(tgtDropdown.selection.index + 1);

            var scaleX = parseFloat(scaleXInput.text);
            var scaleY = parseFloat(scaleYInput.text);
            var offsetX = parseFloat(offsetXInput.text);
            var offsetY = parseFloat(offsetYInput.text);

            for (var i = 0; i < maskPanel.children.length; i++) {
                var checkbox = maskPanel.children[i];
                if (!checkbox.value) {
                    // Remove preview mask if unchecked
                    if (previewMasks[i]) {
                        try { previewMasks[i].remove(); } catch(e) {}
                        previewMasks[i] = null;
                    }
                    continue;
                }

                var srcMask = srcLayer.mask.property(i + 1);
                var newMask = previewMasks[i];

                if (!newMask) {
                    // Create new preview mask
                    newMask = tgtLayer.mask.addProperty("Mask");
                    previewMasks[i] = newMask;
                }

                newMask.name = srcMask.name;
                newMask.maskMode = srcMask.maskMode;
                newMask.maskExpansion.setValue(srcMask.maskExpansion.value);
                newMask.maskFeather.setValue(srcMask.maskFeather.value);

                var srcPath = srcMask.property("maskPath");
                if (srcPath.isTimeVarying) {
                    while (newMask.property("maskPath").numKeys > 0) {
                        newMask.property("maskPath").removeKey(1);
                    }
                    for (var k = 1; k <= srcPath.numKeys; k++) {
                        var keyTime = srcPath.keyTime(k);
                        var keyValue = srcPath.keyValue(k);
                        var scaledPath = new Shape();
                        scaledPath.vertices = [];
                        scaledPath.inTangents = [];
                        scaledPath.outTangents = [];
                        for (var j = 0; j < keyValue.vertices.length; j++) {
                            scaledPath.vertices.push([keyValue.vertices[j][0]*scaleX + offsetX, keyValue.vertices[j][1]*scaleY + offsetY]);
                            scaledPath.inTangents.push([keyValue.inTangents[j][0]*scaleX, keyValue.inTangents[j][1]*scaleY]);
                            scaledPath.outTangents.push([keyValue.outTangents[j][0]*scaleX, keyValue.outTangents[j][1]*scaleY]);
                        }
                        scaledPath.closed = keyValue.closed;
                        newMask.property("maskPath").setValueAtTime(keyTime, scaledPath);
                    }
                } else {
                    var staticValue = srcPath.value;
                    var scaledPath = new Shape();
                    scaledPath.vertices = [];
                    scaledPath.inTangents = [];
                    scaledPath.outTangents = [];
                    for (var j = 0; j < staticValue.vertices.length; j++) {
                        scaledPath.vertices.push([staticValue.vertices[j][0]*scaleX + offsetX, staticValue.vertices[j][1]*scaleY + offsetY]);
                        scaledPath.inTangents.push([staticValue.inTangents[j][0]*scaleX, staticValue.inTangents[j][1]*scaleY]);
                        scaledPath.outTangents.push([staticValue.outTangents[j][0]*scaleX, staticValue.outTangents[j][1]*scaleY]);
                    }
                    scaledPath.closed = staticValue.closed;
                    newMask.property("maskPath").setValue(scaledPath);
                }
            }
        }

        // Live preview triggers
        [scaleXInput, scaleYInput, offsetXInput, offsetYInput].forEach(function(input){
            input.onChanging = updatePreview;
        });
        maskPanel.onClick = updatePreview;
        srcDropdown.onChange = updatePreview;
        tgtDropdown.onChange = updatePreview;

        commitBtn.onClick = function() {
            previewMasks = {}; // preview masks are now final
            alert("Masks committed!");
        };

        resetBtn.onClick = function() {
            for (var i in previewMasks) {
                try { previewMasks[i].remove(); } catch(e) {}
            }
            previewMasks = {};
            alert("Preview masks reset.");
        };

        if (win instanceof Window) {
            win.center();
            win.show();
        } else {
            win.layout.layout(true);
            win.layout.resize();
        }
    }

    MaskTransferUI(this);
}