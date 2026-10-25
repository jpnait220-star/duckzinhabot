import {randomUUID} from 'node:crypto';
import {EXTRA_QUIZ_BANK} from './duck-extra-quiz-questions.mjs';
import {ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags} from 'discord.js';

const q=(topic,text,choices,right)=>Object.freeze({topic,text,choices,right});
export const LEVEL_NAMES=['Iniciante','Aprendiz','Intermediário','Avançado','Mestre'];
export const QUIZ_BANK=Object.freeze([
  [
    q('Minecraft','Qual mob costuma soltar linha?', ['Aranha','Ovelha','Galinha','Vaca'],0),
    q('Minecraft','Qual minério é usado para circuitos?', ['Quartzo','Redstone','Lápis-lazúli','Ametista'],1),
    q('Minecraft','Qual item costuma domesticar lobos?', ['Sementes','Pão','Osso','Maçã'],2),
    q('Minecraft','Qual é a dimensão do portal de obsidiana?', ['End','Nether','Overworld','Aether'],1),
    q('Geografia','Qual é a capital da Bahia?', ['Salvador','Recife','Fortaleza','Belém'],0),
    q('Ciência','Qual é o planeta vermelho?', ['Júpiter','Vênus','Marte','Netuno'],2),
    q('Matemática','Quanto é 9 × 8?', ['63','81','72','64'],2),
    q('Português','Qual palavra está escrita corretamente?', ['Excessão','Exceção','Exceçãum','Esceção'],1),
    q('Minecraft','Qual ferramenta quebra pedra mais rapidamente?', ['Pá','Enxada','Picareta','Tesoura'],2),
    q('Ciência','Qual estrela ilumina a Terra?', ['Sírius','Sol','Vega','Polaris'],1),
    q('Geografia','Em qual continente fica o Brasil?', ['Europa','África','América do Sul','Ásia'],2),
    q('Matemática','Quanto é 100 ÷ 4?', ['20','40','15','25'],3)
  ],
  [
    q('Minecraft','Quantos blocos de obsidiana usa o menor portal do Nether, sem cantos?', ['8','10','12','14'],1),
    q('Minecraft','Qual encantamento faz o tridente impulsionar o jogador na água?', ['Lealdade','Canalização','Correnteza','Perfuração'],2),
    q('Minecraft','Qual mob deixa cair pérolas do End?', ['Creeper','Enderman','Esqueleto','Aranha'],1),
    q('Minecraft','Qual é o nome da barra de acesso rápido?', ['Inventário','Hotbar','Scoreboard','Chat'],1),
    q('Matemática','Quanto é 15% de 200?', ['20','25','30','35'],2),
    q('Ciência','Qual é a fórmula química da água?', ['CO₂','H₂O','O₂','NaCl'],1),
    q('Geografia','Qual é o maior oceano?', ['Atlântico','Índico','Pacífico','Ártico'],2),
    q('Português','Qual é o plural de cidadão?', ['Cidadãos','Cidadões','Cidadães','Cidadãoses'],0),
    q('Tecnologia','Qual extensão é normalmente usada por arquivos JSON?', ['.png','.json','.mp3','.exe'],1),
    q('Geografia','Qual país tem a cidade de Tóquio?', ['Coreia do Sul','Japão','China','Tailândia'],1),
    q('Matemática','Uma dúzia e meia corresponde a quantas unidades?', ['12','16','18','24'],2),
    q('Ciência','Qual gás as plantas absorvem na fotossíntese?', ['Oxigênio','Hidrogênio','CO₂','Hélio'],2)
  ],
  [
    q('Minecraft','Qual é a quantidade máxima de livros para uma mesa de encantamentos no nível 30?', ['12','15','18','20'],1),
    q('Minecraft','Qual bloco permite obter Netherita por melhoria de equipamento?', ['Mesa de cartografia','Mesa de ferraria','Cortador de pedras','Alto-forno'],1),
    q('Minecraft','Qual efeito do farol aumenta a velocidade de mineração?', ['Pressa','Resistência','Força','Salto'],0),
    q('Minecraft','Qual comando normalmente mostra dados de desempenho no Java Edition?', ['F3','F1','F5','F11'],0),
    q('Matemática','Qual é o resultado de 7² − 3²?', ['16','40','49','58'],1),
    q('Ciência','Qual partícula tem carga elétrica negativa?', ['Próton','Nêutron','Elétron','Fóton'],2),
    q('Geografia','Qual é o maior deserto quente do mundo?', ['Atacama','Saara','Gobi','Kalahari'],1),
    q('Português','Qual é a forma correta para anunciar vários ovos à venda?', ['Vende-se ovos','Vendem-se ovos','Vendam-se ovo','Vendeu-se ovos'],1),
    q('Tecnologia','O que significa a sigla CPU?', ['Central Processing Unit','Computer Program Utility','Control Pixel Unit','Central Program Upload'],0),
    q('Matemática','Qual é a raiz quadrada de 144?', ['10','11','12','14'],2),
    q('Ciência','Qual é o símbolo químico do ferro?', ['F','Fr','Fe','Ir'],2),
    q('História','Em que século ocorreu a Revolução Francesa?', ['XVI','XVII','XVIII','XIX'],2)
  ],
  [
    q('Minecraft','Qual é o dano-base de uma espada de diamante no Java Edition moderno?', ['5','6','7','8'],2),
    q('Minecraft','Qual nível máximo do encantamento Proteção?', ['III','IV','V','VI'],1),
    q('Minecraft','Qual atributo do Minecraft tem valor 20 para 10 corações normais?', ['Vida máxima','Velocidade','Armadura','Resistência'],0),
    q('Minecraft','Qual efeito impede a fome de diminuir enquanto dura no modo Sobrevivência?', ['Saturação','Náusea','Pressa','Cegueira'],0),
    q('Matemática','Resolva: 3x + 7 = 31. Qual é x?', ['6','7','8','9'],2),
    q('Geografia','Qual é o país que abriga a montanha Aconcágua?', ['Chile','Argentina','Peru','Equador'],1),
    q('Ciência','Qual é a unidade do SI para resistência elétrica?', ['Volt','Ampere','Ohm','Watt'],2),
    q('Tecnologia','Qual protocolo costuma cuidar da resolução de nomes de domínio?', ['DNS','SMTP','SSH','FTP'],0),
    q('Português','Qual é a classificação de rapidamente?', ['Substantivo','Adjetivo','Advérbio','Pronome'],2),
    q('Matemática','Qual é o próximo número: 2, 6, 12, 20, 30, ...?', ['36','40','42','44'],2),
    q('Astronomia','Qual planeta tem o maior número de luas conhecidas nas listas tradicionais até 2023?', ['Marte','Júpiter','Saturno','Vênus'],2),
    q('Tecnologia','Qual notação define um valor booleano válido em JSON?', ['True','FALSE','false','False'],2)
  ],
  [
    q('Minecraft','Quantos itens uma fornalha cozinha com um bloco de carvão como combustível?', ['40','64','80','100'],2),
    q('Minecraft','Qual é o alcance horizontal aproximado de um repetidor de redstone antes de outro componente?', ['4 blocos','8 blocos','15 blocos','32 blocos'],2),
    q('Minecraft','Quantos olhos do End cabem ao todo nos espaços do portal do End?', ['8','10','12','14'],2),
    q('Ciência','Qual constante liga energia e frequência em E = h·f?', ['Constante gravitacional','Constante de Planck','Número de Avogadro','Permissividade elétrica'],1),
    q('Matemática','Qual é o resultado de 2⁵ + 3³?', ['49','59','64','81'],1),
    q('Matemática','Se 3/5 de um número são 42, qual é o número?', ['60','65','70','75'],2),
    q('Tecnologia','Qual é a complexidade de busca binária em uma lista ordenada?', ['O(n²)','O(n)','O(log n)','O(1)'],2),
    q('Geografia','Qual linha imaginária está aproximadamente em 23,5° sul?', ['Equador','Trópico de Câncer','Trópico de Capricórnio','Círculo Polar Ártico'],2),
    q('Ciência','Qual organela é responsável principalmente por produzir ATP na respiração aeróbia?', ['Lisossomo','Ribossomo','Mitocôndria','Núcleo'],2),
    q('Português','Na frase “Quando cheguei, ele saiu”, qual oração exprime tempo?', ['Ele saiu','Quando cheguei','A frase inteira','Nenhuma'],1),
    q('Lógica','Qual é o próximo número: 1, 1, 2, 3, 5, 8, ...?', ['11','12','13','15'],2),
    q('Tecnologia','Na codificação UTF-8, quantos bytes pode ocupar um caractere Unicode?', ['Sempre 1','De 1 a 4','Sempre 2','De 5 a 8'],1)
  ]
].map((level,i)=>Object.freeze([
  ...level,
  ...EXTRA_QUIZ_BANK[i].map(([topic,text,choices,right])=>q(topic,text,choices,right))
])));

