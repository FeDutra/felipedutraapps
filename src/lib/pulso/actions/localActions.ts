import { invoke } from '@tauri-apps/api/core';
import { notionActions } from './notionActions';
import { whatsappActions } from './whatsappActions';
import { googleActions } from './googleActions';
import { slackActions } from './slackActions';
import { canvaActions } from './canvaActions';

export const localActions = {
  openApp: async (appName: string): Promise<string> => {
    try {
      const script = `tell application "${appName}" to activate`;
      // Invoca o comando Rust que criamos no Tauri
      await invoke('execute_applescript', { script });
      return `Pronto, abri o ${appName} para você.`;
    } catch (error) {
      console.error(`Erro ao abrir app ${appName}:`, error);
      return `Desculpe, tive um problema ao tentar abrir o ${appName}. Ele está instalado?`;
    }
  },
  
  playMusic: async (): Promise<string> => {
    try {
      // Exemplo simples com o app Música nativo do Mac
      const script = `tell application "Music" to play`;
      await invoke('execute_applescript', { script });
      return `Coloquei a música para tocar.`;
    } catch (error) {
      console.error('Erro ao tocar música:', error);
      return `Não consegui dar play na música no momento.`;
    }
  },

  // Integração real com o Notion
  readNotion: async (pageName: string, targetAlias?: string): Promise<string> => {
    return await notionActions.readNotion(pageName, targetAlias);
  },
  queryNotionDatabase: async (databaseName: string, targetAlias?: string): Promise<string> => {
    return await notionActions.queryDatabase(databaseName, targetAlias);
  },
  createNotionPage: async (parentName: string, pageTitle: string, content?: string, targetAlias?: string): Promise<string> => {
    return await notionActions.createPage(parentName, pageTitle, content, targetAlias);
  },
  createNotionComment: async (pageName: string, commentText: string, targetAlias?: string): Promise<string> => {
    return await notionActions.createComment(pageName, commentText, targetAlias);
  },

  // Integração real com WhatsApp
  sendWhatsapp: async (to: string, message: string): Promise<string> => {
    return whatsappActions.sendMessage(to, message);
  },
  createWhatsappGroup: async (name: string, participants: string[]): Promise<string> => {
    return whatsappActions.createGroup(name, participants);
  },
  updateWhatsappGroup: async (groupName: string, newName?: string, description?: string): Promise<string> => {
    return whatsappActions.updateGroup(groupName, newName, description);
  },
  manageWhatsappParticipants: async (groupName: string, action: 'add' | 'remove', participants: string[]): Promise<string> => {
    return whatsappActions.manageParticipants(groupName, action, participants);
  },
  updateWhatsappSettings: async (groupName: string, adminsOnlyMessages?: boolean, adminsOnlySettings?: boolean): Promise<string> => {
    return whatsappActions.updateGroupSettings(groupName, adminsOnlyMessages, adminsOnlySettings);
  },
  getWhatsappChats: async (): Promise<string> => {
    return whatsappActions.getRecentChats();
  },
  getWhatsappMessages: async (chatName: string, limit: number = 10): Promise<string> => {
    return whatsappActions.getChatMessages(chatName, limit);
  },
  performWhatsappAction: async (chatName: string, action: string): Promise<string> => {
    return whatsappActions.performChatAction(chatName, action);
  },
  runAntigravityCli: async (commandArgs: string): Promise<string> => {
    try {
      const fullCommand = `cd /Users/felipedutra/Projetos/eden-terra && ${commandArgs}`;
      const output = await invoke<string>('execute_shell_command', { command: fullCommand });
      return output;
    } catch (error) {
      console.error('Failed to run local command:', error);
      throw error;
    }
  },
  runAntigravityStream: async (commandArgs: string): Promise<void> => {
    try {
      const fullCommand = `cd /Users/felipedutra/Projetos/eden-terra && ${commandArgs}`;
      await invoke('execute_long_command_stream', { command: fullCommand });
    } catch (e: any) {
      console.error('Failed to run stream command:', e);
    }
  },

  // Integração com Google (Fê Pessoal e Despertar)
  listGoogleEvents: async (calendarAlias: string, timeMin?: string, timeMax?: string): Promise<string> => {
    return googleActions.listEvents(calendarAlias, timeMin, timeMax);
  },
  createGoogleEvent: async (calendarAlias: string, title: string, start: string, end: string, description?: string): Promise<string> => {
    return googleActions.createEvent(calendarAlias, title, start, end, description);
  },
  sendGoogleEmail: async (emailAlias: string, to: string, subject: string, body: string): Promise<string> => {
    return googleActions.sendEmail(emailAlias, to, subject, body);
  },

  // Integração com Slack
  sendSlackMessage: async (slackAlias: string, channel: string, message: string): Promise<string> => {
    return slackActions.sendMessage(slackAlias, channel, message);
  },

  // Integração com Canva
  createCanvaDesign: async (designType: string, title: string): Promise<string> => {
    return canvaActions.createDesign(designType, title);
  }
};
