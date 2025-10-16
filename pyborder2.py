# “””
XML Frame Generator Script

This script reads an XML file containing frame definitions with border pixel colors,
and generates PNG images for each frame with the specified border colors.

The colors are stored as byte-shifted RGB values (e.g., 0xFF0000 for red).
“””

# Import required libraries

import xml.etree.ElementTree as ET  # For parsing XML files
from PIL import Image  # For creating and saving images
import numpy as np  # For fast array operations
from concurrent.futures import ProcessPoolExecutor, as_completed  # For parallel processing
import time  # For timing and progress tracking
import os  # For system information (CPU count)

def parse_color_values(color_string):
“””
Parse comma-separated color values from a string into a numpy array.

```
Args:
    color_string: String containing comma-separated integer values (e.g., "255,65280,16711680")

Returns:
    NumPy array of unsigned 32-bit integers representing packed RGB colors

Example:
    "255,65280" -> np.array([255, 65280], dtype=np.uint32)
"""
# Split the string by commas, strip whitespace, convert to integers, and create numpy array
return np.array([int(val.strip()) for val in color_string.split(',') if val.strip()], dtype=np.uint32)
```

def unpack_rgb_vectorized(packed_colors):
“””
Unpack byte-shifted RGB values into separate R, G, B channels using vectorized operations.

```
Byte-shifted RGB format stores colors as a single integer:
- Red channel: bits 16-23 (0xFF0000)
- Green channel: bits 8-15 (0x00FF00)
- Blue channel: bits 0-7 (0x0000FF)

Args:
    packed_colors: NumPy array of packed RGB values (e.g., [16711680, 65280, 255])

Returns:
    NumPy array of shape (n, 3) with separate R, G, B values (0-255)

Example:
    [16711680] (red) -> [[255, 0, 0]]
    [65280] (green) -> [[0, 255, 0]]
"""
# Extract red channel by shifting right 16 bits and masking with 0xFF
r = (packed_colors >> 16) & 0xFF

# Extract green channel by shifting right 8 bits and masking with 0xFF
g = (packed_colors >> 8) & 0xFF

# Extract blue channel by masking with 0xFF (no shift needed)
b = packed_colors & 0xFF

# Stack the three channels together along the last axis to create RGB tuples
# Result shape: (n, 3) where n is the number of colors
return np.stack([r, g, b], axis=-1).astype(np.uint8)
```

def create_frame_from_borders(frame_data):
“””
Create a PNG image frame with colored border pixels based on provided data.

```
Args:
    frame_data: Tuple containing (frame_number, left_colors, right_colors, top_colors, bottom_colors)
               - frame_number: Integer identifier for the frame
               - left/right/top/bottom_colors: NumPy arrays of packed RGB values

Returns:
    Tuple of (frame_number, success_boolean, message_or_filename)
    - On success: (frame_num, True, "frame_0001.png")
    - On failure: (frame_num, False, "error message")
"""
# Unpack the frame data tuple into individual variables
frame_num, left, right, top, bottom = frame_data

# Calculate image dimensions based on border lengths
# Width is determined by the number of pixels in the top border
width = len(top)
# Height is determined by the number of pixels in the left border
height = len(left)

# Validate that all borders have consistent dimensions
# Right border must have same length as left (both are height)
# Bottom border must have same length as top (both are width)
if len(right) != height or len(bottom) != width:
    # Return error if dimensions don't match
    return (frame_num, False, f"Border dimensions don't match!")

# Create a new image array filled with white (255, 255, 255) as background
# Shape: (height, width, 3) where 3 represents RGB channels
img_array = np.full((height, width, 3), 255, dtype=np.uint8)

# Unpack all border colors from packed format to RGB using vectorized operations
top_colors = unpack_rgb_vectorized(top)        # Convert top border colors
bottom_colors = unpack_rgb_vectorized(bottom)  # Convert bottom border colors
left_colors = unpack_rgb_vectorized(left)      # Convert left border colors
right_colors = unpack_rgb_vectorized(right)    # Convert right border colors

# Set border pixels using numpy array slicing (much faster than loops)
img_array[0, :] = top_colors        # Set entire top row (first row, all columns)
img_array[-1, :] = bottom_colors    # Set entire bottom row (last row, all columns)
img_array[:, 0] = left_colors       # Set entire left column (all rows, first column)
img_array[:, -1] = right_colors     # Set entire right column (all rows, last column)

# Convert the numpy array to a PIL Image object
# 'RGB' mode indicates a color image with red, green, and blue channels
img = Image.fromarray(img_array, 'RGB')

# Generate filename with zero-padded frame number (e.g., frame_0001.png)
filename = f"frame_{frame_num:04d}.png"

# Save the image to disk as PNG
img.save(filename)

# Return success status with the filename
return (frame_num, True, filename)
```

