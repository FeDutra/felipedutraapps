'use client';

import React from 'react';
import { inboxService } from '../services/pulsoService';
import { inboxHelpers } from '../utils/inboxHelpers';
import { InboxItem } from '../types/pulso.types';
import { InboxHeader } from '../components/inbox/InboxHeader';
import { InboxFilters } from '../components/inbox/InboxFilters';
import { InboxItemCard } from '../components/inbox/InboxItemCard';
import { InboxDetailDrawer } from '../components/inbox/InboxDetailDrawer';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * @file InboxPage.tsx
 * @description Universal Inbox page for the PULSO cockpit.
 */

export default function InboxPage() {
  const [items, setItems] = React.useState<InboxItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedItem, setSelectedItem] = React.useState<InboxItem | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filters, setFilters] = React.useState({
    status: 'new',
    type: 'all',
    priority: 'all',
    area: 'all'
  });

  const loadItems = React.useCallback(async () => {
    setLoading(true);
    const data = await inboxService.getAll();
    setItems([...data]);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filteredItems = React.useMemo(() => {
    let result = inboxHelpers.filterItems(items, filters);
    result = inboxHelpers.searchItems(result, searchQuery);
    return result;
  }, [items, filters, searchQuery]);

  const stats = React.useMemo(() => inboxHelpers.getStats(items), [items]);

  const handleUpdate = async (id: string, data: Partial<InboxItem>) => {
    const updated = await inboxService.update(id, data);
    setItems(prev => prev.map(i => i.id === id ? updated : i));
    if (selectedItem?.id === id) setSelectedItem(updated);
  };

  const handleConvert = async (id: string, targetType: string) => {
    try {
      const { item } = await inboxService.convertTo(id, targetType);
      setItems(prev => prev.map(i => i.id === id ? item : i));
      setSelectedItem(null);
      // Optional: Show success toast
    } catch (err) {
      console.error('Falha na conversão:', err);
    }
  };

  const handleCreateNew = async () => {
    const newItem = await inboxService.create({
      name: 'Novo Registro',
      body: '',
      type: 'task',
      priority: 'medium',
      originChannel: 'Manual'
    });
    setItems(prev => [newItem, ...prev]);
    setSelectedItem(newItem);
  };

  if (loading && items.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p className="text-white/20 text-[10px] font-black uppercase tracking-widest">Sincronizando Inbox</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <InboxHeader stats={stats} onCreateNew={handleCreateNew} />
      
      <InboxFilters 
        filters={filters} 
        setFilters={setFilters} 
        onSearch={setSearchQuery} 
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredItems.map((item) => (
            <InboxItemCard 
              key={item.id} 
              item={item} 
              onClick={setSelectedItem} 
            />
          ))}
        </AnimatePresence>

        {filteredItems.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-3xl bg-white/1">
            <p className="text-white/20 text-xs italic">Nenhum item encontrado nesta categoria.</p>
          </div>
        )}
      </div>

      <InboxDetailDrawer 
        item={selectedItem} 
        onClose={() => setSelectedItem(null)} 
        onUpdate={handleUpdate}
        onConvert={handleConvert}
      />
    </div>
  );
}
