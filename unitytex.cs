using UnityEngine;
using UnityEditor;
using System.Collections.Generic;
using System.IO;

public class TextureAnalyzer : EditorWindow
{
private Vector2 scrollPosition;
private List<TextureInfo> textureInfos = new List<TextureInfo>();

```
[System.Serializable]
public class TextureInfo
{
    public string name;
    public string path;
    public int width;
    public int height;
    public bool isPowerOfTwo;
    public int maxSize;
    public float pixelsPerUnit;
    public bool isSprite;
    public string issues;
}

[MenuItem("Tools/Texture Analyzer")]
public static void ShowWindow()
{
    GetWindow<TextureAnalyzer>("Texture Analyzer");
}

private void OnGUI()
{
    GUILayout.Label("Texture Analysis Tool", EditorStyles.boldLabel);
    
    if (GUILayout.Button("Analyze All Textures"))
    {
        AnalyzeTextures();
    }
    
    if (GUILayout.Button("Export to CSV"))
    {
        ExportToCSV();
    }
    
    if (textureInfos.Count > 0)
    {
        GUILayout.Space(10);
        GUILayout.Label($"Found {textureInfos.Count} textures", EditorStyles.boldLabel);
        
        // Header
        EditorGUILayout.BeginHorizontal();
        GUILayout.Label("Name", GUILayout.Width(200));
        GUILayout.Label("Dimensions", GUILayout.Width(80));
        GUILayout.Label("PoT", GUILayout.Width(40));
        GUILayout.Label("Max Size", GUILayout.Width(70));
        GUILayout.Label("PPU", GUILayout.Width(60));
        GUILayout.Label("Issues", GUILayout.Width(200));
        EditorGUILayout.EndHorizontal();
        
        EditorGUILayout.Separator();
        
        scrollPosition = EditorGUILayout.BeginScrollView(scrollPosition);
        
        foreach (var info in textureInfos)
        {
            EditorGUILayout.BeginHorizontal();
            
            // Clickable texture name
            if (GUILayout.Button(info.name, EditorStyles.linkLabel, GUILayout.Width(200)))
            {
                Selection.activeObject = AssetDatabase.LoadAssetAtPath<Texture2D>(info.path);
                EditorGUIUtility.PingObject(Selection.activeObject);
            }
            
            GUILayout.Label($"{info.width}x{info.height}", GUILayout.Width(80));
            
            // Color code power of two
            GUI.color = info.isPowerOfTwo ? Color.green : Color.red;
            GUILayout.Label(info.isPowerOfTwo ? "Yes" : "No", GUILayout.Width(40));
            GUI.color = Color.white;
            
            GUILayout.Label(info.maxSize.ToString(), GUILayout.Width(70));
            
            if (info.isSprite)
            {
                GUILayout.Label(info.pixelsPerUnit.ToString("F1"), GUILayout.Width(60));
            }
            else
            {
                GUILayout.Label("N/A", GUILayout.Width(60));
            }
            
            // Color code issues
            if (!string.IsNullOrEmpty(info.issues))
            {
                GUI.color = Color.yellow;
            }
            GUILayout.Label(info.issues, GUILayout.Width(200));
            GUI.color = Color.white;
            
            EditorGUILayout.EndHorizontal();
        }
        
        EditorGUILayout.EndScrollView();
    }
}

private void AnalyzeTextures()
{
    textureInfos.Clear();
    
    // Find all texture assets
    string[] guids = AssetDatabase.FindAssets("t:Texture2D");
    
    for (int i = 0; i < guids.Length; i++)
    {
        string path = AssetDatabase.GUIDToAssetPath(guids[i]);
        
        // Update progress bar
        EditorUtility.DisplayProgressBar("Analyzing Textures", $"Processing {Path.GetFileName(path)}", (float)i / guids.Length);
        
        Texture2D texture = AssetDatabase.LoadAssetAtPath<Texture2D>(path);
        if (texture == null) continue;
        
        TextureImporter importer = AssetImporter.GetAtPath(path) as TextureImporter;
        if (importer == null) continue;
        
        TextureInfo info = new TextureInfo();
        info.name = texture.name;
        info.path = path;
        info.width = texture.width;
        info.height = texture.height;
        info.isPowerOfTwo = IsPowerOfTwo(texture.width) && IsPowerOfTwo(texture.height);
        
        // Get max texture size from importer settings
        TextureImporterPlatformSettings settings = importer.GetDefaultPlatformTextureSettings();
        info.maxSize = settings.maxTextureSize;
        
        // Check if it's a sprite
        info.isSprite = importer.textureType == TextureImporterType.Sprite;
        if (info.isSprite)
        {
            info.pixelsPerUnit = importer.spritePixelsPerUnit;
        }
        
        // Analyze potential issues
        List<string> issues = new List<string>();
        
        if (!info.isPowerOfTwo)
        {
            issues.Add("Not PoT");
        }
        
        if (info.width > info.maxSize || info.height > info.maxSize)
        {
            issues.Add("Exceeds max size");
        }
        
        // Check if texture is unnecessarily large
        if (info.maxSize > Mathf.Max(info.width, info.height) * 2)
        {
            issues.Add("Max size too large");
        }
        
        // Check common sprite PPU values
        if (info.isSprite)
        {
            if (info.pixelsPerUnit != 100f && info.pixelsPerUnit != 1f && info.pixelsPerUnit != 16f && info.pixelsPerUnit != 32f)
            {
                issues.Add("Unusual PPU");
            }
        }
        
        info.issues = string.Join(", ", issues);
        
        textureInfos.Add(info);
    }
    
    EditorUtility.ClearProgressBar();
    
    // Sort by name
    textureInfos.Sort((a, b) => a.name.CompareTo(b.name));
    
    Debug.Log($"Texture analysis complete. Found {textureInfos.Count} textures.");
}

private bool IsPowerOfTwo(int value)
{
    return value > 0 && (value & (value - 1)) == 0;
}

private void ExportToCSV()
{
    if (textureInfos.Count == 0)
    {
        EditorUtility.DisplayDialog("No Data", "Please analyze textures first.", "OK");
        return;
    }
    
    string path = EditorUtility.SaveFilePanel("Export Texture Analysis", "", "texture_analysis", "csv");
    if (string.IsNullOrEmpty(path)) return;
    
    using (StreamWriter writer = new StreamWriter(path))
    {
        // Write header
        writer.WriteLine("Name,Path,Width,Height,Power of Two,Max Size,Pixels Per Unit,Is Sprite,Issues");
        
        // Write data
        foreach (var info in textureInfos)
        {
            writer.WriteLine($"\"{info.name}\",\"{info.path}\",{info.width},{info.height},{info.isPowerOfTwo},{info.maxSize},{info.pixelsPerUnit},{info.isSprite},\"{info.issues}\"");
        }
    }
    
    EditorUtility.DisplayDialog("Export Complete", $"Texture analysis exported to:\n{path}", "OK");
}
```

}