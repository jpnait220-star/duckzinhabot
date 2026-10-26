// Funcionalidades sociais simples, sem criar vínculos exclusivos nem coletar informações privadas.
export function familiarityLabel(turns=0){
  const count=Math.max(0,Number(turns)||0);
  if(count<5)return 'novo por aqui';
  if(count<20)return 'conhecido da comunidade';
  return 'frequenta bastante o chat';
}

// Elogio direcionado à própria Duckzinha, não a outros membros.
// Usa regras rápidas para frases comuns e a classificação de IA continua
// disponível para elogios informais desconhecidos.
export function complimentToDuck(input,{directed=false}={}){
 const text=String(input||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/\s+/g,' ').trim();
 if(!text||text.length>180||/https?:\/\/|@everyone|@here/.test(text))return false;
 if(/\b(ajuda|urgente|erro|bug|problema|triste|socorro|medo|ansiedade|morreu|doente|chorei|senha|token)\b/.test(text))
  return false;
 // Um "não é fofa" não pode virar elogio.
 if(/\b(?:nao|nem|nunca)\s+(?:(?:e|eh|ta|tava|foi|achei|gosto|curto|adoro|amo)\s+)?(?:muito\s+)?(?:legal|fofa|fofinha|linda|boa|incrivel|top|bonita|inteligente|engracada)\b/.test(text))
  return false;
 const aimed=directed||/\bduckzinha+\b/.test(text);
 if(!aimed)return false;
 const praise=/(?:\b(?:incrivel|sensacional|maravilhosa|perfeita|fofa|fofinha|linda|bonita|gentil|inteligente|engracada|diva|querida|adoravel|legal|bacana|massa|braba|top|rainha|simpatica)\b)|(?:\bgente boa\b)|(?:\bmuito boa\b)|(?:\bboa demais\b)|(?:\bmandou bem\b)|(?:\barraz(?:ou|a)\b)|(?:\b(?:te|ti)\s+adoro\b)|(?:\b(?:amo|adoro|curto|gosto de)\s+(?:voce|vc|ce|tu|sua personalidade|seu jeito)\b)|(?:\b(?:parabens|obrigad[oa])\b)/u;
 return praise.test(text);
}

export function imageReactionKind(message,{botDirected=false}={}){
  const text=String(message||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  if(!text||text.length>180||/https?:\/\/|@everyone|@here/.test(text))return null;
  if(/\b(ajuda|urgente|erro|bug|problema|triste|socorro|medo|ansiedade|morreu|doente|chorei)\b/.test(text))return null;
  // Elogios têm prioridade mesmo quando incluem "oi" ou "kkkk".
  if(complimentToDuck(message,{directed:botDirected}))return 'fofo';
  // Cumprimentos naturais: com/sem acento, alongados, gírias e pontuação.
  const cleaned=text.replace(/^[^a-z0-9]+/,'').replace(/\s+/g,' ').trim();
  if(/^(?:o+i+(?:e+)?|(?:oi){2,}|o+la+|opa+|e\s*a[iye]+|ea+e+|salve+|fala+|bo+m+\s+d+i+a+|boa+\s+tarde+|boa+\s+noite+|oi\s*galera|hey+|hello+|hi+)(?:[^a-z0-9]|$)/.test(cleaned))return 'ola';
  if(/(?:\b(?:kkkk+|rsrs+|hahaha+|hehehe+|mds kkk|morri de rir)\b|😂|🤣)/.test(text))return 'riso';
  if(/(?:\b(?:gg|ganhamos|vencemos|conseguimos|boa demais|w demais)\b|🎉|🏆)/.test(text))return 'gg';
  if(/(?:\b(?:que susto|nao acredito|eita|caraca|meu deus)\b|😱|😮)/.test(text))return 'surpresa';
  if(/(?:\b(?:muito fofo|que fofo|bonitinho|que lindo)\b|🥹|🥰)/.test(text))return 'fofo';
  return null;
}

export function maySendImageReaction({
  now=Date.now(),lastGlobal=0,lastChannel=0,lastUser=0,
  roll=1,isGreeting=false,isCompliment=false
}={}){
  if(isGreeting){
    // Um oi pode receber reação imediatamente, mas não repita para cada spam.
    return now-lastGlobal>=8_000&&now-lastChannel>=12_000&&
      now-lastUser>=20_000;
  }
  if(isCompliment){
    // Uma chance de 50% por elogio elegível. Antispam mais curto:
    // o intervalo geral de 20 minutos por canal impedia quase todo elogio.
    return now-lastGlobal>=8_000&&now-lastChannel>=25_000&&
      now-lastUser>=60_000&&roll<0.50;
  }
  return now-lastGlobal>=5*60_000&&now-lastChannel>=20*60_000&&
    now-lastUser>=2*60_000&&roll<0.50;
}

export function ticketGuide(){
  return '**Como explicar seu problema para a equipe**\n'+
    '• Conte o que aconteceu e o que você esperava que acontecesse.\n'+
    '• Diga em qual projeto, jogo ou versão ocorreu.\n'+
    '• Copie a mensagem de erro, se houver, e explique o que já tentou.\n'+
    '• Se puder, envie um print mostrando o erro ou o problema.\n'+
    '• Nunca envie senhas, tokens ou dados pessoais no ticket.\n\n'+
    'Aguarde um membro da staff para continuar o atendimento.\n\n'+
    '💬 **Tudo pronto!** Com essas informações, nossa equipe consegue entender melhor a situação e continuar o atendimento por aqui.';
}
