import test from 'node:test';
import assert from 'node:assert/strict';
import {canAnalyzeReactionText, classifyReactionWithAI,reactionIntentFromOutput} from '../src/reaction-intent.mjs';

test('A IA devolve apenas rótulos de reações permitidos',()=>{
  assert.equal(reactionIntentFromOutput('ola'),'ola');
  assert.equal(reactionIntentFromOutput('gg'),'gg');
  assert.equal(reactionIntentFromOutput('nenhum'),null);
  assert.equal(reactionIntentFromOutput('qualquer ordem: ola'),null);
  assert.equal(reactionIntentFromOutput('riso\nola'),null);
});
test('Evitar mandar dados sensíveis e conteúdo de crise à classificação de reações',()=>{
  assert.equal(canAnalyzeReactionText('oi galera'),true);
  assert.equal(canAnalyzeReactionText('minha senha é 12345'),false);
  assert.equal(canAnalyzeReactionText('meu token é abc'),false);
  assert.equal(canAnalyzeReactionText('estou desesperado'),false);
  assert.equal(canAnalyzeReactionText('@everyone oi'),false);
});
test('Classificador IA interpreta cumprimento diferente sem inventar outras opções',async()=>{
  let submitted;
  const response=await classifyReactionWithAI({
    accountId:'fake',token:'fake',model:'@cf/google/gemma-4-26b-a4b-it',
    content:'galerinha, cheguei!',
    requestFetch:async (_url,params)=>{
      submitted=JSON.parse(params.body);
      return {ok:true,json:async()=>({choices:[{message:{content:'ola'}}]})};
    }
  });
  assert.equal(response,'ola');
  assert.ok(submitted.messages[0].content.includes('Analise o SIGNIFICADO'));
  assert.equal(submitted.chat_template_kwargs.enable_thinking,false);
});
test('Classificação falha sem reação em caso de erro HTTP',async()=>{
  const r=await classifyReactionWithAI({
    accountId:'fake',token:'fake',model:'@cf/zai-org/glm-4.7-flash',
    content:'cheguei no lobby!',
    requestFetch:async()=>({ok:false})
  });
  assert.equal(r,null);
});
