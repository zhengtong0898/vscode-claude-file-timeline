import requests
import json
import  os

PORT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".claude-port")
with open(PORT_FILE) as f:
    PORT = int(f.read().strip())
BASE = f"http://127.0.0.1:{PORT}"

session = requests.Session()
session.trust_env = False

TEST_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sync_timeline_test.txt")

# Create test file
with open(TEST_FILE, "w", encoding="utf-8") as f:
    f.write("Hello, this is the initial content. 6\n")
print(f"Created: {TEST_FILE}")

# First sync
print("\n--- Sync 1: Initial Open ---")
r = session.post(f"{BASE}/sync", json={"files": [TEST_FILE], "label": "Initial Open"})
print(json.dumps(r.json(), indent=2))

