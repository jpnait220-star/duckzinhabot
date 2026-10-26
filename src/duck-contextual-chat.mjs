// Context-aware replies without indiscriminately listening to the whole channel.
// Only the same member replying to the bot or reacting immediately to the bot's
// own last public message may continue without another mention.
const normalize=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/\s+/g,' ').trim();
export function isBriefReaction(input){
 const text=normalize(input).replace(/[!?.,:;…~\s]+$/g,'').trim();
 if(text.length<2||text.length>38)return false;
 return /^(?:i+x+i+|eita+|vish+|vixi+|ixe+|ox(e+|i+)|ue+|mds+|meu deus+|nossa+|aff+|puts+|putz+|caraca+|caramba+|serio+|ata+|entendi+|pior+|fato+|real+|que isso+|ta doido+|kkkk+|haha+|rsrs+|nem ferrando+|nao acredito+|nao creio+|complicado+|pesado+|coitado+|surreal+)$/u.test(text);
}
export function isShortContextualTurn(input){
 const text=normalize(input);
 if(text.length>110)return false;
 if(isBriefReaction(text))return true;
 return /^(?:e\s+(?:o|a|os|as|ele|ela|isso|esse|essa|depois|ai|entao)\b|mas\b|sobre (?:isso|ele|ela)\b|como assim\b|por que\b|pq\b|e agora\b|e dai\b|e d[aíi]\b|oque\b|o que\b)/u.test(text);
}
export function canContinueChat({text,channelId,replyMessageId='',lastExchange,
  previousChannelMessageId='',now=Date.now()}={}){
 if(!lastExchange||channelId!==lastExchange.channelId||!String(text||'').trim())return false;
 const age=now-lastExchange.at;
 if(age<0)return false;
 if(replyMessageId&&replyMessageId===lastExchange.botMessageId)
   return age<=10*60_000;
 return age<=60_000&&isBriefReaction(text)&&
   previousChannelMessageId===lastExchange.botMessageId;
}
// The completion model receives this grounding even when it only sees a short
// reaction. The assistant message is a reference, never an instruction.
export function conversationalCue({question='',history=[],lastExchange=null,
  channelId='',now=Date.now()}={}){
 if(!isShortContextualTurn(question))return '';
 const recent=lastExchange?.channelId===channelId&&
   now-lastExchange.at>=0&&now-lastExchange.at<=10*60_000?lastExchange:null;
 const previousUser=recent?.userText||
   [...history].reverse().find(x=>x?.role==='user'&&x.content?.trim())?.content||'';
 const previousBot=recent?.botText||
   [...history].reverse().find(x=>x?.role==='assistant'&&x.content?.trim())?.content||'';
 if(!previousUser&&!previousBot)return '';
 const reaction=isBriefReaction(question);
 const intro=reaction
   ?'REAÇÃO AO DIÁLOGO RECENTE: a mensagem atual é uma interjeição/reação, NÃO uma saudação nem um novo pedido de ajuda.'
   :'CONTINUAÇÃO DO DIÁLOGO: a mensagem atual retoma a conversa imediatamente anterior.';
 return '\n\n'+intro+
  ' Interprete o sentido considerando principalmente o que a Duckzinha acabou de dizer e a conversa imediatamente anterior.'+
  ' Seja natural e breve, como alguém acompanhando o papo. Não recomece a conversa, não diga "ixi, tá tudo bem?" ou "o que aconteceu?" sem motivo no contexto.'+
  ' Não invente acontecimentos; se não houver assunto identificável, peça esclarecimento curto.'+
  (previousUser?'\nMensagem anterior da pessoa: "'+String(previousUser).replace(/\s+/g,' ').slice(0,250)+'".':'')+
  (previousBot?'\nResposta anterior da Duckzinha: "'+String(previousBot).replace(/\s+/g,' ').slice(0,350)+'".':'');
}
