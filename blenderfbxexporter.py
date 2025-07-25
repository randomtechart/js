import bpy
import bmesh
from bpy.props import (StringProperty, BoolProperty, FloatProperty,
EnumProperty, IntProperty)
from bpy.types import Panel, Operator
from bpy_extras.io_utils import ExportHelper
import os

class FBXUnityExportProperties(bpy.types.PropertyGroup):
“”“Properties for FBX Unity export settings”””

```
# File path
export_path: StringProperty(
    name="Export Path",
    description="Directory to export FBX files",
    default="//",
    maxlen=1024,
    subtype='DIR_PATH'
)

# Scale settings
global_scale: FloatProperty(
    name="Scale",
    description="Scale all data",
    default=1.0,
    min=0.001,
    max=1000.0
)

apply_unit_scale: BoolProperty(
    name="Apply Unit Scale",
    description="Take into account current Blender units settings",
    default=True
)

# Transform settings
apply_transform: BoolProperty(
    name="Apply Transform",
    description="Bake space transform into object, avoids getting unwanted rotations",
    default=True
)

# Object types
use_mesh_modifiers: BoolProperty(
    name="Apply Modifiers",
    description="Apply modifiers to mesh objects",
    default=True
)

use_mesh_edges: BoolProperty(
    name="Loose Edges",
    description="Export loose edges",
    default=False
)

use_tspace: BoolProperty(
    name="Tangent Space",
    description="Add binormal and tangent vectors, together with normal they form the tangent space",
    default=False
)

# Animation settings
use_anim: BoolProperty(
    name="Export Animation",
    description="Export keyframe animation",
    default=True
)

use_anim_action_all: BoolProperty(
    name="All Actions",
    description="Export all actions for the first armature found",
    default=True
)

use_default_take: BoolProperty(
    name="Default Take",
    description="Export currently assigned object and armature animations into FBX's default take",
    default=True
)

# Material settings
path_mode: EnumProperty(
    name="Path Mode",
    items=(('AUTO', "Auto", ""),
           ('ABSOLUTE', "Absolute", ""),
           ('RELATIVE', "Relative", ""),
           ('MATCH', "Match", ""),
           ('STRIP', "Strip Path", ""),
           ('COPY', "Copy", "")),
    default='AUTO'
)

embed_textures: BoolProperty(
    name="Embed Textures",
    description="Embed textures in FBX binary file",
    default=False
)

# Unity specific settings
use_selection: BoolProperty(
    name="Selected Objects Only",
    description="Export selected objects only",
    default=False
)

use_active_collection: BoolProperty(
    name="Active Collection Only",
    description="Export only objects from the active collection",
    default=False
)

# Armature settings
primary_bone_axis: EnumProperty(
    name="Primary Bone Axis",
    items=(('X', "X Axis", ""),
           ('Y', "Y Axis", ""),
           ('Z', "Z Axis", ""),
           ('-X', "-X Axis", ""),
           ('-Y', "-Y Axis", ""),
           ('-Z', "-Z Axis", "")),
    default='Y'
)

secondary_bone_axis: EnumProperty(
    name="Secondary Bone Axis", 
    items=(('X', "X Axis", ""),
           ('Y', "Y Axis", ""),
           ('Z', "Z Axis", ""),
           ('-X', "-X Axis", ""),
           ('-Y', "-Y Axis", ""),
           ('-Z', "-Z Axis", "")),
    default='X'
)
```

class EXPORT_OT_fbx_unity(Operator, ExportHelper):
“”“Export FBX for Unity with custom settings”””
bl_idname = “export_scene.fbx_unity”
bl_label = “Export FBX for Unity”
bl_options = {‘PRESET’, ‘UNDO’}

```
filename_ext = ".fbx"

filter_glob: StringProperty(
    default="*.fbx",
    options={'HIDDEN'},
    maxlen=255,
)

def execute(self, context):
    props = context.scene.fbx_unity_export_props
    
    # Get the filepath from the file browser
    filepath = self.filepath
    
    # Ensure the filepath has .fbx extension
    if not filepath.lower().endswith('.fbx'):
        filepath += '.fbx'
    
    # Set up export parameters
    export_params = {
        'filepath': filepath,
        'check_existing': True,
        'filter_glob': "*.fbx",
        'use_selection': props.use_selection,
        'use_active_collection': props.use_active_collection,
        'global_scale': props.global_scale,
        'apply_unit_scale': props.apply_unit_scale,
        'apply_scale_options': 'FBX_SCALE_NONE',
        'use_space_transform': props.apply_transform,
        'bake_space_transform': props.apply_transform,
        'object_types': {'MESH', 'ARMATURE', 'EMPTY'},
        'use_mesh_modifiers': props.use_mesh_modifiers,
        'use_mesh_modifiers_render': props.use_mesh_modifiers,
        'mesh_smooth_type': 'OFF',
        'use_subsurf': False,
        'use_mesh_edges': props.use_mesh_edges,
        'use_tspace': props.use_tspace,
        'use_custom_props': False,
        'add_leaf_bones': True,
        'primary_bone_axis': props.primary_bone_axis,
        'secondary_bone_axis': props.secondary_bone_axis,
        'use_armature_deform_only': False,
        'armature_nodetype': 'NULL',
        'bake_anim': props.use_anim,
        'bake_anim_use_all_bones': True,
        'bake_anim_use_nla_strips': False,
        'bake_anim_use_all_actions': props.use_anim_action_all,
        'bake_anim_force_startend_keying': True,
        'bake_anim_step': 1.0,
        'bake_anim_simplify_factor': 1.0,
        'path_mode': props.path_mode,
        'embed_textures': props.embed_textures,
        'batch_mode': 'OFF',
        'use_batch_own_dir': True,
        'use_metadata': True,
        'axis_forward': '-Z',
        'axis_up': 'Y'
    }
    
    try:
        bpy.ops.export_scene.fbx(**export_params)
        self.report({'INFO'}, f"FBX exported successfully to: {filepath}")
        return {'FINISHED'}
    except Exception as e:
        self.report({'ERROR'}, f"Export failed: {str(e)}")
        return {'CANCELLED'}
```

