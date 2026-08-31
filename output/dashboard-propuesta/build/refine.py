import pathlib
p=pathlib.Path('output/dashboard-propuesta/build/build.mjs')
s=p.read_text(encoding='utf-8')
s=s.replace("s=slide('Velocidad: subir no siempre es peligroso');", "tx(s,'Color + etiqueta + icono. Detenido no significa Crítico.',48,631,1184,32,22,C.muted);\ns=slide('Velocidad: subir no siempre es peligroso');")
p.write_text(s,encoding='utf-8')
