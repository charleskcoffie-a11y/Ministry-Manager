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

  console.log('Checking SO 71, 72, 73:\n');
  
  [71, 72, 73].forEach(soNum => {
    const containing = data.content.filter(c => c.text.includes('S.O ' + soNum));
    console.log('SO ' + soNum + ': ' + containing.length + ' items containing it');
    containing.slice(0, 2).forEach((item, idx) => {
      console.log('  Item ' + idx + ' (id=' + item.id + '):');
      console.log('    Text: ' + item.text.substring(0, 150).replace(/\n/g, ' '));
    });
  });

  // Also check what the main S.O labels are for these numbers
  console.log('\n\nLooking for main heading SO numbers:');
  [71, 72, 73].forEach(soNum => {
    const heading = data.content.find(c => c.text.trim().startsWith('S.O ' + soNum + ' –'));
    if (heading) {
      console.log('SO ' + soNum + ': YES');
      console.log('  Text: ' + heading.text.substring(0, 100).replace(/\n/g, ' '));
    } else {
      console.log('SO ' + soNum + ': NO MAIN HEADING');
      // Show what we do have around position 71
      const nearby = data.content.filter(c => 
        c.text.includes('S.O ') && 
        (c.text.includes('7' + soNum % 10) || c.text.includes('7 ' + soNum % 10))
      ).slice(0, 1);
      if (nearby.length > 0) {
        console.log('  Nearby: ' + nearby[0].text.substring(0, 100).replace(/\n/g, ' '));
      }
    }
  });
})();
