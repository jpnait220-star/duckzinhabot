import {spawn} from 'node:child_process';
import ffmpegStatic from 'ffmpeg-static';
import {Routes,MessageFlags,PermissionFlagsBits} from 'discord.js';

// Discord exige Ogg/Opus mono, duração e forma de onda.
// A versão 14.22 de discord.js não preenche os metadados de voz em AttachmentBuilder;
// por isso usamos REST do próprio cliente com a rota oficial de mensagens.
export async function runFfmpeg(input,args,{
  binary=ffmpegStatic,spawnProcess=spawn,timeoutMs=20000,maxBytes=5*1024*1024
}={}){
  if(!Buffer.isBuffer(input)||input.length<24||input.length>4*1024*1024)
    throw Error('Áudio de entrada inválido para conversão');
  if(!binary)throw Error('FFmpeg não está disponível na FadeHost');
  return new Promise((resolve,reject)=>{
    let child,finished=false;
    try{child=spawnProcess(binary,['-hide_banner','-loglevel','error','-nostdin',
      '-i','pipe:0',...args],{stdio:['pipe','pipe','pipe']});}
    catch(err){return reject(err);}
    const chunks=[];let len=0,stderr='';
    const timeout=setTimeout(()=>{finish(new Error('Tempo limite na conversão de voz'));child.kill();},timeoutMs);
    timeout.unref?.();
    function finish(err,result){
      if(finished)return;finished=true;clearTimeout(timeout);
      if(err)reject(err);else resolve(result);
    }
    child.on('error',finish);
    child.stderr.on('data',data=>{stderr=(stderr+String(data)).slice(-500);});
    child.stdout.on('data',buf=>{
      len+=buf.length;
      if(len>maxBytes){finish(new Error('Voz excedeu limite de tamanho'));child.kill();}
      else chunks.push(buf);
    });
    child.on('close',code=>{
      if(finished)return;
      if(code!==0)return finish(new Error('FFmpeg '+code+': '+stderr.slice(-220)));
      const output=Buffer.concat(chunks);
      if(output.length<16)return finish(new Error('Áudio convertido vazio'));
      finish(null,output);
    });
    child.stdin.on('error',finish);
    child.stdin.end(input);
  });
}
export function makeWaveform(pcm,{sampleRate=8000}={}){
  if(!Buffer.isBuffer(pcm)||pcm.length<2)throw Error('PCM vazio');
  // Máximo 256 pontos; bloco <=100ms quando possível.
  const samples=Math.floor(pcm.length/2);
  const points=Math.min(256,Math.max(1,Math.ceil(samples/Math.floor(sampleRate/10))));
  const wave=Buffer.alloc(points);
  let peak=1;const powers=[];
  for(let n=0;n<points;n++){
    const start=Math.floor(n*samples/points),end=Math.floor((n+1)*samples/points);
    let sum=0,count=0;
    for(let i=start;i<end;i++){
      const sample=pcm.readInt16LE(i*2)/32768;
      sum+=sample*sample;count++;
    }
    const value=Math.sqrt(sum/Math.max(1,count));
    powers.push(value);peak=Math.max(peak,value*12);
  }
  for(let i=0;i<points;i++)
    wave[i]=Math.max(12,Math.min(255,Math.round(255*Math.pow(powers[i]/peak,.65))));
  return wave.toString('base64');
}
export async function convertToVoiceMessage(audio,options={}){
  const base=['-vn','-ac','1'];
  const [pcm,ogg]=await Promise.all([
    runFfmpeg(audio,[...base,'-ar','8000','-f','s16le','pipe:1'],{
      ...options,maxBytes:3*1024*1024
    }),
    runFfmpeg(audio,[...base,'-ar','48000','-c:a','libopus',
      '-b:a','32k','-application','voip','-f','ogg','pipe:1'],{
      ...options,maxBytes:3*1024*1024
    })
  ]);
  if(ogg.subarray(0,4).toString('ascii')!=='OggS')
    throw Error('FFmpeg não retornou Ogg/Opus válido');
  const duration=Number((pcm.length/2/8000).toFixed(3));
  if(duration<.1||duration>180)throw Error('Duração inválida da mensagem de voz');
  return {audio:ogg,duration,waveform:makeWaveform(pcm)};
}
export function nativeVoicePayload({audio,duration,waveform}){
  if(!Buffer.isBuffer(audio)||audio.subarray(0,4).toString('ascii')!=='OggS')
    throw Error('Mensagem de voz precisa ser Ogg/Opus');
  if(!Number.isFinite(duration)||duration<=0||duration>180)
    throw Error('Duração da mensagem de voz inválida');
  if(typeof waveform!=='string'||!waveform||Buffer.from(waveform,'base64').length>256)
    throw Error('Forma de onda inválida');
  return {
    body:{
      flags:MessageFlags.IsVoiceMessage,
      attachments:[{id:0,filename:'duckzinha-voz.ogg',
        duration_secs:duration,waveform}]
    },
    files:[{name:'duckzinha-voz.ogg',data:audio,contentType:'audio/ogg'}]
  };
}
export async function sendNativeVoice(interaction,converted){
  const channel=interaction.channel;
  if(!channel?.id||!interaction.inGuild())throw Error('Use em um canal do servidor.');
  const me=interaction.guild.members.me||await interaction.guild.members.fetchMe();
  const permissions=channel.permissionsFor(me);
  const required=[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.AttachFiles,PermissionFlagsBits.SendVoiceMessages];
  if(!permissions?.has(required))throw Error(
    'Preciso de Ver canal, Enviar mensagens, Anexar arquivos e Enviar mensagens de voz.');
  const payload=nativeVoicePayload(converted);
  // A rota POST /channels/{id}/messages é diferente da resposta da interação:
  // mensagens de voz nativas não podem ser editadas nem conter texto.
  return interaction.client.rest.post(Routes.channelMessages(channel.id),payload);
}
