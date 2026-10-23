// Afinidade com a Duckzinha: guarda só uma pontuação e data, nunca o texto da ofensa.
// Mensagens de terceiros, tickets e simples palavrões não contam.
// Todas as mudanças de tom se limitam a brincadeiras leves e assertividade.
export const AFFINITY_MIN=-5, AFFINITY_MAX=5;
const DAY=86_400_000;
const bad=/\b(?:sua?\s+(?:burra?|idiota|in[uú]til|chata?|lenta?|lerda?)|voc[eê]\s+[eé]\s+(?:burra?|idiota|in[uú]til|chata?|lenta?|lerda?|um lixo)|v[co]\s+[eé]\s+(?:burra?|idiota|in[uú]til|chata?)|tu\s+[eé]\s+(?:burra?|idiota|in[uú]til|chata?)|duckzinha\s+[eé]\s+(?:burra?|idiota|in[uú]til|chata?|lixo)|cala\s+a\s+boca|vai\s+se\s+ferrar|te\s+odeio|odeio\s+voc[eê]|idiota|in[uú]til)\b/i;
const nice=/\b(?:obrigad[oa]|brigad[ao]|valeu|vlw|mandou\s+bem|amei|adorei|gosto\s+de\s+voc[eê]|voc[eê]\s+[eé]\s+(?:legal|incr[ií]vel|fofa|gentil|demais)|tu\s+[eé]\s+(?:legal|incr[ií]vel|fofa)|arrasou|muito\s+boa|boa\s+duckzinha|te\s+adoro)\b/i;

export function affinitySignal(message,{directed=false}={}){
  if(!directed)return 0;
  const text=String(message||'').trim().slice(0,240).toLowerCase();
  if(!text||text.length>220||/https?:\/\/|@everyone|@here/.test(text))return 0;
  // Não punir quem está citando ou perguntando sobre uma ofensa.
  if(/\b(?:por\s+que|porque|disseram\s+que|te\s+chamaram|algu[eé]m\s+disse|o\s+que\s+[eé]|n[aã]o\s+seja|n[aã]o\s+[eé]\s+(?:burra|idiota))\b/i.test(text))return 0;
  if(bad.test(text))return -2;
  if(nice.test(text))return 1;
  return 0;
}

export function adjustedAffinity(score=0,updatedAt=null,now=Date.now()){
  let current=Math.max(AFFINITY_MIN,Math.min(AFFINITY_MAX,Math.trunc(Number(score)||0)));
  const old=Date.parse(String(updatedAt||''));
  if(!Number.isFinite(old)||old>now||current===0)return current;
  const days=Math.floor((now-old)/(3*DAY));
  if(days<=0)return current;
  return current>0?Math.max(0,current-days):Math.min(0,current+days);
}
export function nextAffinity(score,change){
  return Math.max(AFFINITY_MIN,Math.min(AFFINITY_MAX,(Number(score)||0)+change));
}
export function affinityLevel(score){
  if(score<=-3)return 'reservada';
  if(score<0)return 'cautelosa';
  if(score>=3)return 'acolhedora';
  if(score>0)return 'amigavel';
  return 'neutra';
}
export function affinityStyle(score){
  switch(affinityLevel(score)){
    case 'reservada':return 'RESERVADA: se houver provocação direta, responda de modo assertivo e com leve ironia bem-humorada, sem ofender nem humilhar. Seja útil e justa, e aceite desculpas e mudanças de atitude.';
    case 'cautelosa':return 'CAUTELOSA: mantenha educação e use brincadeiras mais contidas; não presuma má intenção em mensagens neutras. Seja útil.';
    case 'acolhedora':return 'ACOLHEDORA: quando apropriado, fale com mais entusiasmo, gentileza e referências positivas a conversas realmente lembradas. Sem intimidade exclusiva ou flerte.';
    case 'amigavel':return 'AMIGÁVEL: seja um pouco mais calorosa e descontraída, sem agir como se tivesse vínculo íntimo.';
    default:return 'NEUTRA: simpatia leve, espontânea e educada para esta pessoa.';
  }
}
