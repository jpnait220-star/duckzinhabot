// A member's chosen display name comes only from that same member's own
// explicit introduction, never from a Discord nickname or third-party claims.
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const normalize=s=>clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

const forbidden=new Set([
 'staff','dono','admin','moderador','ajudante','humano','cara','pessoa',
 'jogador','usuario','melhor','uma','um','estudante','brasileiro',
 'brasileira','fã','fa','voce','você','eu','ninguem','ninguém',
 'feliz','triste','novo','nova','nada','outro','outra','mesmo','mesma',
 'quem','legal','normal','real','gente','sou','era','aquele','aquela'
]);

export function pickSelfName(input){
 const text=clean(input).slice(0,320);
 // Treat a name as self-provided only when this speaker explicitly names self.
 // No generic "o Duck", mentions, reported speech ("ele é Duck"), or claims
 // that grant roles/permissions.
 const patterns=[
  /(?:^|[.!?,;]\s*|\s)\b(?:eu\s+)?(?:me\s+chamo|me\s+chamam|meu\s+nome\s+(?:é|eh|e)|pode(?:m)?\s+me\s+chamar\s+de|me\s+chame\s+de)\s+([\p{L}][\p{L}\p{N}_-]{1,23})\b/iu,
  /(?:^|[.!?,;]\s*|\s)\b(?:eu\s+)?sou\s+(?:o\s+|a\s+)?([\p{L}][\p{L}\p{N}_-]{1,23})\b/iu,
  /(?:^|[.!?,;]\s*|\s)\beu\s+(?:que\s+)?(?:sou|era)\s+(?:o\s+|a\s+)?([\p{L}][\p{L}\p{N}_-]{1,23})\b/iu,
  /(?:^|[.!?,;]\s*|\s)\b(?:meu\s+nick\s+(?:é|eh|e)|meu\s+apelido\s+(?:é|eh|e))\s+([\p{L}][\p{L}\p{N}_-]{1,23})\b/iu
 ];
 // Negation and quotations are not assertions of identity.
 if(/\b(?:n[aã]o\s+(?:sou|me\s+chamo)|nem\s+sou)\b/iu.test(text))return null;
 if(/^\s*(?:ele|ela|fulano|meu amigo|minha amiga)\s+(?:é|eh|e|se chama)\b/iu.test(text))return null;
 for(const pattern of patterns){
  const match=pattern.exec(text);
  if(!match)continue;
  const name=match[1].trim();
  if(forbidden.has(normalize(name)))continue;
  // "eu sou um cara" is not a name; neither is a Discord mention.
  if(/^\d+$/.test(name))continue;
  return name;
 }
 return null;
}
export function isSelfIdentityQuestion(input){
 const q=normalize(input).replace(/[?!.,:;]+/g,' ').replace(/\s+/g,' ').trim();
 return /(?:^|\b)(?:quem\s+(?:eu\s+sou|sou\s+eu|eu\s+era)|qual\s+(?:e\s+)?(?:o\s+)?meu\s+(?:nome|apelido|nick)|(?:voce|vc|ce|tu)\s+(?:sabe|lembra|recorda)(?:r)?\s+(?:de\s+)?quem\s+(?:eu\s+sou|sou\s+eu)|(?:voce|vc|ce|tu)\s+(?:lembra|recorda)(?:r)?\s+de\s+mim)(?:\b|$)/u.test(q);
}
export function findSelfNameInHistory(history=[]){
 // Only inspect the member's own user turns (no bot output, no channel gossip).
 for(const turn of [...history].reverse()){
  if(turn?.role!=='user'||typeof turn.content!=='string')continue;
  const name=pickSelfName(turn.content);
  if(name)return name;
 }
 return null;
}
export function identityAnswer(name){
 const chosen=clean(name);
 return chosen
  ?'Você me contou que é o **'+chosen+'**! 💛'
  :'Ainda não encontrei um nome que você tenha me contado. Como prefere que eu te chame? 💛';
}
