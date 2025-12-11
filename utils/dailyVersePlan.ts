
export class DailyVersePlan {
  // A simple plan of verse references for the year.
  static readonly yearlyVerseRefs = [
    'Psalm 1:1–3',
    'Proverbs 3:5–6',
    'John 1:1–5',
    'Philippians 4:6–7',
    'Romans 8:28',
    'Isaiah 40:31',
    'John 1:25',
    'Joshua 1:9',
    'Matthew 11:28–30',
    'Ephesians 3:20–21',
    '1 Corinthians 13:4–7',
    'Psalm 23:1–4',
    'John 3:16',
    'Romans 12:1–2',
    'Galatians 5:22–23',
    'Hebrews 12:1–2',
    'James 1:2–5',
    '1 Peter 5:7',
    'Colossians 3:12–17',
    'Psalm 91:1–4'
  ];

  // Choose a start date for the plan.
  static readonly startDate = new Date(2026, 0, 1); // January 1, 2026

  /**
   * Get the verse reference for a given date.
   */
  static verseForDate(date: Date): string {
    const start = new Date(this.startDate);
    start.setHours(0, 0, 0, 0);
    
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return this.yearlyVerseRefs[0];
    }

    const index = diffDays % this.yearlyVerseRefs.length;
    return this.yearlyVerseRefs[index];
  }

  /**
   * Convenience: get today's verse reference.
   */
  static verseForToday(): string {
    return this.verseForDate(new Date());
  }
}