export function levelForStreak(streak){
  return Math.min(5,Math.max(1,1+Math.floor(Math.max(0,streak)/3)));
}
export function chooseQuestion(level,used=[],rand=Math.random){
  const pool=QUIZ_BANK[Math.max(1,Math.min(5,level))-1];
  const unused=pool.map((_,i)=>i).filter(i=>!used.includes(level+':'+i));
  const allowed=unused.length?unused:pool.map((_,i)=>i);
  const position=allowed[Math.floor(Math.max(0,Math.min(0.999999,Number(rand())))*allowed.length)];
  return {key:level+':'+position,...pool[position]};
}
export function questionButtons(id,question){
  return [new ActionRowBuilder().addComponents(question.choices.map((label,index)=>
    new ButtonBuilder().setCustomId('duckgame:'+id+':'+index)
      .setLabel(label.slice(0,80)).setStyle(ButtonStyle.Primary)))];
}
export function questionText(question,streak,best,lead=''){
  const level=levelForStreak(streak);
  return (lead?lead+'\n\n':'')+
    '🦆 **QUIZ STREAK · '+LEVEL_NAMES[level-1]+'**\n'+
    '🔥 Sequência: **'+streak+'**   🏆 Melhor: **'+best+'**   ⭐ Nível: **'+level+'/5**\n'+
    '📚 '+question.topic+'\n\n**'+question.text+'**\n'+
    'Selecione uma resposta em até 90 segundos.';
}
export class DuckQuiz{
  constructor({now=Date.now,random=Math.random,saveBest}={}){
    this.now=now;this.random=random;this.saveBest=saveBest;
    this.sessions=new Map();this.userSessions=new Map();
    this.best=new Map();this.lastStart=new Map();
  }
  score(user){return this.best.get(user)||0;}
  activeStreak(user){
    const id=this.userSessions.get(user);
    return id?this.sessions.get(id)?.streak||0:0;
  }
  resetUser(user){
    const id=this.userSessions.get(user);
    if(id)this.sessions.delete(id);
    this.userSessions.delete(user);this.best.delete(user);this.lastStart.delete(user);
  }
  cleanup(){
    const now=this.now();
    for(const [id,s] of this.sessions){
      if(s.expires>now)continue;
      this.sessions.delete(id);
      if(this.userSessions.get(s.user)===id)this.userSessions.delete(s.user);
    }
  }
  next(user,streak=0,used=[],lastQuestion=null){
    const level=levelForStreak(streak);
    const selected=chooseQuestion(level,used,this.random);
    const id=randomUUID().slice(0,16);
    const past=used.length>=100?[]:used;
    const session={id,user,streak,question:selected,used:[...past,selected.key],expires:this.now()+90000};
    this.sessions.set(id,session);
    this.userSessions.set(user,id);
    return session;
  }
  payload(session,lead=''){
    return {
      content:questionText(session.question,session.streak,this.score(session.user),lead),
      components:questionButtons(session.id,session.question),
      allowedMentions:{parse:[]}
    };
  }
  start(interaction){
    this.cleanup();
    const user=interaction.user.id,now=this.now();
    if(now-(this.lastStart.get(user)||0)<8000)
      return {content:'Aguarde 8 segundos antes de começar outro quiz.',flags:MessageFlags.Ephemeral};
    this.lastStart.set(user,now);
    const previous=this.userSessions.get(user);
    if(previous)this.sessions.delete(previous);
    const session=this.next(user);
    return {...this.payload(session),flags:MessageFlags.Ephemeral};
  }
  async answer(interaction){
    const [,id,choice]=interaction.customId.split(':');
    const session=this.sessions.get(id);
    if(!session||session.expires<this.now()){
      if(session)this.sessions.delete(id);
      await interaction.reply({content:'⏳ Esse quiz expirou. Use /jogo quiz para tentar novamente.',
        flags:MessageFlags.Ephemeral});return;
    }
    if(session.user!==interaction.user.id){
      await interaction.reply({content:'Esse quiz pertence a outra pessoa.',
        flags:MessageFlags.Ephemeral});return;
    }
    // O item é removido antes da primeira espera assíncrona; cliques repetidos não pontuam.
    this.sessions.delete(id);
    if(this.userSessions.get(session.user)!==id){
      await interaction.reply({content:'Este quiz já foi substituído por outro.',
        flags:MessageFlags.Ephemeral});return;
    }
    this.userSessions.delete(session.user);
    const correct=Number(choice)===session.question.right;
    if(!correct){
      await interaction.update({
        content:'❌ **A sequência terminou!**\n'+
          'Resposta correta: **'+session.question.choices[session.question.right]+'**.\n'+
          '🔥 Você fez **'+session.streak+'** acertos seguidos.\n'+
          '🏆 Sua melhor sequência: **'+this.score(session.user)+'**.\n'+
          'Use /jogo quiz para tentar superar o recorde! 💛',
        components:[],allowedMentions:{parse:[]}
      });
      return;
    }
    const streak=session.streak+1;
    if(streak>this.score(session.user)){
      this.best.set(session.user,streak);
      if(this.saveBest)void Promise.resolve().then(()=>this.saveBest(session.user,streak))
        .catch(err=>console.warn('[Duckzinha] Recorde do quiz: '+String(err.message||err)));
    }
    const next=this.next(session.user,streak,session.used);
    const changed=levelForStreak(streak)>levelForStreak(session.streak);
    const lead='✅ **Acertou!** '+(changed?'🚀 Você subiu de nível!':'Próxima pergunta!')+
      ' (resposta anterior: **'+session.question.choices[session.question.right]+'**)';
    await interaction.update(this.payload(next,lead));
  }
}
