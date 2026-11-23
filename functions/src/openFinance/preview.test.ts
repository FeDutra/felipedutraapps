import test from 'node:test';import assert from 'node:assert/strict';import {previewOwner} from '../../lib/openFinance/preview.js';
const grant={ownerUid:'fixture-owner',scope:'finance_snapshot_read',revoked:false,expiresAt:{toMillis:()=>2000}};
test('preview grants only scoped read before expiry',()=>assert.equal(previewOwner(grant,1000),'fixture-owner'));
test('missing expired revoked or broad grants fail closed',()=>{for(const g of [null,{...grant,revoked:true},{...grant,scope:'admin'},{...grant,expiresAt:{toMillis:()=>0}},{...grant,expiresAt:null},{...grant,ownerUid:''}])assert.throws(()=>previewOwner(g,1000),/expired_or_invalid/);});
