#!/usr/bin/env python3
from pypdf import PdfReader

pdf_path = r'C:\Users\charlescoffie\OneDrive - Ghana Methodist church of Toronto\MINISTRY\CONSTITUTION\2022_Constitution_ocr.pdf'
reader = PdfReader(pdf_path)

# Look at pages 59-63 to find full SO 71, 72, 73 context
for page_num in range(58, 63):
    if page_num < len(reader.pages):
        page = reader.pages[page_num]
        text = page.extract_text() or ''
        print(f'\n{"="*80}')
        print(f'PAGE {page_num + 1}')
        print(f'{"="*80}\n')
        print(text)
