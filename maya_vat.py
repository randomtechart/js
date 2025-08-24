# “””
Maya VAT (Vertex Animation Texture) Encoding Tool

This tool exports vertex animation data from Maya as textures that can be used
in real-time applications like Unreal Engine, Unity, or custom shaders.

Features:

- Position-based VAT encoding
- Normal-based VAT encoding
- Multiple encoding formats (float, normalized)
- Frame range selection
- Multiple objects support
- Quality presets
- Real-time preview
- Batch export capabilities

Author: Professional Maya Technical Artist
Version: 1.0
“””

import maya.cmds as cmds
import maya.mel as mel
import maya.api.OpenMaya as om2
import maya.api.OpenMayaAnim as oma2
import numpy as np
from PIL import Image
import os
import json
import time

class VATEncoder:
“”“Main VAT encoding class”””

```
def __init__(self):
    self.reset_data()
    
def reset_data(self):
    """Reset all internal data"""
    self.meshes = []
    self.frame_start = 1
    self.frame_end = 100
    self.frame_step = 1
    self.output_path = ""
    self.texture_width = 256
    self.texture_height = 256
    self.encoding_type = "position"  # position, normal, both
    self.data_format = "float32"     # float32, normalized
    self.pivot_mode = "center"       # center, bottom, custom
    self.custom_pivot = [0, 0, 0]
    self.normalize_bounds = True
    self.flip_v = True
    self.vertex_data = {}
    self.bounds_data = {}
    
def add_mesh(self, mesh_name):
    """Add mesh to VAT export list"""
    if cmds.objExists(mesh_name):
        if mesh_name not in self.meshes:
            self.meshes.append(mesh_name)
            return True
    return False
    
def remove_mesh(self, mesh_name):
    """Remove mesh from VAT export list"""
    if mesh_name in self.meshes:
        self.meshes.remove(mesh_name)
        return True
    return False
    
def get_mesh_vertex_count(self, mesh_name):
    """Get vertex count for a mesh"""
    selection_list = om2.MSelectionList()
    selection_list.add(mesh_name)
    dag_path = selection_list.getDagPath(0)
    mesh_fn = om2.MFnMesh(dag_path)
    return mesh_fn.numVertices
    
def calculate_texture_dimensions(self):
    """Calculate optimal texture dimensions based on vertex count and frame count"""
    total_vertices = sum([self.get_mesh_vertex_count(mesh) for mesh in self.meshes])
    frame_count = int((self.frame_end - self.frame_start) / self.frame_step) + 1
    
    # Calculate dimensions (width = vertices, height = frames)
    self.texture_width = self.next_power_of_2(total_vertices)
    self.texture_height = self.next_power_of_2(frame_count)
    
    # Clamp to reasonable limits
    self.texture_width = min(max(self.texture_width, 64), 4096)
    self.texture_height = min(max(self.texture_height, 64), 4096)
    
def next_power_of_2(self, n):
    """Get next power of 2"""
    power = 1
    while power < n:
        power *= 2
    return power
    
def get_mesh_bounds(self, mesh_name, frame_range=None):
    """Get bounding box for mesh across frame range"""
    if frame_range is None:
        frame_range = range(self.frame_start, self.frame_end + 1, self.frame_step)
        
    current_frame = cmds.currentTime(query=True)
    
    min_bounds = [float('inf')] * 3
    max_bounds = [float('-inf')] * 3
    
    for frame in frame_range:
        cmds.currentTime(frame)
        bbox = cmds.exactWorldBoundingBox(mesh_name)
        
        # Update min/max bounds
        for i in range(3):
            min_bounds[i] = min(min_bounds[i], bbox[i])
            max_bounds[i] = max(max_bounds[i], bbox[i+3])
            
    cmds.currentTime(current_frame)
    return min_bounds, max_bounds
    
def get_pivot_point(self, mesh_name):
    """Get pivot point based on pivot mode"""
    if self.pivot_mode == "custom":
        return self.custom_pivot
        
    min_bounds, max_bounds = self.get_mesh_bounds(mesh_name)
    
    if self.pivot_mode == "center":
        return [(min_bounds[i] + max_bounds[i]) / 2 for i in range(3)]
    elif self.pivot_mode == "bottom":
        return [(min_bounds[i] + max_bounds[i]) / 2 if i != 1 else min_bounds[i] for i in range(3)]
        
    return [0, 0, 0]
    
def extract_vertex_data(self, progress_callback=None):
    """Extract vertex animation data from meshes"""
    if not self.meshes:
        raise ValueError("No meshes selected for VAT export")
        
    current_frame = cmds.currentTime(query=True)
    frame_range = range(self.frame_start, self.frame_end + 1, self.frame_step)
    total_frames = len(frame_range)
    
    self.vertex_data = {}
    self.bounds_data = {}
    
    try:
        for mesh_idx, mesh_name in enumerate(self.meshes):
            if progress_callback:
                progress_callback(f"Processing mesh: {mesh_name}", mesh_idx / len(self.meshes))
                
            # Get mesh bounds for normalization
            min_bounds, max_bounds = self.get_mesh_bounds(mesh_name, frame_range)
            self.bounds_data[mesh_name] = {"min": min_bounds, "max": max_bounds}
            
            # Get pivot point
            pivot = self.get_pivot_point(mesh_name)
            
            # Initialize data storage
            vertex_count = self.get_mesh_vertex_count(mesh_name)
            
            if self.encoding_type in ["position", "both"]:
                self.vertex_data[f"{mesh_name}_position"] = np.zeros((total_frames, vertex_count, 3), dtype=np.float32)
                
            if self.encoding_type in ["normal", "both"]:
                self.vertex_data[f"{mesh_name}_normal"] = np.zeros((total_frames, vertex_count, 3), dtype=np.float32)
            
            # Extract data for each frame
            for frame_idx, frame in enumerate(frame_range):
                if progress_callback:
                    progress_callback(
                        f"Processing frame {frame} of {mesh_name}", 
                        (mesh_idx + frame_idx / total_frames) / len(self.meshes)
                    )
                    
                cmds.currentTime(frame)
                
                # Get mesh data
                selection_list = om2.MSelectionList()
                selection_list.add(mesh_name)
                dag_path = selection_list.getDagPath(0)
                mesh_fn = om2.MFnMesh(dag_path)
                
                # Extract positions
                if self.encoding_type in ["position", "both"]:
                    points = mesh_fn.getPoints(om2.MSpace.kWorld)
                    positions = np.array([[p.x - pivot[0], p.y - pivot[1], p.z - pivot[2]] for p in points], dtype=np.float32)
                    
                    if self.normalize_bounds:
                        # Normalize to [-1, 1] range
                        for i in range(3):
                            range_val = max_bounds[i] - min_bounds[i]
                            if range_val > 0:
                                positions[:, i] = (positions[:, i] - (min_bounds[i] - pivot[i])) / range_val * 2 - 1
                                
                    self.vertex_data[f"{mesh_name}_position"][frame_idx] = positions
                
                # Extract normals
                if self.encoding_type in ["normal", "both"]:
                    normals_raw = mesh_fn.getVertexNormals(True, om2.MSpace.kWorld)
                    normals = np.array([[n.x, n.y, n.z] for n in normals_raw], dtype=np.float32)
                    self.vertex_data[f"{mesh_name}_normal"][frame_idx] = normals
                    
    finally:
        cmds.currentTime(current_frame)
        
def encode_to_texture(self, data_key, progress_callback=None):
    """Encode vertex data to texture format"""
    if data_key not in self.vertex_data:
        raise ValueError(f"Data key {data_key} not found in vertex data")
        
    data = self.vertex_data[data_key]
    frames, vertices, components = data.shape
    
    # Create texture data
    texture_data = np.zeros((self.texture_height, self.texture_width, 4), dtype=np.float32)
    
    # Pack vertex data into texture
    vertex_idx = 0
    for frame in range(frames):
        if progress_callback:
            progress_callback(f"Encoding frame {frame+1}/{frames}", frame / frames)
            
        frame_y = frame if not self.flip_v else (self.texture_height - 1 - frame)
        
        for vertex in range(vertices):
            if vertex_idx >= self.texture_width:
                break
                
            # Pack XYZ into RGB channels, leave alpha as 1
            texture_data[frame_y, vertex, 0] = data[frame, vertex, 0]  # R = X
            texture_data[frame_y, vertex, 1] = data[frame, vertex, 1]  # G = Y  
            texture_data[frame_y, vertex, 2] = data[frame, vertex, 2]  # B = Z
            texture_data[frame_y, vertex, 3] = 1.0                      # A = 1
            
            vertex_idx += 1
            
        vertex_idx = 0
        
    return texture_data
    
def save_texture(self, texture_data, filepath, format_type="exr"):
    """Save texture data to file"""
    if self.data_format == "normalized":
        # Convert to 0-1 range and then to 8-bit
        texture_data = (texture_data + 1) * 0.5
        texture_data = np.clip(texture_data * 255, 0, 255).astype(np.uint8)
        mode = "RGBA"
    else:
        # Keep as float32 for EXR
        mode = "RGBA"
        
    # Convert to PIL format
    if self.data_format == "float32" and format_type.lower() == "exr":
        # For EXR, we need to save as float32
        self.save_exr(texture_data, filepath)
    else:
        # For other formats, convert to uint8
        if self.data_format == "float32":
            texture_data = np.clip((texture_data + 1) * 127.5, 0, 255).astype(np.uint8)
        
        height, width = texture_data.shape[:2]
        img = Image.fromarray(texture_data, mode)
        img.save(filepath)
        
def save_exr(self, data, filepath):
    """Save data as EXR file using OpenEXR"""
    try:
        import OpenEXR
        import Imath
        
        height, width = data.shape[:2]
        header = OpenEXR.Header(width, height)
        header['channels'] = {
            'R': Imath.Channel(Imath.PixelType(Imath.PixelType.FLOAT)),
            'G': Imath.Channel(Imath.PixelType(Imath.PixelType.FLOAT)),
            'B': Imath.Channel(Imath.PixelType(Imath.PixelType.FLOAT)),
            'A': Imath.Channel(Imath.PixelType(Imath.PixelType.FLOAT))
        }
        
        out = OpenEXR.OutputFile(filepath, header)
        out.writePixels({
            'R': data[:,:,0].astype(np.float32).tobytes(),
            'G': data[:,:,1].astype(np.float32).tobytes(), 
            'B': data[:,:,2].astype(np.float32).tobytes(),
            'A': data[:,:,3].astype(np.float32).tobytes()
        })
        out.close()
        
    except ImportError:
        # Fallback to TIFF if OpenEXR not available
        filepath = filepath.replace('.exr', '.tif')
        texture_data = np.clip((data + 1) * 127.5, 0, 255).astype(np.uint8)
        img = Image.fromarray(texture_data, 'RGBA')
        img.save(filepath)
        
def export_metadata(self, filepath):
    """Export metadata JSON file"""
    metadata = {
        "version": "1.0",
        "meshes": self.meshes,
        "frame_range": {
            "start": self.frame_start,
            "end": self.frame_end,
            "step": self.frame_step
        },
        "texture_dimensions": {
            "width": self.texture_width,
            "height": self.texture_height
        },
        "encoding": {
            "type": self.encoding_type,
            "format": self.data_format,
            "pivot_mode": self.pivot_mode,
            "normalize_bounds": self.normalize_bounds,
            "flip_v": self.flip_v
        },
        "bounds": self.bounds_data,
        "vertex_counts": {mesh: self.get_mesh_vertex_count(mesh) for mesh in self.meshes}
    }
    
    with open(filepath, 'w') as f:
        json.dump(metadata, f, indent=2)
        
def export_vat(self, output_directory, progress_callback=None):
    """Main export function"""
    if not os.path.exists(output_directory):
        os.makedirs(output_directory)
        
    # Calculate texture dimensions
    self.calculate_texture_dimensions()
    
    # Extract vertex data
    if progress_callback:
        progress_callback("Extracting vertex data...", 0.1)
    self.extract_vertex_data(progress_callback)
    
    # Export textures
    exported_files = []
    data_keys = list(self.vertex_data.keys())
    
    for i, data_key in enumerate(data_keys):
        if progress_callback:
            progress_callback(f"Encoding texture: {data_key}", 0.5 + (i / len(data_keys)) * 0.4)
            
        texture_data = self.encode_to_texture(data_key, progress_callback)
        
        # Determine file extension
        ext = ".exr" if self.data_format == "float32" else ".png"
        filepath = os.path.join(output_directory, f"{data_key}_VAT{ext}")
        
        self.save_texture(texture_data, filepath)
        exported_files.append(filepath)
        
    # Export metadata
    metadata_path = os.path.join(output_directory, "VAT_metadata.json")
    self.export_metadata(metadata_path)
    exported_files.append(metadata_path)
    
    if progress_callback:
        progress_callback("Export complete!", 1.0)
        
    return exported_files
```

