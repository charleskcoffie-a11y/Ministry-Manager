#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const url = 'https://wtvnyyfxjefuprcntjta.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0dm55eWZ4amVmdXByY250anRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjY5NjUsImV4cCI6MjA4MDgwMjk2NX0.O569-gYigdB84xmjOTicMU2aSghDYm2ItPjl8EPmOm8';
const supabase = createClient(url, key);

async function updateSO72And73() {
  try {
  // SO 72 and SO 73 transcribed from the visible PDF page content.
  const so72Text = `S.O 72

(2) If the Minister concerned is in Full Connexion he or she may ask
permission to resign from the Ministry or to become
Supernumerary.

(3) In the case of Ministers in Full Connexion compulsorily retired,
the General Purposes Council shall advise the Conference what
payments (if any) shall be made to the Minister concerned and
from what funds the payment shall be made.`;

  const so73Text = `S.O 73 - Resignations from the Ministry

(1) Any Minister in Full Connexion or Probationer desiring to resign
or withdraw from the Ministry shall give written notice of such
resignation or withdrawal. All such notices shall be referred by
the Presiding Bishop to an Advisory Committee for consideration.
An opportunity shall be given to the Minister to be present at the
committee if he or she should so desire. The committee shall
advise the Presiding Bishop as to whether the resignation or
withdrawal should be accepted and, if so, the date from which it
should take effect.

(2) Should a Minister intimate to the Presiding Bishop his or her
intention to resign from the Ministry at some future date, the
Presiding Bishop may regard the intimation as tantamount to an
actual resignation, and the procedure shall be as in (1) above.

(3) The Presiding Bishop, acting in consultation with the Advisory
Committee, shall have authority to accept the resignation of a
Minister, and every such action on the part of the Presiding
Bishop shall be deemed for all purposes to be the action of the
Conference. The Presiding Bishop shall report his action to the
next Conference.

(4) The Advisory Committee shall consist of the Presiding Bishop, Lay
President and the Administrative Bishop of the Conference, the
Bishop of the Diocese, the General Director, General Directorate
for Ministries, the Director, Ordained Ministry, the
Superintendent of the Circuit concerned, one other Minister and
two Lay persons chosen by the Presiding Bishop.`;

    console.log('Updating SO 72 and SO 73 in database...\n');

    // Fetch current standing_orders document
    const { data: soDoc, error: fetchError } = await supabase
      .from('uploaded_documents')
      .select('content')
      .eq('id', 'standing_orders')
      .single();

    if (fetchError) throw fetchError;

    // Content comes as a parsed array already from Supabase jsonb type
    let content = soDoc.content;
    if (typeof content === 'string') {
      content = JSON.parse(content);
    }

    // Find and update SO 72
    const so72Idx = content.findIndex(item => item.id === 'd-72');
    if (so72Idx >= 0) {
      console.log('Updating SO 72...');
      const oldLen = content[so72Idx].text.length;
      content[so72Idx].text = so72Text;
      console.log(`✓ SO 72 updated (${oldLen} → ${so72Text.length} chars)`);
    } else {
      console.error('SO 72 not found in database');
    }

    // Find and update SO 73
    const so73Idx = content.findIndex(item => item.id === 'd-73');
    if (so73Idx >= 0) {
      console.log('Updating SO 73...');
      const oldLen = content[so73Idx].text.length;
      content[so73Idx].text = so73Text;
      console.log(`✓ SO 73 updated (${oldLen} → ${so73Text.length} chars)`);
    } else {
      console.error('SO 73 not found in database');
    }

    // Upload updated content
    const { error: updateError } = await supabase
      .from('uploaded_documents')
      .update({
        content: content,
        updated_at: new Date().toISOString()
      })
      .eq('id', 'standing_orders');

    if (updateError) throw updateError;

    console.log('\n--- Verification ---\n');
    
    // Verify the updates
    const { data: verify, error: verfError } = await supabase
      .from('uploaded_documents')
      .select('content')
      .eq('id', 'standing_orders')
      .single();

    if (verify) {
      const updated = verify.content;
      const so72Updated = updated.find(item => item.id === 'd-72');
      const so73Updated = updated.find(item => item.id === 'd-73');
      
      console.log(`SO 72: ${so72Updated?.text?.length || 0} characters`);
      console.log(`SO 73: ${so73Updated?.text?.length || 0} characters`);
    }

    console.log('\n✓ Update complete. Standing Orders app will auto-refresh on next view.');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateSO72And73();
