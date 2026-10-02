# Guia de uso

[Índice da documentação](../README.md) · [Dados de mercado](MARKET_DATA.md) · [Roadmap](ROADMAP.md)

Este guia descreve a versão atual do código, revisada em 02/10/2026. A interface está em português. “Conta” reúne preferências locais e chaves de provedores: não é uma conta de login do InvestorMe nem uma conexão com corretora.

## Abrir o aplicativo

1. Instale Node.js 22 LTS ou posterior.
2. Baixe ou clone a versão atual do repositório. Se usar ZIP, extraia o arquivo.
3. Abra o terminal na pasta que contém `package.json`.
4. Execute `npm ci` e depois `npm start`.

O comando `npm start` abre o desktop Electron. `npm run preview` abre apenas uma prévia web, sem acesso aos provedores e com armazenamento separado. A janela desktop inicia em 1480 × 960 e aceita no mínimo 1024 × 700.

Se você já usa uma versão anterior, feche o programa, atualize os arquivos do projeto e execute `npm ci` novamente. Uma pasta antiga em Downloads continua sendo uma cópia antiga. Não apague os dados locais do aplicativo para atualizar. Instaladores disponíveis em artifacts do GitHub Actions precisam ser baixados após um build bem-sucedido; não há atualização automática no app.

## Configurar brapi e Twelve Data

Obtenha as chaves nas suas contas dos provedores. O InvestorMe não cria contas, compra planos nem fornece uma chave compartilhada. Não publique suas chaves em issues, capturas de tela ou commits.

1. Clique no perfil/engrenagem no rodapé da barra lateral.
2. Em **Conta e configurações**, encontre **Conexões de mercado**.
3. Selecione **Brasil: brapi · EUA: Twelve Data** para usar ambos, ou escolha somente um provedor.
4. Cole cada chave no campo correspondente.
5. Clique em **Salvar e conectar**. O aplicativo aplica a configuração e solicita cotações.
6. Clique em **Testar conexão salva** de cada provedor. O teste consulta PETR4 para brapi e AAPL para Twelve Data.
7. Em **Mercados**, consulte os valores recebidos, a origem, o horário e eventuais erros.

O teste usa a chave já salva; digitar uma nova chave sem salvar não muda a credencial testada. Uma resposta “Conectado” comprova aquela consulta naquele momento, não acesso a todos os ativos ou ao histórico. Consultas, testes e salvamentos que atualizam cotações podem consumir a cota da API.

| Ação | Efeito |
| --- | --- |
| Salvar com campo de chave vazio | Mantém a chave já configurada. |
| Remover chave | Apaga a credencial daquele provedor. Na brapi, símbolos públicos podem continuar disponíveis sem token. |
| Desconectar | Para as consultas normais e limpa as cotações exibidas; conserva as chaves para reconexão. |
| Testar conexão salva | Faz uma consulta explícita, inclusive se a conexão geral estiver desativada. |
| Limpar workspace | Remove registros/preferências após confirmação; não remove as chaves. |

As chaves ficam fora do workspace e da exportação JSON, protegidas pelo sistema operacional. Se essa proteção não estiver disponível, a tela informa que elas valem apenas para a sessão: será preciso digitá-las novamente ao reabrir o app. As chaves salvas não reaparecem nos campos.

Sem token brapi, o adaptador permite consultar PETR4, VALE3, ITUB4 e MGLU3. Outros ativos e o acesso da Twelve Data dependem do plano. O app não garante tempo real; consulte os horários dos dados e os termos atuais do provedor. Os limites exibidos pelo seu painel de conta são a referência para uso e cobrança.

## Entender os valores

- `—` significa que o valor não pôde ser calculado ou obtido. Não significa preço zero.
- Caixa e custo médio são informados por você; o aplicativo não importa seu saldo de corretora.
- Capital investido é quantidade × custo médio. Valor de mercado usa a cotação recebida. P/L não realizado compara esses valores.
- Se faltar a cotação de uma posição relevante, os totais que dependem dela ficam indisponíveis.
- Uma carteira vazia pode legitimamente mostrar zero. Isso não é uma cotação fictícia.
- Ao falhar uma atualização, as cotações afetadas são removidas. Respostas reais ainda dentro do cache podem ser reutilizadas; atualizar não força uma chamada nova a cada clique.
- O horário vem do provedor. O aviso de cotação antiga não determina se a bolsa está aberta.

Não existem mais preços de demonstração ou resultados de treinamento/backtest fabricados no aplicativo. O catálogo inicial contém apenas nomes e identificadores de ativos reais.

## Páginas e recursos

