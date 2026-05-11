'use client';

import React from 'react';
import { inboxService } from '../services/pulsoService';
import { authService } from '../../../shared/services/authService';
import { AlertCircle } from 'lucide-react';
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
  const [isCreating, setIsCreating] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filters, setFilters] = React.useState({
    status: 'new',
    type: 'all',
    priority: 'all',
    area: 'all'
  });
  const [feedback, setFeedback] = React.useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3000);
  };

  const loadItems = React.useCallback(async () => {
    setLoading(true);
    try {
      await authService.ensurePulsoAuthReady();
      const data = await inboxService.getAll();
      setItems([...data]);
    } catch (err: any) {
      console.error('Inbox load error:', err);
      showFeedback(err.message || 'Erro ao carregar itens do Inbox', 'error');
    }
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
    try {
      const updated = await inboxService.update(id, data);
      setItems(prev => prev.map(i => i.id === id ? updated : i));
      if (selectedItem?.id === id) setSelectedItem(updated);
      showFeedback('Item atualizado');
    } catch (err) {
      showFeedback('Erro ao atualizar item', 'error');
    }
  };

  const handleConvert = async (id: string, targetType: string) => {
    try {
      const { item } = await inboxService.convertTo(id, targetType);
      setItems(prev => prev.map(i => i.id === id ? item : i));
      setSelectedItem(null);
      showFeedback(`Item convertido em ${targetType}`);
    } catch (err) {
      console.error('Falha na conversão:', err);
      showFeedback('Erro na conversão', 'error');
    }
  };

  const handleCreateNew = () => {
    setIsCreating(true);
    setSelectedItem(null);
  };

  const handleSaveNew = async (data: Partial<InboxItem>) => {
    try {
      const newItem = await inboxService.create(data);
      setItems(prev => [newItem, ...prev]);
      setIsCreating(false);
      showFeedback('Registro salvo no Inbox');
    } catch (err) {
      showFeedback('Erro ao salvar registro', 'error');
    }
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
              onClick={(it) => {
                setSelectedItem(it);
                setIsCreating(false);
              }} 
            />
          ))}
        </AnimatePresence>

        {filteredItems.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-3xl bg-white/1">
            <p className="text-white/20 text-xs italic">Nenhum item encontrado nesta categoria.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {feedback && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl border backdrop-blur-md shadow-2xl flex items-center gap-3 ${
              feedback.type === 'error' 
                ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${feedback.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`} />
            <span className="text-[10px] font-black uppercase tracking-widest">{feedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <InboxDetailDrawer 
        item={selectedItem} 
        isCreating={isCreating}
        onClose={() => {
          setSelectedItem(null);
          setIsCreating(false);
        }} 
        onUpdate={handleUpdate}
        onConvert={handleConvert}
        onCreate={handleSaveNew}
      />
    </div>
  );
}
