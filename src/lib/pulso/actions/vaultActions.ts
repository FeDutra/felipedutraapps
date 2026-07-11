import { invoke } from '@tauri-apps/api/core';

// iCloud Drive LotusVault Path
const CLOUD_DOCS_PATH = "/Users/felipedutra/Library/Mobile Documents/com~apple~CloudDocs/LotusVault";

export const vaultActions = {
  /**
   * Grava ou atualiza uma nota Markdown (.md) no LotusVault local/iCloud.
   */
  writeNote: async (title: string, content: string): Promise<string> => {
    try {
      const sanitizedTitle = title.replace(/[/\\?%*:|"<>\s]/g, '_');
      const fileName = `${sanitizedTitle}.md`;
      const base64Content = btoa(unescape(encodeURIComponent(content)));
      
      const command = `echo "${base64Content}" | base64 -d > "${CLOUD_DOCS_PATH}/${fileName}"`;
      await invoke<string>('execute_shell_command', { command });
      return `Nota "${title}" salva com sucesso no LotusVault (iCloud).`;
    } catch (e: any) {
      console.error('[VaultActions] Erro ao gravar nota:', e);
      return `Erro ao gravar nota localmente: ${e.message || e}`;
    }
  },

  /**
   * Lê uma nota Markdown específica (.md) do LotusVault.
   */
  readNote: async (title: string): Promise<string> => {
    try {
      const sanitizedTitle = title.replace(/[/\\?%*:|"<>\s]/g, '_');
      const fileName = sanitizedTitle.endsWith('.md') ? sanitizedTitle : `${sanitizedTitle}.md`;
      
      const command = `cat "${CLOUD_DOCS_PATH}/${fileName}"`;
      const output = await invoke<string>('execute_shell_command', { command });
      return output;
    } catch (e: any) {
      console.error('[VaultActions] Erro ao ler nota:', e);
      return `Não encontrei a nota "${title}" ou ela está inacessível.`;
    }
  },

  /**
   * Lista e busca termos dentro das notas Markdown no LotusVault.
   */
  searchVault: async (queryText: string): Promise<string> => {
    try {
      // Lista arquivos e busca por ocorrências simples usando grep/find do macOS
      const escapedQuery = queryText.replace(/"/g, '\\"');
      const command = `find "${CLOUD_DOCS_PATH}" -name "*.md" -type f -exec grep -li "${escapedQuery}" {} +`;
      const output = await invoke<string>('execute_shell_command', { command });
      
      if (!output || output.trim() === '') {
        // Fallback: listar últimos arquivos criados se não achar o termo
        const listCommand = `ls -t "${CLOUD_DOCS_PATH}" | head -n 10`;
        const listOutput = await invoke<string>('execute_shell_command', { command: listCommand });
        return listOutput.trim() ? `Nenhum arquivo correspondente com o termo. Notas recentes:\n${listOutput}` : 'O LotusVault está vazio no momento.';
      }

      const fileList = output.split('\n')
        .filter(x => x.trim() !== '')
        .map(path => {
          const parts = path.split('/');
          return parts[parts.length - 1];
        })
        .join('\n');
        
      return `Notas encontradas contendo o termo "${queryText}":\n${fileList}`;
    } catch (e: any) {
      console.error('[VaultActions] Erro ao buscar no Vault:', e);
      return `Erro ao buscar notas: ${e.message || e}`;
    }
  }
};
