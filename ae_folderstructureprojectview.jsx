// After Effects Script: Folder Structure Recreation
// This script recreates folder structures from file paths and organizes footage

(function() {
// Check if After Effects is available
if (typeof app === “undefined” || !app.project) {
alert(“This script must be run in After Effects with an active project.”);
return;
}

```
app.beginUndoGroup("Recreate Folder Structure");

try {
    // Get selected footage items
    var selectedItems = getSelectedFootageItems();
    if (selectedItems.length === 0) {
        alert("Please select one or more footage items in the project panel.");
        return;
    }
    
    // Get base directory from user
    var baseDirectory = promptForBaseDirectory();
    if (!baseDirectory) {
        alert("No base directory specified. Script cancelled.");
        return;
    }
    
    // Normalize base directory path
    baseDirectory = normalizePathSeparators(baseDirectory);
    if (!baseDirectory.endsWith("/")) {
        baseDirectory += "/";
    }
    
    // Process each selected footage item
    var processedCount = 0;
    var createdFolders = {};
    
    for (var i = 0; i < selectedItems.length; i++) {
        var item = selectedItems[i];
        
        if (item.mainSource instanceof FileSource) {
            var filePath = normalizePathSeparators(item.mainSource.file.fsName);
            var relativePath = getRelativePath(filePath, baseDirectory);
            
            if (relativePath) {
                var targetFolder = createFolderStructure(relativePath, createdFolders);
                if (targetFolder && item.parentFolder !== targetFolder) {
                    item.parentFolder = targetFolder;
                    processedCount++;
                }
            }
        }
    }
    
    alert("Script completed successfully!\n" + 
          "Processed " + processedCount + " items.\n" + 
          "Created " + Object.keys(createdFolders).length + " folders.");
    
} catch (error) {
    alert("Error: " + error.toString());
} finally {
    app.endUndoGroup();
}

// Function to get selected footage items
function getSelectedFootageItems() {
    var selectedItems = [];
    
    for (var i = 1; i <= app.project.numItems; i++) {
        var item = app.project.item(i);
        if (item.selected && item instanceof FootageItem) {
            selectedItems.push(item);
        }
    }
    
    return selectedItems;
}

// Function to prompt for base directory
function promptForBaseDirectory() {
    var dialog = new Window("dialog", "Base Directory");
    dialog.orientation = "column";
    dialog.alignChildren = "fill";
    dialog.spacing = 10;
    
    // Instructions
    var instructionsGroup = dialog.add("group");
    instructionsGroup.orientation = "column";
    instructionsGroup.alignChildren = "left";
    
    instructionsGroup.add("statictext", undefined, "Enter the base directory path to use as the root for folder recreation.");
    instructionsGroup.add("statictext", undefined, "Example: C:/Projects/MyProject/ or /Users/username/Projects/MyProject/");
    instructionsGroup.add("statictext", undefined, "Folders after this path will be recreated in the project panel.");
    
    // Input section
    var inputGroup = dialog.add("group");
    inputGroup.alignChildren = "fill";
    
    inputGroup.add("statictext", undefined, "Base Directory:");
    var pathInput = inputGroup.add("edittext", undefined, "");
    pathInput.preferredSize.width = 400;
    
    // Browse button
    var browseBtn = inputGroup.add("button", undefined, "Browse...");
    browseBtn.onClick = function() {
        var folder = Folder.selectDialog("Select Base Directory");
        if (folder) {
            pathInput.text = folder.fsName;
        }
    };
    
    // Example with selected files
    if (getSelectedFootageItems().length > 0) {
        var exampleGroup = dialog.add("group");
        exampleGroup.orientation = "column";
        exampleGroup.alignChildren = "left";
        
        exampleGroup.add("statictext", undefined, "Example from your selected files:");
        
        var firstItem = getSelectedFootageItems()[0];
        if (firstItem.mainSource instanceof FileSource) {
            var examplePath = normalizePathSeparators(firstItem.mainSource.file.fsName);
            var exampleText = exampleGroup.add("statictext", undefined, examplePath);
            exampleText.characters = 60;
        }
    }
    
    // Buttons
    var buttonGroup = dialog.add("group");
    var okBtn = buttonGroup.add("button", undefined, "OK");
    var cancelBtn = buttonGroup.add("button", undefined, "Cancel");
    
    okBtn.onClick = function() {
        if (pathInput.text.trim() === "") {
            alert("Please enter a base directory path.");
            return;
        }
        dialog.close(1);
    };
    
    cancelBtn.onClick = function() {
        dialog.close(0);
    };
    
    if (dialog.show() === 1) {
        return pathInput.text.trim();
    }
    
    return null;
}

// Function to normalize path separators (convert to forward slashes)
function normalizePathSeparators(path) {
    if (!path) return "";
    return path.replace(/\\/g, "/");
}

// Function to get relative path from file path and base directory
function getRelativePath(filePath, baseDirectory) {
    if (!filePath || !baseDirectory) return null;
    
    // Convert paths to lowercase for comparison (Windows compatibility)
    var lowerFilePath = filePath.toLowerCase();
    var lowerBaseDir = baseDirectory.toLowerCase();
    
    // Check if file path starts with base directory
    if (lowerFilePath.indexOf(lowerBaseDir) !== 0) {
        return null;
    }
    
    // Get the relative path
    var relativePath = filePath.substring(baseDirectory.length);
    
    // Remove the filename, keep only the directory structure
    var lastSlashIndex = relativePath.lastIndexOf("/");
    if (lastSlashIndex > 0) {
        return relativePath.substring(0, lastSlashIndex);
    }
    
    return null;
}

// Function to create folder structure and return target folder
function createFolderStructure(relativePath, createdFolders) {
    if (!relativePath) return app.project.rootFolder;
    
    // Check if we've already created this folder structure
    if (createdFolders[relativePath]) {
        return createdFolders[relativePath];
    }
    
    var pathParts = relativePath.split("/");
    var currentFolder = app.project.rootFolder;
    var currentPath = "";
    
    for (var i = 0; i < pathParts.length; i++) {
        var folderName = pathParts[i];
        if (folderName === "") continue;
        
        currentPath += (currentPath === "" ? "" : "/") + folderName;
        
        // Check if folder already exists in cache
        if (createdFolders[currentPath]) {
            currentFolder = createdFolders[currentPath];
            continue;
        }
        
        // Look for existing folder
        var existingFolder = findFolderByName(currentFolder, folderName);
        
        if (existingFolder) {
            currentFolder = existingFolder;
        } else {
            // Create new folder
            currentFolder = currentFolder.items.addFolder(folderName);
        }
        
        // Cache the folder
        createdFolders[currentPath] = currentFolder;
    }
    
    return currentFolder;
}

// Function to find folder by name within a parent folder
function findFolderByName(parentFolder, folderName) {
    for (var i = 1; i <= parentFolder.numItems; i++) {
        var item = parentFolder.item(i);
        if (item instanceof FolderItem && item.name === folderName) {
            return item;
        }
    }
    return null;
}
```

})();