class VIEW3D_PT_fbx_unity_export(Panel):
“”“Panel for FBX Unity export settings”””
bl_label = “FBX Unity Export”
bl_idname = “VIEW3D_PT_fbx_unity_export”
bl_space_type = ‘VIEW_3D’
bl_region_type = ‘UI’
bl_category = “Unity Export”

```
def draw(self, context):
    layout = self.layout
    props = context.scene.fbx_unity_export_props
    
    # Export button
    layout.operator("export_scene.fbx_unity", text="Export FBX for Unity", icon='EXPORT')
    
    layout.separator()
    
    # Transform settings
    box = layout.box()
    box.label(text="Transform Settings", icon='OBJECT_ORIGIN')
    box.prop(props, "global_scale")
    box.prop(props, "apply_unit_scale")
    box.prop(props, "apply_transform")
    
    # Object selection
    box = layout.box()
    box.label(text="Object Selection", icon='RESTRICT_SELECT_OFF')
    box.prop(props, "use_selection")
    box.prop(props, "use_active_collection")
    
    # Mesh settings
    box = layout.box()
    box.label(text="Mesh Settings", icon='MESH_DATA')
    box.prop(props, "use_mesh_modifiers")
    box.prop(props, "use_mesh_edges")
    box.prop(props, "use_tspace")
    
    # Animation settings
    box = layout.box()
    box.label(text="Animation", icon='ANIM')
    box.prop(props, "use_anim")
    if props.use_anim:
        box.prop(props, "use_anim_action_all")
        box.prop(props, "use_default_take")
    
    # Armature settings
    box = layout.box()
    box.label(text="Armature", icon='ARMATURE_DATA')
    row = box.row()
    row.prop(props, "primary_bone_axis")
    row.prop(props, "secondary_bone_axis")
    
    # Material settings
    box = layout.box()
    box.label(text="Materials", icon='MATERIAL')
    box.prop(props, "path_mode")
    box.prop(props, "embed_textures")
```

class VIEW3D_PT_fbx_unity_quick_actions(Panel):
“”“Quick actions panel for common Unity export tasks”””
bl_label = “Quick Actions”
bl_idname = “VIEW3D_PT_fbx_unity_quick_actions”
bl_space_type = ‘VIEW_3D’
bl_region_type = ‘UI’
bl_category = “Unity Export”
bl_parent_id = “VIEW3D_PT_fbx_unity_export”

```
def draw(self, context):
    layout = self.layout
    props = context.scene.fbx_unity_export_props
    
    # Quick preset buttons
    col = layout.column(align=True)
    
    # Static mesh preset
    op = col.operator("wm.context_set_value", text="Static Mesh Preset")
    op.data_path = "scene.fbx_unity_export_props.use_anim"
    op.value = "False"
    
    # Animated mesh preset  
    op = col.operator("wm.context_set_value", text="Animated Mesh Preset")
    op.data_path = "scene.fbx_unity_export_props.use_anim"
    op.value = "True"
    
    layout.separator()
    
    # Selection helpers
    col = layout.column(align=True)
    col.operator("object.select_all", text="Select All").action = 'SELECT'
    col.operator("object.select_all", text="Deselect All").action = 'DESELECT'
    col.operator("object.select_by_type", text="Select Meshes").type = 'MESH'
```

# Registration

classes = [
FBXUnityExportProperties,
EXPORT_OT_fbx_unity,
VIEW3D_PT_fbx_unity_export,
VIEW3D_PT_fbx_unity_quick_actions,
]

def register():
for cls in classes:
bpy.utils.register_class(cls)

```
bpy.types.Scene.fbx_unity_export_props = bpy.props.PointerProperty(
    type=FBXUnityExportProperties
)
```

def unregister():
for cls in reversed(classes):
bpy.utils.unregister_class(cls)

```
del bpy.types.Scene.fbx_unity_export_props
```

if **name** == “**main**”:
register()
print(“FBX Unity Export addon registered successfully!”)