import {randomUUID} from 'node:crypto';
import {ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags} from 'discord.js';
import {MOVES,TYPES,normalizedPet,calculateHit,maxHP,hpBar} from './duck-battle-data.mjs';

const hidden=text=>({content:text,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
const tag=id=>'<@'+id+'>';
function controls(arena){
  const side=arena.players[arena.turn],row=new ActionRowBuilder();
  for(let i=0;i<3;i++){
    const move=MOVES[side.pet.moves[i]];
    row.addComponents(new ButtonBuilder().setCustomId('duckbattle:'+arena.id+':'+i)
      .setLabel((move?.name||'Bicada').slice(0,65))
      .setEmoji(move?.emoji||'🦆').setStyle(ButtonStyle.Primary));
  }
  row.addComponents(
    new ButtonBuilder().setCustomId('duckbattle:'+arena.id+':guard')
      .setLabel('Defender').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('duckbattle:'+arena.id+':forfeit')
      .setLabel('Desistir').setStyle(ButtonStyle.Danger));
  return [row];
}
function battleText(b){
  const [a,z]=b.players;
  const format=p=>tag(p.id)+'  '+TYPES[p.pet.type].emoji+' **'+TYPES[p.pet.type].name+
    ' · Nível '+p.pet.level+'**\n'+hpBar(p.hp,p.max)+' **'+p.hp+'/'+p.max+' HP**'+
    (p.shield?' 🛡️ Defendendo':'');
  return '⚔️ **ARENA DOS PATINHOS • TURNO '+b.movesTaken+'**\n\n'+
    format(a)+'\n\n**VS**\n\n'+format(z)+'\n\n'+
    '🎯 **Vez de '+tag(b.players[b.turn].id)+'**\n'+
    'Use um golpe, defenda ou desista. 90 segundos por turno.\n\n'+
    (b.log?'📖 '+b.log:'Batalha começando!')+
    '\n\n💛 Batalha sem apostas de moedas.';
}
export class DuckBattleArena{
  constructor({store,random=Math.random,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}={}){
    this.store=store;this.random=random;this.now=now;
    this.setTimer=setTimer;this.clearTimer=clearTimer;
    this.battles=new Map();this.active=new Map();
  }
  cleanup(b){
    if(b.timer)this.clearTimer(b.timer);
    b.timer=null;this.battles.delete(b.id);
    for(const id of [b.challenger,b.target])
      if(this.active.get(id)===b.id)this.active.delete(id);
    b.phase='ended';
  }
  setDeadline(b,ms,callback){
    if(b.timer)this.clearTimer(b.timer);
    b.deadline=this.now()+ms;
    b.timer=this.setTimer(()=>{
      if(b.phase==='ended'||b.deadline>this.now())return;
      void callback().catch(err=>console.warn('[Duckzinha] Arena: '+err.message));
    },ms);
    b.timer?.unref?.();
  }
  async challenge(interaction){
    if(!this.store?.persistent)
      return interaction.reply(hidden('É necessário configurar o Supabase para guardar níveis e golpes.'));
    const target=interaction.options.getUser('pessoa',true);
    if(target.bot||target.id===interaction.user.id)
      return interaction.reply(hidden('Escolha outra pessoa real para enfrentar.'));
    if(this.active.has(interaction.user.id)||this.active.has(target.id))
      return interaction.reply(hidden('Um dos participantes já está em outra batalha.'));
    const guildMember=await interaction.guild.members.fetch(target.id).catch(()=>null);
    if(!guildMember)return interaction.reply(hidden('Essa pessoa não está neste servidor.'));
    const id=randomUUID().slice(0,15),b={
      id,challenger:interaction.user.id,target:target.id,
      guildId:interaction.guildId,phase:'inviting',message:null,timer:null,deadline:0,
      locked:false,players:null,turn:0,movesTaken:0,log:''
    };
    this.battles.set(id,b);this.active.set(b.challenger,id);this.active.set(b.target,id);
    const buttons=new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('duckbattle:'+id+':accept')
        .setLabel('Aceitar batalha').setEmoji('⚔️').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('duckbattle:'+id+':decline')
        .setLabel('Recusar').setStyle(ButtonStyle.Secondary)
    );
    try{
      await interaction.reply({
        content:'🦆 **DESAFIO DE PATINHOS**\n'+tag(b.challenger)+' desafiou '+tag(b.target)+
          ' para uma batalha por turnos!\n🌊🔥🌿⚡❄️ Escolha seu tipo usando /pato tipo.'+
          '\n💛 Golpes por TM, níveis, vantagens elementais e nenhuma aposta.'+
          '\n⏳ Aceite em até 60 segundos.',
        components:[buttons],allowedMentions:{users:[b.challenger,b.target]}
      });
      b.message=await interaction.fetchReply();
      this.setDeadline(b,60_000,async()=>{
        this.cleanup(b);
        await b.message?.edit({content:'⌛ O desafio expirou. Inicie outra batalha com /batalha.',
          components:[],allowedMentions:{parse:[]}}).catch(()=>{});
      });
    }catch(err){this.cleanup(b);throw err;}
  }
  async action(interaction){
    const [,id,choice]=interaction.customId.split(':');
    const b=this.battles.get(id);
    if(!b||b.phase==='ended'||b.deadline<=this.now())
      return interaction.reply(hidden('Esse desafio ou turno já expirou.'));
    if(b.locked)return interaction.reply(hidden('Estou processando a jogada. Tente novamente.'));
    if(b.phase==='inviting'){
      if(interaction.user.id!==b.target)
        return interaction.reply(hidden('Só a pessoa desafiada pode aceitar ou recusar.'));
      if(!['accept','decline'].includes(choice))
        return interaction.reply(hidden('A batalha ainda não começou.'));
      b.locked=true;
      try{
        if(choice==='decline'){
          this.cleanup(b);
          return await interaction.update({content:'🦆 Desafio recusado. Nenhuma moeda foi perdida.',
            components:[],allowedMentions:{parse:[]}});
        }
        await interaction.deferUpdate();
        const pets=await Promise.all([b.challenger,b.target].map(id=>this.store.getDuck(id)));
        if(b.phase==='ended')return;
        b.players=[b.challenger,b.target].map((id,i)=>{
          const pet=normalizedPet(pets[i]),max=maxHP(pet.level);
          return {id,pet,hp:max,max,shield:false};
        });
        b.phase='playing';b.movesTaken=0;b.turn=0;
        b.log='Desafio aceito! '+tag(b.challenger)+' começa.';
        this.setDeadline(b,90_000,async()=>this.timeout(b));
        await interaction.editReply({content:battleText(b),
          components:controls(b),allowedMentions:{parse:[]}});
      }catch(err){
        this.cleanup(b);
        console.warn('[Duckzinha] Falha ao iniciar batalha: '+err.message);
        if(interaction.deferred||interaction.replied)
          await interaction.editReply({content:'Não consegui iniciar a batalha. Tente novamente.',
            components:[]}).catch(()=>{});
        else await interaction.reply(hidden('Não consegui iniciar a batalha.')).catch(()=>{});
      }finally{b.locked=false;}
      return;
    }
    if(b.phase!=='playing')return interaction.reply(hidden('A batalha não está ativa.'));
    if(!b.players.some(p=>p.id===interaction.user.id))
      return interaction.reply(hidden('Você não participa dessa batalha.'));
    if(choice!=='forfeit'&&interaction.user.id!==b.players[b.turn].id)
      return interaction.reply(hidden('Aguarde sua vez de atacar.'));
    if(!['0','1','2','guard','forfeit'].includes(choice))
      return interaction.reply(hidden('Golpe inválido.'));
    b.locked=true;
    try{
      const current=b.players[b.turn],other=b.players[1-b.turn];
      if(choice==='forfeit'){
        const loser=b.players.find(p=>p.id===interaction.user.id);
        const winner=b.players.find(p=>p.id!==interaction.user.id);
        this.cleanup(b);
        return await interaction.update({content:'🏳️ '+tag(loser.id)+' desistiu!\n'+
          '🏆 **'+tag(winner.id)+' venceu!**\nNenhuma moeda foi apostada.',
          components:[],allowedMentions:{parse:[]}});
      }
      if(choice==='guard'){
        current.shield=true;b.log=tag(current.id)+' levantou o **Escudo de Penas** 🛡️.';
      }else{
        const moveId=current.pet.moves[Number(choice)];
        const hit=calculateHit(current.pet,other.pet,moveId,
          {guard:other.shield,random:this.random});
        other.shield=false;other.hp=Math.max(0,other.hp-hit.damage);
        const effect=hit.effect>1?' • **super efetivo!**':
          hit.effect<1?' • pouco efetivo':'';
        b.log=tag(current.id)+' usou **'+MOVES[moveId].name+'** e causou **'+
          hit.damage+' de dano**'+effect+(hit.critical?' • ✨ Crítico!':'')+'.';
      }
      b.movesTaken++;
      if(other.hp===0){
        const reward=b.movesTaken>=3;
        this.cleanup(b);
        const result='🏆 **VITÓRIA DE '+tag(current.id)+'!**\n\n'+
          battleText({...b,turn:b.turn,log:b.log})+
          '\n\n'+(reward?'⭐ Vencedor: +12 XP • Adversário: +5 XP.':'Partida muito curta: sem XP.')+
          '\n💛 Sem apostas.';
        await interaction.update({content:result.slice(0,1950),components:[],allowedMentions:{parse:[]}});
        if(reward){
          void Promise.allSettled([
            this.store.awardDuckBattleXp(current.id,'batalha:'+b.id,12),
            this.store.awardDuckBattleXp(other.id,'batalha:'+b.id,5)
          ]).then(results=>{
            for(const r of results)if(r.status==='rejected')
              console.warn('[Duckzinha] XP da batalha: '+r.reason?.message);
          });
        }
        return;
      }
      if(b.movesTaken>=36){
        this.cleanup(b);
        return interaction.update({content:'🤝 A batalha terminou empatada após 36 jogadas!\n'+
          tag(current.id)+' e '+tag(other.id)+' lutaram com coragem. Nenhuma moeda foi perdida.',
          components:[],allowedMentions:{parse:[]}});
      }
      b.turn=1-b.turn;
      this.setDeadline(b,90_000,async()=>this.timeout(b));
      await interaction.update({content:battleText(b),components:controls(b),allowedMentions:{parse:[]}});
    }finally{b.locked=false;}
  }
  async timeout(b){
    if(b.phase==='ended')return;
    const message=b.message;
    const status=b.phase==='playing'
      ?'⌛ Batalha encerrada por inatividade. Nenhum XP ou moeda foi perdido.'
      :'⌛ Desafio expirado. Nenhuma moeda foi perdida.';
    this.cleanup(b);
    await message?.edit({content:status,components:[],allowedMentions:{parse:[]}}).catch(()=>{});
  }
  shutdown(){for(const b of [...this.battles.values()])this.cleanup(b);}
}
