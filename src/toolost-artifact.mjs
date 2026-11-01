import {projectTooLostDetail} from './toolost-statement.mjs';

// Byte equality to a claimed digest is not proof of provider authenticity or payout.
export async function compareTooLostArtifact(bytes,statement,{requestedLabelId,nowMs=Date.now()}={}){
 if(!(bytes instanceof Uint8Array)||bytes.byteLength<1||bytes.byteLength>16000000)
  throw new Error('Document comparison unavailable');
 const projected=projectTooLostDetail(statement,{requestedLabelId,nowMs});
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 const actual=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
 return Object.freeze({labelId:projected.labelId,statementId:projected.statementId,
  sourceKind:projected.source.kind,documentSha256:actual,matches:actual===projected.source.documentSha256,byteLength:bytes.byteLength});
}