class VATEncoderUI:
“”“Maya UI for VAT Encoder”””

```
def __init__(self):
    self.encoder = VATEncoder()
    self.window_name = "VATEncoderWindow"
    self.create_ui()
    
def create_ui(self):
    """Create the main UI window"""
    # Delete existing window
    if cmds.window(self.window_name, exists=True):
        cmds.deleteUI(self.window_name)
        
    # Create main window
    self.window = cmds.window(
        self.window_name,
        title="VAT Encoder v1.0",
        widthHeight=(400, 600),
        resizeToFitChildren=True
    )
    
    # Main layout
    main_layout = cmds.columnLayout(adjustableColumn=True, margin=10)
    
    # Header
    cmds.text(label="Vertex Animation Texture Encoder", 
             font="boldLabelFont", height=30)
    cmds.separator(height=10)
    
    # Mesh Selection Frame
    mesh_frame = cmds.frameLayout(label="Mesh Selection", collapsable=True)
    cmds.columnLayout(adjustableColumn=True)
    
    cmds.rowLayout(numberOfColumns=2, columnWidth2=(200, 180))
    self.mesh_scroll = cmds.textScrollList(height=100, allowMultiSelection=False)
    
    cmds.columnLayout()
    cmds.button(label="Add Selected", command=self.add_selected_meshes, width=170)
    cmds.button(label="Remove Selected", command=self.remove_selected_meshes, width=170)
    cmds.button(label="Clear All", command=self.clear_all_meshes, width=170)
    cmds.setParent('..')  # columnLayout
    cmds.setParent('..')  # rowLayout
    cmds.setParent('..')  # columnLayout
    cmds.setParent('..')  # frameLayout
    
    # Animation Frame
    anim_frame = cmds.frameLayout(label="Animation Range", collapsable=True)
    cmds.columnLayout(adjustableColumn=True)
    
    cmds.rowLayout(numberOfColumns=4, columnWidth4=(80, 80, 80, 80))
    cmds.text(label="Start:")
    self.frame_start_field = cmds.intField(value=1)
    cmds.text(label="End:")
    self.frame_end_field = cmds.intField(value=100)
    cmds.setParent('..')
    
    cmds.rowLayout(numberOfColumns=4, columnWidth4=(80, 80, 100, 100))
    cmds.text(label="Step:")
    self.frame_step_field = cmds.intField(value=1)
    cmds.button(label="Use Timeline", command=self.use_timeline_range, width=90)
    cmds.button(label="Use Playback", command=self.use_playback_range, width=90)
    cmds.setParent('..')
    cmds.setParent('..')
    cmds.setParent('..')
    
    # Encoding Settings Frame
    encoding_frame = cmds.frameLayout(label="Encoding Settings", collapsable=True)
    cmds.columnLayout(adjustableColumn=True)
    
    cmds.rowLayout(numberOfColumns=2, columnWidth2=(120, 250))
    cmds.text(label="Encoding Type:")
    self.encoding_type_menu = cmds.optionMenu()
    cmds.menuItem(label="Position Only")
    cmds.menuItem(label="Normal Only") 
    cmds.menuItem(label="Position + Normal")
    cmds.setParent('..')
    
    cmds.rowLayout(numberOfColumns=2, columnWidth2=(120, 250))
    cmds.text(label="Data Format:")
    self.data_format_menu = cmds.optionMenu()
    cmds.menuItem(label="Float32 (EXR)")
    cmds.menuItem(label="Normalized (PNG)")
    cmds.setParent('..')
    
    cmds.rowLayout(numberOfColumns=2, columnWidth2=(120, 250))
    cmds.text(label="Pivot Mode:")
    self.pivot_mode_menu = cmds.optionMenu(changeCommand=self.on_pivot_mode_changed)
    cmds.menuItem(label="Center")
    cmds.menuItem(label="Bottom")
    cmds.menuItem(label="Custom")
    cmds.setParent('..')
    
    # Custom pivot controls (initially hidden)
    self.custom_pivot_layout = cmds.rowLayout(numberOfColumns=4, columnWidth4=(60, 80, 80, 80), visible=False)
    cmds.text(label="Pivot:")
    self.pivot_x_field = cmds.floatField(value=0.0)
    self.pivot_y_field = cmds.floatField(value=0.0) 
    self.pivot_z_field = cmds.floatField(value=0.0)
    cmds.setParent('..')
    
    cmds.checkBox(label="Normalize Bounds", value=True)
    cmds.checkBox(label="Flip V Coordinate", value=True)
    
    cmds.setParent('..')
    cmds.setParent('..')
    
    # Texture Settings Frame
    texture_frame = cmds.frameLayout(label="Texture Settings", collapsable=True, collapse=True)
    cmds.columnLayout(adjustableColumn=True)
    
    cmds.rowLayout(numberOfColumns=4, columnWidth4=(80, 80, 80, 120))
    cmds.text(label="Width:")
    self.texture_width_field = cmds.intField(value=256)
    cmds.text(label="Height:")
    self.texture_height_field = cmds.intField(value=256)
    cmds.setParent('..')
    
    cmds.button(label="Auto Calculate Dimensions", command=self.auto_calculate_dimensions)
    
    cmds.setParent('..')
    cmds.setParent('..')
    
    # Export Frame
    export_frame = cmds.frameLayout(label="Export", collapsable=True)
    cmds.columnLayout(adjustableColumn=True)
    
    cmds.rowLayout(numberOfColumns=2, columnWidth2=(300, 80))
    self.output_path_field = cmds.textField(placeholderText="Select output directory...")
    cmds.button(label="Browse", command=self.browse_output_path, width=70)
    cmds.setParent('..')
    
    cmds.separator(height=10)
    
    # Progress bar
    self.progress_bar = cmds.progressBar(maxValue=100, visible=False)
    self.progress_text = cmds.text(label="", visible=False)
    
    # Export buttons
    cmds.rowLayout(numberOfColumns=2, columnWidth2=(190, 190))
    cmds.button(label="Export VAT", command=self.export_vat, 
               backgroundColor=(0.3, 0.7, 0.3), height=40)
    cmds.button(label="Preview Settings", command=self.preview_settings, height=40)
    cmds.setParent('..')
    
    cmds.setParent('..')
    cmds.setParent('..')
    
    # Show window
    cmds.showWindow(self.window)
    
def add_selected_meshes(self, *args):
    """Add selected meshes to the list"""
    selected = cmds.ls(selection=True, type='transform')
    added = []
    
    for obj in selected:
        # Check if object has mesh shape
        shapes = cmds.listRelatives(obj, shapes=True, type='mesh')
        if shapes and self.encoder.add_mesh(obj):
            added.append(obj)
            
    # Update UI list
    if added:
        cmds.textScrollList(self.mesh_scroll, edit=True, 
                          append=added)
        cmds.inViewMessage(amg=f"Added {len(added)} mesh(es)", pos='midCenter', fade=True)
    else:
        cmds.inViewMessage(amg="No valid meshes selected", pos='midCenter', fade=True)
        
def remove_selected_meshes(self, *args):
    """Remove selected meshes from the list"""
    selected_items = cmds.textScrollList(self.mesh_scroll, query=True, selectItem=True)
    if selected_items:
        for item in selected_items:
            self.encoder.remove_mesh(item)
            cmds.textScrollList(self.mesh_scroll, edit=True, removeItem=item)
            
def clear_all_meshes(self, *args):
    """Clear all meshes from the list"""
    self.encoder.meshes = []
    cmds.textScrollList(self.mesh_scroll, edit=True, removeAll=True)
    
def use_timeline_range(self, *args):
    """Use timeline range for animation"""
    start = int(cmds.playbackOptions(query=True, minTime=True))
    end = int(cmds.playbackOptions(query=True, maxTime=True))
    cmds.intField(self.frame_start_field, edit=True, value=start)
    cmds.intField(self.frame_end_field, edit=True, value=end)
    
def use_playback_range(self, *args):
    """Use playback range for animation"""
    start = int(cmds.playbackOptions(query=True, animationStartTime=True))
    end = int(cmds.playbackOptions(query=True, animationEndTime=True))
    cmds.intField(self.frame_start_field, edit=True, value=start)
    cmds.intField(self.frame_end_field, edit=True, value=end)
    
def on_pivot_mode_changed(self, *args):
    """Handle pivot mode change"""
    mode = cmds.optionMenu(self.pivot_mode_menu, query=True, value=True)
    show_custom = mode == "Custom"
    cmds.rowLayout(self.custom_pivot_layout, edit=True, visible=show_custom)
    
def auto_calculate_dimensions(self, *args):
    """Auto calculate texture dimensions"""
    self.update_encoder_settings()
    self.encoder.calculate_texture_dimensions()
    cmds.intField(self.texture_width_field, edit=True, value=self.encoder.texture_width)
    cmds.intField(self.texture_height_field, edit=True, value=self.encoder.texture_height)
    
def browse_output_path(self, *args):
    """Browse for output directory"""
    result = cmds.fileDialog2(fileMode=3, caption="Select Output Directory")
    if result:
        cmds.textField(self.output_path_field, edit=True, text=result[0])
        
def update_encoder_settings(self):
    """Update encoder with UI settings"""
    # Frame range
    self.encoder.frame_start = cmds.intField(self.frame_start_field, query=True, value=True)
    self.encoder.frame_end = cmds.intField(self.frame_end_field, query=True, value=True)
    self.encoder.frame_step = cmds.intField(self.frame_step_field, query=True, value=True)
    
    # Encoding settings
    encoding_map = {"Position Only": "position", "Normal Only": "normal", "Position + Normal": "both"}
    encoding_type = cmds.optionMenu(self.encoding_type_menu, query=True, value=True)
    self.encoder.encoding_type = encoding_map[encoding_type]
    
    format_map = {"Float32 (EXR)": "float32", "Normalized (PNG)": "normalized"}
    data_format = cmds.optionMenu(self.data_format_menu, query=True, value=True)
    self.encoder.data_format = format_map[data_format]
    
    pivot_map = {"Center": "center", "Bottom": "bottom", "Custom": "custom"}
    pivot_mode = cmds.optionMenu(self.pivot_mode_menu, query=True, value=True)
    self.encoder.pivot_mode = pivot_map[pivot_mode]
    
    if self.encoder.pivot_mode == "custom":
        self.encoder.custom_pivot = [
            cmds.floatField(self.pivot_x_field, query=True, value=True),
            cmds.floatField(self.pivot_y_field, query=True, value=True),
            cmds.floatField(self.pivot_z_field, query=True, value=True)
        ]
        
    # Texture settings
    self.encoder.texture_width = cmds.intField(self.texture_width_field, query=True, value=True)
    self.encoder.texture_height = cmds.intField(self.texture_height_field, query=True, value=True)
    
def progress_callback(self, message, progress):
    """Progress callback for export process"""
    cmds.progressBar(self.progress_bar, edit=True, progress=int(progress * 100))
    cmds.text(self.progress_text, edit=True, label=message)
    cmds.refresh()
    
def export_vat(self, *args):
    """Export VAT textures"""
    try:
        # Validate inputs
        if not self.encoder.meshes:
            cmds.confirmDialog(title="Error", message="No meshes selected for export")
            return
            
        output_path = cmds.textField(self.output_path_field, query=True, text=True)
        if not output_path:
            cmds.confirmDialog(title="Error", message="Please select an output directory")
            return
            
        # Update encoder settings
        self.update_encoder_settings()
        
        # Show progress
        cmds.progressBar(self.progress_bar, edit=True, visible=True)
        cmds.text(self.progress_text, edit=True, visible=True)
        
        # Export
        start_time = time.time()
        exported_files = self.encoder.export_vat(output_path, self.progress_callback)
        end_time = time.time()
        
        # Hide progress
        cmds.progressBar(self.progress_bar, edit=True, visible=False)
        cmds.text(self.progress_text, edit=True, visible=False)
        
        # Show success message
        duration = end_time - start_time
        message = f"VAT export completed in {duration:.1f}s\n\nExported files:\n"
        message += "\n".join([os.path.basename(f) for f in exported_files])
        
        cmds.confirmDialog(title="Export Complete", message=message)
        
    except Exception as e:
        cmds.progressBar(self.progress_bar, edit=True, visible=False)
        cmds.text(self.progress_text, edit=True, visible=False)
        cmds.confirmDialog(
```