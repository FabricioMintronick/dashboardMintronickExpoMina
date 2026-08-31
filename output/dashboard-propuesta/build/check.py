import json,pathlib
p=pathlib.Path('output/dashboard-propuesta/build/renders')
for f in sorted(p.glob('*.json')):
 d=json.loads(f.read_text(encoding='utf-8')); bad=[]
 for e in d.get('elements',[]):
  b=e.get('bbox');
  if b and (b[0]<0 or b[1]<0 or b[0]+b[2]>1280.5 or b[1]+b[3]>720.5):bad.append(e.get('name'))
 if bad:print(f.name,bad)
print('Canvas checks complete')
