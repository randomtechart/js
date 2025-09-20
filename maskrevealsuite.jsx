// MaskRevealSuite.jsx
// ===================
// Main UI for the Mask Reveal Suite
// Loads external presets from MaskRevealPresets.jsx

(function MaskRevealSuite() {

    // Load the presets file
    var presetFile = File($.fileName).path + "/MaskRevealPresets.jsx";
    $.evalFile(presetFile);

    // UI
    var win = new Window("palette", "Mask Reveal Suite", undefined);
    win.orientation = "column";

    win.add("statictext", undefined, "Select Reveal Preset:");

    var presetDropdown = win.add("dropdownlist", undefined, []);
    for (var key in MaskRevealPresets) {
        presetDropdown.add("item", key);
    }
    presetDropdown.selection = 0;

    var applyBtn = win.add("button", undefined, "Apply Preset");

    applyBtn.onClick = function() {
        var sel = app.project.activeItem.selectedLayers;
        if (!sel || sel.length === 0) {
            alert("Select at least one layer with a mask.");
            return;
        }

        app.beginUndoGroup("Apply Mask Reveal Preset");

        var presetName = presetDropdown.selection.text;
        var presetFunc = MaskRevealPresets[presetName];

        for (var i = 0; i < sel.length; i++) {
            var layer = sel[i];
            if (layer.mask && layer.mask.numProperties > 0) {
                var mask = layer.mask(1);
                var shape = mask.property("maskPath").value;
                var newShape = presetFunc(new Shape(shape));
                mask.property("maskPath").setValue(newShape);
            }
        }

        app.endUndoGroup();
    };

    win.center();
    win.show();

})();