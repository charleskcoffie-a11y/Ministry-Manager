
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
  is_favorite?: boolean; // New field
  created_at?: string;
}

export type TaskCategory = 'Preaching' | 'Visitation' | 'Counseling' | 'Administration' | 'Prayer' | 'Bible Study' | 'Other';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type TaskStatus = 'Pending' | 'In Progress' | 'Completed';

export interface Task {
  id: string;
  title: string;       // Replaces 'message' conceptually
  category: TaskCategory;
  description?: string;
  task_date: string;   // Due date
  priority: TaskPriority;
  status: TaskStatus;
  
  // Legacy fields kept for compatibility during migration
  message?: string; 
  is_completed?: boolean; 
  
  completed_at?: string | null;
  created_at?: string;
}

// --- NEW REMINDER TYPES ---
export type ReminderCategory = 'Sermon Preparation' | 'Visitation' | 'Counseling' | 'Prayer & Fasting' | 'Meeting' | 'Personal Devotion' | 'Other';
export type ReminderFrequency = 'One-time' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';

export interface Reminder {
  id: string;
  title: string;
  category: ReminderCategory;
  frequency: ReminderFrequency;
  start_date: string; // ISO string (YYYY-MM-DDTHH:mm)
  notes?: string;
  is_active: boolean;
  created_at?: string;
}

// --- COUNSELING TYPES ---
export type CaseType = 'Marriage' | 'Family' | 'Addiction' | 'Youth' | 'Bereavement' | 'Spiritual' | 'Other';
export type CounselingStatus = 'Open' | 'In Progress' | 'Closed';

export interface CounselingSession {
  id: string;
  initials: string;
  case_type: CaseType;
  summary: string;
  key_issues?: string;
  scriptures_used?: string;
  action_steps?: string;
  prayer_points?: string;
  follow_up_date?: string; // ISO string
  status: CounselingStatus;
  created_at?: string;
}
// --------------------------

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
  is_favorite?: boolean; // New field for favorites
  created_at?: string;
}

// --- SERMON / TALK NOTES (Listening) ---

export interface SermonPoint {
  id?: string;
  note_id?: string;
  point_number: number;
  main_point: string;
  supporting_scripture: string;
  key_quotes: string;
  illustrations: string;
  ministry_emphasis: string;
  created_at?: string;
}

export interface SermonNote {
  id: string;
  // 1. Basic Info
  preacher: string;
  note_date: string;
  location: string;
  sermon_title: string;
  main_scripture: string;

  // 2. Opening
  opening_remarks: string;
  passage_context: string;
  key_themes: string;

  // 4. Theological
  key_doctrines: string;
  theological_strengths: string;
  theological_questions: string;

  // 5. Preaching Style
  tone_atmosphere: string;
  use_of_scripture: string;
  use_of_stories: string;
  audience_engagement: string;
  flow_transitions: string;
  memorable_phrases: string;

  // 6. Reflections
  minister_lessons: string;
  personal_challenge: string;
  application_to_preaching: string;
  pastoral_insights: string;

  // 7. Application
  calls_to_action: string;
  spiritual_challenges: string;
  practical_applications: string;
  prayer_points: string;

  // 8. Closing
  closing_scripture: string;
  central_message_summary: string;
  final_memorable_line: string;

  // 9. Follow Up
  followup_scriptures: string;
  followup_topics: string;
  followup_people: string;
  followup_ministry_ideas: string;

  created_at?: string;
  
  // Virtual field for app logic, not in main table
  points?: SermonPoint[];
}

// --- DAILY VERSE ---
export interface DailyVerse {
  id: string;
  reference: string;
  translation: string;
  text?: string | null;
  image_url?: string | null;
  date?: string;
  created_at?: string;
}
