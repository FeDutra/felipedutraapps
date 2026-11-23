export class OpenFinanceError extends Error {
  status: number;
  constructor(code: string, status = 502) { super(code); this.status = status; }
}
export type FinanceScope = 'personal' | 'business';
export interface PluggyConfig { clientId?: string; clientSecret?: string; }
export interface ConnectionRecord {
  ownerUid: string; itemId: string; provider: 'pluggy'; scope: FinanceScope;
  connectorId: number; state: 'connected_awaiting_sync';
}
export function validateScope(value: unknown): FinanceScope {
  if (value !== 'personal' && value !== 'business') throw new OpenFinanceError('invalid_scope', 400);
  return value;
}
export function authorizeUser(uid: string, anonymous: boolean, allowed: string | undefined) {
  if (!uid || anonymous) throw new OpenFinanceError('authentication_required', 401);
  if (!allowed?.split(',').map(v=>v.trim()).filter(Boolean).includes(uid)) throw new OpenFinanceError('finance_access_not_configured', 403);
}
export class PluggyConnectService {
  private config: PluggyConfig;
  private fetchImpl: typeof fetch;
  constructor(config: PluggyConfig, fetchImpl: typeof fetch = fetch) { this.config=config; this.fetchImpl=fetchImpl; }
  private async call(path: string, apiKey?: string, body?: unknown): Promise<any> {
    try {
      const response=await this.fetchImpl(`https://api.pluggy.ai${path}`,{
        method: body === undefined ? 'GET' : 'POST', redirect:'error', signal:AbortSignal.timeout(20000),
        headers:{'Content-Type':'application/json',...(apiKey?{'X-API-KEY':apiKey}:{})},
        ...(body === undefined ? {} : {body:JSON.stringify(body)})
      });
      if(!response.ok) throw new OpenFinanceError('pluggy_request_failed');
      return await response.json();
    } catch(error) {
      if(error instanceof OpenFinanceError) throw error;
      throw new OpenFinanceError('pluggy_unavailable');
    }
  }
  private async authenticate() {
    const {clientId,clientSecret}=this.config;
    if(!clientId || !clientSecret || clientId==='client_id' || clientSecret==='client_secret') throw new OpenFinanceError('pluggy_not_configured',503);
    const data=await this.call('/auth',undefined,{clientId,clientSecret});
    if(typeof data.apiKey!=='string' || !data.apiKey) throw new OpenFinanceError('invalid_pluggy_response');
    return data.apiKey as string;
  }
  async createToken(uid: string) {
    const key=await this.authenticate();
    const connectors=await this.call('/connectors?name=MeuPluggy&sandbox=false',key);
    const connector=connectors.results?.find((c:any)=>['meupluggy'].includes(String(c.name).replace(/\s/g,'').toLowerCase()) && c.sandbox !== true);
    if(!connector || !Number.isInteger(connector.id)) throw new OpenFinanceError('meupluggy_connector_unavailable',503);
    const result=await this.call('/connect_token',key,{options:{clientUserId:uid,avoidDuplicates:true}});
    if(typeof result.accessToken!=='string' || !result.accessToken) throw new OpenFinanceError('invalid_pluggy_response');
    return {accessToken:result.accessToken,connectorId:connector.id,expiresInSeconds:1800};
  }
  async verifyConnection(uid: string, itemId: unknown, scope: FinanceScope): Promise<ConnectionRecord> {
    if(typeof itemId!=='string' || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(itemId)) throw new OpenFinanceError('invalid_item_id',400);
    const key=await this.authenticate();
    const item=await this.call(`/items/${encodeURIComponent(itemId)}`,key);
    // Never trust the widget callback as proof of ownership or data readiness.
    if(item.id!==itemId || item.clientUserId!==uid) throw new OpenFinanceError('item_owner_not_verified',403);
    if(!['UPDATED','UPDATING','WAITING_USER_INPUT'].includes(item.status)) throw new OpenFinanceError('item_not_ready',409);
    const connector=item.connector;
    if(!connector || String(connector.name).replace(/\s/g,'').toLowerCase()!=='meupluggy' || connector.sandbox===true || !Number.isInteger(connector.id)) throw new OpenFinanceError('unexpected_connector',400);
    return {ownerUid:uid,itemId,scope,provider:'pluggy',connectorId:connector.id,state:'connected_awaiting_sync'};
  }
}
