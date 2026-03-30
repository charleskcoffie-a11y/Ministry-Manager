#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const url = 'https://wtvnyyfxjefuprcntjta.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0dm55eWZ4amVmdXByY250anRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjY5NjUsImV4cCI6MjA4MDgwMjk2NX0.O569-gYigdB84xmjOTicMU2aSghDYm2ItPjl8EPmOm8';
const supabase = createClient(url, key);

(async () => {
  const { data } = await supabase
    .from('uploaded_documents')
    .select('*')
    .eq('id', 'standing_orders_draft')
    .single();

  const soPattern = /S\.O\.?\s*(\d+)/gi;
  const foundSOs = new Set();

  // Find all SO references
  data.content.forEach(item => {
    const matches = item.text.matchAll(soPattern);
    for (const match of matches) {
      foundSOs.add(parseInt(match[1]));
    }
  });

  const sortedSOs = Array.from(foundSOs).sort((a, b) => a - b);
  
  console.log('Standing Order numbers found in OCR Constitution PDF:\n');
  console.log(sortedSOs.join(', '));
  
  console.log(`\n\nTotal unique SO references: ${sortedSOs.length}`);
  console.log(`Range: SO ${sortedSOs[0]} to SO ${sortedSOs[sortedSOs.length - 1]}`);

  // Find gaps
  console.log('\n\nGaps (missing SO numbers):');
  const gaps = [];
  for (let i = 1; i <= 251; i++) {
    if (!foundSOs.has(i)) {
      gaps.push(i);
    }
  }

  if (gaps.length === 0) {
    console.log('✓ No gaps found - all SO 1-251 are referenced!');
  } else {
    console.log(`Found ${gaps.length} missing SO numbers:\n`);
    
    // Show gaps in ranges
    let rangeStart = gaps[0];
    let rangeEnd = gaps[0];
    
    for (let i = 1; i <= gaps.length; i++) {
      if (i < gaps.length && gaps[i] === rangeEnd + 1) {
        rangeEnd = gaps[i];
      } else {
        if (rangeStart === rangeEnd) {
          console.log(`  SO ${rangeStart}`);
        } else {
          console.log(`  SO ${rangeStart}-${rangeEnd}`);
        }
        if (i < gaps.length) {
          rangeStart = gaps[i];
          rangeEnd = gaps[i];
        }
      }
    }
  }

})();
