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
      if (filters.project && filters.project !== 'all' && (item as any).projectRef !== filters.project) return false;
      if (filters.person && filters.person !== 'all' && !((item as any).ownerRefs || []).includes(filters.person)) return false;
      if (filters.source && filters.source !== 'all' && (item as any).sourceRef !== filters.source) return false;
      if (filters.origin && filters.origin !== 'all' && item.originChannel !== filters.origin) return false;
      
      if (filters.dateRange && filters.dateRange !== 'all') {
        const dVal = item.createdAt || (item as any).updatedAt || item.processedAt;
        if (!dVal) return false;
        
        let dateObj: Date;
        if (typeof (dVal as any).toDate === 'function') {
          dateObj = (dVal as any).toDate();
        } else if ((dVal as any).seconds) {
          dateObj = new Date((dVal as any).seconds * 1000);
        } else {
          dateObj = new Date(dVal);
        }

        if (isNaN(dateObj.getTime())) return false;
        
        const now = new Date();
        if (filters.dateRange === 'today') {
          if (dateObj.toDateString() !== now.toDateString()) return false;
        } else if (filters.dateRange === '7d') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (dateObj < sevenDaysAgo) return false;
        } else if (filters.dateRange === '30d') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (dateObj < thirtyDaysAgo) return false;
        } else if (filters.dateRange === 'month') {
          if (dateObj.getMonth() !== now.getMonth() || dateObj.getFullYear() !== now.getFullYear()) return false;
        }
      }

      return true;
    });
  },

  searchItems: (items: InboxItem[], query: string) => {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter(item => 
      ((item as any).name || '').toLowerCase().includes(q) || 
      ((item as any).body || '').toLowerCase().includes(q)
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
