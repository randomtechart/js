using UnityEngine;
using UnityEditor;
using System.Collections.Generic;
using System.Xml;
using System.IO;
using System.Linq;

// Runtime Component
public class ImageSequenceAnimator : MonoBehaviour
{
public string xmlPath;
public Sprite[] imageSequence;
public Animator animator;
public bool autoTriggerSelected = false;
public int selectedAnimationIndex = 0;

```
[System.Serializable]
public class AnimationClipData
{
    public string name;
    public int startFrame;
    public int endFrame;
    public string triggerName;
}

public List<AnimationClipData> clipDataList = new List<AnimationClipData>();

public void TriggerAnimation(string triggerName)
{
    if (animator != null)
    {
        animator.SetTrigger(triggerName);
    }
}

public void TriggerAnimationByIndex(int index)
{
    if (index >= 0 && index < clipDataList.Count)
    {
        TriggerAnimation(clipDataList[index].triggerName);
    }
}

private void Start()
{
    if (autoTriggerSelected && clipDataList.Count > 0)
    {
        TriggerAnimationByIndex(selectedAnimationIndex);
    }
}
```

}

// Editor Script
[CustomEditor(typeof(ImageSequenceAnimator))]
public class ImageSequenceAnimatorEditor : Editor
{
private SerializedProperty xmlPathProp;
private SerializedProperty imageSequenceProp;
private SerializedProperty animatorProp;
private SerializedProperty autoTriggerProp;
private SerializedProperty selectedAnimIndexProp;

```
private void OnEnable()
{
    xmlPathProp = serializedObject.FindProperty("xmlPath");
    imageSequenceProp = serializedObject.FindProperty("imageSequence");
    animatorProp = serializedObject.FindProperty("animator");
    autoTriggerProp = serializedObject.FindProperty("autoTriggerSelected");
    selectedAnimIndexProp = serializedObject.FindProperty("selectedAnimationIndex");
}

public override void OnInspectorGUI()
{
    serializedObject.Update();
    ImageSequenceAnimator sequencer = (ImageSequenceAnimator)target;

    EditorGUILayout.LabelField("Image Sequence Animator", EditorStyles.boldLabel);
    EditorGUILayout.Space();

    // XML Path
    EditorGUILayout.BeginHorizontal();
    EditorGUILayout.PropertyField(xmlPathProp, new GUIContent("XML Path"));
    if (GUILayout.Button("Browse", GUILayout.Width(60)))
    {
        string path = EditorUtility.OpenFilePanel("Select XML File", Application.dataPath, "xml");
        if (!string.IsNullOrEmpty(path))
        {
            xmlPathProp.stringValue = path;
        }
    }
    EditorGUILayout.EndHorizontal();

    // Image Sequence
    EditorGUILayout.PropertyField(imageSequenceProp, new GUIContent("Image Sequence"), true);

    // Animator
    EditorGUILayout.PropertyField(animatorProp, new GUIContent("Animator"));

    EditorGUILayout.Space();

    // Reload XML and Rebuild Button
    if (GUILayout.Button("Reload XML and Rebuild Animations", GUILayout.Height(30)))
    {
        ReloadAndRebuild(sequencer);
    }

    EditorGUILayout.Space();

    // Animation Selection Dropdown
    if (sequencer.clipDataList.Count > 0)
    {
        EditorGUILayout.LabelField("Animation Control", EditorStyles.boldLabel);
        
        string[] animationNames = sequencer.clipDataList.Select(c => c.name).ToArray();
        selectedAnimIndexProp.intValue = EditorGUILayout.Popup(
            "Select Animation",
            selectedAnimIndexProp.intValue,
            animationNames
        );

        // Auto-trigger checkbox
        EditorGUILayout.PropertyField(autoTriggerProp, new GUIContent("Auto Trigger on Start"));

        EditorGUILayout.Space();

        // Display current animation info
        if (selectedAnimIndexProp.intValue < sequencer.clipDataList.Count)
        {
            var clipData = sequencer.clipDataList[selectedAnimIndexProp.intValue];
            EditorGUILayout.HelpBox(
                $"Animation: {clipData.name}\n" +
                $"Frames: {clipData.startFrame} - {clipData.endFrame}\n" +
                $"Trigger: {clipData.triggerName}",
                MessageType.Info
            );
        }

        // Manual trigger button for testing
        if (Application.isPlaying && GUILayout.Button("Trigger Selected Animation"))
        {
            sequencer.TriggerAnimationByIndex(selectedAnimIndexProp.intValue);
        }
    }
    else
    {
        EditorGUILayout.HelpBox("No animations loaded. Please set XML path and click 'Reload XML and Rebuild Animations'.", MessageType.Warning);
    }

    serializedObject.ApplyModifiedProperties();
}

private void ReloadAndRebuild(ImageSequenceAnimator sequencer)
{
    if (string.IsNullOrEmpty(sequencer.xmlPath))
    {
        EditorUtility.DisplayDialog("Error", "Please specify an XML file path.", "OK");
        return;
    }

    if (!File.Exists(sequencer.xmlPath))
    {
        EditorUtility.DisplayDialog("Error", "XML file not found at specified path.", "OK");
        return;
    }

    if (sequencer.imageSequence == null || sequencer.imageSequence.Length == 0)
    {
        EditorUtility.DisplayDialog("Error", "Please assign an image sequence.", "OK");
        return;
    }

    // Parse XML
    List<ImageSequenceAnimator.AnimationClipData> clipDataList = ParseXML(sequencer.xmlPath);
    if (clipDataList.Count == 0)
    {
        EditorUtility.DisplayDialog("Error", "No valid animation data found in XML.", "OK");
        return;
    }

    sequencer.clipDataList = clipDataList;

    // Create or get animator
    if (sequencer.animator == null)
    {
        sequencer.animator = sequencer.GetComponent<Animator>();
        if (sequencer.animator == null)
        {
            sequencer.animator = sequencer.gameObject.AddComponent<Animator>();
        }
    }

    // Create AnimatorController
    string controllerPath = $"Assets/AnimatorControllers/{sequencer.gameObject.name}_Controller.controller";
    string directory = Path.GetDirectoryName(controllerPath);
    
    if (!Directory.Exists(directory))
    {
        Directory.CreateDirectory(directory);
    }

    UnityEditor.Animations.AnimatorController controller = UnityEditor.Animations.AnimatorController.CreateAnimatorControllerAtPath(controllerPath);
    
    // Create animation clips
    foreach (var clipData in clipDataList)
    {
        AnimationClip clip = CreateAnimationClip(sequencer.imageSequence, clipData);
        
        // Save the clip
        string clipPath = $"Assets/AnimationClips/{sequencer.gameObject.name}_{clipData.name}.anim";
        string clipDirectory = Path.GetDirectoryName(clipPath);
        if (!Directory.Exists(clipDirectory))
        {
            Directory.CreateDirectory(clipDirectory);
        }
        
        AssetDatabase.CreateAsset(clip, clipPath);

        // Add to animator controller
        var state = controller.AddMotion(clip);
        
        // Add trigger parameter
        controller.AddParameter(clipData.triggerName, UnityEngine.AnimatorControllerParameterType.Trigger);
        
        // Create transition from Any State
        var anyState = controller.layers[0].stateMachine.defaultState;
        var transition = controller.layers[0].stateMachine.AddAnyStateTransition(state);
        transition.AddCondition(UnityEditor.Animations.AnimatorConditionMode.If, 0, clipData.triggerName);
        transition.duration = 0;
        transition.hasExitTime = false;
    }

    AssetDatabase.SaveAssets();
    AssetDatabase.Refresh();

    sequencer.animator.runtimeAnimatorController = controller;

    EditorUtility.DisplayDialog("Success", $"Created {clipDataList.Count} animations successfully!", "OK");
}

private List<ImageSequenceAnimator.AnimationClipData> ParseXML(string xmlPath)
{
    List<ImageSequenceAnimator.AnimationClipData> clipDataList = new List<ImageSequenceAnimator.AnimationClipData>();

    try
    {
        XmlDocument xmlDoc = new XmlDocument();
        xmlDoc.Load(xmlPath);

        XmlNodeList animationNodes = xmlDoc.SelectNodes("//Animation");
        
        foreach (XmlNode node in animationNodes)
        {
            string name = node.Attributes["name"]?.Value ?? "Unnamed";
            int startFrame = int.Parse(node.Attributes["startFrame"]?.Value ?? "0");
            int endFrame = int.Parse(node.Attributes["endFrame"]?.Value ?? "0");

            ImageSequenceAnimator.AnimationClipData clipData = new ImageSequenceAnimator.AnimationClipData
            {
                name = name,
                startFrame = startFrame,
                endFrame = endFrame,
                triggerName = "Trigger_" + name.Replace(" ", "_")
            };

            clipDataList.Add(clipData);
        }
    }
    catch (System.Exception e)
    {
        Debug.LogError($"Error parsing XML: {e.Message}");
    }

    return clipDataList;
}

private AnimationClip CreateAnimationClip(Sprite[] sprites, ImageSequenceAnimator.AnimationClipData clipData)
{
    AnimationClip clip = new AnimationClip();
    clip.name = clipData.name;
    clip.frameRate = 30; // Adjust as needed

    EditorCurveBinding spriteBinding = new EditorCurveBinding();
    spriteBinding.type = typeof(SpriteRenderer);
    spriteBinding.path = "";
    spriteBinding.propertyName = "m_Sprite";

    int frameCount = clipData.endFrame - clipData.startFrame + 1;
    ObjectReferenceKeyframe[] spriteKeyFrames = new ObjectReferenceKeyframe[frameCount];

    for (int i = 0; i < frameCount; i++)
    {
        int spriteIndex = clipData.startFrame + i;
        if (spriteIndex >= 0 && spriteIndex < sprites.Length)
        {
            spriteKeyFrames[i] = new ObjectReferenceKeyframe
            {
                time = i / clip.frameRate,
                value = sprites[spriteIndex]
            };
        }
    }

    AnimationUtility.SetObjectReferenceCurve(clip, spriteBinding, spriteKeyFrames);

    // Make the animation loop
    AnimationClipSettings settings = AnimationUtility.GetAnimationClipSettings(clip);
    settings.loopTime = false;
    AnimationUtility.SetAnimationClipSettings(clip, settings);

    return clip;
}
```

}

/* Example XML Format:

<?xml version="1.0" encoding="UTF-8"?>

<Animations>
    <Animation name="Walk" startFrame="0" endFrame="10"/>
    <Animation name="Run" startFrame="11" endFrame="20"/>
    <Animation name="Jump" startFrame="21" endFrame="30"/>
    <Animation name="Idle" startFrame="31" endFrame="40"/>
</Animations>
*/