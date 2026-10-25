// Checks the actual active rounds. Never leaks correct choices to model prompts.
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
const noise=new Set(['qual','quais','quanto','quantos','quem','onde','quando','como',
 'marque','opcao','alternativa','correta','certo','resposta','pergunta','quiz','minigame',
 'rodada','jogo','nivel','sobre','esse','essa','isto','isso','aquele','aquela','voce',
 'sabe','diga','fale','favor','pode','minha','meu','para','com','dos','das','uma',
 'verdadeiro','falso','personagem']);
const terms=s=>normalize(s).split(' ').filter(t=>t.length>=3&&!noise.has(t));
export const GAME_ANSWER_REFUSAL='🦆 Eita, essa é uma pergunta do quiz ou minigame que ainda está rolando! 🤭 Não vou entregar a resposta nem dar dicas, hein? Escolhe uma opção e depois eu conto!';

export function activeGameQuestions({publicQuiz,miniGames,guildId,now=Date.now()}={}){
 const questions=[];
 if(!guildId)return questions;
 const prefix=String(guildId)+':';
 for(const [key,room] of publicQuiz?.rooms||[]){
  const r=room?.current;
  if(key.startsWith(prefix)&&r&&!r.closed&&r.deadline>now){
   questions.push({kind:'quiz',text:r.question.text,
    correct:r.question.choices[r.question.right]});
  }
 }
 for(const [key,game] of miniGames?.games||[]){
  if(key.startsWith(prefix)&&game?.q&&now-game.time<30000){
   questions.push({kind:'minigame',text:game.q.question,
    correct:game.q.options[game.q.answer]});
  }
 }
 return questions;
}

export function isGameAnswerRequest(input,questions=[]){
 if(!questions.length)return false;
 const q=normalize(input);
 if(!q)return false;
 const hasGame=/\b(quiz|minigame|pergunta|questao|rodada|alternativa|opcao|letra|pista|dica|resposta|gabarito|acertar)\b/.test(q);
 const wantsAnswer=/\b(resposta|correta|certa|alternativa|opcao|gabarito|pista|dica|resolve|resolva|responda|responde|ajuda|ajude|marca|marque|escolhe|escolha|pesquisa|pesquise|fala|diz|diga|qual|que|quem|quanto|onde|como)\b/.test(q);
 if(hasGame&&wantsAnswer)return true;
 if(/^(?:qual (?:e|seria|a)?\s*(?:resposta|certa|correta)?|(?:me\s+)?(?:diz|fala|responde|responda|manda)\s+(?:a\s+)?(?:resposta|certa|qual|isso)|(?:e\s+)?(?:letra|opcao|alternativa)\s+[abcd])$/.test(q))return true;
 const tokenList=terms(q);
 return questions.some(item=>{
  const question=normalize(item.text);
  if(q.length>=8&&(question.includes(q)||q.includes(question)))return true;
  const needed=new Set(terms(question));
  const shared=[...new Set(tokenList)].filter(t=>needed.has(t));
  const numbers=[...new Set(question.match(/\b\d+\b/g)||[])];
  const inputNumbers=[...new Set(q.match(/\b\d+\b/g)||[])];
  if(numbers.length>=2&&numbers.every(n=>inputNumbers.includes(n))&&wantsAnswer)return true;
  if(shared.length>=3&&wantsAnswer)return true;
  if(shared.length>=2&&needed.size<=5&&wantsAnswer)return true;
  const correct=normalize(item.correct);
  if(hasGame&&correct.length>=4&&(' '+q+' ').includes(' '+correct+' '))return true;
  return false;
 });
}
