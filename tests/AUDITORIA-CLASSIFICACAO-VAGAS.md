# Auditoria da classificação e das vagas continentais

Data da verificação: 20/10/2026

## Escopo e arquivos

- `js/app.js`: `initialTeams`, `getRows`, `getQualification`, `renderTable`, `syncCopaFinalistOptions` e os listeners dos seletores/reset.
- `js/fixtures.js`: confrontos e `officialResult` usados para separar resultados encerrados de placares simuláveis.
- `index.html`: seletores `lib`, `sula`, `cdb` e `vice`, indicadores e bloco de explicações.
- `css/style.css`: tokens das zonas e classes da posição/legenda.
- `tests/standings.test.cjs`: testes anteriores e novos testes de auditoria.

## Funcionamento encontrado

1. `initialTeams` contém a tabela-base agregada. `getRows()` cria uma cópia e acrescenta apenas placares completos e válidos encontrados em `scores` para partidas sem `officialResult`. Cada placar elegível atualiza jogos, gols, vitórias/empates/derrotas e pontos; o saldo é calculado como gols pró menos gols contra. Os resultados oficiais não são reaplicados à tabela-base.
2. A ordenação efetivamente implementada é pontos, vitórias, saldo de gols e gols pró. Ela ainda não implementa todos os critérios do REC 2026 (ver pendências).
3. `getQualification(rows)` monta mapas de fase de grupos, fase preliminar e seis vagas da Sul-Americana. Evita que um clube apareça simultaneamente em grupos e preliminar; a fase de grupos tem prioridade visual, seguida de preliminar, Sul-Americana e rebaixamento.
4. A função trata posições 17 a 20 da classificação projetada como inelegíveis para vagas de 2027. Como usa `rows`, simulações podem alterar quem ocupa essas posições. Isso é uma hipótese provisória do simulador; os documentos CONMEBOL de 2026 trazem a regra geral de divisão principal para o ano da competição, mas não confirmam a regra da edição de 2027.
5. `renderTable()` atualiza os indicadores e textos a partir de `getQualification()`. “Última posição incluída” agora considera a posição mais baixa de qualquer clube brasileiro nos mapas de grupos ou preliminar, inclusive vagas obtidas por título. A legenda e as classes CSS compartilham os mesmos tokens de cor.
6. Os quatro seletores começam vazios. As opções são independentes por competição; `syncCopaFinalistOptions()` impede o mesmo clube como campeão e vice da Copa do Brasil. Mudanças redesenham a projeção; restaurar o cenário limpa os seletores e os placares simulados.

## Regras confirmadas em fonte oficial

