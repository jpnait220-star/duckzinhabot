// Interpreta pedidos claros feitos à Duckzinha quando mencionada.
// Ações de outras aplicações NÃO são slash commands; são mensagens de texto.
export function normalizeActionText(input){
  return String(input||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/\s+/g,' ').trim();
}
const voiceWords='(?:call|vc|voz|canal de voz)';
export function requestedAction(input){
  const original=String(input||'').replace(/\s+/g,' ').trim();
  if(!original||original.length>240)return null;
  const normalized=normalizeActionText(original).replace(/^[,!.?\s]+|[,!.?\s]+$/g,'');
  // Comandos rápidos são aceitos somente quando a mensagem menciona o bot (checagem no bot.mjs).
  if(/^(?:-join\s*(?:do\s+)?tts|(?:liga|ligue|ativa|ative|chama|chame|conecta|conecte|coloca|coloque|entra|entre|bota|bote|poe|ponha)\s+(?:o\s+)?tts(?:\s+(?:na|no|da|do|pra|para|nessa|nesta|minha|de|com|do canal|em)\s+.*)?|(?:coloca|coloque|bota|bote|poe|ponha|chama|chame)\s+(?:o\s+)?tts\s+(?:na|no|pra|para)\s+.*|(?:entra|entre|coloca|coloque|liga|ativa)\s+(?:na\s+)?call\s+(?:do\s+)?tts)$/i.test(normalized)){
    return {kind:'tts'};
  }
  if(/^(?:qual|quais|que|manda|mand[ae]|passa|me\s+passa|mostra|me\s+mostra|tem|onde|como\s+acesso)\b.*\b(?:site|link|pagina|website)\b|^(?:site|website|link\s+do\s+site)(?:\s+(?:do\s+)?duckzin(?:community)?)?$/i.test(normalized) ||
     /^(?:qual|quais|manda|me\s+passa|mostra|me\s+mostra)\b.*\b(?:site|link)\s+(?:do\s+)?duckzin(?:community)?\b/i.test(normalized)){
    return {kind:'website'};
  }
  if(/^(?:quais?|que|mostra|mostrar|manda|me\s+mostra|me\s+manda|tem|lista|liste|cita|cite|quero\s+ver|onde\s+acho|onde\s+estao)\b.*\b(?:projetos?|mods?|aplicativos?|apps?)\b|^(?:projetos?|mods?|apps?)$/i.test(normalized)){
    return {kind:'projetos'};
  }
  // Aceita "coloca a música X na call", "toca X", "põe música na call X".
  const start=/^(?:coloca|coloque|bota|bote|toca|toque|poe|ponha|reproduz|reproduza|play)\s+(.+)$/i.exec(normalized);
  if(start){
    let rest=start[1].replace(/^(?:(?:a|o|uma|um)\s+)?(?:musica|som|faixa|song)(?:\s+|$)/i,'').trim();
    rest=rest.replace(new RegExp('^(?:na|no) (?:minha )?'+voiceWords+'(?: |$)','i'),'').trim();
    rest=rest.replace(new RegExp('\\s+(?:na|no) (?:minha )?'+voiceWords+'$','i'),'').trim();
    rest=rest.replace(/^(?:de|do|da|chamada|chamado)\s+/i,'');
    if(!rest)return {kind:'music',song:''};
    // Só encaminhar pedido se houver nome válido, sem menções nem comando encadeado.
    if(!rest||rest.length>95||/[\r\n;<>@`]|https?:\/\//i.test(rest))return null;
    if(/^(?:na|no|a|uma|o|musica|call|vc|voz|nada)$/i.test(rest))return {kind:'music',song:''};
    return {kind:'music',song:rest};
  }
  return null;
}
export function musicBotMessage(title){
  const name=String(title||'').trim();
  if(!name||name.length>95||/[\r\n;<>@`]/.test(name)||/https?:\/\//i.test(name))return null;
  return 'm!p '+name;
}
export function ttsBotMessage(){return '-join';}
