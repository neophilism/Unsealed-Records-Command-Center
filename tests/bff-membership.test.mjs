import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rename,chmod,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {membershipContext,fileMembership} from '../src/bff/membership.mjs';
const now=1800000000000;
const identity={serverVerified:true,tokenValid:true,subject:'user_001',expiresAtMs:now+300000,
 labelGrants:[{labelId:'label_0001',active:true,role:'owner',expiresAtMs:now+300000}]};
const document=()=>({version:1,revision:1,issuer:'issuer',issuedAtMs:now,validUntilMs:now+600000,
 grants:[{subject:'user_001',labelId:'label_0001',active:true,role:'viewer',notBeforeMs:now,expiresAtMs:now+120000}]});
test('current membership intersects signed grants and limits role and expiry',()=>{
 const result=membershipContext(document(),identity,'label_0001',now);
 assert.equal(result.labelGrants[0].role,'viewer');assert.equal(result.labelGrants[0].expiresAtMs,now+120000);
 assert.equal(membershipContext(document(),identity,'label_0002',now),null);
 assert.equal(membershipContext(document(),{...identity,subject:'user_002'},'label_0001',now),null);
 assert.equal(membershipContext(document(),{...identity,labelGrants:[]},'label_0001',now),null);
});
test('revoked, expired, future, stale and malformed authority fail closed',()=>{
 for(const mutate of [d=>d.grants[0].active=false,d=>d.grants[0].expiresAtMs=now,
  d=>d.grants[0].notBeforeMs=now+1,d=>d.validUntilMs=now,d=>d.issuedAtMs=now+1,
  d=>d.grants.push({...d.grants[0]}),d=>delete d.grants[0].subject,
  d=>d.grants[0].role='superuser',d=>d.validUntilMs=now+86400001]){
  const d=document();mutate(d);assert.equal(membershipContext(d,identity,'label_0001',now),null);
 }
});
test('private file replacement applies revocation without restarting; unsafe files fail closed',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bff-membership-')),path=join(dir,'grants.json');
 const check=fileMembership({path,issuer:'issuer'});
 const put=async d=>{await writeFile(path+'.new',JSON.stringify(d),{mode:0o600});await rename(path+'.new',path);};
 try{
  assert.equal(await check(identity,'label_0001',now),null);
  await put(document());assert.ok(await check(identity,'label_0001',now));
  const revoked=document();revoked.revision=2;revoked.grants[0].active=false;
  await put(revoked);assert.equal(await check(identity,'label_0001',now),null);
  await put({...document(),issuer:'other'});assert.equal(await check(identity,'label_0001',now),null);
  await put(document());await chmod(path,0o644);assert.equal(await check(identity,'label_0001',now),null);
  await rm(path);await writeFile(path+'.target',JSON.stringify(document()),{mode:0o600});
  await symlink(path+'.target',path);assert.equal(await check(identity,'label_0001',now),null);
  await rm(path);await writeFile(path,'x'.repeat(1000001),{mode:0o600});assert.equal(await check(identity,'label_0001',now),null);
 }finally{await rm(dir,{recursive:true,force:true});}
});
