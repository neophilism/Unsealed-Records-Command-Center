/** Isolated fail-closed BFF policy. A real server must verify and supply claims, not accept browser input. */
export function permitLabelRequest(context, labelId, tokenNowMs) {
 if (!context || context.serverVerified !== true || context.tokenValid !== true ||
     typeof labelId !== 'string' || !/^[a-zA-Z0-9_-]{8,128}$/.test(labelId) ||
     !Number.isFinite(tokenNowMs) || !Number.isFinite(context.expiresAtMs) ||
     tokenNowMs >= context.expiresAtMs || !Array.isArray(context.labelGrants)) return false;
 return context.labelGrants.some(g=>g?.labelId===labelId&&g?.active===true&&
   ['viewer','operator','owner'].includes(g.role) && g.expiresAtMs>tokenNowMs);
}
export function publicBffFailure(){return Object.freeze({error:'UNAVAILABLE',message:'Data is unavailable'});}
