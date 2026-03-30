const { createClient } = require('@supabase/supabase-js');
const url = 'https://wtvnyyfxjefuprcntjta.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0dm55eWZ4amVmdXByY250anRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjY5NjUsImV4cCI6MjA4MDgwMjk2NX0.O569-gYigdB84xmjOTicMU2aSghDYm2ItPjl8EPmOm8';
const supabase = createClient(url, key);

// Replicate the search filter logic from the app
const soMatchesInText = (text, soNumber) => {
  const patterns = [
    `\\bS\\.O\\.?\\s*${soNumber}\\b`,
    `\\bS\\s*O\\s*${soNumber}\\b`,
    `\\bSO\\s*${soNumber}\\b`,
    `\\b${soNumber}\\b(?=\\s|$|[^0-9])`,
  ];
  const regex = new RegExp(patterns.join('|'), 'gi');
  return regex.test(text);
};

const extractSoNumber = (input) => {
  const match = input.trim().match(/^(?:s\.?\s*o\.?\s*)?(\d+)$/i);
  return match ? match[1] : null;
};

(async () => {
  const { data } = await supabase
    .from('uploaded_documents')
    .select('*')
    .eq('id', 'standing_orders')
    .single();

  console.log('Testing search for: "72", "SO 72", "S.O 72"\n');

  const searchQueries = ['72', 'SO 72', 'S.O 72', '71', '73'];
  
  searchQueries.forEach(query => {
    const soNumber = extractSoNumber(query);
    console.log('Query: "' + query + '" -> extracted number: ' + soNumber);
    
    if (soNumber) {
      const results = data.content.filter(item => soMatchesInText(item.text, soNumber));
      console.log('  Found: ' + results.length + ' items');
      results.slice(0, 2).forEach(r => {
        console.log('    - ' + r.text.substring(0, 80).replace(/\n/g, ' '));
      });
    }
    console.log('');
  });
})();
