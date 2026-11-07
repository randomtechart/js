# After Effects Script Plan: Default Marker and Frame 0 Shift

## 1. Goal

Traverse the active composition and all of its child compositions and, per comp:

1. Make sure a comp marker with the comment `Default` sits at frame 0.
2. If any footage sits at frame 0, shift every layer and every comp marker one frame later.
3. Show everything in a UI first. **Nothing changes until Apply is pressed.**

## 2. Definitions and Rules

### Footage
- "Footage" for the frame 0 check means any layer whose `source` is a `FootageItem` **or** a `CompItem` (precomps count as footage).
- Solids, text, nulls, shapes and adjustment layers are not part of the frame 0 check, but they **are** shifted (see section 6).

### Frame 0
- A time counts as frame 0 if it is within half a frame (`comp.frameDuration / 2`) of time 0.
- Always use raw comp time, not displayed timecode (matters when `displayStartTime` is nonzero).
- Always use each comp's own `frameDuration`.

### Default token
- Match `Default` as a whole word, case-sensitive, followed by a comma, whitespace, or end of string.
- `Defaults` and `DefaultPose` do **not** match.

### Marker rules
| Marker comment | Action |
|---|---|
| Exactly `Default` at frame 0 | Keep. |
| Exactly `Default` elsewhere (no Default at 0) | Move to frame 0. |
| Exactly `Default`, extra duplicates | Delete the duplicates. |
| `Default` + comma or space + text (e.g. `Default, Intro`, `Default Intro`) | Strip `Default` and the delimiter, trim leftovers, keep the marker in place. |
| No Default marker anywhere | Create `Default` at frame 0. |

**Split case:** if a token marker sits at frame 0 after cleaning (e.g. `Default Intro` at 0), `Default` stays at frame 0 and the remaining text (`Intro`) moves to frame 1. If another marker already occupies the target frame, use the next free frame and flag the comp in the UI.

**Marker data:** whenever a marker is removed and re-added, copy the **full** `MarkerValue` (comment, duration, chapter, URL, frame target, cue point name, parameters) so nothing is lost.

## 3. Traversal

- Start at `app.project.activeItem`. Abort with an alert if it is not a comp.
- Recurse through layers whose `source` is a `CompItem`.
- Keep a visited-ID set so a precomp used in several places is processed once and circular references cannot loop.
- Store comps by `comp.id` (not object references) and look them up later with `app.project.itemByID()`.
- Record each comp's depth for indentation in the UI.
- **Scope option:** "Active comp and children" or "Selected comps in the Project panel".
- **Skip list:** a name-pattern field (e.g. `_ref*`, `OLD_*`). Matching comps are not scanned or changed.
- Progress bar with a cancel check between comps.

## 4. Scan Phase (read-only)

Per comp, collect:

- **Default at 0:** an exact `Default` marker at frame 0.
- **Stray Defaults:** other exact `Default` markers, with times.
- **Token fixes:** markers containing the Default token plus other text, with the before and after result (e.g. `Default Intro → Default @0 + Intro @1`).
- **Footage at 0:** footage and precomp layers whose `inPoint` is at frame 0.
- **Hidden precomps:** precomp layers with `enabled == false`. Report only, nothing is changed.
- **Overflow:** after a simulated one-frame shift, layers whose `outPoint` was within the comp before the shift but lands past `comp.duration`, and markers that land at or past the comp's end. Layers that already extended past the end before the shift are ignored.
- **Expression warnings:** layers with expressions containing `time`, `valueAtTime`, `key(`, `loopIn` or `loopOut` (the shift can change their output). Warning only.
- **Time-remapped layers:** flagged as a warning.
- **Planned action** summary for the comp.

## 5. UI (ScriptUI palette)

### List columns
Comp (indented by depth) | Default at 0? | Stray Defaults | Token fixes | Footage at 0? | Hidden precomps | Overflow | Expression warnings | Planned action

### Controls
- Per-row include checkbox.
- Scope dropdown, skip-list field.
- "Save a backup copy first" checkbox (default on).
- Buttons: **Rescan**, **Apply**, **Cancel**, **Copy report / Save .txt**.
- Summary line (e.g. "12 comps, 3 need shift, 5 missing Default, 2 overflow").
- Progress bar with cancel during scan and apply.

