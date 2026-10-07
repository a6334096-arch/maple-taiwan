# Geographic map provenance

Coastline: Natural Earth v5.1.1, 1:10m Admin 0 countries, Taiwan geometry.
https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/
https://naturalearth.s3.amazonaws.com/10m_cultural/ne_10m_admin_0_countries.zip
Public domain: https://www.naturalearthdata.com/about/terms-of-use/

WGS84 input, north-up Web Mercator projection with a uniform scale. Viewport
covers the main island and nearby islands, including Penghu, Green Island and
Orchid Island; this is not a nationwide offshore-island atlas.
Each attraction has its own official coordinate_source_url and scope. Trail
pins are official trail entrances, not inferred trail summits. Coordinates are
representative locations, not hiking routes. scripts/generate-map.py regenerates
both the coastline and attraction positions using the same projection.

Directory selection includes the full verified Forestry and Nature Conservation
Agency “全台賞楓” recommendation list, plus other official tourism maple entries.
https://recreation.forest.gov.tw/Topic/Topic?region=ALL&word=%E8%B3%9E%E6%A5%93
There is no claim that every individual maple tree or private garden is listed.
