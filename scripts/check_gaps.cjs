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

  const soNums = new Set();
  
  data.content.forEach((c, idx) => {
    const text = c.text;
    // More flexible regex to catch SO numbers
    const matches = text.match(/S\.O\s+(\d+)/g);
    if (matches) {
      matches.forEach(match => {
        const num = match.replace(/[^\d]/g, '');
        soNums.add(parseInt(num));
      });
    }
  });

  const sorted = Array.from(soNums).sort((a, b) => a - b);
  console.log('Found ' + sorted.length + ' unique SO numbers');
  console.log('First 10: ' + sorted.slice(0, 10).join(', '));
  console.log('Range: SO ' + sorted[0] + ' to SO ' + sorted[sorted.length - 1]);

  // Check gaps 65-85
  const gaps = [];
  for (let i = 65; i <= 85; i++) {
    if (!soNums.has(i)) gaps.push(i);
  }
  console.log('\nMissing SO 65-85: ' + gaps.join(', '));

  // Check specific numbers
  console.log('\nChecking SO 71, 72, 73:');
  [71, 72, 73].forEach(num => {
    console.log('SO ' + num + ' exists: ' + soNums.has(num));
  });
})();
