#!/usr/bin/env python3
from pypdf import PdfReader
import re

pdf_path = r'C:\Users\charlescoffie\OneDrive - Ghana Methodist church of Toronto\MINISTRY\CONSTITUTION\2022_Constitution_ocr.pdf'
reader = PdfReader(pdf_path)

full_text = ''
for page in reader.pages:
    full_text += '\n' + (page.extract_text() or '')

print('Searching for the FULL text of SO 71, 72, 73...\n')

# Find which pages mention these SO numbers
for so_num in [71, 72, 73]:
    # Find page with the full standing order heading
    pattern = f'(?:^|\n)S\.O\.?\s*{so_num}(?:\s*–|\\s*\\()'
    match = re.search(pattern, full_text, re.IGNORECASE | re.MULTILINE)
    
    if match:
        start_pos = match.start()
        # Find next SO number after this one
        next_so_pattern = f'S\.O\.?\s*(?:{so_num + 1}|{so_num + 2}|{so_num + 3}|[0-9]{{3}})'
        next_match = re.search(next_so_pattern, full_text[start_pos + 10:], re.IGNORECASE)
        
        if next_match:
            end_pos = start_pos + 10 + next_match.start()
        else:
            end_pos = min(start_pos + 5000, len(full_text))
        
        so_content = full_text[start_pos:end_pos].strip()
        
        print(f'\n{"="*80}')
        print(f'SO {so_num} ({len(so_content)} chars):')
        print(f'{"="*80}\n')
        print(so_content[:1500])
        if len(so_content) > 1500:
            print(f'\n... ({len(so_content) - 1500} more chars)')
    else:
        print(f'\n{"="*80}')
        print(f'SO {so_num}: NOT FOUND IN PDF')
        print(f'{"="*80}')
