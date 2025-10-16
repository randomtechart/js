from PIL import Image
import xml.etree.ElementTree as ET
import os
import glob

def process_image_sequence(input_pattern, xml_path, output_dir):
“””
Processes an entire image sequence, applying border colors from XML.


Args:
    input_pattern: Pattern for input images (e.g., "frames/frame_*.jpg")
    xml_path: Path to XML file with sequence border data
    output_dir: Directory to save output images
"""
# Create output directory if it doesn't exist
os.makedirs(output_dir, exist_ok=True)

# Get all input images matching the pattern
image_files = sorted(glob.glob(input_pattern))

if not image_files:
    print(f"No images found matching pattern: {input_pattern}")
    return

print(f"Found {len(image_files)} images to process")

# Parse the XML file
tree = ET.parse(xml_path)
root = tree.getroot()

# Process each frame
for img_path in image_files:
    # Extract frame number from filename
    basename = os.path.basename(img_path)
    filename_no_ext = os.path.splitext(basename)[0]
    
    # Try to extract frame number (assumes format like "frame_001.jpg")
    try:
        frame_num = int(''.join(filter(str.isdigit, filename_no_ext)))
    except ValueError:
        frame_num = image_files.index(img_path)
    
    print(f"\nProcessing frame {frame_num}: {basename}")
    
    # Apply border colors for this frame
    output_path = os.path.join(output_dir, basename)
    apply_frame_border(img_path, root, frame_num, output_path)
```

def apply_frame_border(image_path, xml_root, frame_num, output_path):
“””
Applies border colors to a single frame based on XML data.


Args:
    image_path: Path to input image
    xml_root: Root element of parsed XML
    frame_num: Frame number to process
    output_path: Path to save output image
"""
# Open the image
img = Image.open(image_path)
img = img.convert('RGB')
width, height = img.size
pixels = img.load()

# Find the frame element in XML
frame_elem = xml_root.find(f".//frame[@number='{frame_num}']")

if frame_elem is None:
    print(f"  Warning: No data found for frame {frame_num} in XML")
    img.save(output_path)
    return

pixel_count = 0

# Process each pixel in this frame
for pixel_elem in frame_elem.findall('pixel'):
    x = int(pixel_elem.get('x'))
    y = int(pixel_elem.get('y'))
    r = int(pixel_elem.get('r'))
    g = int(pixel_elem.get('g'))
    b = int(pixel_elem.get('b'))
    
    # Validate position is on the border
    is_border = (x == 0 or x == width - 1 or 
                y == 0 or y == height - 1)
    
    # Apply color if valid
    if 0 <= x < width and 0 <= y < height and is_border:
        pixels[x, y] = (r, g, b)
        pixel_count += 1

print(f"  Applied {pixel_count} border pixels")

# Save the modified image
img.save(output_path)


def create_sequence_xml(xml_path, num_frames=10, width=200, height=150):
“””
Creates an example XML file for an image sequence.


Args:
    xml_path: Path where XML file will be saved
    num_frames: Number of frames in the sequence
    width: Width of images
    height: Height of images
"""
root = ET.Element('image_sequence')

for frame_num in range(num_frames):
    frame_elem = ET.SubElement(root, 'frame', number=str(frame_num))
    
    # Animate color cycling through frames
    # Red component cycles
    red_val = int(255 * (frame_num / num_frames))
    blue_val = 255 - red_val
    
    # Add corner pixels with animated colors
    ET.SubElement(frame_elem, 'pixel', 
                 x='0', y='0', 
                 r=str(red_val), g='0', b=str(blue_val))
    
    ET.SubElement(frame_elem, 'pixel', 
                 x=str(width-1), y='0', 
                 r=str(blue_val), g=str(red_val), b='0')
    
    ET.SubElement(frame_elem, 'pixel', 
                 x='0', y=str(height-1), 
                 r='0', g=str(red_val), b=str(blue_val))
    
    ET.SubElement(frame_elem, 'pixel', 
                 x=str(width-1), y=str(height-1), 
                 r=str(red_val), g=str(blue_val), b=str(red_val))
    
    # Add animated strip along top border
    for x in range(0, width, 5):
        color_offset = (x + frame_num * 10) % 255
        ET.SubElement(frame_elem, 'pixel', 
                     x=str(x), y='0', 
                     r=str(color_offset), g=str(255-color_offset), b='128')

# Create the tree and save
tree = ET.ElementTree(root)
ET.indent(tree, space='  ')
tree.write(xml_path, encoding='utf-8', xml_declaration=True)
print(f"Example sequence XML created at {xml_path}")


# Example usage

if **name** == “**main**”:
# Create an example XML for a 10-frame sequence
create_sequence_xml(“sequence_borders.xml”, num_frames=10, width=200, height=150)


# Process all frames in a directory
# Input images can be named like: frame_000.jpg, frame_001.jpg, etc.
process_image_sequence(
    input_pattern="input_frames/frame_*.jpg",
    xml_path="sequence_borders.xml",
    output_dir="output_frames"
)

print("\n" + "="*50)
print("XML Format for sequences:")
print("="*50)
print("<?xml version='1.0' encoding='utf-8'?>")
print("<image_sequence>")
print("  <frame number='0'>")
print("    <pixel x='0' y='0' r='255' g='0' b='0' />")
print("    <pixel x='10' y='0' r='0' g='255' b='0' />")
print("  </frame>")
print("  <frame number='1'>")
print("    <pixel x='0' y='0' r='200' g='55' b='0' />")
print("    <pixel x='10' y='0' r='0' g='200' b='55' />")
print("  </frame>")
print("  ...")
print("</image_sequence>")
