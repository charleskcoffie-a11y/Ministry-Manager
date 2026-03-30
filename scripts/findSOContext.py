#!/usr/bin/env python3
from pypdf import PdfReader

pdf_path = r'C:\Users\charlescoffie\OneDrive - Ghana Methodist church of Toronto\MINISTRY\CONSTITUTION\2022_Constitution_ocr.pdf'
reader = PdfReader(pdf_path)

full_text = ''
for page in reader.pages:
    full_text += (page.extract_text() or '')

print('Looking for SO 71, 72, 73 in PDF...\n')

# Find context around 71, 72, 73
for so_num in [71, 72, 73]:
    # Simple substring search - look for any occurrence
    search_str = str(so_num)
    idx = 0
    count = 0
    
    print(f'\n{"="*80}')
    print(f'Searching for "{search_str}" (SO {so_num})...')
    print(f'{"="*80}\n')
    
    while True:
        idx = full_text.find(search_str, idx)
        if idx < 0:
            break
        
        count += 1
        start = max(0, idx - 100)
        end = min(len(full_text), idx + 300)
        context = full_text[start:end].replace('\n', ' ')
        
        print(f'Match {count} at position {idx}:')
        print(f'...{context}...\n')
        
        idx += 1
        if count >= 5:  # Show first 5 matches
            break
    
    if count == 0:
        print(f'No occurrences found\n')
