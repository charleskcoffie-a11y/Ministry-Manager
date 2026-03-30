#!/usr/bin/env python3
from pypdf import PdfReader

pdf_path = r'C:\Users\charlescoffie\OneDrive - Ghana Methodist church of Toronto\MINISTRY\CONSTITUTION\2022_Constitution_ocr.pdf'
reader = PdfReader(pdf_path)

full_text = ''
for page in reader.pages:
    full_text += '\n' + (page.extract_text() or '')

# Find Commissioning section
comm_idx = full_text.find('Commissioning')
if comm_idx >= 0:
    # Extract from 'Commissioning' to next major section
    end_idx = full_text.find('\n\nProbation', comm_idx)
    if end_idx < 0:
        end_idx = comm_idx + 1000
    commissioning_text = full_text[comm_idx:end_idx].strip()
    print('=== COMMISSIONING SECTION ===\n')
    print(commissioning_text)
    print(f'\n\nTotal: {len(commissioning_text)} chars\n')

print('\n' + '='*80 + '\n')

# Find Probation section  
prob_idx = full_text.find('Probation')
if prob_idx >= 0:
    end_idx = full_text.find('\n\n', prob_idx + 100)
    if end_idx < 0:
        end_idx = prob_idx + 1000
    probation_text = full_text[prob_idx:end_idx].strip()
    print('=== PROBATION SECTION ===\n')
    print(probation_text)
    print(f'\n\nTotal: {len(probation_text)} chars')
