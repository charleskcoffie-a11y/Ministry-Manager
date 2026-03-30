const { createClient } = require('@supabase/supabase-js');

const url = 'https://wtvnyyfxjefuprcntjta.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0dm55eWZ4amVmdXByY250anRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjY5NjUsImV4cCI6MjA4MDgwMjk2NX0.O569-gYigdB84xmjOTicMU2aSghDYm2ItPjl8EPmOm8';
const supabase = createClient(url, key);

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

(async () => {
  const { data, error } = await supabase
    .from('uploaded_documents')
    .select('content')
    .eq('id', 'standing_orders')
    .single();

  if (error) throw error;

  const content = data.content;
  for (const id of ['d-88', 'd-89', 'd-90', 'd-91']) {
    const item = content.find((entry) => entry.id === id);
    console.log('\n' + id + ' len=' + (item?.text?.length || 0));
    console.log((item?.text || '').slice(0, 600).replace(/\n/g, ' | '));
  }

  const matches = content.filter((item) => soMatchesInText(item.text || '', '90'));
  console.log('\nMatches for SO 90:');
  matches.slice(0, 20).forEach((item, index) => {
    console.log(`${index + 1}. ${item.id} -> ${(item.text || '').slice(0, 140).replace(/\n/g, ' | ')}`);
  });
})();
