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

  console.log('Finding incomplete main Standing Orders (SO 1-251)...\n');
  
  // Only check main SO entries (d-1 through d-251)
  const mainSOs = data.content.filter(item => {
    const num = parseInt(item.id.replace('d-', ''));
    return num >= 1 && num <= 251;
  });

  // Find all with short content (less than 150 chars = likely just heading)
  const stubs = mainSOs.filter(item => item.text.length < 150);
  
  console.log(`Found ${stubs.length} incomplete main Standing Orders:\n`);
  
  stubs.forEach(item => {
    const soNum = item.id.replace('d-', '');
    console.log(`SO ${soNum}: ${item.text.length} chars`);
    console.log(`  "${item.text.substring(0, 80).replace(/\n/g, ' ')}..."\n`);
  });

  if (stubs.length === 0) {
    console.log('✓ All main Standing Orders (1-251) have substantial content!');
    console.log(`Average content: ${Math.round(mainSOs.reduce((sum, item) => sum + item.text.length, 0) / mainSOs.length)} chars`);
  }
})();
