#!/usr/bin/env python3
from pypdf import PdfReader
import re

pdf_path = r'C:\Users\charlescoffie\OneDrive - Ghana Methodist church of Toronto\MINISTRY\CONSTITUTION\2022_Constitution_ocr.pdf'
reader = PdfReader(pdf_path)

# Search for SO patterns
so_patterns = [
    r'S\.O\.?\s*72',
    r'SO\s*72',
    r'Standing Order[s]?\s+72',
    r'S\.O\.?\s*73',
    r'SO\s*73', 
    r'Standing Order[s]?\s+73',
]

print('Searching for SO 72 and SO 73 with context...\n')

for page_num, page in enumerate(reader.pages, 1):
    text = page.extract_text() or ''
    
    for pattern in so_patterns:
        matches = list(re.finditer(pattern, text, re.IGNORECASE | re.DOTALL))
        if matches:
            for match in matches:
                start = max(0, match.start() - 80)
                end = min(len(text), match.end() + 150)
                context = text[start:end].replace('\n', ' ')
                print(f'Page {page_num} - Pattern "{pattern}":')
                print(f'  ...{context}...\n')

print('\n' + '='*80)
print('SUMMARY: Checking if SO 72 and 73 have substantial body text')
print('='*80 + '\n')

# Get all text and search for commission/probation sections
full_text = ''
for page in reader.pages:
    full_text += '\n' + (page.extract_text() or '')

# Look for "Commissioning" and "Probation" sections
if 'Commissioning' in full_text:
    idx = full_text.find('Commissioning')
    print(f'Found "Commissioning" at position {idx}:')
    print(f'Context: ...{full_text[max(0, idx-50):idx+300]}...\n')
else:
    print('No "Commissioning" section found in Constitution PDF\n')

if 'Probation' in full_text:
    idx = full_text.find('Probation')
    print(f'Found "Probation" at position {idx}:')
    print(f'Context: ...{full_text[max(0, idx-50):idx+300]}...\n')
else:
    print('No "Probation" section found in Constitution PDF\n')
