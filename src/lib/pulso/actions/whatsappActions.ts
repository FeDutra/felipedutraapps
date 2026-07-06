export const whatsappActions = {
  sendMessage: async (to: string, message: string): Promise<string> => {
    try {
      const response = await fetch('http://localhost:3005/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, message })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro desconhecido');
      }

      return `Mensagem enviada com sucesso para ${to}.`;
    } catch (error: any) {
      console.error("[WhatsAppActions] Erro ao enviar mensagem:", error);
      return `Falha ao enviar mensagem pelo WhatsApp: ${error.message}`;
    }
  },

  createGroup: async (name: string, participants: string[]): Promise<string> => {
    try {
      const response = await fetch('http://localhost:3005/group/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, participants })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro desconhecido');
      return `Grupo "${name}" criado com sucesso!`;
    } catch (error: any) {
      return `Falha ao criar grupo: ${error.message}`;
    }
  },

  updateGroup: async (groupName: string, newName?: string, description?: string): Promise<string> => {
    try {
      const response = await fetch('http://localhost:3005/group/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupName, newName, description })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro desconhecido');
      return `Grupo "${groupName}" atualizado com sucesso.`;
    } catch (error: any) {
      return `Falha ao atualizar grupo: ${error.message}`;
    }
  },

  manageParticipants: async (groupName: string, action: 'add' | 'remove', participants: string[]): Promise<string> => {
    try {
      const response = await fetch('http://localhost:3005/group/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupName, action, participants })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro desconhecido');
      const actionTxt = action === 'add' ? 'adicionados' : 'removidos';
      return `Participantes ${actionTxt} do grupo "${groupName}".`;
    } catch (error: any) {
      return `Falha ao gerenciar participantes: ${error.message}`;
    }
  },

  updateGroupSettings: async (groupName: string, adminsOnlyMessages?: boolean, adminsOnlySettings?: boolean): Promise<string> => {
    try {
      const response = await fetch('http://localhost:3005/group/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupName, adminsOnlyMessages, adminsOnlySettings })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro desconhecido');
      return `Permissões do grupo "${groupName}" atualizadas.`;
    } catch (error: any) {
      return `Falha ao atualizar permissões do grupo: ${error.message}`;
    }
  },

  // ==== MODO DEUS ====
  getRecentChats: async (): Promise<any> => {
    try {
      const response = await fetch('http://localhost:3005/chats');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro desconhecido');
      return JSON.stringify(data.chats);
    } catch (error: any) {
      return `Falha ao buscar chats recentes: ${error.message}`;
    }
  },

  getChatMessages: async (chatName: string, limit: number = 10): Promise<any> => {
    try {
      const response = await fetch(`http://localhost:3005/chat/messages?chatName=${encodeURIComponent(chatName)}&limit=${limit}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro desconhecido');
      return JSON.stringify(data.messages);
    } catch (error: any) {
      return `Falha ao buscar mensagens: ${error.message}`;
    }
  },

  performChatAction: async (chatName: string, action: string): Promise<string> => {
    try {
      const response = await fetch('http://localhost:3005/chat/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatName, action })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro desconhecido');
      return `Ação "${action}" executada com sucesso no chat "${chatName}".`;
    } catch (error: any) {
      return `Falha ao executar ação "${action}": ${error.message}`;
    }
  }
};
