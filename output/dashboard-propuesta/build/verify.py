import zipfile,pathlib,json
from lxml import etree
z=zipfile.ZipFile(r'C:/Users/JoanPerez/Desktop/MINTRONICK DOCUMENTOS/capturas dashboard.docx')
r=etree.fromstring(z.read('word/_rels/document.xml.rels')); m={x.get('Id'):x.get('Target') for x in r}
d=etree.fromstring(z.read('word/document.xml'))
ids=d.xpath('//*[local-name()="blip"]/@*[local-name()="embed"]')
print('Document order:',[m[x] for x in ids])
p=pathlib.Path('output/dashboard-propuesta')
z=zipfile.ZipFile(p/'MINTRONICK_propuesta_dashboard.pptx')
slides=[n for n in z.namelist() if n.startswith('ppt/slides/slide') and n.endswith('.xml')]
notes=[n for n in z.namelist() if n.startswith('ppt/notesSlides/notesSlide') and n.endswith('.xml')]
print('Slides',len(slides),'Notes',len(notes),'Size MB',round((p/'MINTRONICK_propuesta_dashboard.pptx').stat().st_size/1e6,1))
print('Broken zip member',z.testzip())
