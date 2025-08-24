/**

- After Effects Utility Library
- 100 Essential Functions for Creating Professional AE Tools
- 
- This library provides comprehensive utilities for:
- - Layer Management
- - Composition Operations
- - Property Animation
- - Masks and Shapes
- - Text and Graphics
- - Effects and Expressions
- - File Operations
- - UI Creation
- - Math and Utilities
- - Project Management
    */

// Global utility object to contain all functions
var AEUtils = (function() {
“use strict”;

```
var utils = {};

// ========================================
// PROJECT & COMPOSITION UTILITIES (1-10)
// ========================================

// 1. Get active composition
utils.getActiveComp = function() {
    return app.project.activeItem;
};

// 2. Create new composition
utils.createComp = function(name, width, height, duration, frameRate) {
    width = width || 1920;
    height = height || 1080;
    duration = duration || 10;
    frameRate = frameRate || 29.97;
    return app.project.items.addComp(name, width, height, 1, duration, frameRate);
};

// 3. Get composition by name
utils.getCompByName = function(name) {
    for (var i = 1; i <= app.project.items.length; i++) {
        var item = app.project.items[i];
        if (item instanceof CompItem && item.name === name) {
            return item;
        }
    }
    return null;
};

// 4. Duplicate composition
utils.duplicateComp = function(comp, newName) {
    var dupComp = comp.duplicate();
    if (newName) dupComp.name = newName;
    return dupComp;
};

// 5. Get project item by name
utils.getProjectItem = function(name) {
    for (var i = 1; i <= app.project.items.length; i++) {
        if (app.project.items[i].name === name) {
            return app.project.items[i];
        }
    }
    return null;
};

// 6. Create folder in project
utils.createFolder = function(name) {
    return app.project.items.addFolder(name);
};

// 7. Move item to folder
utils.moveToFolder = function(item, folder) {
    item.parentFolder = folder;
};

// 8. Get all compositions in project
utils.getAllComps = function() {
    var comps = [];
    for (var i = 1; i <= app.project.items.length; i++) {
        var item = app.project.items[i];
        if (item instanceof CompItem) {
            comps.push(item);
        }
    }
    return comps;
};

// 9. Get project info
utils.getProjectInfo = function() {
    return {
        name: app.project.file ? app.project.file.name : "Untitled",
        numItems: app.project.items.length,
        activeComp: app.project.activeItem ? app.project.activeItem.name : null
    };
};

// 10. Save project
utils.saveProject = function(path) {
    if (path) {
        app.project.save(new File(path));
    } else {
        app.project.save();
    }
};

// ========================================
// LAYER MANAGEMENT (11-30)
// ========================================

// 11. Get selected layers
utils.getSelectedLayers = function(comp) {
    comp = comp || utils.getActiveComp();
    if (!comp) return [];
    return comp.selectedLayers;
};

// 12. Get layer by name
utils.getLayerByName = function(comp, name) {
    comp = comp || utils.getActiveComp();
    if (!comp) return null;
    for (var i = 1; i <= comp.numLayers; i++) {
        if (comp.layer(i).name === name) {
            return comp.layer(i);
        }
    }
    return null;
};

// 13. Create solid layer
utils.createSolid = function(comp, name, color, width, height, duration) {
    comp = comp || utils.getActiveComp();
    if (!comp) return null;
    color = color || [1, 1, 1];
    width = width || comp.width;
    height = height || comp.height;
    duration = duration || comp.duration;
    return comp.layers.addSolid(color, name, width, height, 1, duration);
};

// 14. Create null layer
utils.createNull = function(comp, name) {
    comp = comp || utils.getActiveComp();
    if (!comp) return null;
    var nullLayer = comp.layers.addNull();
    if (name) nullLayer.name = name;
    return nullLayer;
};

// 15. Create text layer
utils.createText = function(comp, text, name) {
    comp = comp || utils.getActiveComp();
    if (!comp) return null;
    var textLayer = comp.layers.addText(text || "Sample Text");
    if (name) textLayer.name = name;
    return textLayer;
};

// 16. Duplicate layer
utils.duplicateLayer = function(layer, newName) {
    var dupLayer = layer.duplicate();
    if (newName) dupLayer.name = newName;
    return dupLayer;
};

// 17. Delete layer
utils.deleteLayer = function(layer) {
    layer.remove();
};

// 18. Lock/unlock layer
utils.lockLayer = function(layer, lock) {
    layer.locked = lock !== false;
};

// 19. Show/hide layer
utils.showLayer = function(layer, visible) {
    layer.enabled = visible !== false;
};

// 20. Set layer parent
utils.setParent = function(childLayer, parentLayer) {
    childLayer.parent = parentLayer;
};

// 21. Get layer bounds
utils.getLayerBounds = function(layer, time) {
    time = time || 0;
    return layer.sourceRectAtTime(time, false);
};

// 22. Center layer in comp
utils.centerLayer = function(layer, comp) {
    comp = comp || layer.containingComp;
    var layerRect = utils.getLayerBounds(layer);
    layer.transform.position.setValue([
        comp.width / 2,
        comp.height / 2
    ]);
};

// 23. Align layers
utils.alignLayers = function(layers, alignment) {
    if (layers.length < 2) return;
    var bounds = [];
    for (var i = 0; i < layers.length; i++) {
        bounds.push(utils.getLayerBounds(layers[i]));
    }
    // Implementation varies by alignment type
};

// 24. Distribute layers
utils.distributeLayers = function(layers, axis) {
    if (layers.length < 3) return;
    // Implementation for distributing layers evenly
};

// 25. Get layers by type
utils.getLayersByType = function(comp, type) {
    comp = comp || utils.getActiveComp();
    var layers = [];
    for (var i = 1; i <= comp.numLayers; i++) {
        var layer = comp.layer(i);
        if (layer.matchName === type) {
            layers.push(layer);
        }
    }
    return layers;
};

// 26. Move layer to time
utils.moveLayerToTime = function(layer, time) {
    layer.startTime = time;
};

// 27. Trim layer
utils.trimLayer = function(layer, inPoint, outPoint) {
    if (inPoint !== undefined) layer.inPoint = inPoint;
    if (outPoint !== undefined) layer.outPoint = outPoint;
};

// 28. Pre-compose layers
utils.preCompLayers = function(layers, name, moveAllAttributes) {
    if (layers.length === 0) return null;
    var comp = layers[0].containingComp;
    name = name || "Pre-comp";
    moveAllAttributes = moveAllAttributes !== false;
    return comp.layers.precompose(utils.getLayerIndices(layers), name, moveAllAttributes);
};

// 29. Get layer indices
utils.getLayerIndices = function(layers) {
    var indices = [];
    for (var i = 0; i < layers.length; i++) {
        indices.push(layers[i].index);
    }
    return indices;
};

// 30. Create shape layer
utils.createShape = function(comp, name) {
    comp = comp || utils.getActiveComp();
    if (!comp) return null;
    var shapeLayer = comp.layers.addShape();
    if (name) shapeLayer.name = name;
    return shapeLayer;
};

// ========================================
// PROPERTY ANIMATION (31-45)
// ========================================

// 31. Set keyframe
utils.setKeyframe = function(property, time, value) {
    property.setValueAtTime(time, value);
};

// 32. Add keyframe at current time
utils.addKeyframe = function(property, value) {
    var comp = utils.getActiveComp();
    if (!comp) return;
    var time = comp.time;
    if (value !== undefined) {
        property.setValueAtTime(time, value);
    } else {
        property.setValueAtKey(property.addKey(time), property.value);
    }
};

// 33. Remove all keyframes
utils.removeAllKeyframes = function(property) {
    while (property.numKeys > 0) {
        property.removeKey(1);
    }
};

// 34. Linear keyframe interpolation
utils.setLinearInterpolation = function(property, keyIndex) {
    if (keyIndex) {
        property.setInterpolationTypeAtKey(keyIndex, KeyframeInterpolationType.LINEAR);
    } else {
        for (var i = 1; i <= property.numKeys; i++) {
            property.setInterpolationTypeAtKey(i, KeyframeInterpolationType.LINEAR);
        }
    }
};

// 35. Ease keyframe interpolation
utils.setEaseInterpolation = function(property, keyIndex, easeIn, easeOut) {
    easeIn = easeIn || new KeyframeEase(0, 33.33);
    easeOut = easeOut || new KeyframeEase(0, 33.33);
    
    if (keyIndex) {
        property.setTemporalEaseAtKey(keyIndex, [easeIn], [easeOut]);
    } else {
        for (var i = 1; i <= property.numKeys; i++) {
            property.setTemporalEaseAtKey(i, [easeIn], [easeOut]);
        }
    }
};

// 36. Copy keyframes between properties
utils.copyKeyframes = function(sourceProperty, targetProperty) {
    for (var i = 1; i <= sourceProperty.numKeys; i++) {
        var time = sourceProperty.keyTime(i);
        var value = sourceProperty.keyValue(i);
        targetProperty.setValueAtTime(time, value);
    }
};

// 37. Reverse keyframes
utils.reverseKeyframes = function(property) {
    var keyframes = [];
    for (var i = 1; i <= property.numKeys; i++) {
        keyframes.push({
            time: property.keyTime(i),
            value: property.keyValue(i)
        });
    }
    
    utils.removeAllKeyframes(property);
    
    for (var j = 0; j < keyframes.length; j++) {
        var newTime = keyframes[keyframes.length - 1].time - keyframes[j].time + keyframes[0].time;
        property.setValueAtTime(newTime, keyframes[keyframes.length - 1 - j].value);
    }
};

// 38. Scale keyframe timing
utils.scaleKeyframes = function(property, scaleFactor) {
    var keyframes = [];
    for (var i = 1; i <= property.numKeys; i++) {
        keyframes.push({
            time: property.keyTime(i),
            value: property.keyValue(i)
        });
    }
    
    utils.removeAllKeyframes(property);
    
    for (var j = 0; j < keyframes.length; j++) {
        property.setValueAtTime(keyframes[j].time * scaleFactor, keyframes[j].value);
    }
};

// 39. Add expression to property
utils.addExpression = function(property, expression) {
    property.expression = expression;
};

// 40. Remove expression from property
utils.removeExpression = function(property) {
    property.expression = "";
};

// 41. Animate property with ease
utils.animateWithEase = function(property, fromValue, toValue, duration, easeType) {
    var comp = utils.getActiveComp();
    if (!comp) return;
    
    var startTime = comp.time;
    var endTime = startTime + duration;
    
    property.setValueAtTime(startTime, fromValue);
    property.setValueAtTime(endTime, toValue);
    
    // Apply easing based on type
    if (easeType === "easeOut") {
        utils.setEaseInterpolation(property, 1, new KeyframeEase(0, 75), new KeyframeEase(0, 25));
    } else if (easeType === "easeIn") {
        utils.setEaseInterpolation(property, 1, new KeyframeEase(0, 25), new KeyframeEase(0, 75));
    }
};

// 42. Create wiggle expression
utils.addWiggle = function(property, frequency, amplitude) {
    frequency = frequency || 2;
    amplitude = amplitude || 50;
    property.expression = "wiggle(" + frequency + ", " + amplitude + ")";
};

// 43. Create loop expression
utils.addLoop = function(property, type, numKeyframes) {
    type = type || "cycle";
    numKeyframes = numKeyframes || "";
    property.expression = "loopOut('" + type + "'," + numKeyframes + ")";
};

// 44. Set property value at time
utils.setValueAtTime = function(property, time, value) {
    property.setValueAtTime(time, value);
};

// 45. Get property value at time
utils.getValueAtTime = function(property, time) {
    return property.valueAtTime(time, false);
};

// ========================================
// EFFECTS & EXPRESSIONS (46-55)
// ========================================

// 46. Add effect to layer
utils.addEffect = function(layer, effectName, effectDisplayName) {
    var effect = layer.Effects.addProperty(effectName);
    if (effectDisplayName) effect.name = effectDisplayName;
    return effect;
};

// 47. Remove effect from layer
utils.removeEffect = function(layer, effectName) {
    for (var i = 1; i <= layer.Effects.numProperties; i++) {
        var effect = layer.Effects.property(i);
        if (effect.matchName === effectName || effect.name === effectName) {
            effect.remove();
            return true;
        }
    }
    return false;
};

// 48. Get effect by name
utils.getEffect = function(layer, effectName) {
    for (var i = 1; i <= layer.Effects.numProperties; i++) {
        var effect = layer.Effects.property(i);
        if (effect.matchName === effectName || effect.name === effectName) {
            return effect;
        }
    }
    return null;
};

// 49. Apply drop shadow
utils.addDropShadow = function(layer, distance, angle, softness, opacity) {
    var dropShadow = utils.addEffect(layer, "ADBE Drop Shadow");
    if (distance !== undefined) dropShadow.property("Distance").setValue(distance);
    if (angle !== undefined) dropShadow.property("Direction").setValue(angle);
    if (softness !== undefined) dropShadow.property("Softness").setValue(softness);
    if (opacity !== undefined) dropShadow.property("Opacity").setValue(opacity);
    return dropShadow;
};

// 50. Apply glow effect
utils.addGlow = function(layer, glowRadius, glowIntensity, glowColor) {
    var glow = utils.addEffect(layer, "ADBE Outer Glow");
    if (glowRadius !== undefined) glow.property("Glow Radius").setValue(glowRadius);
    if (glowIntensity !== undefined) glow.property("Glow Intensity").setValue(glowIntensity);
    if (glowColor !== undefined) glow.property("Glow Colors").setValue(glowColor);
    return glow;
};

// 51. Apply blur effect
utils.addBlur = function(layer, blurAmount, blurDimensions) {
    var blur = utils.addEffect(layer, "ADBE Gaussian Blur 2");
    if (blurAmount !== undefined) blur.property("Blurriness").setValue(blurAmount);
    if (blurDimensions !== undefined) blur.property("Blur Dimensions").setValue(blurDimensions);
    return blur;
};

// 52. Create time expression
utils.createTimeExpression = function(multiplier, offset) {
    multiplier = multiplier || 1;
    offset = offset || 0;
    return "time * " + multiplier + " + " + offset;
};

// 53. Create index expression
utils.createIndexExpression = function(multiplier, offset) {
    multiplier = multiplier || 1;
    offset = offset || 0;
    return "index * " + multiplier + " + " + offset;
};

// 54. Create random expression
utils.createRandomExpression = function(min, max, seed) {
    min = min || 0;
    max = max || 100;
    seed = seed || "";
    return "random(" + seed + ") * (" + max + " - " + min + ") + " + min;
};

// 55. Apply color correction
utils.addColorCorrection = function(layer, hue, saturation, lightness) {
    var hueSat = utils.addEffect(layer, "ADBE HUE SATURATION");
    if (hue !== undefined) hueSat.property("Channel Control").property("Master Hue").setValue(hue);
    if (saturation !== undefined) hueSat.property("Channel Control").property("Master Saturation").setValue(saturation);
    if (lightness !== undefined) hueSat.property("Channel Control").property("Master Lightness").setValue(lightness);
    return hueSat;
};

// ========================================
// MASKS & SHAPES (56-65)
// ========================================

// 56. Create rectangular mask
utils.createRectMask = function(layer, rect) {
    var mask = layer.Masks.addProperty("Mask");
    var shape = mask.property("maskShape");
    var vertices = [
        [rect.left, rect.top],
        [rect.left + rect.width, rect.top],
        [rect.left + rect.width, rect.top + rect.height],
        [rect.left, rect.top + rect.height]
    ];
    var myShape = new Shape();
    myShape.vertices = vertices;
    myShape.closed = true;
    shape.setValue(myShape);
    return mask;
};

// 57. Create elliptical mask
utils.createEllipseMask = function(layer, center, size) {
    var mask = layer.Masks.addProperty("Mask");
    var shape = mask.property("maskShape");
    var vertices = [];
    var inTangents = [];
    var outTangents = [];
    
    // Create circle with bezier curves
    var rx = size[0] / 2;
    var ry = size[1] / 2;
    var cx = center[0];
    var cy = center[1];
    
    vertices = [
        [cx, cy - ry],
        [cx + rx, cy],
        [cx, cy + ry],
        [cx - rx, cy]
    ];
    
    var cp = 0.552 * rx; // Control point distance for circle
    inTangents = [[-cp, 0], [0, -cp], [cp, 0], [0, cp]];
    outTangents = [[cp, 0], [0, cp], [-cp, 0], [0, -cp]];
    
    var myShape = new Shape();
    myShape.vertices = vertices;
    myShape.inTangents = inTangents;
    myShape.outTangents = outTangents;
    myShape.closed = true;
    shape.setValue(myShape);
    return mask;
};

// 58. Animate mask path
utils.animateMaskPath = function(mask, startShape, endShape, duration) {
    var comp = utils.getActiveComp();
    if (!comp) return;
    
    var startTime = comp.time;
    var endTime = startTime + duration;
    var shapeProperty = mask.property("maskShape");
    
    shapeProperty.setValueAtTime(startTime, startShape);
    shapeProperty.setValueAtTime(endTime, endShape);
};

// 59. Set mask mode
utils.setMaskMode = function(mask, mode) {
    // mode: Add, Subtract, Intersect, Lighten, Darken, Difference
    mask.property("maskMode").setValue(mode);
};

// 60. Set mask feather
utils.setMaskFeather = function(mask, featherAmount) {
    mask.property("maskFeather").setValue([featherAmount, featherAmount]);
};

// 61. Add rectangle to shape layer
utils.addRectToShape = function(shapeLayer, size, position) {
    var shapeGroup = shapeLayer.content.addProperty("ADBE Vector Group");
    var rect = shapeGroup.content.addProperty("ADBE Vector Shape - Rect");
    
    if (size) rect.property("Size").setValue(size);
    if (position) rect.property("Position").setValue(position);
    
    return shapeGroup;
};

// 62. Add ellipse to shape layer
utils.addEllipseToShape = function(shapeLayer, size, position) {
    var shapeGroup = shapeLayer.content.addProperty("ADBE Vector Group");
    var ellipse = shapeGroup.content.addProperty("ADBE Vector Shape - Ellipse");
    
    if (size) ellipse.property("Size").setValue(size);
    if (position) ellipse.property("Position").setValue(position);
    
    return shapeGroup;
};

// 63. Add fill to shape
utils.addFillToShape = function(shapeGroup, color, opacity) {
    var fill = shapeGroup.content.addProperty("ADBE Vector Graphic - Fill");
    if (color) fill.property("Color").setValue(color);
    if (opacity !== undefined) fill.property("Opacity").setValue(opacity);
    return fill;
};

// 64. Add stroke to shape
utils.addStrokeToShape = function(shapeGroup, color, width, opacity) {
    var stroke = shapeGroup.content.addProperty("ADBE Vector Graphic - Stroke");
    if (color) stroke.property("Color").setValue(color);
    if (width !== undefined) stroke.property("Stroke Width").setValue(width);
    if (opacity !== undefined) stroke.property("Opacity").setValue(opacity);
    return stroke;
};

// 65. Create path from points
utils.createPathFromPoints = function(points, closed) {
    closed = closed !== false;
    var shape = new Shape();
    shape.vertices = points;
    shape.closed = closed;
    return shape;
};

// ========================================
// TEXT UTILITIES (66-75)
// ========================================

// 66. Set text content
utils.setTextContent = function(textLayer, text) {
    var textDocument = textLayer.property("Source Text").value;
    textDocument.text = text;
    textLayer.property("Source Text").setValue(textDocument);
};

// 67. Set text font
utils.setTextFont = function(textLayer, fontName, fontSize) {
    var textDocument = textLayer.property("Source Text").value;
    if (fontName) textDocument.font = fontName;
    if (fontSize) textDocument.fontSize = fontSize;
    textLayer.property("Source Text").setValue(textDocument);
};

// 68. Set text color
utils.setTextColor = function(textLayer, color) {
    var textDocument = textLayer.property("Source Text").value;
    textDocument.fillColor = color;
    textLayer.property("Source Text").setValue(textDocument);
};

// 69. Set text alignment
utils.setTextAlignment = function(textLayer, alignment) {
    var textDocument = textLayer.property("Source Text").value;
    textDocument.justification = alignment;
    textLayer.property("Source Text").setValue(textDocument);
};

// 70. Animate text by character
utils.animateTextByCharacter = function(textLayer, property, delay) {
    delay = delay || 0.1;
    var animator = textLayer.property("Text").property("Animators").addProperty("ADBE Text Animator");
    var selector = animator.property("Selectors").property("ADBE Text Selector");
    
    selector.property("Start").setValue(0);
    selector.property("End").setValue(0);
    selector.property("Offset").setValue(0);
    
    // Add animation property and set keyframes
    var animProperty = animator.property("Properties").addProperty(property);
    return animator;
};

// 71. Add text animator
utils.addTextAnimator = function(textLayer, animatorType) {
    var animator = textLayer.property("Text").property("Animators").addProperty("ADBE Text Animator");
    if (animatorType) {
        animator.property("Properties").addProperty(animatorType);
    }
    return animator;
};

// 72. Set text stroke
utils.setTextStroke = function(textLayer, strokeColor, strokeWidth) {
    var textDocument = textLayer.property("Source Text").value;
    textDocument.strokeOverFill = true;
    textDocument.strokeColor = strokeColor;
    textDocument.strokeWidth = strokeWidth;
    textLayer.property("Source Text").setValue(textDocument);
};

// 73. Create typewriter effect
utils.createTypewriter = function(textLayer, duration) {
    var animator = utils.addTextAnimator(textLayer);
    var selector = animator.property("Selectors").property("ADBE Text Selector");
    var opacity = animator.property("Properties").addProperty("ADBE Text Opacity");
    
    opacity.setValue(0);
    
    var comp = textLayer.containingComp;
    var startTime = comp.time;
    
    selector.property("End").setValueAtTime(startTime, 0);
    selector.property("End").setValueAtTime(startTime + duration, 100);
    
    return animator;
};

// 74. Get text layer bounds
utils.getTextBounds = function(textLayer, time) {
    time = time || 0;
    return textLayer.sourceRectAtTime(time, false);
};

// 75. Convert text to shapes
utils.convertTextToShapes = function(textLayer) {
    textLayer.selected = true;
    app.executeCommand(3781); // Convert to shapes command ID
    var comp = textLayer.containingComp;
    return comp.selectedLayers[0];
};

// ========================================
// IMPORT/EXPORT & FILES (76-85)
// ========================================

// 76. Import file
utils.importFile = function(filePath) {
    var file = new File(filePath);
    if (file.exists) {
        return app.project.importFile(new ImportOptions(file));
    }
    return null;
};

// 77. Import sequence
utils.importSequence = function(filePath) {
    var file = new File(filePath);
    var importOptions = new ImportOptions(file);
    importOptions.sequence = true;
    return app.project.importFile(importOptions);
};

// 78. Add footage to comp
utils.addFootageToComp = function(footage, comp, time) {
    comp = comp || utils.getActiveComp();
    time = time || 0;
    if (!comp) return null;
    var layer = comp.layers.add(footage, time);
    return layer;
};

// 79. Render composition
utils.renderComp = function(comp, outputPath, templateName) {
    var renderQueue = app.project.renderQueue;
    var renderItem = renderQueue.items.add(comp);
    
    if (templateName) {
        renderItem.applyTemplate(templateName);
    }
    
    if (outputPath) {
        var outputModule = renderItem.outputModule(1);
        outputModule.file = new File(outputPath);
    }
    
    return renderItem;
};

// 80. Export frame as image
utils.exportFrame = function(comp, time, outputPath) {
    comp.time = time;
    comp.saveFrameToPng(comp.time, new File(outputPath));
};

// 81. Collect files
utils.collectFiles = function(destFolder) {
    var folder = new Folder(destFolder);
    app.project.collectFiles(folder);
};

// 82. Replace footage
utils.replaceFootage = function(footageItem, newFilePath) {
    var newFile = new File(newFilePath);
    if (newFile.exists) {
        footageItem.replaceWithPath(newFilePath);
    }
};

// 83. Get footage info
utils.getFootageInfo = function(footageItem) {
    return {
        name: footageItem.name,
        width: footageItem.width,
        height: footageItem.height,
        duration: footageItem.duration,
        frameRate: footageItem.frameRate,
        hasVideo: footageItem.hasVideo,
        hasAudio: footageItem.hasAudio
    };
};

// 84. Create proxy
utils.createProxy = function(footageItem, proxyPath) {
    var proxyFile = new File(proxyPath);
    if (proxyFile.exists) {
        footageItem.setProxy(proxyFile);
    }
};

// 85. Remove proxy
utils.removeProxy = function(footageItem) {
    footageItem.setProxyToNone();
};
```