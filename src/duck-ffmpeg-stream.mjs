// Aguarda a drenagem do pipe do FFmpeg sem acumular listeners de 'error'.
export function writeFfmpegFrame(stream,frame){
  if(stream.destroyed||stream.writableEnded)
    return Promise.reject(new Error('Pipe de vídeo do FFmpeg já foi encerrado'));
  try{
    if(stream.write(frame))return Promise.resolve();
  }catch(error){
    return Promise.reject(error);
  }
  return new Promise((resolve,reject)=>{
    const cleanup=()=>{
      stream.off('drain',onDrain);
      stream.off('error',onError);
      stream.off('close',onClose);
    };
    const onDrain=()=>{cleanup();resolve();};
    const onError=error=>{cleanup();reject(error);};
    const onClose=()=>{cleanup();reject(new Error('FFmpeg fechou o pipe antes do fim dos frames'));};
    stream.once('drain',onDrain);
    stream.once('error',onError);
    stream.once('close',onClose);
  });
}
