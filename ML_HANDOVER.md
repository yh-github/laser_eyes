# Big Mouth: ML Research Handover

## 1. Project Objective
Achieve **F1 Score >= 95%** for real-time mouth openness detection.
The current geometric baseline is hitting ~70% due to head-pose distortion and baseline drift. We need a robust model that can distinguish "Mouth Open" from "Mouth Closed" across diverse users and mobile environments.

## 2. Constraints
- **Real-time Performance**: The final model must run in a web browser on a mobile device (iPhone/Android) at 30+ FPS.
- **Dependency**: The model will receive raw 2D landmarks from `clmtrackr` (via WebGazer). It cannot request a new heavy model like MediaPipe FaceMesh if performance suffers.
- **Input**: 22 mouth landmarks + 7 reference face landmarks (see `DATA_SPECIFICATION.md`).

## 3. Data Access
The dataset is hosted on Hugging Face:
- **Repo**: [huggingface.co/datasets/Y3/mouth_status](https://huggingface.co/datasets/Y3/mouth_status)
- **Download**: 
  ```bash
  git clone https://huggingface.co/datasets/Y3/mouth_status
  ```
- **Specification**: Refer to `README.md` (or `DATA_SPECIFICATION.md`) in the repo for the mapping of the `mr` and `rr` flat arrays.

## 4. Key Challenges to Solve
- **Pitch/Tilt Invariance**: As the head tilts down, the mouth's vertical distance foreshortens. The model must use the reference points (`rr`) to normalize this.
- **Baseline Drift**: Users may move closer/further from the camera. The model should ideally be "Self-Normalizing" or use relative geometric ratios.
- **False Positive Suppression**: Talking or smiling should not trigger an "Open" state.

## 5. Deliverables
- A lightweight inference function (Javascript/Tensorflow.js) that takes the raw points and returns a probability `0.0 - 1.0`.
- The optimal thresholds for "Open" and "Closed" triggers.
