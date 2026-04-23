import json
import os
import glob
import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import f1_score, classification_report, confusion_matrix

def load_data(data_path):
    all_records = []
    json_files = glob.glob(os.path.join(data_path, "raw", "*.json"))
    
    print(f"Found {len(json_files)} JSON files.")
    
    for file_path in json_files:
        with open(file_path, 'r') as f:
            data = json.load(f)
            records = data.get('records', [])
            
            # Metadata baselines can be used for normalization too
            metadata = data.get('metadata', {})
            baselines = metadata.get('baselines', {})
            
            for rec in records:
                # Features: 
                # 1. mr (44 floats)
                # 2. rr (14 floats)
                # 3. m (metrics)
                
                mr = np.array(rec['mr'])
                rr = np.array(rec['rr'])
                metrics = rec['m']
                
                # Normalization
                # Use Nose Tip (Point 62, which is the last point in rr)
                nose_x = rr[12]
                nose_y = rr[13]
                
                # Calculate scale: Nose to Chin (Point 7 is 2nd point in rr)
                chin_x = rr[2]
                chin_y = rr[3]
                scale = np.sqrt((nose_x - chin_x)**2 + (nose_y - chin_y)**2)
                
                if scale == 0:
                    scale = 1.0
                
                # 4. Explicit Geometric Features
                # Corners: Point 44 (0) and Point 50 (6)
                p44 = mr[0:2]
                p50 = mr[12:14]
                # Inner Lips: Point 60 (16) and Point 57 (13)
                p60 = mr[32:34]
                p57 = mr[26:28]
                
                m_width = np.sqrt(np.sum((p44 - p50)**2))
                m_height = np.sqrt(np.sum((p60 - p57)**2))
                mar = m_height / m_width if m_width > 0 else 0
                
                # Normalize mr
                mr_norm = []
                for i in range(0, len(mr), 2):
                    mr_norm.append((mr[i] - nose_x) / scale)
                    mr_norm.append((mr[i+1] - nose_y) / scale)
                
                # Combine features
                features = mr_norm + [mar]
                # Add pre-computed metrics
                features.append(metrics.get('pitchDelta', 0))
                features.append(metrics.get('marScore', 0))
                features.append(metrics.get('yawFactor', 0))
                features.append(metrics.get('areaScore', 0))
                
                all_records.append({
                    'features': features,
                    'label': 1 if rec['truth'] else 0
                })
                
    return all_records

def train():
    data_path = "mouth_status/data"
    json_files = sorted(glob.glob(os.path.join(data_path, "raw", "*.json")))
    
    if not json_files:
        print("No files found!")
        return

    all_file_data = []
    for f_path in json_files:
        with open(f_path, 'r') as f:
            data = json.load(f)
            records = data.get('records', [])
            
            file_records = []
            seen_mr = set()
            for rec in records:
                mr_tuple = tuple(rec['mr'])
                if mr_tuple in seen_mr:
                    continue
                seen_mr.add(mr_tuple)
                
                # Feature engineering (reusing logic from before)
                mr = np.array(rec['mr'])
                rr = np.array(rec['rr'])
                metrics = rec['m']
                nose_x, nose_y = rr[12], rr[13]
                chin_x, chin_y = rr[2], rr[3]
                scale = np.sqrt((nose_x - chin_x)**2 + (nose_y - chin_y)**2) or 1.0
                
                # Geometric features
                p44, p50 = mr[0:2], mr[12:14]
                p60, p57 = mr[32:34], mr[26:28]
                mar = np.sqrt(np.sum((p60 - p57)**2)) / (np.sqrt(np.sum((p44 - p50)**2)) or 1.0)
                
                mr_norm = []
                for i in range(0, len(mr), 2):
                    mr_norm.append((mr[i] - nose_x) / scale)
                    mr_norm.append((mr[i+1] - nose_y) / scale)
                
                features = mr_norm + [mar]
                features.extend([metrics.get(k, 0) for k in ['pitchDelta', 'marScore', 'yawFactor', 'areaScore']])
                
                file_records.append({
                    'features': features,
                    'label': 1 if rec['truth'] else 0
                })
            all_file_data.append(file_records)
            print(f"File {os.path.basename(f_path)}: {len(file_records)} unique records")

    # Leave-one-file-out CV
    f1_scores = []
    for i in range(len(all_file_data)):
        test_records = all_file_data[i]
        train_records = [rec for j, file_recs in enumerate(all_file_data) if i != j for rec in file_recs]
        
        X_train = np.stack([r['features'] for r in train_records])
        y_train = np.array([r['label'] for r in train_records])
        X_test = np.stack([r['features'] for r in test_records])
        y_test = np.array([r['label'] for r in test_records])
        
        model = xgb.XGBClassifier(n_estimators=100, max_depth=4, learning_rate=0.1, random_state=42)
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        
        score = f1_score(y_test, y_pred)
        f1_scores.append(score)
        print(f"Fold {i} (Test on {os.path.basename(json_files[i])}): F1 = {score:.4f}")

    print(f"\nAverage F1 Score across files: {np.mean(f1_scores):.4f}")

    # Final model on all data
    print("\nTraining final model on all unique data...")
    all_recs = [rec for file_recs in all_file_data for rec in file_recs]
    X_final = np.stack([r['features'] for r in all_recs])
    y_final = np.array([r['label'] for r in all_recs])
    final_model = xgb.XGBClassifier(n_estimators=150, max_depth=5, learning_rate=0.05, random_state=42)
    final_model.fit(X_final, y_final)
    final_model.save_model("mouth_baseline.json")
    print("Final model saved to mouth_baseline.json")


if __name__ == "__main__":
    train()
