import {ActionRowBuilder,ButtonBuilder,ButtonStyle} from 'discord.js';

// Custom IDs carry only game type and Discord user IDs, never secrets or answer keys.
// Discord buttons stay beneath completed games so players can request a fresh round.
export function replayRow(type,{ownerId='',opponentId=''}={}){
 const allowed=new Set(['mini','rps','ttt','quiz','championship','coin']);
 if(!allowed.has(type))throw new Error('Unknown minigame replay type');
 let id='duckagain:'+type;
 if(type==='mini'){
   if(!/^[a-z0-9-]{1,65}$/.test(ownerId))throw new Error('Invalid minigame type');
   id+=':'+ownerId;
 }
 if(type==='ttt'){
   if(!/^[0-9]{1,25}$/.test(ownerId))throw new Error('Invalid game owner');
   id+=':'+ownerId;
 }
 if(type==='coin'){
   if(!/^[0-9]{1,25}$/.test(ownerId)||!/^[0-9]{1,25}$/.test(opponentId))
     throw new Error('Invalid coinflip players');
   id+=':'+ownerId+':'+opponentId;
 }
 return new ActionRowBuilder().addComponents(
   new ButtonBuilder().setCustomId(id)
     .setEmoji('🔄').setLabel('Jogar novamente').setStyle(ButtonStyle.Success)
 );
}
