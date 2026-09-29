import urllib.request, re

chunk_url = 'https://smt.nhso.go.th/smtf/2153.fe2a1dd64a0e8426.js'
r = urllib.request.Request(chunk_url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(r, timeout=15) as resp:
    content = resp.read().decode('utf-8', errors='ignore')

print('Chunk size:', len(content))
# Find table headers or labels in this chunk
# In Angular templates, look for i18n or text strings like '<th>', 'p-table', 'th'
for m in re.finditer(r'<th[^>]*>(.*?)</th>', content):
    print('TH tag:', m.group(0))

# Or search for Thai characters
thai_matches = re.findall(r'[\u0E00-\u0E7F]{2,}', content)
print('Unique Thai words count:', len(set(thai_matches)))
for word in set(thai_matches):
    if len(word) > 4:
        print('Thai word:', word)
