# Big Mouth: Research Dataset Specification (v1.2)

This dataset is designed for training and optimizing facial mouth-tracking algorithms. It contains raw geometry and ground-truth labels for "Mouth Open" vs "Mouth Closed" states.

## File Structure
- `metadata`: Session-wide calibration baselines and device info.
- `records`: Array of frame data captured at ~30-60 FPS.

## Frame Record Mapping (`records`)
To save space, the following shorthand keys are used:

| Key | Description | Data Type |
|-----|-------------|-----------|
| `t` | Relative Timestamp | Integer (ms) |
| `truth` | Ground Truth Label | Boolean (Target State) |
| `m` | Pre-computed Metrics | Object (normalized 0.0-1.0) |
| `mr` | **Mouth Raw Points** | Flat Float Array `[x, y, x, y, ...]` |
| `rr` | **Reference Points** | Flat Float Array `[x, y, x, y, ...]` |

### Landmark Indexing (clmtrackr Model)
Coordinates are in **Camera Pixels** (default 640x480).

#### `mr` (Mouth Raw): Indices 44 to 65
This array contains 22 points (44 floats). 
- **Corners**: Index 0,1 (Point 44) and Index 12,13 (Point 50).
- **Upper Inner Lip**: Index 32,33 (Point 60).
- **Lower Inner Lip**: Index 26,27 (Point 57).

#### `rr` (Reference Raw): Key Pose Landmarks
Used for scaling and head-angle compensation.
- **Indices**: `[1, 7, 13, 27, 32, 33, 62]`
- `62`: Nose Tip (Anchor)
- `27, 32`: Left/Right Eye Centers
- `1, 13`: Face Left/Right Edges
- `7, 33`: Chin Bottom / Forehead Top

## Normalization Logic
To calculate a baseline-independent Mouth Aspect Ratio (MAR):
```javascript
width = dist(p44, p50)
height = dist(p60, p57)
MAR = height / width
```

## Pitch Compensation
Use `m.pitchDelta` to compensate for foreshortening. 
`Adjusted_MAR = MAR * (1.0 + abs(pitchDelta) * 1.2)`
