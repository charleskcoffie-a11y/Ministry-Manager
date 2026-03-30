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

  console.log('SO 71, 72, 73 with context:\n');
  
  const soHeadings = [71, 72, 73];
  soHeadings.forEach(soNum => {
    const idx = data.content.findIndex(c => c.id === 'd-' + soNum);
    if (idx >= 0) {
      console.log('\n--- SO ' + soNum + ' ---');
      // Show current and next 3 items
      for (let i = idx; i < Math.min(idx + 4, data.content.length); i++) {
        const item = data.content[i];
        const len = item.text.length;
        console.log('id=' + item.id + ' len=' + len);
        console.log('  ' + item.text.substring(0, 180).replace(/\n/g, ' ... '));
      }
    }
  });
})();
