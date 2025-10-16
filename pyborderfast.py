from PIL import Image
import xml.etree.ElementTree as ET
import numpy as np
import os
import glob
from multiprocessing import Pool, cpu_count
import time

def apply_frame_border_numpy(image_path, frame_data, output_path):
“””
Applies border colors to a single frame using numpy (FAST).

```
Args:
    image_path: Path to input image
    frame_data: Dictionary with frame number and pixel list
    output_path: Path to save output image

Returns:
    Tuple of (frame_num, pixel_count, processing_time)
"""
start_time = time.time()

# Open image and convert to numpy array (much faster than PIL pixel access)
img = Image.open(image_path)
img = img.convert('RGB')
img_array = np.array(img)
height, width = img_array.shape[:2]

frame_num = frame_data['frame_num']
pixels = frame_data['pixels']
pixel_count = 0

# Apply all pixels at once using numpy indexing (vectorized operation)
for pixel in pixels:
    x, y, r, g, b = pixel
    
    # Validate position is on the border
    is_border = (x == 0 or x == width - 1 or 
                y == 0 or y == height - 1)
    
    if 0 <= x < width and 0 <= y < height and is_border:
        img_array[y, x] = [r, g, b]  # Note: numpy uses [y, x] indexing
        pixel_count += 1

# Convert back to PIL Image and save
result_img = Image.fromarray(img_array)
result_img.save(output_path)

elapsed = time.time() - start_time
return (frame_num, pixel_count, elapsed)
```

def parse_xml_sequence(xml_path):
“””
Parses the entire XML file and returns frame data.

```
Args:
    xml_path: Path to XML file

Returns:
    Dictionary mapping frame numbers to pixel lists
"""
tree = ET.parse(xml_path)
root = tree.getroot()

frame_data = {}

for frame_elem in root.findall('frame'):
    frame_num = int(frame_elem.get('number'))
    pixels = []
    
    for pixel_elem in frame_elem.findall('pixel'):
        x = int(pixel_elem.get('x'))
        y = int(pixel_elem.get('y'))
        r = int(pixel_elem.get('r'))
        g = int(pixel_elem.get('g'))
        b = int(pixel_elem.get('b'))
        pixels.append((x, y, r, g, b))
    
    frame_data[frame_num] = pixels

return frame_data
```

def process_single_frame(args):
“””
Wrapper function for multiprocessing pool.

```
Args:
    args: Tuple of (image_path, frame_data, output_path)

Returns:
    Processing statistics
"""
return apply_frame_border_numpy(*args)
```

def process_image_sequence_optimized(input_pattern, xml_path, output_dir, num_workers=None):
“””
Processes image sequence with numpy and multiprocessing (OPTIMIZED).

```
Args:
    input_pattern: Pattern for input images (e.g., "frames/frame_*.jpg")
    xml_path: Path to XML file with sequence border data
    output_dir: Directory to save output images
    num_workers: Number of parallel workers (None = auto-detect CPUs)
"""
start_time = time.time()

# Create output directory
os.makedirs(output_dir, exist_ok=True)

# Get all input images
image_files = sorted(glob.glob(input_pattern))

if not image_files:
    print(f"No images found matching pattern: {input_pattern}")
    return

print(f"Found {len(image_files)} images to process")
print(f"Using numpy arrays and multiprocessing")

# Parse XML once (more efficient than parsing per frame)
print("Parsing XML...")
frame_data_dict = parse_xml_sequence(xml_path)
print(f"Loaded data for {len(frame_data_dict)} frames")

# Prepare arguments for parallel processing
process_args = []
for img_path in image_files:
    basename = os.path.basename(img_path)
    filename_no_ext = os.path.splitext(basename)[0]
    
    # Extract frame number
    try:
        frame_num = int(''.join(filter(str.isdigit, filename_no_ext)))
    except ValueError:
        frame_num = image_files.index(img_path)
    
    # Skip if no data for this frame
    if frame_num not in frame_data_dict:
        print(f"Warning: No XML data for frame {frame_num}")
        continue
    
    output_path = os.path.join(output_dir, basename)
    frame_data = {
        'frame_num': frame_num,
        'pixels': frame_data_dict[frame_num]
    }
    
    process_args.append((img_path, frame_data, output_path))

# Determine number of workers
if num_workers is None:
    num_workers = cpu_count()

print(f"\nProcessing with {num_workers} parallel workers...")

# Process images in parallel
with Pool(processes=num_workers) as pool:
    results = pool.map(process_single_frame, process_args)

# Print statistics
total_pixels = sum(r[1] for r in results)
total_time = time.time() - start_time

print(f"\n{'='*60}")
print(f"Processing complete!")
print(f"{'='*60}")
print(f"Total frames processed: {len(results)}")
print(f"Total border pixels set: {total_pixels}")
print(f"Total time: {total_time:.2f} seconds")
print(f"Average time per frame: {total_time/len(results):.3f} seconds")
print(f"Frames per second: {len(results)/total_time:.2f}")
print(f"Output saved to: {output_dir}")
```

