#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const url = 'https://wtvnyyfxjefuprcntjta.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0dm55eWZ4amVmdXByY250anRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjY5NjUsImV4cCI6MjA4MDgwMjk2NX0.O569-gYigdB84xmjOTicMU2aSghDYm2ItPjl8EPmOm8';
const supabase = createClient(url, key);

(async () => {
  const { data } = await supabase
    .from('uploaded_documents')
    .select('*')
    .eq('id', 'standing_orders')
    .single();

  console.log('Finding all Standing Orders with short/stub content...\n');
  
  // Calculate average length
  const avgLen = data.content.reduce((sum, item) => sum + item.text.length, 0) / data.content.length;
  console.log(`Average content length: ${Math.round(avgLen)} chars\n`);
  
  // Find all entries below 150 chars (likely stubs - just headings)
  const stubs = data.content.filter(item => item.text.length < 150);
  
  console.log(`Found ${stubs.length} entries with less than 150 characters:\n`);
  
  stubs.forEach(item => {
    // Extract SO number from id
    const soNum = item.id.match(/\d+/)?.[0] || item.id;
    console.log(`SO ${soNum}: ${item.text.length} chars`);
    console.log(`  "${item.text.substring(0, 100).replace(/\n/g, ' ')}..."\n`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('Summary of stub entries by character length:\n');
  
  const byLength = {};
  stubs.forEach(item => {
    const len = item.text.length;
    if (!byLength[len]) byLength[len] = [];
    byLength[len].push(item.id);
  });
  
  Object.keys(byLength).sort((a, b) => a - b).forEach(len => {
    console.log(`${len} chars: ${byLength[len].length} entries - ${byLength[len].join(', ')}`);
  });
})();
