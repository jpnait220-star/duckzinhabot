import test from 'node:test';
import assert from 'node:assert/strict';
import {isSnowflake,isTicketChannel,ticketOpeningMessage,welcomeMessage} from '../src/community-events.mjs';

const category='123456789123456789';
test('IDs de canal/categoria válidos',()=>{
  assert.equal(isSnowflake(category),true);
  assert.equal(isSnowflake('entrada'),false);
});
test('aviso somente nos tickets privados em canais de texto',()=>{
  const privateTicket={type:0,parentId:category,name:'suporte-joao',visibleToEveryone:false};
  assert.equal(isTicketChannel(privateTicket,category),true);
  assert.equal(isTicketChannel({...privateTicket,visibleToEveryone:true},category),false);
  assert.equal(isTicketChannel({...privateTicket,parentId:'999999999999999999'},category),false);
  assert.equal(isTicketChannel({...privateTicket,type:12},category),false);
  assert.equal(isTicketChannel({...privateTicket,name:'ticket-joao'},''),true);
  assert.equal(isTicketChannel({...privateTicket,name:'atendimento-joao'},''),true);
  assert.equal(isTicketChannel({...privateTicket,name:'geral'},''),false);
  assert.equal(isTicketChannel({...privateTicket,name:'suporte-geral'},''),false);
});
test('mensagens de boas-vindas e espera são claras',()=>{
  assert.match(ticketOpeningMessage(),/aguarde um membro da .*equipe staff/);
  const welcome=welcomeMessage('987654321987654321','Comunidade Duckzin');
  assert.match(welcome,/<@987654321987654321>/);
  assert.match(welcome,/Comunidade Duckzin/);
  assert.doesNotMatch(welcomeMessage('987654321987654321','@everyone'),/@everyone/);
});