def process_image_sequence_standard(input_pattern, xml_path, output_dir):
“””
Standard processing without optimization (for comparison).

```
Args:
    input_pattern: Pattern for input images
    xml_path: Path to XML file
    output_dir: Directory to save output images
"""
start_time = time.time()

os.makedirs(output_dir, exist_ok=True)
image_files = sorted(glob.glob(input_pattern))

if not image_files:
    print(f"No images found matching pattern: {input_pattern}")
    return

print(f"Found {len(image_files)} images to process")
print(f"Using standard PIL pixel access (no optimization)")

tree = ET.parse(xml_path)
root = tree.getroot()

total_pixels = 0

for img_path in image_files:
    basename = os.path.basename(img_path)
    filename_no_ext = os.path.splitext(basename)[0]
    
    try:
        frame_num = int(''.join(filter(str.isdigit, filename_no_ext)))
    except ValueError:
        frame_num = image_files.index(img_path)
    
    # Open image with standard PIL
    img = Image.open(img_path)
    img = img.convert('RGB')
    width, height = img.size
    pixels = img.load()
    
    # Find frame data
    frame_elem = root.find(f".//frame[@number='{frame_num}']")
    if frame_elem is None:
        continue
    
    # Apply pixels using PIL (slower)
    for pixel_elem in frame_elem.findall('pixel'):
        x = int(pixel_elem.get('x'))
        y = int(pixel_elem.get('y'))
        r = int(pixel_elem.get('r'))
        g = int(pixel_elem.get('g'))
        b = int(pixel_elem.get('b'))
        
        is_border = (x == 0 or x == width - 1 or 
                    y == 0 or y == height - 1)
        
        if 0 <= x < width and 0 <= y < height and is_border:
            pixels[x, y] = (r, g, b)
            total_pixels += 1
    
    output_path = os.path.join(output_dir, basename)
    img.save(output_path)

total_time = time.time() - start_time

print(f"\n{'='*60}")
print(f"Standard processing complete!")
print(f"{'='*60}")
print(f"Total frames processed: {len(image_files)}")
print(f"Total border pixels set: {total_pixels}")
print(f"Total time: {total_time:.2f} seconds")
print(f"Average time per frame: {total_time/len(image_files):.3f} seconds")
print(f"Frames per second: {len(image_files)/total_time:.2f}")
```

def create_sequence_xml(xml_path, num_frames=10, width=200, height=150):
“””
Creates an example XML file for an image sequence.
“””
root = ET.Element(‘image_sequence’)

```
for frame_num in range(num_frames):
    frame_elem = ET.SubElement(root, 'frame', number=str(frame_num))
    
    red_val = int(255 * (frame_num / num_frames))
    blue_val = 255 - red_val
    
    # Add border pixels
    ET.SubElement(frame_elem, 'pixel', 
                 x='0', y='0', 
                 r=str(red_val), g='0', b=str(blue_val))
    
    ET.SubElement(frame_elem, 'pixel', 
                 x=str(width-1), y='0', 
                 r=str(blue_val), g=str(red_val), b='0')
    
    # Add strip along top border
    for x in range(0, width, 5):
        color_offset = (x + frame_num * 10) % 255
        ET.SubElement(frame_elem, 'pixel', 
                     x=str(x), y='0', 
                     r=str(color_offset), g=str(255-color_offset), b='128')

tree = ET.ElementTree(root)
ET.indent(tree, space='  ')
tree.write(xml_path, encoding='utf-8', xml_declaration=True)
print(f"Example XML created at {xml_path}")
```

# Example usage

if **name** == “**main**”:
# Create example XML
create_sequence_xml(“sequence_borders.xml”, num_frames=10, width=200, height=150)

```
print("\n" + "="*60)
print("OPTIMIZED VERSION (numpy + multiprocessing)")
print("="*60)

# Process with optimization
process_image_sequence_optimized(
    input_pattern="input_frames/frame_*.jpg",
    xml_path="sequence_borders.xml",
    output_dir="output_frames_optimized"
)

# Uncomment to compare with standard version:
# print("\n" + "="*60)
# print("STANDARD VERSION (for comparison)")
# print("="*60)
# process_image_sequence_standard(
#     input_pattern="input_frames/frame_*.jpg",
#     xml_path="sequence_borders.xml",
#     output_dir="output_frames_standard"
# )
```