# Ecossistema ÉDEN

Central viva de estado e produtividade de Felipe Dutra. Este repositório consolida múltiplos apps em uma arquitetura modular unificada utilizando Next.js e Firebase.

## 🏗️ Arquitetura do Projeto

O projeto utiliza um padrão de **Separação por Módulos (Apps)**:

- `src/apps/`: Contém a inteligência, componentes, tipos e serviços de cada app individual.
  - `central/`: Dashboard unificador.
  - `terra/`: Sistema de regeneração e monitoramento biológico.
  - `pulso/`: Inbox universal e cockpit de estado vivo.
  - `habitos/`: (Em desenvolvimento).
- `src/app/`: Estrutura de roteamento (Next.js App Router) que consome os módulos da pasta `apps`.
- `src/shared/`: Recursos compartilhados (UI Components, Firebase Client, Utils).

## 🚀 Como Iniciar

1. **Instale as dependências:**
   ```bash
   npm install
   ```

2. **Configure o Ambiente:**
   Crie um arquivo `.env.local` baseado no padrão do Firebase (se necessário).

3. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

4. **Acesse:**
   - [http://localhost:3000/](http://localhost:3000/)

## ☁️ Deploy

O deploy é realizado via Firebase Hosting:

```bash
npm run build
firebase deploy
```

---
**Padrão Oficial de Desenvolvimento ÉDEN.**
