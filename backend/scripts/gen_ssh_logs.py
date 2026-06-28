import json
import random
import time
from datetime import datetime

IPS = ["192.168.1.10","203.0.113.5","198.51.100.42","8.8.8.8","1.1.1.1"]
USERS = ["root","admin","user","test"]

if __name__ == "__main__":
    for i in range(10):
        rec = {
            "ts": datetime.utcnow().isoformat(),
            "source": "ssh",
            "ip": random.choice(IPS),
            "user": random.choice(USERS),
            "status": random.choice(["fail","fail","fail","success"]),
        }
        print(json.dumps(rec))
        time.sleep(0.5)
