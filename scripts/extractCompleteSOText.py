#!/usr/bin/env python3
from pypdf import PdfReader
import re

pdf_path = r'C:\Users\charlescoffie\OneDrive - Ghana Methodist church of Toronto\MINISTRY\CONSTITUTION\2022_Constitution_ocr.pdf'
reader = PdfReader(pdf_path)

full_text = ''
for page in reader.pages:
    full_text += (page.extract_text() or '')

# Find SO 71, 72, 73 sections
results = {}

# SO 71
so71_idx = full_text.find('71. (1) (2) (3) (4) 72.')
if so71_idx >= 0:
    # Extract backwards to find heading
    line_start = full_text.rfind('\n', max(0, so71_idx - 200), so71_idx)
    so72_idx = so71_idx + len('71. (1) (2) (3) (4) 72.')
    results['71'] = full_text[so71_idx:so72_idx].strip()
else:
    results['71'] = None

# SO 72
so72_search = full_text.find('72. (1) (2) (3) (4) 73.')
if so72_search >= 0:
    so72_start = so72_search
    so73_idx = so72_search + len('72. (1) (2) (3) (4) 73.')
    results['72'] = full_text[so72_start:so73_idx].strip()
else:
    results['72'] = None

# SO 73 - get full section
so73_idx = full_text.find('73.\n(1)')
if so73_idx >= 0:
    # Find next major section (74 or next paragraph)
    so74_idx = full_text.find('\n74.', so73_idx + 10)
    if so74_idx < 0:
        # Look for pattern indicating next section
        so74_idx = full_text.find('Ministers Becoming Members of Synod', so73_idx)
    if so74_idx < 0:
        so74_idx = so73_idx + 3500
    
    results['73'] = full_text[so73_idx:so74_idx].strip()
else:
    results['73'] = None

# Print results
for so_num in [71, 72, 73]:
    print(f'<=== SO {so_num} ===> ')
    if results[str(so_num)]:
        text = results[str(so_num)]
        print(f'Length: {len(text)} chars\n')
        print(text)
    else:
        print('NOT FOUND')
    print('\n' + '='*80 + '\n')
