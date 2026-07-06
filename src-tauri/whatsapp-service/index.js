const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');

const app = express();
app.use(cors());
app.use(express.json());

let qrData = null;
let connectionStatus = 'loading';

// Inicializa o cliente do WhatsApp com sessão local salva em pasta
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './wwebjs_auth' }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    // QR foi recebido, salva pra API consultar
    qrData = qr;
    connectionStatus = 'qr_ready';
    console.log('[WhatsApp] Novo QR Code gerado');
});

client.on('ready', () => {
    qrData = null;
    connectionStatus = 'connected';
    console.log('[WhatsApp] Cliente Conectado e Pronto!');
});

client.on('authenticated', () => {
    console.log('[WhatsApp] Autenticado com sucesso!');
});

client.on('auth_failure', msg => {
    console.error('[WhatsApp] Falha na autenticação', msg);
    connectionStatus = 'disconnected';
});

client.on('disconnected', (reason) => {
    console.log('[WhatsApp] Desconectado: ', reason);
    connectionStatus = 'disconnected';
    qrData = null;
    // O cliente tenta reconectar automaticamente
});

// Começa a inicialização do Puppeteer
client.initialize().catch(err => {
    console.error("[WhatsApp] Erro fatal no initialize:", err);
    connectionStatus = 'error';
});

// ENDPOINTS DA API REST

// Endpoint para checar status e pegar QR Code
app.get('/status', async (req, res) => {
    try {
        if (connectionStatus === 'qr_ready' && qrData) {
            const qrBase64 = await qrcode.toDataURL(qrData);
            return res.json({ status: connectionStatus, qr: qrBase64 });
        }
        return res.json({ status: connectionStatus });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// FUNÇÃO AUXILIAR PARA ACHAR ID POR NOME (Contatos ou Grupos)
async function resolveWhatsAppId(to) {
    if (!/[a-zA-Z]/.test(to)) {
        // Se for número puro, assume que é pessoa
        return to.includes('@') ? to : `${to.replace(/\D/g, '')}@c.us`;
    }
    // Procura em chats (inclui Grupos)
    const chats = await client.getChats();
    const chat = chats.find(c => c.name && c.name.toLowerCase().includes(to.toLowerCase()));
    if (chat) return chat.id._serialized;
    
    // Procura em contatos da agenda
    const contacts = await client.getContacts();
    const contact = contacts.find(c => 
        (c.name && c.name.toLowerCase().includes(to.toLowerCase())) || 
        (c.pushname && c.pushname.toLowerCase().includes(to.toLowerCase()))
    );
    if (contact) return contact.id._serialized;
    
    return null;
}

// Endpoint para enviar mensagem (Agora suporta Grupos)
app.post('/send', async (req, res) => {
    const { to, message } = req.body;
    if (connectionStatus !== 'connected') return res.status(400).json({ error: 'WhatsApp offline' });
    if (!to || !message) return res.status(400).json({ error: 'Faltam parâmetros' });

    try {
        const numberId = await resolveWhatsAppId(to);
        if (!numberId) return res.status(404).json({ error: `Alvo "${to}" não encontrado.` });

        const response = await client.sendMessage(numberId, message);
        res.json({ success: true, messageId: response.id.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para criar um grupo
app.post('/group/create', async (req, res) => {
    const { name, participants } = req.body; // participants: array de nomes ou números
    if (connectionStatus !== 'connected') return res.status(400).json({ error: 'WhatsApp offline' });
    if (!name || !participants || !Array.isArray(participants)) return res.status(400).json({ error: 'Faltam parâmetros' });

    try {
        const participantIds = [];
        for (const p of participants) {
            const id = await resolveWhatsAppId(p);
            if (id) participantIds.push(id);
        }
        
        if (participantIds.length === 0) return res.status(400).json({ error: 'Nenhum participante válido encontrado' });
        
        const response = await client.createGroup(name, participantIds);
        res.json({ success: true, groupId: response.gid._serialized });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para editar grupo (nome/descrição)
app.put('/group/update', async (req, res) => {
    const { groupName, newName, description } = req.body;
    if (connectionStatus !== 'connected') return res.status(400).json({ error: 'WhatsApp offline' });

    try {
        const groupId = await resolveWhatsAppId(groupName);
        if (!groupId || !groupId.includes('@g.us')) return res.status(404).json({ error: 'Grupo não encontrado' });
        
        const chat = await client.getChatById(groupId);
        if (newName) await chat.setSubject(newName);
        if (description) await chat.setDescription(description);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para gerenciar participantes
app.post('/group/participants', async (req, res) => {
    const { groupName, action, participants } = req.body; // action: 'add' ou 'remove'
    if (connectionStatus !== 'connected') return res.status(400).json({ error: 'WhatsApp offline' });

    try {
        const groupId = await resolveWhatsAppId(groupName);
        if (!groupId || !groupId.includes('@g.us')) return res.status(404).json({ error: 'Grupo não encontrado' });
        
        const chat = await client.getChatById(groupId);
        
        const participantIds = [];
        for (const p of participants) {
            const id = await resolveWhatsAppId(p);
            if (id) participantIds.push(id);
        }

        if (participantIds.length > 0) {
            if (action === 'add') {
                await chat.addParticipants(participantIds);
            } else if (action === 'remove') {
                await chat.removeParticipants(participantIds);
            }
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para permissões de grupo
app.post('/group/settings', async (req, res) => {
    const { groupName, adminsOnlyMessages, adminsOnlySettings } = req.body;
    if (connectionStatus !== 'connected') return res.status(400).json({ error: 'WhatsApp offline' });

    try {
        const groupId = await resolveWhatsAppId(groupName);
        if (!groupId || !groupId.includes('@g.us')) return res.status(404).json({ error: 'Grupo não encontrado' });
        
        const chat = await client.getChatById(groupId);
        
        if (adminsOnlyMessages !== undefined) {
            await chat.setMessagesAdminsOnly(adminsOnlyMessages);
        }
        if (adminsOnlySettings !== undefined) {
            await chat.setInfoAdminsOnly(adminsOnlySettings);
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = 3005;
app.listen(PORT, () => {
    console.log(`[WhatsApp Service] Rodando na porta ${PORT}`);
});
