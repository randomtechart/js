using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

public class AssetOptimizationReport : EditorWindow
{
private Vector2 scrollPosition;
private List<AssetOptimizationData> optimizationData = new List<AssetOptimizationData>();
private bool showFBXAssets = true;
private bool showImageAssets = true;
private bool showOnlyIssues = false;
private string searchFilter = “”;
private SortMode currentSortMode = SortMode.Name;

```
private enum SortMode
{
    Name,
    Size,
    Issues,
    Type
}

private class AssetOptimizationData
{
    public string assetPath;
    public string assetName;
    public AssetType type;
    public long fileSize;
    public List<OptimizationSuggestion> suggestions;
    public ImportSettings currentSettings;
    
    public int IssueCount => suggestions.Count(s => s.severity == Severity.High || s.severity == Severity.Medium);
}

private enum AssetType
{
    FBX,
    Texture
}

private class OptimizationSuggestion
{
    public string title;
    public string description;
    public Severity severity;
    public string recommendation;
}

private enum Severity
{
    Low,
    Medium,
    High
}

private class ImportSettings
{
    // FBX Settings
    public bool readWriteEnabled;
    public bool optimizeMesh;
    public ModelImporterMeshCompression meshCompression;
    public bool importBlendShapes;
    public bool importVisibility;
    public bool importCameras;
    public bool importLights;
    public ModelImporterAnimationType animationType;
    public int polygonCount;
    public int vertexCount;
    
    // Texture Settings
    public TextureImporterType textureType;
    public int maxTextureSize;
    public TextureImporterFormat textureFormat;
    public TextureImporterCompression compression;
    public bool mipmapEnabled;
    public FilterMode filterMode;
    public bool isReadable;
    public int width;
    public int height;
}

[MenuItem("Tools/Asset Optimization Report")]
public static void ShowWindow()
{
    GetWindow<AssetOptimizationReport>("Asset Optimization Report");
}

private void OnGUI()
{
    EditorGUILayout.BeginVertical();
    
    // Header
    EditorGUILayout.Space();
    EditorGUILayout.LabelField("Asset Optimization Report", EditorStyles.boldLabel);
    EditorGUILayout.Space();
    
    // Controls
    EditorGUILayout.BeginHorizontal();
    if (GUILayout.Button("Generate Report", GUILayout.Height(30)))
    {
        GenerateReport();
    }
    
    if (GUILayout.Button("Apply All Safe Optimizations", GUILayout.Height(30)))
    {
        ApplyAllSafeOptimizations();
    }
    EditorGUILayout.EndHorizontal();
    
    EditorGUILayout.Space();
    
    // Filters
    EditorGUILayout.BeginHorizontal();
    showFBXAssets = EditorGUILayout.Toggle("Show FBX", showFBXAssets);
    showImageAssets = EditorGUILayout.Toggle("Show Textures", showImageAssets);
    showOnlyIssues = EditorGUILayout.Toggle("Show Only Issues", showOnlyIssues);
    EditorGUILayout.EndHorizontal();
    
    // Search and Sort
    EditorGUILayout.BeginHorizontal();
    EditorGUILayout.LabelField("Search:", GUILayout.Width(50));
    searchFilter = EditorGUILayout.TextField(searchFilter);
    EditorGUILayout.LabelField("Sort by:", GUILayout.Width(50));
    currentSortMode = (SortMode)EditorGUILayout.EnumPopup(currentSortMode, GUILayout.Width(100));
    EditorGUILayout.EndHorizontal();
    
    EditorGUILayout.Space();
    
    // Results Summary
    if (optimizationData.Count > 0)
    {
        var filteredData = GetFilteredData();
        var totalIssues = filteredData.Sum(d => d.IssueCount);
        var totalSize = filteredData.Sum(d => d.fileSize);
        
        EditorGUILayout.BeginHorizontal(EditorStyles.helpBox);
        EditorGUILayout.LabelField($"Assets: {filteredData.Count}", GUILayout.Width(100));
        EditorGUILayout.LabelField($"Issues: {totalIssues}", GUILayout.Width(100));
        EditorGUILayout.LabelField($"Total Size: {FormatFileSize(totalSize)}", GUILayout.Width(150));
        EditorGUILayout.EndHorizontal();
        
        EditorGUILayout.Space();
    }
    
    // Asset List
    scrollPosition = EditorGUILayout.BeginScrollView(scrollPosition);
    
    var dataToShow = GetFilteredData();
    foreach (var data in dataToShow)
    {
        DrawAssetData(data);
    }
    
    EditorGUILayout.EndScrollView();
    EditorGUILayout.EndVertical();
}

private List<AssetOptimizationData> GetFilteredData()
{
    var filtered = optimizationData.Where(d =>
    {
        if (!showFBXAssets && d.type == AssetType.FBX) return false;
        if (!showImageAssets && d.type == AssetType.Texture) return false;
        if (showOnlyIssues && d.IssueCount == 0) return false;
        if (!string.IsNullOrEmpty(searchFilter) && 
            !d.assetName.ToLower().Contains(searchFilter.ToLower())) return false;
        return true;
    });
    
    return currentSortMode switch
    {
        SortMode.Name => filtered.OrderBy(d => d.assetName).ToList(),
        SortMode.Size => filtered.OrderByDescending(d => d.fileSize).ToList(),
        SortMode.Issues => filtered.OrderByDescending(d => d.IssueCount).ToList(),
        SortMode.Type => filtered.OrderBy(d => d.type).ThenBy(d => d.assetName).ToList(),
        _ => filtered.ToList()
    };
}

private void GenerateReport()
{
    optimizationData.Clear();
    
    // Find all FBX files
    var fbxGuids = AssetDatabase.FindAssets("t:Model");
    foreach (var guid in fbxGuids)
    {
        var path = AssetDatabase.GUIDToAssetPath(guid);
        if (path.EndsWith(".fbx") || path.EndsWith(".obj") || path.EndsWith(".dae"))
        {
            AnalyzeFBXAsset(path);
        }
    }
    
    // Find all texture files
    var textureGuids = AssetDatabase.FindAssets("t:Texture2D");
    foreach (var guid in textureGuids)
    {
        var path = AssetDatabase.GUIDToAssetPath(guid);
        AnalyzeTextureAsset(path);
    }
    
    Debug.Log($"Asset Optimization Report generated: {optimizationData.Count} assets analyzed");
}

private void AnalyzeFBXAsset(string assetPath)
{
    var importer = AssetImporter.GetAtPath(assetPath) as ModelImporter;
    if (importer == null) return;
    
    var fileInfo = new FileInfo(assetPath);
    var mesh = AssetDatabase.LoadAssetAtPath<Mesh>(assetPath);
    
    var data = new AssetOptimizationData
    {
        assetPath = assetPath,
        assetName = Path.GetFileNameWithoutExtension(assetPath),
        type = AssetType.FBX,
        fileSize = fileInfo.Length,
        suggestions = new List<OptimizationSuggestion>(),
        currentSettings = new ImportSettings
        {
            readWriteEnabled = importer.isReadable,
            optimizeMesh = importer.optimizeMeshVertices,
            meshCompression = importer.meshCompression,
            importBlendShapes = importer.importBlendShapes,
            importVisibility = importer.importVisibility,
            importCameras = importer.importCameras,
            importLights = importer.importLights,
            animationType = importer.animationType,
            polygonCount = mesh?.triangles?.Length / 3 ?? 0,
            vertexCount = mesh?.vertexCount ?? 0
        }
    };
    
    AnalyzeFBXOptimizations(data, importer);
    optimizationData.Add(data);
}

private void AnalyzeFBXOptimizations(AssetOptimizationData data, ModelImporter importer)
{
    // Check Read/Write Enabled
    if (data.currentSettings.readWriteEnabled)
    {
        data.suggestions.Add(new OptimizationSuggestion
        {
            title = "Read/Write Enabled",
            description = "Read/Write is enabled, which doubles memory usage",
            severity = Severity.High,
            recommendation = "Disable Read/Write unless you need to access mesh data at runtime"
        });
    }
    
    // Check Mesh Optimization
    if (!data.currentSettings.optimizeMesh)
    {
        data.suggestions.Add(new OptimizationSuggestion
        {
            title = "Mesh Not Optimized",
            description = "Mesh optimization is disabled",
            severity = Severity.Medium,
            recommendation = "Enable mesh optimization to reduce vertex count and improve performance"
        });
    }
    
    // Check Mesh Compression
    if (data.currentSettings.meshCompression == ModelImporterMeshCompression.Off)
    {
        data.suggestions.Add(new OptimizationSuggestion
        {
            title = "No Mesh Compression",
            description = "Mesh compression is disabled",
            severity = Severity.Medium,
            recommendation = "Enable mesh compression to reduce memory usage"
        });
    }
    
    // Check High Poly Count
    if (data.currentSettings.polygonCount > 10000)
    {
        data.suggestions.Add(new OptimizationSuggestion
        {
            title = "High Polygon Count",
            description = $"Model has {data.currentSettings.polygonCount} polygons",
            severity = data.currentSettings.polygonCount > 50000 ? Severity.High : Severity.Medium,
            recommendation = "Consider using LOD system or reducing polygon count"
        });
    }
    
    // Check unnecessary imports
    if (data.currentSettings.importCameras)
    {
        data.suggestions.Add(new OptimizationSuggestion
        {
            title = "Importing Cameras",
            description = "Cameras from the model are being imported",
            severity = Severity.Low,
            recommendation = "Disable camera import if not needed"
        });
    }
    
    if (data.currentSettings.importLights)
    {
        data.suggestions.Add(new OptimizationSuggestion
        {
            title = "Importing Lights",
            description = "Lights from the model are being imported",
            severity = Severity.Low,
            recommendation = "Disable light import if not needed"
        });
    }
    
    // Check animation settings
    if (data.currentSettings.animationType != ModelImporterAnimationType.None)
    {
        var animationClips = AssetDatabase.LoadAllAssetsAtPath(data.assetPath)
            .OfType<AnimationClip>().Count();
        
        if (animationClips == 0)
        {
            data.suggestions.Add(new OptimizationSuggestion
            {
                title = "Animation Import Enabled",
                description = "Animation import is enabled but no animations found",
                severity = Severity.Low,
                recommendation = "Disable animation import if no animations are needed"
            });
        }
    }
}

private void AnalyzeTextureAsset(string assetPath)
{
    var importer = AssetImporter.GetAtPath(assetPath) as TextureImporter;
    if (importer == null) return;
    
    var fileInfo = new FileInfo(assetPath);
    var texture = AssetDatabase.LoadAssetAtPath<Texture2D>(assetPath);
    
    var data = new AssetOptimizationData
    {
        assetPath = assetPath,
        assetName = Path.GetFileNameWithoutExtension(assetPath),
        type = AssetType.Texture,
        fileSize = fileInfo.Length,
        suggestions = new List<OptimizationSuggestion>(),
        currentSettings = new ImportSettings
        {
            textureType = importer.textureType,
            maxTextureSize = importer.maxTextureSize,
            compression = importer.textureCompression,
            mipmapEnabled = importer.mipmapEnabled,
            isReadable = importer.isReadable,
            width = texture?.width ?? 0,
            height = texture?.height ?? 0
        }
    };
    
    var platformSettings = importer.GetPlatformTextureSettings("Standalone");
    data.currentSettings.textureFormat = platformSettings.format;
    
    AnalyzeTextureOptimizations(data, importer);
    optimizationData.Add(data);
}

private void AnalyzeTextureOptimizations(AssetOptimizationData data, TextureImporter importer)
{
    // Check if texture is readable
    if (data.currentSettings.isReadable)
    {
        data.suggestions.Add(new OptimizationSuggestion
        {
            title = "Read/Write Enabled",
            description = "Texture Read/Write is enabled, doubling memory usage",
            severity = Severity.High,
            recommendation = "Disable Read/Write unless you need to access pixel data at runtime"
        });
    }
    
    // Check texture size
    var maxDimension = Mathf.Max(data.currentSettings.width, data.currentSettings.height);
    if (maxDimension > 2048)
    {
        data.suggestions.Add(new OptimizationSuggestion
        {
            title = "Large Texture Size",
            description = $"Texture is {data.currentSettings.width}x{data.currentSettings.height}",
            severity = maxDimension > 4096 ? Severity.High : Severity.Medium,
            recommendation = "Consider reducing texture size or using texture streaming"
        });
    }
    
    // Check if texture is power of 2
    if (!IsPowerOfTwo(data.currentSettings.width) || !IsPowerOfTwo(data.currentSettings.height))
    {
        data.suggestions.Add(new OptimizationSuggestion
        {
            title = "Non-Power-of-Two Texture",
            description = "Texture dimensions are not power of 2",
            severity = Severity.Low,
            recommendation = "Use power-of-2 dimensions for better compression and performance"
        });
    }
    
    // Check compression
    if (data.currentSettings.compression == TextureImporterCompression.Uncompressed)
    {
        data.suggestions.Add(new OptimizationSuggestion
        {
            title = "Uncompressed Texture",
            description = "Texture is not compressed",
            severity = Severity.High,
            recommendation = "Enable compression to significantly reduce memory usage"
        });
    }
    
    // Check mipmap settings
    if (data.currentSettings.textureType == TextureImporterType.Sprite && data.currentSettings.mipmapEnabled)
    {
        data.suggestions.Add(new OptimizationSuggestion
        {
            title = "Unnecessary Mipmaps",
            description = "Mipmaps enabled for UI/Sprite texture",
            severity = Severity.Low,
            recommendation = "Disable mipmaps for UI elements and sprites"
        });
    }
    
    // Check max texture size vs actual size
    if (data.currentSettings.maxTextureSize > maxDimension * 2)
    {
        data.suggestions.Add(new OptimizationSuggestion
        {
            title = "Max Size Too High",
            description = $"Max texture size ({data.currentSettings.maxTextureSize}) is much larger than actual size",
            severity = Severity.Low,
            recommendation = "Reduce max texture size to match actual texture dimensions"
        });
    }
}

private void DrawAssetData(AssetOptimizationData data)
{
    EditorGUILayout.BeginVertical(EditorStyles.helpBox);
    
    // Asset Header
    EditorGUILayout.BeginHorizontal();
    
    var icon = data.type == AssetType.FBX ? EditorGUIUtility.IconContent("Mesh Icon") : EditorGUIUtility.IconContent("Texture Icon");
    GUILayout.Label(icon, GUILayout.Width(20), GUILayout.Height(20));
    
    EditorGUILayout.LabelField(data.assetName, EditorStyles.boldLabel);
    
    if (data.IssueCount > 0)
    {
        var color = GUI.color;
        GUI.color = data.suggestions.Any(s => s.severity == Severity.High) ? Color.red : Color.yellow;
        GUILayout.Label($"⚠ {data.IssueCount}", GUILayout.Width(30));
        GUI.color = color;
    }
    
    EditorGUILayout.LabelField(FormatFileSize(data.fileSize), GUILayout.Width(80));
    
    if (GUILayout.Button("Select", GUILayout.Width(60)))
    {
        Selection.activeObject = AssetDatabase.LoadAssetAtPath<Object>(data.assetPath);
    }
    
    if (GUILayout.Button("Apply Safe Fixes", GUILayout.Width(100)))
    {
        ApplySafeOptimizations(data);
    }
    
    EditorGUILayout.EndHorizontal();
    
    // Asset Details
    EditorGUI.indentLevel++;
    EditorGUILayout.LabelField($"Path: {data.assetPath}", EditorStyles.miniLabel);
    
    if (data.type == AssetType.FBX)
    {
        EditorGUILayout.LabelField($"Vertices: {data.currentSettings.vertexCount:N0}, Polygons: {data.currentSettings.polygonCount:N0}", EditorStyles.miniLabel);
    }
    else
    {
        EditorGUILayout.LabelField($"Size: {data.currentSettings.width}x{data.currentSettings.height}", EditorStyles.miniLabel);
    }
    
    // Suggestions
    if (data.suggestions.Count > 0)
    {
        EditorGUILayout.Space(5);
        foreach (var suggestion in data.suggestions)
        {
            var color = GUI.color;
            GUI.color = suggestion.severity switch
            {
                Severity.High => new Color(1f, 0.8f, 0.8f),
                Severity.Medium => new Color(1f, 1f, 0.8f),
                _ => Color.white
            };
            
            EditorGUILayout.BeginVertical(EditorStyles.helpBox);
            EditorGUILayout.LabelField($"[{suggestion.severity}] {suggestion.title}", EditorStyles.boldLabel);
            EditorGUILayout.LabelField(suggestion.description, EditorStyles.wordWrappedLabel);
            EditorGUILayout.LabelField($"💡 {suggestion.recommendation}", EditorStyles.miniLabel);
            EditorGUILayout.EndVertical();
            
            GUI.color = color;
        }
    }
    
    EditorGUI.indentLevel--;
    EditorGUILayout.EndVertical();
    EditorGUILayout.Space(2);
}

private void ApplyAllSafeOptimizations()
{
    int applied = 0;
    foreach (var data in optimizationData)
    {
        if (ApplySafeOptimizations(data))
            applied++;
    }
    
    AssetDatabase.Refresh();
    Debug.Log($"Applied safe optimizations to {applied} assets");
    GenerateReport(); // Refresh the report
}

private bool ApplySafeOptimizations(AssetOptimizationData data)
{
    bool changed = false;
    
    if (data.type == AssetType.FBX)
    {
        var importer = AssetImporter.GetAtPath(data.assetPath) as ModelImporter;
        if (importer != null)
        {
            if (importer.isReadable)
            {
                importer.isReadable = false;
                changed = true;
            }
            
            if (!importer.optimizeMeshVertices)
            {
                importer.optimizeMeshVertices = true;
                changed = true;
            }
            
            if (importer.meshCompression == ModelImporterMeshCompression.Off)
            {
                importer.meshCompression = ModelImporterMeshCompression.Low;
                changed = true;
            }
            
            if (importer.importCameras)
            {
                importer.importCameras = false;
                changed = true;
            }
            
            if (importer.importLights)
            {
                importer.importLights = false;
                changed = true;
            }
        }
    }
    else if (data.type == AssetType.Texture)
    {
        var importer = AssetImporter.GetAtPath(data.assetPath) as TextureImporter;
        if (importer != null)
        {
            if (importer.isReadable)
            {
                importer.isReadable = false;
                changed = true;
            }
            
            if (importer.textureCompression == TextureImporterCompression.Uncompressed)
            {
                importer.textureCompression = TextureImporterCompression.Compressed;
                changed = true;
            }
            
            // Disable mipmaps for sprites
            if (importer.textureType == TextureImporterType.Sprite && importer.mipmapEnabled)
            {
                importer.mipmapEnabled = false;
                changed = true;
            }
        }
    }
    
    if (changed)
    {
        AssetDatabase.ImportAsset(data.assetPath);
        Debug.Log($"Applied optimizations to: {data.assetName}");
    }
    
    return changed;
}

private bool IsPowerOfTwo(int value)
{
    return value > 0 && (value & (value - 1)) == 0;
}

private string FormatFileSize(long bytes)
{
    if (bytes < 1024) return $"{bytes} B";
    if (bytes < 1024 * 1024) return $"{bytes / 1024.0:F1} KB";
    if (bytes < 1024 * 1024 * 1024) return $"{bytes / (1024.0 * 1024.0):F1} MB";
    return $"{bytes / (1024.0 * 1024.0 * 1024.0):F1} GB";
}
```

}