### Row click
- Open the comp in the viewer (`comp.openInViewer()`).
- Deselect all layers in that comp, then select the flagged layers: footage at frame 0, hidden precomps, and overflowing layers.
- Clicking never changes anything. Only Apply does.

## 6. Overflow Prompt (before Apply does anything)

One dialog, shown only if any comp has overflow. Choices are global, with a **"Review per comp"** checkbox for finer control.

**Question 1: layers and markers that overflow**
- **Extend comp:** add the frames needed so everything fits. This also resolves the marker question.
- **Trim layers:** set overflowing layers' `outPoint` to the comp end. Markers cannot be trimmed, so Question 2 applies.

**Question 2: markers that fall outside (only if Trim was chosen)**
- Move to the last frame of the comp.
- Delete them.
- Extend the comp just enough to fit the markers (layers stay trimmed).

**Notes**
- Extending also grows the work area if it matched the old comp end.
- Extending a child comp does **not** extend its precomp layer in the parent. That layer keeps its `outPoint` and is flagged in the log.
- Trimming loses the last frame of any layer that ended exactly at the comp end.

## 7. Apply Phase

1. If "Save a backup copy first" is checked, save a backup copy of the project.
2. Collect the overflow choices (section 6) before changing anything.
3. Open one `beginUndoGroup` for the whole run.
4. Process comps **children first**, so a parent's overflow check sees any child extensions. Per comp:
   1. **Shift, if footage at frame 0.**
      - Move **every layer's** `startTime` later by `comp.frameDuration`. Keyframes, time remap, masks, effects and layer markers travel with the layer.
      - Shift every comp marker one frame later, latest first (remove and re-add with the full `MarkerValue`).
   2. **Overflow handling:** extend the comp or trim layers, and handle out-of-range markers per the prompt choices.
   3. **Clean tokens:** strip `Default` plus its delimiter from affected comments in place. If a cleaned marker is still at frame 0, move its remaining text to frame 1 (or the next free frame).
   4. **Enforce Default:** move an exact `Default` to frame 0, delete extra duplicates, or create one at frame 0 if none exists.
   5. Log the results for the comp.
5. End the undo group, refresh the list, and show the summary.

Default is enforced after the shift so it never ends up on frame 1.

**Run-twice safety:** after a shift, nothing remains at frame 0, so a second run must not shift again. Test this explicitly.

## 8. Edge Cases

- Locked layers: unlock temporarily, then restore.
- Parented layers: shifting `startTime` does not break parenting. All layers move together.
- Time-remapped layers and layers with expressions: warn.
- Layers that already extend past the comp end before the shift: not treated as new overflow.
- Comps with different frame rates: always use that comp's `frameDuration`.
- Nonzero `displayStartTime`: use raw comp time.
- Hidden precomps: report only.

## 9. Build Order

1. Traversal and scan, with results to the console.
2. UI list with row-click selection and the extra columns.
3. Marker logic (token rules, Default enforcement, full `MarkerValue` preservation).
4. Shift for all layers and markers.
5. Overflow detection and the prompt dialog.
6. Backup, scope options, skip list, progress bar and cancel.
7. Report export (Copy report / Save .txt).
8. Edge case handling, logging and testing.

## 10. Test Checklist

- Comp with Default already at 0 and no footage at 0: no changes.
- Comp with Default elsewhere: moved to 0, extras deleted.
- Comp with no Default: created at 0.
- `Default, Intro` and `Default Intro` at various times: cleaned in place.
- `Default Intro` at frame 0: split into `Default` @0 and `Intro` @1.
- Footage and precomp layers at 0: everything shifts, keyframes stay in sync, non-footage layers and parent nulls move too.
- Overflow with Extend, Trim and each marker option.
- Nested and shared precomps processed once, children first.
- Second run produces no additional shift.
- Markers with duration and other data keep their full `MarkerValue`.
- Hidden precomps listed and selected on row click.
