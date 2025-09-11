// Photoshop JavaScript to execute external commands and display output
// Save this as a .jsx file and run in Photoshop

#target photoshop

// Main function to create UI and handle external executable
function createExternalExecutableUI() {
// Create the main dialog window
var dialog = new Window(“dialog”, “External Executable Interface”);
dialog.orientation = “column”;
dialog.alignChildren = “fill”;
dialog.spacing = 10;
dialog.margins = 16;


// Input section
var inputGroup = dialog.add("group");
inputGroup.orientation = "column";
inputGroup.alignChildren = "fill";

// Executable path input
var execGroup = inputGroup.add("group");
execGroup.add("statictext", undefined, "Executable Path:");
var executablePath = execGroup.add("edittext", undefined, "cmd.exe");
executablePath.preferredSize.width = 300;

var browseBtn = execGroup.add("button", undefined, "Browse");
browseBtn.onClick = function() {
    var file = File.openDialog("Select Executable");
    if (file) {
        executablePath.text = file.fsName;
    }
};

// Arguments input
var argsGroup = inputGroup.add("group");
argsGroup.add("statictext", undefined, "Arguments:");
var argumentsField = argsGroup.add("edittext", undefined, "/c echo Hello World");
argumentsField.preferredSize.width = 400;

// Execute button
var executeBtn = inputGroup.add("button", undefined, "Execute Command");
executeBtn.preferredSize.height = 30;

// Output section
var outputGroup = dialog.add("group");
outputGroup.orientation = "column";
outputGroup.alignChildren = "fill";

outputGroup.add("statictext", undefined, "Output:");
var outputText = outputGroup.add("edittext", undefined, "", {multiline: true, scrolling: true});
outputText.preferredSize.width = 500;
outputText.preferredSize.height = 200;
outputText.enabled = false; // Read-only

// Status section
var statusGroup = dialog.add("group");
var statusText = statusGroup.add("statictext", undefined, "Ready");
statusText.preferredSize.width = 400;

// Button section
var buttonGroup = dialog.add("group");
buttonGroup.alignment = "center";

var clearBtn = buttonGroup.add("button", undefined, "Clear Output");
var closeBtn = buttonGroup.add("button", undefined, "Close");

// Event handlers
executeBtn.onClick = function() {
    executeExternalCommand(executablePath.text, argumentsField.text, outputText, statusText);
};

clearBtn.onClick = function() {
    outputText.text = "";
    statusText.text = "Output cleared";
};

closeBtn.onClick = function() {
    dialog.close();
};

// Show the dialog
dialog.show();


}

// Function to execute external command and capture output
function executeExternalCommand(executablePath, arguments, outputTextControl, statusControl) {
try {
statusControl.text = “Executing command…”;
outputTextControl.text = “”; // Clear previous output


    // Validate inputs
    if (!executablePath || executablePath.trim() === "") {
        throw new Error("Executable path cannot be empty");
    }
    
    // Create the command string
    var commandString = '"' + executablePath + '"';
    if (arguments && arguments.trim() !== "") {
        commandString += " " + arguments;
    }
    
    // Execute the command using system.callSystem()
    // Note: This method captures the exit code but not the output directly
    var exitCode = system.callSystem(commandString);
    
    // For better output capture, we'll redirect output to a temporary file
    var tempFile = new File(Folder.temp + "/ps_external_output.txt");
    var commandWithRedirect = commandString + ' > "' + tempFile.fsName + '" 2>&1';
    
    // Execute command with output redirection
    var result = system.callSystem(commandWithRedirect);
    
    // Read the output from temporary file
    var output = "";
    if (tempFile.exists) {
        tempFile.open("r");
        output = tempFile.read();
        tempFile.close();
        tempFile.remove(); // Clean up temp file
    }
    
    // Display results
    if (output && output.trim() !== "") {
        outputTextControl.text = output;
    } else {
        outputTextControl.text = "Command executed successfully (no output or output not captured)";
    }
    
    statusControl.text = "Command completed. Exit code: " + result;
    
} catch (error) {
    outputTextControl.text = "Error: " + error.toString();
    statusControl.text = "Execution failed";
}


}

