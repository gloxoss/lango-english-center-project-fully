import json
from graphify.detect import detect
from pathlib import Path
result = detect(Path(r'd:\Users\zakio\Desktop\Lango english center project fully'))
print(json.dumps(result, ensure_ascii=False))
