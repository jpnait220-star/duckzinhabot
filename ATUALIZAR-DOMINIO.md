# Atualização do endereço da Community — 12/11/2026

Endereço atual: **https://duckcommunity.go.altare.global**.

A base é a branch asasa da Duckzinha no commit 658b7b70c2200947aff76b25a9a3c4af4911918c, com todas as funções existentes preservadas. Mudam o endereço padrão, a configuração de exemplo, os links das respostas sobre o site/projetos, a resposta básica sem IA, o filtro de links da IA e a identificação usada nas pesquisas.

O código também migra WEBSITE_URL=https://duckzincommunity.vercel.app caso a variável antiga ainda esteja salva na host. Links antigos vindos da IA/memória passam a usar a Community atual, preservando caminho e fragmento. A restrição de links continua ativa.

## Aplicar na host da Duckzinha

1. Faça backup dos arquivos e pare somente esta instância da Duckzinha.
2. Substitua os arquivos pelo conteúdo do ZIP. Preserve seu .env e todas as variáveis/segredos existentes. Não troque o token do Discord nem o banco.
3. Recomendado: ajuste WEBSITE_URL=https://duckcommunity.go.altare.global no painel ou no .env.
4. Se precisar instalar as dependências, use npm install. Inicialização: npm start.
5. Mantenha Node.js 22.12 ou superior, conforme as dependências de voz já existentes. Este pacote não reduz o requisito para Node 20.
6. Reinicie uma única instância. Teste /website e /projetos no servidor.

Não é necessário recriar os comandos slash; seus nomes e opções não mudaram. Mensagens antigas já publicadas no Discord não são alteradas por trocar o código.

A API dos mods continua em https://duckconnect.go.altare.global, separada do site. Não use o domínio do Connect em WEBSITE_URL.

Verificação de sintaxe passou e 11 testes dos fluxos afetados passaram, cobrindo comandos, filtro de links, resposta básica e variável antiga. Não foi feita conexão real ao Discord, criação de tickets, alteração do banco ou envio de mensagens durante os testes. A aplicação na host precisa ocorrer para o bot em execução usar estes arquivos.
