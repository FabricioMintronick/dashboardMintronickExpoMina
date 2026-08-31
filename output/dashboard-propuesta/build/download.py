import urllib.request,pathlib
p=pathlib.Path('output/dashboard-propuesta/build')
urls={'cat-ui.jpg':'https://s7d2.scene7.com/is/image/Caterpillar/CM20250821-b551b-c9afd?wid=1800&qlt=90','cat-fleet.jpg':'https://s7d2.scene7.com/is/image/Caterpillar/CM20230519-88da0-b28c7?wid=1800&qlt=90','hexagon.pdf':'https://ichs-p-001.sitecorecontenthub.cloud/api/public/content/op-pro-brochure?v=13e46f34'}
for name,u in urls.items():
 try:
  urllib.request.urlretrieve(u,p/name);print(name,'ok')
 except Exception as e:print(name,str(e))

