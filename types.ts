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