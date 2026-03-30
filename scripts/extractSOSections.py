#!/usr/bin/env python3
from pypdf import PdfReader
import re

pdf_path = r'C:\Users\charlescoffie\OneDrive - Ghana Methodist church of Toronto\MINISTRY\CONSTITUTION\2022_Constitution_ocr.pdf'
reader = PdfReader(pdf_path)

full_text = ''
for page in reader.pages:
    full_text += (page.extract_text() or '')

print('Extracting complete SO 71, 72, 73 sections...\n')
print('='*80 + '\n')

# Find SO 71 - starts with "71. " and ends before "72."
so71_start = full_text.find('71. (1) (2) (3) (4) 72.')
if so71_start < 0:
    so71_start = full_text.find('71.\n')
if so71_start < 0:
    so71_start = full_text.find('71.')

if so71_start >= 0:
    # Back up to find the actual start
    line_start = full_text.rfind('\n', 0, so71_start)
    if line_start < 0:
        line_start = 0
    
    # Find where 72 starts
    so72_start = full_text.find('72.', so71_start)
    if so72_start < 0:
        so72_start = so71_start + 1000
    
    so71_section = full_text[line_start:so72_start].strip()
    
    print('SO 71 FOUND:\n')
    print(so71_section[:1500])
    if len(so71_section) > 1500:
        print(f'\n... ({len(so71_section) - 1500} more chars)')
else:
    print('SO 71: NOT FOUND')

print('\n' + '='*80 + '\n')

# Find SO 72 - look for pattern "72. " and get until "73."
so72_pattern = re.search(r'72\.\s*\(?\d?\)?[^\d]*?(?=73\.)', full_text, re.DOTALL)
if so72_pattern:
    so72_section = so72_pattern.group(0).strip()
    print('SO 72 FOUND:\n')
    print(so72_section[:1500])
    if len(so72_section) > 1500:
        print(f'\n... ({len(so72_section) - 1500} more chars)')
else:
    print('SO 72: NOT FOUND')

print('\n' + '='*80 + '\n')

# Find SO 73 - look for pattern "73. " and get substantial content
so73_start = full_text.find('73.')
if so73_start >= 0:
    # Get next 2000 chars or until next numbered section
    end_search = so73_start + 2000
    so74_start = full_text.find('74.', so73_start)
    if so74_start > 0 and so74_start < end_search:
        end_search = so74_start
    else:
        # Look for pattern like "N. Leaders"
        next_section = re.search(r'\n\d+\.\s+[A-Z]', full_text[so73_start+10:])
        if next_section:
            end_search = so73_start + 10 + next_section.start()
    
    so73_section = full_text[so73_start:end_search].strip()
    print('SO 73 FOUND:\n')
    print(so73_section[:1500])
    if len(so73_section) > 1500:
        print(f'\n... ({len(so73_section) - 1500} more chars)')
else:
    print('SO 73: NOT FOUND')