def parse_frame_data(frame):
“””
Extract and parse data from a single XML frame element.

```
Args:
    frame: XML element containing frame data with 'number' attribute and
           child elements: <left>, <right>, <top>, <bottom>

Returns:
    Tuple of (frame_number, left_array, right_array, top_array, bottom_array)
    Returns None if the frame is missing required elements
"""
# Get the frame number from the 'number' attribute, default to 0 if not found
frame_num = int(frame.get('number', 0))

# Find all required border elements in the XML
left_elem = frame.find('left')      # Find <left> tag
right_elem = frame.find('right')    # Find <right> tag
top_elem = frame.find('top')        # Find <top> tag
bottom_elem = frame.find('bottom')  # Find <bottom> tag

# Check if all required elements are present
# all() returns True only if all elements are not None
if not all([left_elem, right_elem, top_elem, bottom_elem]):
    # Return None if any element is missing
    return None

# Parse the color values from each element's text content
# The 'or' clause handles cases where element.text might be None
left = parse_color_values(left_elem.text or '')
right = parse_color_values(right_elem.text or '')
top = parse_color_values(top_elem.text or '')
bottom = parse_color_values(bottom_elem.text or '')

# Return all parsed data as a tuple
return (frame_num, left, right, top, bottom)
```

def print_progress_bar(current, total, start_time, bar_length=40):
“””
Display a real-time progress bar with statistics in the console.

```
Args:
    current: Number of items completed so far
    total: Total number of items to process
    start_time: Timestamp when processing started (from time.time())
    bar_length: Width of the progress bar in characters (default: 40)

The progress bar updates in place using carriage return (\r) to overwrite
the previous line, creating an animated effect.
"""
# Calculate progress as a fraction (0.0 to 1.0)
progress = current / total

# Calculate elapsed time in seconds
elapsed = time.time() - start_time

# Calculate estimated time remaining (ETA)
if current > 0:
    # Estimate based on average time per item
    eta = (elapsed / current) * (total - current)
    # Format as string with seconds
    eta_str = f"{int(eta)}s"
else:
    # Can't calculate ETA before any items are complete
    eta_str = "calculating..."

# Create the visual progress bar
# Calculate how many characters should be filled
filled = int(bar_length * progress)
# Create bar with filled (█) and empty (░) characters
bar = '█' * filled + '░' * (bar_length - filled)

# Print the progress bar (overwrites previous line with \r)
# end='' prevents newline, flush=True forces immediate display
print(f'\rProgress: [{bar}] {current}/{total} ({progress*100:.1f}%) | '
      f'Elapsed: {int(elapsed)}s | ETA: {eta_str}', end='', flush=True)
```

def process_xml_file(xml_filepath, max_workers=None):
“””
Main function to process an XML file and generate all frame images.

