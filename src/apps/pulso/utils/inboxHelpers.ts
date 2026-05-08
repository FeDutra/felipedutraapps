import { InboxItem } from '../types/pulso.types';

/**
 * @file inboxHelpers.ts
 * @description Helper functions for filtering and searching inbox items.
 */

export const inboxHelpers = {
  filterItems: (items: InboxItem[], filters: any) => {
    return items.filter(item => {
      if (filters.status && filters.status !== 'all' && item.status !== filters.status) return false;
      if (filters.type && filters.type !== 'all' && item.type !== filters.type) return false;
      if (filters.priority && filters.priority !== 'all' && item.priority !== filters.priority) return false;
      if (filters.area && filters.area !== 'all' && item.areaRef !== filters.area) return false;
      if (filters.origin && filters.origin !== 'all' && item.originChannel !== filters.origin) return false;
      return true;
    });
  },

  searchItems: (items: InboxItem[], query: string) => {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter(item => 
      item.name.toLowerCase().includes(q) || 
      item.body.toLowerCase().includes(q)
    );
  },

  getStats: (items: InboxItem[]) => {
    return {
      total: items.length,
      new: items.filter(i => i.status === 'new').length,
      triaged: items.filter(i => i.status === 'triaged').length,
      converted: items.filter(i => i.status === 'converted').length,
    };
  }
};