O [Regulamento Específico da Série A 2026, da CBF (REC, Art. 6)](https://stcbfsiteprdimgbrs.blob.core.windows.net/img-site/cdn/REC_Brasileiro_Serie_A_2026_c984f8cf05.pdf) estabelece:

- Brasileirão: posições 1 a 4 na fase de grupos e 5ª posição na fase preliminar (Art. 6, alíneas a–e).
- Copa do Brasil: campeão na fase de grupos e vice-campeão na fase preliminar (Art. 6, §1º).
- Campeão da Libertadores ou Sul-Americana que também obtenha vaga nacional ocupa a vaga continental; a vaga nacional é repassada ao clube mais bem colocado no Brasileirão ainda não classificado (Art. 6, §2º).
- O REC define como tratar sobreposições de vagas da Copa do Brasil e do Brasileirão, incluindo vagas de mesma fase e o caso de campeão da Copa já classificado por outra competição (Art. 6, §§3º–5º).
- Seis melhores colocados não classificados para a Libertadores obtêm as vagas da Sul-Americana (Art. 7).
- Os quatro últimos colocados são rebaixados (Art. 8).
- Desempate: vitórias, saldo de gols, gols pró, confronto direto (pontos e saldo agregado nos dois jogos; não se aplica a empate entre mais de dois clubes), menos cartões vermelhos, menos cartões amarelos e sorteio (Art. 15).

Os manuais oficiais de [Libertadores 2026](https://cdn.conmebol.com/wp-content/uploads/2025/12/CL-2026-Manual-de-Clubes-POR-2.pdf) e [Sul-Americana 2026](https://cdn.conmebol.com/wp-content/uploads/2025/12/Manual-de-Clubes-CONMEBOL-Sudamericana-2026-ESP.pdf), item 3.6, usam a mesma regra geral: participantes devem pertencer à divisão principal no ano em que a competição continental ocorre. Essa redação é evidência para 2026, não confirmação automática para 2027. Não localizamos manual/regulamento oficial CONMEBOL 2027 nas consultas feitas em 20/10/2026.

A CBF também confirma as vagas da Copa do Brasil em [notícia de 27/01/2026](https://www.cbf.com.br/futebol-brasileiro/noticias/supercopa-do-brasil/masculino/sorteio-da-copa-do-brasil-sera-nesta-quarta-feira-confira-os-criterios). A notícia de dezembro dizia que os casos de sobreposição ainda estavam em análise; o REC publicado em 15/12/2025 é a fonte normativa posterior usada nos testes.

## Resultados dos testes de auditoria

- Antes das alterações: `node --test tests/standings.test.cjs` — 29 aprovados, 0 reprovados.
- Depois das alterações: `node --test tests/standings.test.cjs` — 37 aprovados, 0 reprovados.
- Foram percorridas as 525 combinações possíveis dos valores atuais (vazio ou uma das quatro opções em cada seletor, excluindo campeão igual ao vice da Copa do Brasil). As verificações asseguram que escolhas não mudam estatísticas da liga, que as fases não se sobrepõem, que os indicadores coincidem com os mapas calculados, que a última posição incluída coincide com os classificados pela liga e que a explicação renderizada contém as notas produzidas pelo cálculo.
- Casos baseados no Art. 6 cobrem campeão/vice já em vagas de grupos, campeão da Copa na 5ª posição, posições repassadas e coerência das contagens. Também se verificam as equações de classificação dos 20 clubes, as cores/tokens, clube estrangeiro e os quatro seletores quando o escolhido cai na zona de rebaixamento, inclusive após um placar simulado. O caso ampliado verifica redistribuição modelada, posição vermelha, indicadores, última posição incluída e texto provisório para Libertadores, Sul-Americana, campeão e vice da Copa do Brasil.

## Problemas e limitações encontrados

1. **Critérios de desempate incompletos — confirmado.** `getRows()` para em gols pró. Não há cálculo de confronto direto, cartões vermelhos/amarelos nem sorteio. A tabela-base também não contém os cartões. A ordem pode divergir do REC em empate que ultrapasse gols pró. Para completar, faltam os registros disciplinares e é necessário definir o comportamento determinístico do sorteio; o confronto direto pode ser calculado a partir dos resultados individuais apenas quando todos os jogos pertinentes estiverem definidos.
2. **Elegibilidade de rebaixados em 2027 — pendente de confirmação específica.** A hipótese do simulador exclui os quatro últimos da classificação projetada e os mantém com status visual de rebaixamento. Os manuais de Libertadores e Sul-Americana 2026 contêm a regra geral de divisão principal para o ano da competição, mas não foi localizada a edição/regulamento 2027 que confirme sua aplicação a campeões rebaixados ou o destino de suas vagas. Os textos da interface agora identificam explicitamente a exclusão como hipótese provisória.
3. **Contagem de campeão estrangeiro — representação a esclarecer.** `externalGroups` mantém o clube estrangeiro fora da tabela brasileira, mas `direct` soma esse mapa aos clubes brasileiros. A aritmética interna é consistente com “total de clubes de fase de grupos, incluindo o campeão estrangeiro”; o rótulo atual “Vagas de grupos” não explicita esse significado. A auditoria preservou a representação para não redefinir o indicador sem decisão de produto.
4. **Sortition e cartões não podem ser validados com os dados atuais.** Não existe estado de cartões por equipe nem semente/registro oficial para sorteio. Não foi criado um critério fictício para desempatar.

## Correção realizada

Os textos dinâmicos sobre campeões rebaixados agora distinguem a regra de rebaixamento confirmada pela CBF da hipótese provisória de exclusão e avisam que a elegibilidade/redistribuição para 2027 depende de confirmação CONMEBOL. O indicador de última posição incluída passou a refletir também clubes brasileiros qualificados por título. Nenhum dado de partidas ou tabela-base foi alterado, e nenhuma regra de distribuição de vagas foi modificada.

## Revisão manual ainda necessária

- Validar elegibilidade e destino das vagas de um rebaixado após publicação do regulamento/manual CONMEBOL aplicável à Libertadores 2027 e à Sul-Americana 2027.
- Confirmar com dados oficiais disciplinar e de confronto direto os critérios de desempate ausentes.
- Definir se o indicador deve mostrar somente vagas brasileiras ou também a vaga de um campeão estrangeiro, e tornar o rótulo explícito.
