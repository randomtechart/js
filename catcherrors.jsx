```javascript
// After Effects Script Template with Error Handling and Cleanup
// Minimal boilerplate for modular script architecture

(function() {
    "use strict";
    
    // ============================================
    // MAIN EXECUTION FUNCTION
    // ============================================
    function main() {
        try {
            // Execute sub functions sequentially
            subFunction1();
            subFunction2();
            subFunction3();
            
            alert("Script completed successfully!");
            
        } catch (error) {
            handleError(error);
        } finally {
            // Cleanup always runs, regardless of success or failure
            cleanup();
        }
    }
    
    // ============================================
    // SUB FUNCTIONS (Level 1)
    // ============================================
    function subFunction1() {
        try {
            // Your code here
            // Example: var comp = app.project.activeItem;
            
            // Call nested sub function if needed
            helperFunction1();
            
        } catch (error) {
            throw new Error("Error in subFunction1: " + error.message);
        }
    }
    
    function subFunction2() {
        try {
            // Your code here
            
            // Call nested sub function if needed
            helperFunction2();
            
        } catch (error) {
            throw new Error("Error in subFunction2: " + error.message);
        }
    }
    
    function subFunction3() {
        try {
            // Your code here
            
            // Call nested sub function if needed
            helperFunction3();
            
        } catch (error) {
            throw new Error("Error in subFunction3: " + error.message);
        }
    }
    
    // ============================================
    // NESTED SUB FUNCTIONS (Level 2)
    // ============================================
    function helperFunction1() {
        try {
            // Your helper code here
            
        } catch (error) {
            throw new Error("Error in helperFunction1: " + error.message);
        }
    }
    
    function helperFunction2() {
        try {
            // Your helper code here
            
        } catch (error) {
            throw new Error("Error in helperFunction2: " + error.message);
        }
    }
    
    function helperFunction3() {
        try {
            // Your helper code here
            
        } catch (error) {
            throw new Error("Error in helperFunction3: " + error.message);
        }
    }
    
    // ============================================
    // CLEANUP FUNCTION
    // ============================================
    function cleanup() {
        try {
            // Cleanup code runs whether script succeeds or fails
            // Examples:
            // - Close temporary files
            // - Remove temporary compositions
            // - Reset project state
            // - Delete temporary layers
            // - Clear memory variables
            
            $.writeln("Cleanup completed");
            
        } catch (cleanupError) {
            // Even if cleanup fails, don't crash - just log it
            $.writeln("Warning: Cleanup error - " + cleanupError.message);
        }
    }
    
    // ============================================
    // ERROR HANDLER
    // ============================================
    function handleError(error) {
        var errorMessage = "Script Error:\n\n" + error.message + "\n\nLine: " + error.line;
        alert(errorMessage);
        
        // Optional: Log to console for debugging
        $.writeln(errorMessage);
    }
    
    // ============================================
    // EXECUTE SCRIPT
    // ============================================
    app.beginUndoGroup("Script Name");
    main();
    app.endUndoGroup();
    
})();
```

**Key Changes:**

1. **`finally` block** - Added to the main try-catch, ensures cleanup runs regardless of success or failure
1. **`cleanup()` function** - Dedicated function for cleanup operations with its own error handling
1. **Safe cleanup** - Even if cleanup fails, it won’t crash the script, just logs a warning

The `finally` block guarantees the cleanup function executes whether:

- The script completes successfully
- An error occurs in any sub function
- The script exits early

This is perfect for cleaning up temporary files, layers, comps, or resetting any project state your script modifies.​​​​​​​​​​​​​​​​