import json
from pathlib import Path

d = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding='utf-8-sig'))
code = d['files']['code']
doc = d['files']['doc']
image = d['files']['image']

# Non-code files for semantic extraction
non_code = doc + image
print(f'Code: {len(code)} files (AST handles these)')
print(f'Doc: {len(doc)} files')
print(f'Image: {len(image)} files')
print(f'Non-code total: {len(non_code)} files need semantic extraction')
print(f'Chunks needed: {-(-len(non_code) // 22)}')

# Write non-code file list for chunking
for i, f in enumerate(non_code):
    bn = Path(f).name
    print(f'  {i+1}. {bn}')