| Área | Como usar e limites |
| --- | --- |
| Visão geral | Resumo da carteira e contagem das configurações locais. A evolução histórica da carteira ainda está indisponível. |
| Carteira → Resumo / Posições | Adicione, edite e exclua posições B3 em BRL; informe quantidade, custo médio e caixa. Não há livro de operações nem conversão cambial. |
| Carteira → Desempenho / Rendimentos | Estados vazios: histórico da carteira e motor de proventos ainda não existem. |
| Carteira → Alocação | Pesos calculados com os valores de mercado disponíveis, incluindo caixa na alocação patrimonial. |
| Carteira → Risco | Limites editáveis e efeito aritmético de uma queda uniforme escolhida. Não calcula VaR, volatilidade ou drawdown histórico. |
| Mercados | Filtre o catálogo, adicione favoritos, use **Consultar provedor** para buscar novos ativos e **Atualizar cotações** para atualizar conforme cache e limites. |
| Laboratório → Estratégias | Cadastre regras e limites, ative/pause o estado local e associe modelos/scripts. Nenhuma regra é executada. |
| Laboratório → Modelos | Salve configurações; treinamento e previsões permanecem indisponíveis. |
| Laboratório → Scripts | Edite texto Python/JavaScript, salve, duplique, renomeie e associe a modelos/estratégias. Não executa código. |
| Laboratório → Testes | Salve estratégia, período e capital de um futuro backtest. Os registros ficam “Não executado”, sem métricas inventadas. |
| Sino → Alertas | Cadastre condições, ative/desative regras e marque como lidas. Ainda não há monitoramento nem disparo de notificações. |
| Conta e configurações | Chaves, nome local, tema, densidade, preferências de notificações, exportação e limpeza. |

Em Mercados, abra um ativo e escolha **Histórico diário** para solicitar OHLCV dos últimos 30 dias. A disponibilidade depende do provedor. Isso não produz automaticamente o gráfico de desempenho da sua carteira. O catálogo não é uma lista completa da bolsa; busca local e consulta ao provedor são operações diferentes.

Use `Ctrl+K` para buscar páginas/ativos. No editor de scripts, `Ctrl+S` salva e Tab insere quatro espaços; o conteúdo também é salvo automaticamente. Vincular um script organiza a pesquisa, sem torná-lo executável.

## Personalização

Clique em **Personalizar** no cabeçalho. Arraste os painéis pelo título ou use as setas; redimensione pelo canto inferior direito. A engrenagem do painel permite mudar nome, dimensões e cor. **Painéis** mostra/oculta componentes. Clique em **Concluir** para sair.

**Restaurar padrão** restaura somente o layout da página atual. **Limpar workspace**, na conta, é uma ação diferente: remove os registros e preferências locais após confirmação. Layouts são salvos junto do workspace e incluídos na exportação.

## Persistência, migração e exportação

Use **Exportar workspace** ou a opção de exportação na conta para salvar JSON. No desktop, escolha o destino no diálogo nativo. A exportação contém posições, regras, scripts, layouts e preferências; não contém as chaves ou o cache de cotações. Não existe interface para importar esse JSON nesta versão.

Ao abrir um workspace antigo, a migração remove exemplos iniciais reconhecidos e mantém registros personalizados/editados. Resultados simulados de modelos/backtests são retirados; configurações do usuário permanecem. A versão lógica continua `1`, com revisão de dados `2`.

Quando o armazenamento permite, a migração guarda uma cópia local do original em `investorme.workspace.v1.before-real-data`. Ela não é exibida nem reimportada automaticamente. Registros antigos não tinham informação de origem: um valor idêntico ao exemplo original pode ser reconhecido como exemplo mesmo se tiver sido escolhido manualmente. A cópia permite investigar essa situação. Não há sincronização nem sistema automático de backup; exporte seus registros importantes.

## Resolver problemas

| Sintoma | Verificação |
| --- | --- |
| A área de chaves não aparece | Confirme que abriu a versão atual pelo desktop, não uma pasta antiga ou a prévia web. Se ocultou o painel, use a personalização para mostrá-lo. |
| Chave configurada, mas sem preços | Salve antes de testar; confira o modo selecionado, internet, permissões do ativo e limites do plano. Veja o erro na conta/Mercados. |
| `AUTH_ERROR` | Chave ausente/inválida ou recurso fora do plano. No modo combinado, verifique cada provedor separadamente. |
| `RATE_LIMIT` | Aguarde o prazo do provedor; repetir cliques não contorna a cota. |
| `NO_NETWORK` / `TIMEOUT` | Verifique a conexão e tente mais tarde. Não há fallback fictício. |
| `INVALID_SYMBOL` / `UNSUPPORTED` | O símbolo, mercado, tipo ou intervalo não é suportado pelo adaptador/serviço. |
| `INVALID_RESPONSE` / `PROVIDER_ERROR` | A resposta está incompleta, incoerente ou o serviço falhou. Ela não é convertida em números inventados. |
| Chaves somem após reiniciar | Confira o aviso de uso apenas nesta sessão; sem proteção do sistema elas não são gravadas. |
| Variáveis de ambiente não alteram a conexão | Configuração salva na conta tem prioridade. Arquivos `.env` não são carregados automaticamente. |
| Dados financeiros inválidos | Use as ações de editar/excluir/corrigir caixa e exportar. Não é necessário resetar todo o workspace. |

Ao relatar um problema, informe versão/commit, sistema, ação e código de erro. Oculte credenciais e dados pessoais.
