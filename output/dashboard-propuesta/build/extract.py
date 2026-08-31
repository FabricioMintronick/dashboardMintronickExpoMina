import zipfile, pathlib, json
from lxml import etree
from PIL import Image,ImageOps,ImageDraw
p=pathlib.Path('output/dashboard-propuesta/build'); z=zipfile.ZipFile(r'C:/Users/JoanPerez/Desktop/MINTRONICK DOCUMENTOS/capturas dashboard.docx')
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
r=etree.fromstring(z.read('word/document.xml'))
text='\n'.join(''.join(el.itertext()) for el in [])
paras=[''.join(el.xpath('.//w:t/text()',namespaces=ns)) for el in r.xpath('//w:p',namespaces=ns)]
(p/'document-text.txt').write_text('\n'.join(paras),encoding='utf-8')
images=[]
for n in z.namelist():
 if n.startswith('word/media/'):
  f=p/pathlib.Path(n).name;f.write_bytes(z.read(n));images.append(f)
print('\n'.join(paras)); print('IMAGES',len(images))
thumbs=[]
for f in images:
 try:
  im=Image.open(f).convert('RGB');print(f.name, im.size)
  im.thumbnail((480,270)); tile=Image.new('RGB',(500,305),'white');tile.paste(im,(10,25));ImageDraw.Draw(tile).text((10,5),f.name,fill='black');thumbs.append(tile)
 except: pass
montage=Image.new('RGB',(1500,305*((len(thumbs)+2)//3)), '#cccccc')
for i,t in enumerate(thumbs):montage.paste(t,((i%3)*500,(i//3)*305))
montage.save(p/'source-montage.jpg')
