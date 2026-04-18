import requests
import json
import os

# Load token from local auth.json (gitmanaged via .gitignore)
def get_token():
    try:
        with open('auth.json') as f:
            return json.load(f).get('hf_token')
    except:
        return None

TOKEN = get_token()
REPO = "Y3/mouth_status"

def check_repo():
    print(f"Checking Hugging Face Repository: {REPO}...")
    
    # Check Raw Data
    raw_url = f"https://huggingface.co/api/datasets/{REPO}/tree/main/data/raw"
    headers = {"Authorization": f"Bearer {TOKEN}"}
    
    try:
        response = requests.get(raw_url, headers=headers)
        if response.status_code == 200:
            files = response.json()
            raw_files = [f for f in files if f['type'] == 'file' and f['path'].endswith('.json')]
            print(f"✅ Found {len(raw_files)} raw datasets (.json)")
            # Sort by name descending (latest first)
            raw_files.sort(key=lambda x: x['path'], reverse=True)
            for f in raw_files[:10]: # Show latest 10
                print(f"  - {os.path.basename(f['path'])}")
            if len(raw_files) > 10:
                print(f"  ... and {len(raw_files) - 10} more.")
        else:
            print(f"❌ Failed to access raw data (HTTP {response.status_code})")
            if response.status_code == 404:
                print("   Note: The 'data/raw' directory might not exist yet if no uploads have occurred.")

        # Check Aggregated Data
        agg_url = f"https://huggingface.co/api/datasets/{REPO}/tree/main/data/agg"
        response = requests.get(agg_url, headers=headers)
        if response.status_code == 200:
            files = response.json()
            agg_files = [f for f in files if f['type'] == 'file' and f['path'].endswith('.json')]
            print(f"\n✅ Found {len(agg_files)} aggregated results")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    check_repo()
