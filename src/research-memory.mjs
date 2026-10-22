// Resumos curtos de pesquisas já realizadas, dentro do histórico da própria pessoa.
// Não armazenar automaticamente fatos da internet no conhecimento oficial do servidor.
const OPEN='[PESQUISA_ANTERIOR]';
const CLOSE='[/PESQUISA_ANTERIOR]';
const compact=s=>String(s||'').replace(/\s+/g,' ').trim();

export function researchMemoryNote(question,results=[]){
  const items=(Array.isArray(results)?results:[]).filter(
    x=>typeof x?.title==='string'&&typeof x?.summary==='string'
  ).slice(0,3);
  if(!items.length)return '';
  const topic=compact(question).slice(0,90);
  const notes=items.map(x=>compact(x.title).slice(0,65)+': '+compact(x.summary).slice(0,128));
  return OPEN+' Sobre '+topic+': '+notes.join(' | ').slice(0,520)+' '+CLOSE;
}

export function historyAnswer(answer,question,results=[]){
  const note=researchMemoryNote(question,results);
  if(!note)return compact(answer).slice(0,800);
  return (compact(answer).slice(0,250)+'\n'+note).slice(0,800);
}

export function previousResearchNotes(history=[]){
  const notes=[];
  for(const entry of [...history].reverse()){
    if(entry?.role!=='assistant'||typeof entry.content!=='string')continue;
    const start=entry.content.indexOf(OPEN),end=entry.content.indexOf(CLOSE,start+OPEN.length);
    if(start<0||end<=start)continue;
    notes.push(entry.content.slice(start+OPEN.length,end).trim().slice(0,600));
    if(notes.length>=2)break;
  }
  return notes.join('\n').slice(0,1150);
}
