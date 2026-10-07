"""Generate the geographic SVG from the committed Natural Earth WGS84 geometry.
Web Mercator, north up; identical projection for coast, cities and attraction pins.
Run from repository root. No third-party runtime dependency.
"""
import json,math,re
from pathlib import Path
merc=lambda lat:math.log(math.tan(math.pi/4+math.radians(lat)/2))
def project(lon,lat):return 400+10000*math.radians(lon-121),450-10000*(merc(lat)-merc(23.65))
g=json.loads(Path('data/taiwan-coastline.geojson').read_text())
paths=[]
for polygon in g['coordinates']:
 d=' '.join('M'+'L'.join(f'{x:.2f},{y:.2f}' for x,y in map(lambda p:project(*p),ring))+'Z' for ring in polygon)
 paths.append(f'<path class="island" d="{d}"/>')
cities=[('臺北',121.5654,25.0330,18,-6),('臺中',120.6736,24.1477,-43,5),('高雄',120.3014,22.6273,-43,5),('花蓮',121.6068,23.9911,12,5),('臺東',121.1500,22.7554,12,5),('澎湖',119.5662,23.5655,-30,25)]
labels=[]
for name,lon,lat,dx,dy in cities:
 x,y=project(lon,lat);labels.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="2"/><text x="{x+dx:.2f}" y="{y+dy:.2f}">{name}</text>')
world='<text x="610" y="530" class="sea">太 平 洋</text><text x="85" y="340" class="sea">台 灣 海 峽</text><g class="coastline" fill="#f9f8ef" stroke="#b6c5b1" stroke-width="1.5" stroke-linejoin="round">'+''.join(paths)+'</g><g class="city-label">'+''.join(labels)+'</g><g id="markers"></g>'
p=Path('web/index.html');s=p.read_text();s=re.sub(r'<g id="map-world">.*?</g></svg>',lambda _: '<g id="map-world">'+world+'</g></svg>',s,count=1);p.write_text(s)
places=json.loads(Path('web/places.json').read_text())
for p in places:p['x'],p['y']=[round(n,3) for n in project(p['lon'],p['lat'])]
Path('web/places.json').write_text(json.dumps(places,ensure_ascii=False,indent=2)+'\n')
print('Generated geographic coastline and projected',len(places),'pins.')
