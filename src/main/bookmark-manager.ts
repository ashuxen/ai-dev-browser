import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';

export interface Bookmark {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  folderId?: string;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
}

export interface BookmarkFolder {
  id: string;
  name: string;
  parentId?: string;
  createdAt: number;
}

interface BookmarkState {
  bookmarks: Bookmark[];
  folders: BookmarkFolder[];
}

export class BookmarkManager {
  private store: Store<{ bookmarkState: BookmarkState }>;

  constructor() {
    this.store = new Store({
      name: 'bookmarks',
      defaults: {
        bookmarkState: {
          bookmarks: [],
          folders: [
            { id: 'toolbar', name: 'Bookmarks Bar', createdAt: Date.now() },
            { id: 'other', name: 'Other Bookmarks', createdAt: Date.now() },
          ],
        },
      },
    });
  }

  /**
   * Add a new bookmark
   */
  add(bookmark: Omit<Bookmark, 'id' | 'createdAt' | 'updatedAt'>): Bookmark {
    const state = this.store.get('bookmarkState');
    
    const newBookmark: Bookmark = {
      ...bookmark,
      id: uuidv4(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    state.bookmarks.push(newBookmark);
    this.store.set('bookmarkState', state);

    return newBookmark;
  }

  /**
   * Remove a bookmark by ID
   */
  remove(id: string): boolean {
    const state = this.store.get('bookmarkState');
    const index = state.bookmarks.findIndex(b => b.id === id);
    
    if (index === -1) return false;

    state.bookmarks.splice(index, 1);
    this.store.set('bookmarkState', state);

    return true;
  }

  /**
   * Update a bookmark
   */
  update(id: string, updates: Partial<Omit<Bookmark, 'id' | 'createdAt'>>): Bookmark | null {
    const state = this.store.get('bookmarkState');
    const bookmark = state.bookmarks.find(b => b.id === id);
    
    if (!bookmark) return null;

    Object.assign(bookmark, updates, { updatedAt: Date.now() });
    this.store.set('bookmarkState', state);

    return bookmark;
  }

  /**
   * Get all bookmarks
   */
  getAll(): Bookmark[] {
    const state = this.store.get('bookmarkState');
    return state.bookmarks;
  }

  /**
   * Get bookmarks in a folder
   */
  getByFolder(folderId: string): Bookmark[] {
    const state = this.store.get('bookmarkState');
    return state.bookmarks.filter(b => b.folderId === folderId);
  }

  /**
   * Search bookmarks
   */
  search(query: string): Bookmark[] {
    const state = this.store.get('bookmarkState');
    const lowerQuery = query.toLowerCase();
    
    return state.bookmarks.filter(b =>
      b.title.toLowerCase().includes(lowerQuery) ||
      b.url.toLowerCase().includes(lowerQuery) ||
      b.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Check if a URL is bookmarked
   */
  isBookmarked(url: string): boolean {
    const state = this.store.get('bookmarkState');
    return state.bookmarks.some(b => b.url === url);
  }

  /**
   * Get bookmark by URL
   */
  getByUrl(url: string): Bookmark | null {
    const state = this.store.get('bookmarkState');
    return state.bookmarks.find(b => b.url === url) || null;
  }

  /**
   * Create a folder
   */
  createFolder(name: string, parentId?: string): BookmarkFolder {
    const state = this.store.get('bookmarkState');
    
    const folder: BookmarkFolder = {
      id: uuidv4(),
      name,
      parentId,
      createdAt: Date.now(),
    };

    state.folders.push(folder);
    this.store.set('bookmarkState', state);

    return folder;
  }

  /**
   * Delete a folder
   */
  deleteFolder(id: string): boolean {
    const state = this.store.get('bookmarkState');
    
    // Don't delete default folders
    if (id === 'toolbar' || id === 'other') return false;

    const index = state.folders.findIndex(f => f.id === id);
    if (index === -1) return false;

    // Move bookmarks from this folder to 'other'
    state.bookmarks.forEach(b => {
      if (b.folderId === id) {
        b.folderId = 'other';
      }
    });

    state.folders.splice(index, 1);
    this.store.set('bookmarkState', state);

    return true;
  }

  /**
   * Get all folders
   */
  getAllFolders(): BookmarkFolder[] {
    const state = this.store.get('bookmarkState');
    return state.folders;
  }

  /**
   * Import bookmarks from Chrome/Firefox format
   */
  importBookmarks(bookmarks: Partial<Bookmark>[]): number {
    const state = this.store.get('bookmarkState');
    let imported = 0;

    for (const bookmark of bookmarks) {
      if (!bookmark.url || !bookmark.title) continue;

      // Skip if already exists
      if (state.bookmarks.some(b => b.url === bookmark.url)) continue;

      state.bookmarks.push({
        id: uuidv4(),
        url: bookmark.url,
        title: bookmark.title,
        favicon: bookmark.favicon,
        folderId: bookmark.folderId || 'other',
        tags: bookmark.tags || [],
        createdAt: bookmark.createdAt || Date.now(),
        updatedAt: Date.now(),
      });

      imported++;
    }

    this.store.set('bookmarkState', state);
    return imported;
  }

  /**
   * Export bookmarks
   */
  exportBookmarks(): BookmarkState {
    return this.store.get('bookmarkState');
  }
}

