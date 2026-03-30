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

  console.log('Analyzing OCR Constitution PDF content...\n');
  console.log('Total items in OCR draft: ' + data.content.length + '\n');
  
  // Find all with short content (less than 100 chars)
  const stubs = data.content.filter(item => item.text.length < 100);
  
  console.log(`Found ${stubs.length} entries with less than 100 characters in OCR PDF:\n`);
  
  stubs.slice(0, 50).forEach(item => {
    console.log(`ID ${item.id}: ${item.text.length} chars`);
    console.log(`  "${item.text.substring(0, 70).replace(/\n/g, ' ')}..."\n`);
  });

  if (stubs.length > 50) {
    console.log(`... and ${stubs.length - 50} more short entries\n`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('Distribution by length:\n');
  
  const byLength = {};
  data.content.forEach(item => {
    const len = Math.floor(item.text.length / 100) * 100;
    if (!byLength[len]) byLength[len] = 0;
    byLength[len]++;
  });
  
  Object.keys(byLength).sort((a, b) => a - b).forEach(len => {
    console.log(`${len}-${parseInt(len)+99} chars: ${byLength[len]} entries`);
  });

})();