// Alternative function using File.execute() for direct executable calls
function executeWithFileExecute(executablePath, arguments, outputTextControl, statusControl) {
try {
statusControl.text = “Executing with File.execute()…”;


    var execFile = new File(executablePath);
    if (!execFile.exists) {
        throw new Error("Executable not found: " + executablePath);
    }
    
    // Parse arguments into array
    var argsArray = [];
    if (arguments && arguments.trim() !== "") {
        // Simple argument parsing (doesn't handle quoted arguments with spaces)
        argsArray = arguments.split(/\s+/);
    }
    
    // Execute using File.execute()
    var result = execFile.execute();
    
    if (result) {
        outputTextControl.text = "Command executed successfully using File.execute()";
        statusControl.text = "Execution completed successfully";
    } else {
        outputTextControl.text = "Command failed or returned false";
        statusControl.text = "Execution failed";
    }
    
} catch (error) {
    outputTextControl.text = "Error with File.execute(): " + error.toString();
    statusControl.text = "Execution failed";
}


}

// Utility function to escape command line arguments
function escapeArgument(arg) {
// Basic escaping for Windows command line
if (arg.indexOf(’ ‘) !== -1 || arg.indexOf(’”’) !== -1) {
return ‘”’ + arg.replace(/”/g, ‘””’) + ‘”’;
}
return arg;
}

// Function to create a preset command interface
function createPresetCommandsUI() {
var dialog = new Window(“dialog”, “Preset Commands”);
dialog.orientation = “column”;
dialog.alignChildren = “fill”;
dialog.spacing = 10;
dialog.margins = 16;


// Preset commands
var presets = [
    {name: "System Info", cmd: "cmd.exe", args: "/c systeminfo | findstr /C:\"OS Name\" /C:\"Total Physical Memory\""},
    {name: "Directory List", cmd: "cmd.exe", args: "/c dir"},
    {name: "Current Date", cmd: "cmd.exe", args: "/c date /t & time /t"},
    {name: "Network Config", cmd: "cmd.exe", args: "/c ipconfig"},
];

var presetGroup = dialog.add("group");
presetGroup.orientation = "column";
presetGroup.alignChildren = "fill";

presetGroup.add("statictext", undefined, "Select a preset command:");

for (var i = 0; i < presets.length; i++) {
    (function(preset) {
        var btn = presetGroup.add("button", undefined, preset.name);
        btn.onClick = function() {
            dialog.close();
            executeAndShowResult(preset.cmd, preset.args);
        };
    })(presets[i]);
}

var customBtn = presetGroup.add("button", undefined, "Custom Command...");
customBtn.onClick = function() {
    dialog.close();
    createExternalExecutableUI();
};

var closeBtn = presetGroup.add("button", undefined, "Close");
closeBtn.onClick = function() {
    dialog.close();
};

dialog.show();


}

// Quick execute and show result function
function executeAndShowResult(executable, arguments) {
var resultDialog = new Window(“dialog”, “Command Result”);
resultDialog.orientation = “column”;
resultDialog.alignChildren = “fill”;
resultDialog.spacing = 10;
resultDialog.margins = 16;

```
var outputText = resultDialog.add("edittext", undefined, "Executing...", {multiline: true, scrolling: true});
outputText.preferredSize.width = 500;
outputText.preferredSize.height = 300;
outputText.enabled = false;

var closeBtn = resultDialog.add("button", undefined, "Close");
closeBtn.onClick = function() {
    resultDialog.close();
};

resultDialog.show();

// Execute command
try {
    var tempFile = new File(Folder.temp + "/ps_quick_output.txt");
    var commandString = '"' + executable + '" ' + arguments + ' > "' + tempFile.fsName + '" 2>&1';
    
    system.callSystem(commandString);
    
    var output = "";
    if (tempFile.exists) {
        tempFile.open("r");
        output = tempFile.read();
        tempFile.close();
        tempFile.remove();
    }
    
    outputText.text = output || "Command completed (no output captured)";
    
} catch (error) {
    outputText.text = "Error: " + error.toString();
}


}

// Main entry point - uncomment the function you want to run
// createExternalExecutableUI();  // Full interface
createPresetCommandsUI();       // Preset commands interface