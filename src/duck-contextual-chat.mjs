// Each chat continuation is about conversation chronology, not a keyword
// dictionary. The language model decides whether the next text is a reaction,
// a related question, a joke, or a genuinely new subject.
const textOf=value=>String(value??'').replace(/\s+/g,' ').trim();

export function isBriefReaction(input){
 // Compatibility helper for older tests; it does NOT decide context.
 const text=textOf(input);
 return text.length>=1&&text.length<=40&&!/[?.]\s+\S/.test(text);
}
export function isShortContextualTurn(input){
 // Any short spontaneous message is eligible for contextual interpretation.
 // This includes unknown slang, typos, random expressions and new vocabulary.
 const text=textOf(input);
 return text.length>0&&text.length<=160;
}
export function canContinueChat({text,channelId,replyMessageId='',lastExchange,
  previousChannelMessageId='',now=Date.now()}={}){
 if(!lastExchange||channelId!==lastExchange.channelId||!textOf(text))return false;
 const elapsed=now-lastExchange.at;
 if(elapsed<0)return false;
 if(replyMessageId&&replyMessageId===lastExchange.botMessageId)
   return elapsed<=10*60_000;
 // No unsolicited monitoring: a message without an @mention must be from
 // this same person directly after the bot's own last reply in this channel.
 return elapsed<=60_000&&isShortContextualTurn(text)&&
   previousChannelMessageId===lastExchange.botMessageId;
}
export function conversationalCue({question='',history=[],lastExchange=null,
  channelId='',now=Date.now()}={}){
 const current=textOf(question);
 if(!current)return '';
 const recent=lastExchange?.channelId===channelId&&
   now-lastExchange.at>=0&&now-lastExchange.at<=10*60_000?lastExchange:null;
 // A prior exchange in the same channel is strongest evidence. When an
 // in-memory exchange is unavailable (restart), use only supplied history;
 // the AI is instructed to check whether the new subject is related.
 const previousUser=recent?.userText||
   [...history].reverse().find(x=>x?.role==='user'&&x.content?.trim())?.content||'';
 const previousBot=recent?.botText||
   [...history].reverse().find(x=>x?.role==='assistant'&&x.content?.trim())?.content||'';
 if(!previousUser&&!previousBot)return '';
 const mode=isShortContextualTurn(current)?'MENSAGEM CURTA':'NOVA MENSAGEM';
 return '\n\nCONTEXTO CONVERSACIONAL ('+mode+'): Antes de responder à nova fala, '+
  'compare-a com as últimas mensagens. Identifique por sentido e situação se '+
  'é uma reação espontânea, uma resposta ao que a Duckzinha disse, uma continuação, '+
  'uma brincadeira ou um assunto novo. Não dependa de uma lista de palavras: '+
  'interjeições, gírias desconhecidas, risadas, erros de digitação e frases sem '+
  'pergunta podem ser comentários sobre a fala imediatamente anterior. '+
  'Se alguém insiste, diz que está mandando, ou reclama que você não entendeu, '+
  'releia o pedido anterior da pessoa e o que você respondeu: pode ser '+
  'uma correção ou continuação da mesma tarefa, não um assunto novo. '+
  'Não insulte nem dê broncas ao usuário por insistir. '+
  'Quando fizer sentido, responda à conversa que já está acontecendo, como num chat '+
  'natural, sem cumprimentar de novo, sem fingir que não houve conversa e sem '+
  'perguntar genericamente "tá tudo bem?" ou "o que aconteceu?". '+
  'Quando o usuário mudar claramente de assunto, acompanhe a mudança em vez '+
  'de forçar relação com o anterior. Em caso de dúvida real, esclareça brevemente. '+
  'NÃO invente fatos ausentes no contexto nem compartilhe conteúdo privado.'+
  (previousUser?'\nMensagem anterior da pessoa: "'+textOf(previousUser).slice(0,290)+'".':'')+
  (previousBot?'\nResposta anterior da Duckzinha: "'+textOf(previousBot).slice(0,390)+'".':'');
}

// Used only if the external model is unavailable. Do not pretend to have
// interpreted a reaction with AI when the AI did not respond.
export function reactionFallback(input,{lastExchange=null,channelId='',now=Date.now()}={}){
 if(!isShortContextualTurn(input)||!lastExchange||lastExchange.channelId!==channelId||
  now-lastExchange.at<0||now-lastExchange.at>10*60_000)return null;
 return 'Eu lembro do que estávamos falando, mas minha IA não conseguiu responder agora. Pode repetir essa parte? 💛';
}
