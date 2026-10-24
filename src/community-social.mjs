// Funcionalidades sociais simples, sem criar vínculos exclusivos nem coletar informações privadas.
export function familiarityLabel(turns=0){
  const count=Math.max(0,Number(turns)||0);
  if(count<5)return 'novo por aqui';
  if(count<20)return 'conhecido da comunidade';
  return 'frequenta bastante o chat';
}

export function imageReactionKind(message){
  const text=String(message||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  if(!text||text.length>180||/https?:\/\/|@everyone|@here/.test(text))return null;
  if(/\b(ajuda|urgente|erro|bug|problema|triste|socorro|medo|ansiedade|morreu|doente|chorei)\b/.test(text))return null;
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
  roll=1,isGreeting=false
}={}){
  if(isGreeting){
    // Um oi pode receber reação imediatamente, mas não repita para cada spam.
    return now-lastGlobal>=8_000&&now-lastChannel>=12_000&&
      now-lastUser>=20_000;
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
