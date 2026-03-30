#!/usr/bin/env python3
from pypdf import PdfReader
import re

pdf_path = r'C:\Users\charlescoffie\OneDrive - Ghana Methodist church of Toronto\MINISTRY\CONSTITUTION\2022_Constitution_ocr.pdf'
reader = PdfReader(pdf_path)

# Search for full SO 71, 72, 73 sections
full_text = ''
for page in reader.pages:
    full_text += '\n' + (page.extract_text() or '')

print('Searching for complete SO 71, 72, 73 sections with body text...\n')
print('='*80 + '\n')

# Look for SO 71
so71_match = re.search(r'S\.O\.?\s*71[^\d].*?(?=S\.O\.?\s*7[2-9]|S\.O\.?\s*\d{3}|$)', full_text, re.DOTALL | re.IGNORECASE)
if so71_match:
    so71_text = so71_match.group(0).strip()
    print(f'SO 71 FOUND ({len(so71_text)} chars):\n')
    print(so71_text[:1000])
    if len(so71_text) > 1000:
        print(f'\n... ({len(so71_text) - 1000} more chars)')
else:
    print('SO 71: NOT FOUND\n')

print('\n' + '='*80 + '\n')

# Look for SO 72
so72_match = re.search(r'S\.O\.?\s*72[^\d].*?(?=S\.O\.?\s*7[3-9]|S\.O\.?\s*\d{3}|$)', full_text, re.DOTALL | re.IGNORECASE)
if so72_match:
    so72_text = so72_match.group(0).strip()
    print(f'SO 72 FOUND ({len(so72_text)} chars):\n')
    print(so72_text[:1000])
    if len(so72_text) > 1000:
        print(f'\n... ({len(so72_text) - 1000} more chars)')
else:
    print('SO 72: NOT FOUND\n')

print('\n' + '='*80 + '\n')

# Look for SO 73
so73_match = re.search(r'S\.O\.?\s*73[^\d].*?(?=S\.O\.?\s*7[4-9]|S\.O\.?\s*\d{3}|$)', full_text, re.DOTALL | re.IGNORECASE)
if so73_match:
    so73_text = so73_match.group(0).strip()
    print(f'SO 73 FOUND ({len(so73_text)} chars):\n')
    print(so73_text[:1000])
    if len(so73_text) > 1000:
        print(f'\n... ({len(so73_text) - 1000} more chars)')
else:
    print('SO 73: NOT FOUND\n')
