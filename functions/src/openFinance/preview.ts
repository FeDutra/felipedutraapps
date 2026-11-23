import {OpenFinanceError} from './core';
export function previewOwner(record:any,now=Date.now()):string{
 const expiry=record?.expiresAt?.toMillis?.();
 if(!record||record.scope!=='finance_snapshot_read'||record.revoked!==false||!Number.isFinite(expiry)||expiry<=now||typeof record.ownerUid!=='string'||!record.ownerUid)throw new OpenFinanceError('preview_access_expired_or_invalid',401);
 return record.ownerUid;
}
