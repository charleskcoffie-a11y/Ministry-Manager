
export interface Program {
  id: string;
  date: string;
  activity_description: string;
  venue: string;
  lead: string;
  created_at?: string;
}

export interface StandingOrder {
  id: string;
  code: string;
  title: string;
  content: string;
  tags?: string[];
  created_at?: string;
}

export interface Task {
  id: string;
  task_date: string;
  message: string;
  is_completed: boolean;
  completed_at?: string | null;
  created_at?: string;
}

export interface Idea {
  id: string;
  idea_date: string;
  place: string;
  note: string;
  created_at?: string;
}

export interface UserProfile {
  id: string;
  email: string;
}

// Helper type for CSV Import
export interface ProgramCSV {
  Date: string;
  "Activities-Description": string;
  Venue: string;
  Lead: string;
}

export interface Sermon {
  id: string;
  created_at?: string;
  
  // 1. Title
  title: string;
  
  // 2. Scripture Text
  main_scripture: string;
  
  // 3. Introduction
  introduction: string;
  
  // 4. Background / Context
  background_context: string;
  
  // 5, 6, 7. Main Points
  main_point_1: string;
  main_point_2: string;
  main_point_3: string;
  
  // 8. Practical Applications
  application_points: string[]; // Stored as JSON array
  
  // 9. Gospel Connection
  gospel_connection: string;
  
  // 10. Conclusion
  conclusion: string;
  
  // 11. Closing Prayer
  prayer_points: string[]; // Stored as JSON array (using first item as main prayer usually)
  
  // 12. Altar Call
  altar_call: string;

  // Legacy/Optional fields kept for compatibility or extra metadata
  theme: string;
  proposition?: string;
  outline_points?: string[];
  supporting_scriptures?: string[];
  date_to_preach?: string;
}

// Unified Song Interface for MHB, Canticles, and CAN
export interface Song {
  id: number; // Using explicit integer ID from source
  collection: 'MHB' | 'CAN' | 'CANTICLES_EN' | 'CANTICLES_FANTE' | string;
  code: string;
  number: number | null;
  title: string;
  raw_title?: string;
  lyrics: string;
  author?: string | null;
  copyright?: string | null;
  tags?: string | null;
  reference_number?: string | null;
  created_at?: string;
}
