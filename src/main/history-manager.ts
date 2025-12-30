import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';

export interface HistoryEntry {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  visitedAt: number;
  visitCount: number;
}

interface HistoryState {
  entries: HistoryEntry[];
  lastCleared: number | null;
}

export class HistoryManager {
  private store: Store<{ historyState: HistoryState }>;
  private maxEntries = 10000; // Keep last 10,000 entries

  constructor() {
    this.store = new Store({
      name: 'history',
      defaults: {
        historyState: {
          entries: [],
          lastCleared: null,
        },
      },
    });
  }

  /**
   * Add a history entry
   */
  add(entry: Omit<HistoryEntry, 'id' | 'visitedAt' | 'visitCount'>): HistoryEntry {
    const state = this.store.get('historyState');
    
    // Check if URL already exists
    const existingIndex = state.entries.findIndex(e => e.url === entry.url);
    
    if (existingIndex !== -1) {
      // Update existing entry
      const existing = state.entries[existingIndex];
      existing.visitCount++;
      existing.visitedAt = Date.now();
      existing.title = entry.title || existing.title;
      existing.favicon = entry.favicon || existing.favicon;
      
      // Move to front
      state.entries.splice(existingIndex, 1);
      state.entries.unshift(existing);
      
      this.store.set('historyState', state);
      return existing;
    }

    // Create new entry
    const newEntry: HistoryEntry = {
      ...entry,
      id: uuidv4(),
      visitedAt: Date.now(),
      visitCount: 1,
    };

    state.entries.unshift(newEntry);

    // Trim old entries
    if (state.entries.length > this.maxEntries) {
      state.entries = state.entries.slice(0, this.maxEntries);
    }

    this.store.set('historyState', state);
    return newEntry;
  }

  /**
   * Get all history entries
   */
  getAll(): HistoryEntry[] {
    const state = this.store.get('historyState');
    return state.entries;
  }

  /**
   * Get recent history (last n entries)
   */
  getRecent(count: number = 50): HistoryEntry[] {
    const state = this.store.get('historyState');
    return state.entries.slice(0, count);
  }

  /**
   * Search history
   */
  search(query: string): HistoryEntry[] {
    const state = this.store.get('historyState');
    const lowerQuery = query.toLowerCase();
    
    return state.entries.filter(e =>
      e.title.toLowerCase().includes(lowerQuery) ||
      e.url.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get history for a specific date range
   */
  getByDateRange(startDate: Date, endDate: Date): HistoryEntry[] {
    const state = this.store.get('historyState');
    const start = startDate.getTime();
    const end = endDate.getTime();
    
    return state.entries.filter(e =>
      e.visitedAt >= start && e.visitedAt <= end
    );
  }

  /**
   * Get most visited sites
   */
  getMostVisited(count: number = 10): HistoryEntry[] {
    const state = this.store.get('historyState');
    
    return [...state.entries]
      .sort((a, b) => b.visitCount - a.visitCount)
      .slice(0, count);
  }

  /**
   * Delete a specific entry
   */
  delete(id: string): boolean {
    const state = this.store.get('historyState');
    const index = state.entries.findIndex(e => e.id === id);
    
    if (index === -1) return false;

    state.entries.splice(index, 1);
    this.store.set('historyState', state);

    return true;
  }

  /**
   * Delete entries by URL pattern
   */
  deleteByUrl(urlPattern: string): number {
    const state = this.store.get('historyState');
    const pattern = new RegExp(urlPattern, 'i');
    const originalLength = state.entries.length;
    
    state.entries = state.entries.filter(e => !pattern.test(e.url));
    this.store.set('historyState', state);

    return originalLength - state.entries.length;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.store.set('historyState', {
      entries: [],
      lastCleared: Date.now(),
    });
  }

  /**
   * Clear history older than a certain date
   */
  clearOlderThan(date: Date): number {
    const state = this.store.get('historyState');
    const threshold = date.getTime();
    const originalLength = state.entries.length;
    
    state.entries = state.entries.filter(e => e.visitedAt >= threshold);
    this.store.set('historyState', state);

    return originalLength - state.entries.length;
  }

  /**
   * Get history statistics
   */
  getStats(): { totalEntries: number; totalVisits: number; lastCleared: number | null } {
    const state = this.store.get('historyState');
    
    return {
      totalEntries: state.entries.length,
      totalVisits: state.entries.reduce((sum, e) => sum + e.visitCount, 0),
      lastCleared: state.lastCleared,
    };
  }
}