```
This function orchestrates the entire process:
1. Parse the XML file
2. Extract all frame data
3. Process frames in parallel
4. Display progress
5. Report statistics

Args:
    xml_filepath: Path to the XML file containing frame definitions
    max_workers: Number of parallel worker processes to use
                None = auto-detect based on CPU cores
                1 = no parallelization (sequential processing)
"""
# Print initial status message
print(f"Loading XML file: {xml_filepath}")

# Parse the XML file into an element tree
tree = ET.parse(xml_filepath)
# Get the root element of the XML tree
root = tree.getroot()

# Find all <frame> elements anywhere in the XML tree
# './/frame' uses XPath syntax: '//' means search at any depth
frames = root.findall('.//frame')

# Check if any frames were found
if not frames:
    print("No frame elements found in XML file.")
    return  # Exit the function early

# Count total number of frames found
total_frames = len(frames)
print(f"Found {total_frames} frame(s) to process.\n")

# Parse all frame data from XML first (done sequentially as it's fast)
print("Parsing XML data...")
frame_data_list = []  # List to store all valid frame data

# Loop through each frame element
for frame in frames:
    # Parse the frame data
    data = parse_frame_data(frame)
    
    # Check if parsing was successful
    if data:
        # Add valid frame data to our list
        frame_data_list.append(data)
    else:
        # Frame was missing required tags, print warning
        frame_num = int(frame.get('number', 0))
        print(f"\nWarning: Frame {frame_num} missing border tags, skipping.")

# Check if we have any valid frames to process
if not frame_data_list:
    print("No valid frames to process.")
    return  # Exit if no valid frames

print(f"\nProcessing {len(frame_data_list)} valid frames...\n")

# Determine number of parallel workers to use
if max_workers is None:
    # Auto-detect: use CPU count, but no more workers than frames
    # os.cpu_count() returns number of CPU cores, or None if undetermined
    max_workers = min(os.cpu_count() or 1, len(frame_data_list))

# Initialize tracking variables
completed = 0  # Counter for completed frames
errors = []    # List to collect any errors that occur
start_time = time.time()  # Record start time for statistics

# Create a process pool for parallel execution
# ProcessPoolExecutor spawns separate processes to bypass Python's GIL
with ProcessPoolExecutor(max_workers=max_workers) as executor:
    # Submit all frame processing tasks to the executor
    # This creates a dictionary mapping Future objects to frame numbers
    future_to_frame = {executor.submit(create_frame_from_borders, data): data[0] 
                      for data in frame_data_list}
    
    # Process completed tasks as they finish (not necessarily in order)
    # as_completed() yields futures as they complete
    for future in as_completed(future_to_frame):
        # Get the frame number associated with this future
        frame_num = future_to_frame[future]
        
        try:
            # Get the result from the completed task
            result_frame_num, success, message = future.result()
            
            # Check if the task encountered an error
            if not success:
                # Add error message to our error list
                errors.append(f"Frame {result_frame_num}: {message}")
        except Exception as e:
            # Catch any exceptions that occurred during processing
            errors.append(f"Frame {frame_num}: {str(e)}")
        
        # Increment completed counter
        completed += 1
        
        # Update the progress bar display
        print_progress_bar(completed, len(frame_data_list), start_time)

# Calculate total elapsed time
elapsed = time.time() - start_time

# Print final statistics on a new line
print(f"\n\nCompleted! Processed {completed} frames in {elapsed:.2f}s")
print(f"Average: {elapsed/completed:.3f}s per frame")

# If there were any errors, report them
if errors:
    print(f"\n{len(errors)} error(s) occurred:")
    # Print each error with a bullet point
    for error in errors:
        print(f"  - {error}")
```

# This block only runs when the script is executed directly (not imported)

if **name** == “**main**”:
# Define the XML file to process
xml_file = “frames.xml”  # Change this to your actual XML file path

```
try:
    # Call the main processing function
    # max_workers parameter controls parallelization:
    #   None = automatic (uses all CPU cores)
    #   1 = sequential processing (no parallelization)
    #   N = use N parallel workers
    process_xml_file(xml_file, max_workers=None)
    
except FileNotFoundError:
    # Handle case where XML file doesn't exist
    print(f"Error: XML file '{xml_file}' not found.")
    
except Exception as e:
    # Catch any other unexpected errors
    print(f"Error processing XML: {e}")
```