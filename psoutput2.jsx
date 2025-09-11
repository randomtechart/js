// Photoshop JavaScript to create batch file and check application output
// This script creates a batch file, runs it, and checks for “Pass” in the output

function createAndRunBatchFile() {
try {
// Get the desktop path for saving the batch file
var desktopFolder = Folder.desktop;
var batchFile = new File(desktopFolder + “/run_app.bat”);
var outputFile = new File(desktopFolder + “/app_output.txt”);

```
    // Create the batch file content
    var batchContent = '@echo off\n';
    batchContent += 'echo Running application...\n';
    batchContent += '"c:/my.exe" -pd > "' + outputFile.fsName + '" 2>&1\n';
    batchContent += 'echo Application completed.\n';
    batchContent += 'pause\n';
    
    // Write the batch file
    batchFile.open('w');
    batchFile.write(batchContent);
    batchFile.close();
    
    // Show user the batch file was created
    alert("Batch file created at: " + batchFile.fsName + "\nClick OK to run the application.");
    
    // Execute the batch file
    batchFile.execute();
    
    // Wait a moment and then check for the output file
    // Note: In a real scenario, you might need a longer delay or a loop to check if the file exists
    $.sleep(2000); // Wait 2 seconds
    
    // Check if output file exists and read it
    if (outputFile.exists) {
        outputFile.open('r');
        var output = outputFile.read();
        outputFile.close();
        
        // Check if "Pass" string exists in the output
        if (output.indexOf("Pass") !== -1) {
            alert("SUCCESS: The output contains 'Pass'!\n\nOutput preview:\n" + output.substring(0, 200) + "...");
        } else {
            alert("NOTICE: The output does NOT contain 'Pass'.\n\nOutput preview:\n" + output.substring(0, 200) + "...");
        }
        
        // Clean up - ask user if they want to delete temporary files
        var cleanup = confirm("Do you want to delete the temporary batch and output files?");
        if (cleanup) {
            batchFile.remove();
            outputFile.remove();
            alert("Temporary files deleted.");
        }
    } else {
        alert("Warning: Could not find output file. The application may not have completed yet or may have failed to run.");
    }
    
} catch (error) {
    alert("Error occurred: " + error.toString());
}
```

}

// Alternative version with better waiting mechanism
function createAndRunBatchFileWithWait() {
try {
var desktopFolder = Folder.desktop;
var batchFile = new File(desktopFolder + “/run_app_wait.bat”);
var outputFile = new File(desktopFolder + “/app_output.txt”);
var doneFile = new File(desktopFolder + “/app_done.txt”);

```
    // Create batch file that signals completion
    var batchContent = '@echo off\n';
    batchContent += 'echo Running application...\n';
    batchContent += '"c:/my.exe" -pd > "' + outputFile.fsName + '" 2>&1\n';
    batchContent += 'echo COMPLETED > "' + doneFile.fsName + '"\n';
    batchContent += 'echo Application completed.\n';
    
    // Write the batch file
    batchFile.open('w');
    batchFile.write(batchContent);
    batchFile.close();
    
    alert("Batch file created. The script will now run the application and wait for completion.");
    
    // Execute the batch file
    batchFile.execute();
    
    // Wait for completion by checking for the done file
    var maxWaitTime = 300; // Maximum wait time in seconds (5 minutes)
    var waitTime = 0;
    
    while (!doneFile.exists && waitTime < maxWaitTime) {
        $.sleep(1000); // Wait 1 second
        waitTime++;
        
        // Update user every 10 seconds
        if (waitTime % 10 === 0) {
            var continueWaiting = confirm("Still waiting for application to complete (" + waitTime + "s elapsed).\nClick OK to continue waiting, Cancel to stop.");
            if (!continueWaiting) break;
        }
    }
    
    if (doneFile.exists && outputFile.exists) {
        // Read the output
        outputFile.open('r');
        var output = outputFile.read();
        outputFile.close();
        
        // Check for "Pass" string
        var hasPass = output.indexOf("Pass") !== -1;
        
        if (hasPass) {
            alert("✓ SUCCESS: Found 'Pass' in the output!\n\nExecution time: " + waitTime + " seconds\nOutput length: " + output.length + " characters");
        } else {
            alert("✗ RESULT: 'Pass' was NOT found in the output.\n\nExecution time: " + waitTime + " seconds\nOutput length: " + output.length + " characters");
        }
        
        // Show output preview
        var showOutput = confirm("Do you want to see the full output?");
        if (showOutput) {
            alert("Application Output:\n\n" + output);
        }
        
    } else if (waitTime >= maxWaitTime) {
        alert("Timeout: Application did not complete within " + maxWaitTime + " seconds.");
    } else {
        alert("Operation cancelled by user.");
    }
    
    // Cleanup
    var cleanup = confirm("Clean up temporary files?");
    if (cleanup) {
        try {
            if (batchFile.exists) batchFile.remove();
            if (outputFile.exists) outputFile.remove();
            if (doneFile.exists) doneFile.remove();
            alert("Cleanup completed.");
        } catch (cleanupError) {
            alert("Cleanup error: " + cleanupError.toString());
        }
    }
    
} catch (error) {
    alert("Error: " + error.toString());
}
```

}

// Run the script
// Use the first function for a simple approach, or the second for better waiting
createAndRunBatchFileWithWait();