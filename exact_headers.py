import urllib.request, re, json

chunk_url = 'https://smt.nhso.go.th/smtf/2153.fe2a1dd64a0e8426.js'
r = urllib.request.Request(chunk_url, headers={'User-Agent': 'Mozilla/5.0'})
raw = urllib.request.urlopen(r, timeout=15).read()
text = raw.decode('utf-8')

# Search for getTableHeader and getTabelCell
idx_header = text.find('case"h1":')
idx_cell = text.find('getTabelCell(')

header_code = text[idx_header-50:idx_cell]
cell_code = text[idx_cell:idx_cell+1500]

print('--- TABLE HEADERS (case h1..hn) ---')
# parse case "hX": return "..."
for m in re.finditer(r'case"([^"]+)":return"([^"]+)"', header_code):
    col_id = m.group(1)
    val = m.group(2).encode('utf-8').decode('unicode-escape')
    print(f'{col_id}: {val}')

print('\n--- TABLE CELLS (case d1..dn) ---')
for m in re.finditer(r'case"([^"]+)":return ([^;]+);', cell_code):
    cell_id = m.group(1)
    expr = m.group(2)
    print(f'{cell_id}: {expr}')
