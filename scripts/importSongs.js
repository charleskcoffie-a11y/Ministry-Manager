
/**
 * Import Script for Ministry Manager
 * 
 * Usage:
 * 1. Install dependencies: npm install dotenv @supabase/supabase-js
 * 2. Ensure .env file has REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY (or SERVICE_KEY)
 * 3. Place 'methodist_songs_flat.json' in the same directory or project root.
 * 4. Run: node scripts/importSongs.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Load Environment Variables manually to avoid full dotenv dependency if preferred,
// or use dotenv if available. Here we assume .env is in root.
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envConfig = require('dotenv').config({ path: envPath });
}

// 2. Initialize Supabase
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
// Note: Ideally use a SERVICE_KEY for bulk writes if RLS is strict, but ANON_KEY works if RLS allows public insert.
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Missing REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_ANON_KEY in environment.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function importSongs() {
  const filePath = path.resolve(__dirname, '../methodist_songs_flat.json');
  
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found at ${filePath}`);
    process.exit(1);
  }

  console.log(`Reading JSON from ${filePath}...`);
  const rawData = fs.readFileSync(filePath, 'utf8');
  let songs = [];
  
  try {
    songs = JSON.parse(rawData);
  } catch (e) {
    console.error("Error parsing JSON:", e.message);
    process.exit(1);
  }

  if (!Array.isArray(songs)) {
    console.error("Error: JSON root must be an array.");
    process.exit(1);
  }

  console.log(`Found ${songs.length} songs. Starting import...`);

  const BATCH_SIZE = 100;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < songs.length; i += BATCH_SIZE) {
    const batch = songs.slice(i, i + BATCH_SIZE);
    
    // Map JSON fields to DB columns matching schema if needed
    // JSON: { collection, code, number, title, raw_title, lyrics, author, copyright, tags, reference_number, id }
    // DB:   Same keys.
    const cleanBatch = batch.map(s => ({
      id: s.id, // Explicit ID
      collection: s.collection,
      code: s.code,
      number: s.number,
      title: s.title,
      raw_title: s.raw_title || null,
      lyrics: s.lyrics,
      author: s.author || null,
      copyright: s.copyright || null,
      tags: s.tags || null,
      reference_number: s.reference_number || null
    }));

    const { error } = await supabase.from('songs').upsert(cleanBatch);

    if (error) {
      console.error(`Error inserting batch ${i} - ${i + BATCH_SIZE}:`, error.message);
      errorCount += batch.length;
    } else {
      successCount += batch.length;
      process.stdout.write(`\rProgress: ${successCount} / ${songs.length} imported.`);
    }
  }

  console.log("\n\nImport Complete!");
  console.log(`Success: ${successCount}`);
  console.log(`Errors:  ${errorCount}`);
}

importSongs().catch(err => console.error("Script failed:", err));
