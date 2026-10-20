const initialTeams = [
  // Clube, J, V, E, D, SG, Pts, GP, GC — classificação de referência após a 31ª rodada.
  ['Flamengo',31,20,7,4,36,67,61,25],['Palmeiras',31,19,9,3,32,66,54,22],['Athletico-PR',31,15,8,8,12,53,49,37],['Cruzeiro',31,15,6,10,4,51,50,46],['Fluminense',31,14,9,8,10,51,49,39],['Atlético-MG',31,14,8,9,7,50,42,35],['Bahia',31,13,10,8,5,49,44,39],['Santos',31,12,9,10,2,45,48,46],['São Paulo',31,12,6,13,1,42,36,35],['Bragantino',31,11,8,12,3,41,39,36],['Botafogo',31,10,9,12,-4,39,44,48],['Coritiba',31,10,9,12,-11,39,38,49],['Vitória',31,10,7,14,-11,37,34,45],['Mirassol',31,9,9,13,-8,36,36,44],['Vasco',30,9,8,13,-7,35,36,43],['Corinthians',31,8,9,14,-7,33,32,39],['Internacional',31,7,11,13,-7,32,33,40],['Grêmio',31,7,10,14,-10,31,34,44],['Remo',31,5,11,15,-15,26,34,49],['Chapecoense',30,3,9,18,-32,18,30,62],
];
// Restore fixture-compatible club names when text was decoded twice; numeric base data is untouched.
const normalizeClubName = name => name.replace(/\u00c3\u0192\u00c2/g, '\u00c3');
initialTeams.forEach(team => { team[0] = normalizeClubName(team[0]); });

const fixtures = globalThis.BRASILEIRAO_FIXTURES_2026;
const fixturesByRound = Object.fromEntries(Array.from({length:38}, (_, i) => [String(i + 1), fixtures.filter(f => f.round === i + 1)]));
let teams = initialTeams.map(team => team.slice());
let scores = {};
const currentSeasonRound = 32;
let currentRound = currentSeasonRound;
const $ = id => document.getElementById(id);
const teamNames = initialTeams.map(team => team[0]);
const resolveLeagueClub = name => teamNames.find(team => normalizeClubName(team) === name) || name;
const sortClubsAlphabetically = clubs => clubs.sort((a,b) => a.localeCompare(b,'pt-BR'));
const copaDoBrasilContenders = sortClubsAlphabetically([resolveLeagueClub('Atl\u00e9tico-MG'),resolveLeagueClub('Gr\u00eamio'),'Palmeiras','Vasco']);
const cupContenders = {
  lib:sortClubsAlphabetically(['Flamengo','Fluminense','Palmeiras','Estudiantes']),
  sula:sortClubsAlphabetically([resolveLeagueClub('Atl\u00e9tico-MG'),'Vasco','Boca Juniors','Montevideo City Torque']),
  cdb:copaDoBrasilContenders,
  vice:copaDoBrasilContenders,
};
// Escudos estáticos do pacote público de 2026: github.com/Lobobinho/Escudos-dos-Clubes-do-Brasileirao-2026
const clubCrests = {
  'Athletico-PR': ['athletico-pr.png', 'CAP'], 'Atlético-MG': ['atletico-mg.png', 'CAM'],
  Bahia: ['bahia.png', 'BAH'], Botafogo: ['botafogo.png', 'BOT'], Chapecoense: ['chapecoense.png', 'CHA'],
  Corinthians: ['corinthians.png', 'COR'], Coritiba: ['coritiba.png', 'CFC'], Cruzeiro: ['cruzeiro.png', 'CRU'],
  Flamengo: ['flamengo.png', 'FLA'], Fluminense: ['fluminense.png', 'FLU'], Grêmio: ['gremio.png', 'GRE'],
  Internacional: ['internacional.png', 'INT'], Mirassol: ['mirassol.png', 'MIR'], Palmeiras: ['palmeiras.png', 'PAL'],
  Bragantino: ['bragantino.png', 'RBB'], Remo: ['remo.png', 'REM'], Santos: ['santos.png', 'SAN'],
  'São Paulo': ['sao-paulo.png', 'SAO'], Vasco: ['vasco.png', 'VAS'], Vitória: ['vitoria.png', 'VIT'],
};

function renderCrest(name) {
  const [file, initials] = clubCrests[normalizeClubName(name)] || ['', name.slice(0, 3).toUpperCase()];
  return file
    ? `<span class="crest-wrap"><img class="club-crest" src="assets/crests/${file}" alt="" aria-hidden="true"><span class="crest-fallback" hidden>${initials}</span></span>`
    : `<span class="crest-wrap"><span class="crest-fallback">${initials}</span></span>`;
}

function renderClub(name, side) {
  const [, initials] = clubCrests[normalizeClubName(name)] || ['', name.slice(0, 3).toUpperCase()];
  const crest = renderCrest(name);
  const label = `<span class="club-abbr" aria-hidden="true">${initials}</span>`;
  return `<div class="${side} team-cell" aria-label="${normalizeClubName(name)}">${side === 'home' ? label + crest : crest + label}</div>`;
}

function renderStandingsClub(name) {
  return `<div class="standings-club">${renderCrest(name)}<span class="club-name">${name}</span></div>`;
}

function fillSelect(id) {
  $(id).innerHTML = '<option value="">Selecione um clube</option>' + cupContenders[id].map(name => '<option value="' + name + '">' + name + '</option>').join('');
  $(id).value = '';
}

const copaSemifinalOpponents = new Map([
  [resolveLeagueClub('Atl\u00e9tico-MG'), resolveLeagueClub('Gr\u00eamio')],
  [resolveLeagueClub('Gr\u00eamio'), resolveLeagueClub('Atl\u00e9tico-MG')],
  ['Palmeiras', 'Vasco'],
  ['Vasco', 'Palmeiras'],
]);
const getCopaFinalistConflict = (champion, runnerUp) =>
  Boolean(champion && runnerUp && (champion === runnerUp || copaSemifinalOpponents.get(champion) === runnerUp));
const copaConflictMessage = 'Campe\u00e3o e vice-campe\u00e3o da Copa do Brasil precisam vir de semifinais diferentes.';
let copaSelectionNotice = '';

function hasCompleteScore(score) {
  if (!score || score[0] === '' || score[1] === '' || score[0] == null || score[1] == null) return false;
  return score.every(value => Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 30);
}

function getDelayedFixtures() {
  return fixtures.filter(fixture => fixture.round < currentSeasonRound && !fixture.officialResult);
}

function formatFixtureDate(date) {
  if (!date) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : date;
}

function getFixtureWeekday(date) {
  if (!date) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return '';
  return ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'][new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]))).getUTCDay()];
}

function syncCopaFinalistOptions() {
  const champion = $('cdb').value;
  let runnerUp = $('vice').value;
  if (getCopaFinalistConflict(champion, runnerUp)) {
    // Keep the champion and clear the conflicting runner-up selection.
    $('vice').value = '';
    runnerUp = '';
    copaSelectionNotice = copaConflictMessage;
  } else {
    copaSelectionNotice = '';
  }
  const disabledForVice = champion ? [champion, copaSemifinalOpponents.get(champion)] : [];
  const disabledForChampion = runnerUp ? [runnerUp, copaSemifinalOpponents.get(runnerUp)] : [];
  [['cdb', disabledForChampion], ['vice', disabledForVice]].forEach(([id, unavailable]) => {
    const select = $(id);
    const selected = select.value;
    select.innerHTML = '<option value="">Selecione um clube</option>' + cupContenders[id].map(name =>
      '<option value="' + name + '"' + (unavailable.includes(name) ? ' disabled' : '') + '>' + name + '</option>'
    ).join('');
    select.value = selected;
  });
}

fillSelect('lib');
fillSelect('sula');
fillSelect('cdb');
fillSelect('vice');
$('roundSelect').innerHTML = Array.from({length:38}, (_, index) => '<option value="' + (index + 1) + '">Rodada ' + (index + 1) + '</option>').join('');
$('roundSelect').value = String(currentRound);

function renderFixtures() {
  const games = fixturesByRound[String(currentRound)] || [];
  $('roundSelect').value = String(currentRound);
  $('prevRound').disabled = currentRound <= 1;
  $('nextRound').disabled = currentRound >= 38;
  $('fixtures').innerHTML = games.map(g => {
    const score = scores[g.id] || ['', ''];
    const official = g.officialResult;
    const completed = !official && hasCompleteScore(score);
    const inProgress = !official && score.some(value => value !== '' && value != null);
    const editable = !official && (Number(g.id) >= 311 || g.id === '210' || g.id === '304');
    const scoreMarkup = official
      ? `<b class="official-score" aria-label="Resultado oficial">${official.homeGoals} × ${official.awayGoals}</b>`
      : editable
        ? `<input class="score" inputmode="numeric" type="number" min="0" max="30" aria-label="Gols ${g.home}" data-id="${g.id}" data-side="0" value="${score[0]}"><span class="dash">×</span><input class="score" inputmode="numeric" type="number" min="0" max="30" aria-label="Gols ${g.away}" data-id="${g.id}" data-side="1" value="${score[1]}">`
        : '<span class="pending-score">Resultado pendente</span>';
    const details = [getFixtureWeekday(g.date), formatFixtureDate(g.date), g.time, g.stadium].filter(Boolean).join(' · ');
    const fixtureState = official ? 'fixture-official' : completed ? 'fixture-simulated' : 'fixture-simulatable';
    return `<article class="fixture ${fixtureState}${inProgress && !completed ? ' fixture-in-progress' : ''}" data-fixture-id="${g.id}">${renderClub(g.home, 'home')}${scoreMarkup}${renderClub(g.away, 'away')}<div class="date">${details}</div></article>`;
  }).join('');
  document.querySelectorAll('.club-crest').forEach(image => image.addEventListener('error', () => {
    image.hidden = true;
    image.nextElementSibling.hidden = false;
  }));
  document.querySelectorAll('.score').forEach(input => input.addEventListener('input', () => {
    const id = input.dataset.id;
    if (!scores[id]) scores[id] = ['', ''];
    scores[id][Number(input.dataset.side)] = input.value;
    const card = Array.from(document.querySelectorAll('.fixture')).find(item => item.dataset.fixtureId === id);
    if (card) {
      const completed = hasCompleteScore(scores[id]);
      card.classList.toggle('fixture-simulated', completed);
      card.classList.toggle('fixture-simulatable', !completed);
      card.classList.toggle('fixture-in-progress', !completed && scores[id].some(value => value !== '' && value != null));
    }
    renderTable();
  }));
  const delayed = getDelayedFixtures();
  $('delayedFixtures').hidden = delayed.length === 0;
  $('delayedFixturesTitle').textContent = `Jogos atrasados sem resultado (${delayed.length})`;
  $('roundProgress').innerHTML = delayed.map(g => {
      const home = clubCrests[normalizeClubName(g.home)]?.[1] || g.home;
      const away = clubCrests[normalizeClubName(g.away)]?.[1] || g.away;
      return `<a class="delayed-fixture-link" href="#fixtures" data-round="${g.round}">Rodada ${g.round}: ${home} x ${away}</a>`;
    }).join(' · ');
}

function getRows() {
  const rows = teams.map(t => ({name:t[0],j:t[1],v:t[2],e:t[3],d:t[4],pts:t[6],gp:t[7]??0,gc:t[8]??0,sg:(t[7]??0)-(t[8]??0)}));
  const map = Object.fromEntries(rows.map(row => [row.name, row]));
  Object.keys(fixturesByRound).forEach(round => fixturesByRound[round].forEach(g => {
    const score = scores[g.id];
    if (g.officialResult || !score || score[0] === '' || score[1] === '' || score[0] == null || score[1] == null) return;
    const homeGoals = Number(score[0]), awayGoals = Number(score[1]);
    if (!Number.isInteger(homeGoals) || !Number.isInteger(awayGoals) || homeGoals < 0 || awayGoals < 0 || homeGoals > 30 || awayGoals > 30) return;
    const home = map[normalizeClubName(g.home)], away = map[normalizeClubName(g.away)];
    if (!home || !away) return;
    home.j++; away.j++; home.gp += homeGoals; home.gc += awayGoals; away.gp += awayGoals; away.gc += homeGoals;
    if (homeGoals > awayGoals) { home.v++; away.d++; home.pts += 3; }
    else if (homeGoals < awayGoals) { away.v++; home.d++; away.pts += 3; }
    else { home.e++; away.e++; home.pts++; away.pts++; }
  }));
  rows.forEach(row => { row.sg = row.gp - row.gc; });
  return rows.sort((a,b) => b.pts-a.pts || b.v-a.v || b.sg-a.sg || b.gp-a.gp);
}

function getQualification(rows) {
  const selected={lib:$('lib').value,sula:$('sula').value,cdb:$('cdb').value,vice:$('vice').value};
  const notes=[];
  if(getCopaFinalistConflict(selected.cdb,selected.vice)){
    selected.vice='';
    notes.push(copaConflictMessage+' A escolha incompat\u00edvel foi ignorada na proje\u00e7\u00e3o.');
  }else if(copaSelectionNotice)notes.push(copaSelectionNotice);
  const pos=Object.fromEntries(rows.map((row,index)=>[row.name,index+1]));
  const eligible=name=>Boolean(name&&pos[name]&&pos[name]<=(rows.length===20?rows.length-4:rows.length));
  const groups=new Map(),pre=new Map(),externalGroups=new Map();
  const addGroup=(name,source)=>{if(!eligible(name))return false;if(!groups.has(name))groups.set(name,[]);if(!groups.get(name).includes(source))groups.get(name).push(source);pre.delete(name);return true;};
  const addPre=(name,source)=>{if(!eligible(name)||groups.has(name))return false;if(!pre.has(name))pre.set(name,[]);if(!pre.get(name).includes(source))pre.get(name).push(source);return true;};
  [['Libertadores',selected.lib],['Sul-Americana',selected.sula]].filter(([,club])=>club).forEach(([title,club])=>{
    if(!Object.prototype.hasOwnProperty.call(pos,club)){
      externalGroups.set(club,'Campe\u00e3o da '+title);
      notes.push(club+' n\u00e3o disputa o Brasileir\u00e3o 2026. A vaga direta na Libertadores por ser campe\u00e3o foi contada separadamente, sem incluir o clube na classifica\u00e7\u00e3o do campeonato.');
    }else if(eligible(club))addGroup(club,'Campe\u00e3o da '+title);
    else notes.push(club+' foi escolhido como campe\u00e3o da '+title+', mas aparece entre os quatro \u00faltimos. O simulador o exclui provisoriamente das vagas; a regra da CONMEBOL aplic\u00e1vel a 2027 ainda precisa ser confirmada.');
  });
  if(selected.lib&&selected.lib===selected.sula)notes.push('O mesmo clube foi escolhido como campe\u00e3o da Libertadores e da Sul-Americana. Como essa combina\u00e7\u00e3o n\u00e3o ocorre em um cen\u00e1rio normal das competi\u00e7\u00f5es, ele foi contado uma \u00fanica vez.');
  let extraGroups=0,extraPre=0;
  {
    const champ=selected.cdb,vice=selected.vice;
    const champGroupElsewhere=Boolean(champ&&eligible(champ)&&(groups.has(champ)||pos[champ]<=4));
    const champPreLeague=Boolean(champ&&eligible(champ)&&pos[champ]===5&&!groups.has(champ));
    const viceGroupElsewhere=Boolean(vice&&eligible(vice)&&(groups.has(vice)||pos[vice]<=4));
    if(champ&&vice&&viceGroupElsewhere&&!champGroupElsewhere){
      notes.push('O vice-campe\u00e3o j\u00e1 tem vaga na fase de grupos por outra via. A vaga preliminar da Copa do Brasil \u00e9 repassada ao clube mais bem colocado no Brasileir\u00e3o que ainda n\u00e3o esteja classificado.');
    }
    if(champ&&eligible(champ)){
      if(champGroupElsewhere){
        if(vice&&eligible(vice)){
          if(viceGroupElsewhere)extraGroups++;
          else addGroup(vice,'Copa do Brasil: vaga direta redirecionada');
          extraPre++;
        }else if(!vice)notes.push('O campe\u00e3o da Copa do Brasil j\u00e1 tem vaga na fase de grupos, mas o vice-campe\u00e3o n\u00e3o foi selecionado. Por isso, n\u00e3o \u00e9 poss\u00edvel projetar o destino da vaga direta.');
        else {extraGroups++;notes.push('O vice-campe\u00e3o da Copa do Brasil est\u00e1 entre os quatro \u00faltimos da proje\u00e7\u00e3o. A redistribui\u00e7\u00e3o das duas vagas depende de quais clubes disputar\u00e3o a S\u00e9rie A em 2027.');}
      }else if(champPreLeague){
        addGroup(champ,'Copa do Brasil: fase de grupos');
        notes.push('O campe\u00e3o da Copa do Brasil est\u00e1 na vaga preliminar do Brasileir\u00e3o e passa a usar a vaga na fase de grupos da Copa. Com isso, a vaga preliminar do campeonato \u00e9 redistribu\u00edda.');
      }else {
        addGroup(champ,'Copa do Brasil: campe\u00e3o');
        if(!vice)notes.push('O vice-campe\u00e3o da Copa do Brasil n\u00e3o foi selecionado. A vaga na fase preliminar da Libertadores ainda n\u00e3o est\u00e1 projetada.');
      }
    }else if(champ){
      notes.push(champ+' foi escolhido campe\u00e3o da Copa do Brasil, mas est\u00e1 entre os quatro \u00faltimos. O simulador o exclui provisoriamente; a regra oficial de elegibilidade para 2027 ainda precisa ser confirmada.');
      if(vice&&eligible(vice)){if(viceGroupElsewhere)extraGroups++;else addGroup(vice,'Copa do Brasil: vaga direta redirecionada');extraPre++;}
      else if(vice){extraGroups++;notes.push('O vice-campe\u00e3o tamb\u00e9m est\u00e1 entre os quatro \u00faltimos; o simulador provisoriamente repassa as vagas ao Brasileir\u00e3o, mas o destino oficial para 2027 ainda precisa ser confirmado.');}
      else if(!vice)notes.push('O vice-campe\u00e3o da Copa do Brasil n\u00e3o foi selecionado, ent\u00e3o n\u00e3o h\u00e1 dados suficientes para projetar o destino da outra vaga.');
    }else if(vice)notes.push('O campe\u00e3o da Copa do Brasil n\u00e3o foi selecionado. A vaga direta da competi\u00e7\u00e3o ainda n\u00e3o est\u00e1 projetada.');
    if(vice&&eligible(vice)){
      if(groups.has(vice)||pos[vice]<=4){if(!extraPre)extraPre++;notes.push('O vice-campe\u00e3o consta na fase de grupos desta proje\u00e7\u00e3o. Por isso, a vaga preliminar da Copa do Brasil \u00e9 redistribu\u00edda ao Brasileir\u00e3o.');}
      else addPre(vice,'Copa do Brasil: vice-campe\u00e3o');
    }else if(vice){extraPre++;notes.push(vice+' foi escolhido vice-campe\u00e3o da Copa do Brasil, mas est\u00e1 entre os quatro \u00faltimos. O simulador o exclui provisoriamente e repassa a vaga preliminar no modelo atual; a regra oficial para 2027 ainda precisa ser confirmada.');}
  }
  const leagueGroups=[],leaguePre=[];
  for(const row of rows){if(leagueGroups.length>=4+extraGroups)break;if(!eligible(row.name)||groups.has(row.name)||pre.has(row.name))continue;addGroup(row.name,'Brasileirao: fase de grupos');leagueGroups.push(row.name);}
  for(const row of rows){if(leaguePre.length>=1+extraPre)break;if(!eligible(row.name)||groups.has(row.name)||pre.has(row.name))continue;addPre(row.name,'Brasileirao: fase preliminar');leaguePre.push(row.name);}
  const sulaClubs=[];
  for(const row of rows){if(sulaClubs.length>=6)break;if(eligible(row.name)&&!groups.has(row.name)&&!pre.has(row.name))sulaClubs.push(row.name);}
  const status=Object.fromEntries(rows.map(row=>[row.name,{phase:groups.has(row.name)?'groups':pre.has(row.name)?'pre':sulaClubs.includes(row.name)?'sula':eligible(row.name)?'':'relegation',sources:groups.get(row.name)||pre.get(row.name)||[]}]));
  if(!selected.lib&&!selected.sula&&!selected.cdb&&!selected.vice)notes.push('Nenhum campe\u00e3o foi presumido. Sem escolhas, a proje\u00e7\u00e3o considera apenas as quatro vagas na fase de grupos e a vaga na fase preliminar do Brasileir\u00e3o 2026.');
  notes.unshift('Brasileir\u00e3o S\u00e9rie A 2026: do 1\u00ba ao 4\u00ba lugar, vaga na fase de grupos da Libertadores; 5\u00ba lugar, vaga na fase preliminar. A Copa do Brasil d\u00e1 ao campe\u00e3o uma vaga na fase de grupos e ao vice-campe\u00e3o uma vaga na fase preliminar.');
  notes.push('Regra confirmada pela CBF: os quatro \u00faltimos ser\u00e3o rebaixados. Hip\u00f3tese provis\u00f3ria do simulador: clubes nas posi\u00e7\u00f5es 17 a 20 n\u00e3o recebem vaga. A elegibilidade e a redistribui\u00e7\u00e3o para campe\u00f5es rebaixados dependem do regulamento CONMEBOL de 2027, ainda n\u00e3o confirmado nesta auditoria.');
  const leagueQualified=[...leagueGroups,...leaguePre];
  return {direct:groups.size+externalGroups.size,pre:pre.size,total:groups.size+externalGroups.size+pre.size,notes,pos,status,sulaClubs,leagueQualified,groups:Object.fromEntries(groups),externalGroups:Object.fromEntries(externalGroups),preliminary:Object.fromEntries(pre)};
}

function renderTable() {
  const rows=getRows(),q=getQualification(rows);
  const simulatedCount = fixtures.filter(fixture => !fixture.officialResult && hasCompleteScore(scores[fixture.id])).length;
  $('simulationStatus').hidden = simulatedCount === 0;
  $('simulationStatus').textContent = simulatedCount ? `Projeção alterada · ${simulatedCount} placar${simulatedCount === 1 ? '' : 'es'} simulado${simulatedCount === 1 ? '' : 's'}` : '';
  $('directCount').textContent=q.direct;
  $('preCount').textContent=q.pre;
  const qualifiedLeagueClubs=[...Object.keys(q.groups),...Object.keys(q.preliminary)].filter(name=>q.pos[name]);
  $('lastPlace').textContent=qualifiedLeagueClubs.length?Math.max(...qualifiedLeagueClubs.map(name=>q.pos[name]))+'\u00ba':'-';
  $('explain').innerHTML='<div class="warn"><b>Proje\u00e7\u00e3o de vagas para 2027</b><ul class="result-list">'+q.notes.map(note=>'<li>'+note+'</li>').join('')+'</ul></div>';
  const rowMarkup=(row,index)=>{
    const club=q.status[row.name];
    const positionClass=club.phase==='groups'?'position-groups':club.phase==='pre'?'position-pre':club.phase==='sula'?'position-sula':club.phase==='relegation'?'position-relegation':'position-neutral';
    return '<tr data-club="'+row.name+'" data-qualification="'+club.phase+'"><td class="pos"><span class="position-number '+positionClass+'">'+(index+1)+'</span></td><td>'+renderStandingsClub(row.name)+'</td><td><b>'+row.pts+'</b></td><td>'+row.j+'</td><td>'+row.v+'</td><td>'+row.sg+'</td></tr>';
  };
  $('tbodyTop').innerHTML=rows.slice(0,10).map(rowMarkup).join('');
  $('tbodyBottom').innerHTML=rows.slice(10,20).map((row,index)=>rowMarkup(row,index+10)).join('');
}

function setRound(round) {
  currentRound = Math.max(1, Math.min(38, Number(round) || 1));
  renderFixtures();
}

$('prevRound').addEventListener('click', () => setRound(currentRound - 1));
$('nextRound').addEventListener('click', () => setRound(currentRound + 1));
$('roundSelect').addEventListener('change', () => setRound($('roundSelect').value));
$('roundProgress').addEventListener('click', event => {
  const link = event.target.closest('.delayed-fixture-link');
  if (!link) return;
  event.preventDefault();
  setRound(link.dataset.round);
});
['lib','sula'].forEach(id => $(id).addEventListener('change',renderTable));
$('cdb').addEventListener('change',()=>{syncCopaFinalistOptions();renderTable()});
$('vice').addEventListener('change',()=>{syncCopaFinalistOptions();renderTable()});
$('clearScores').addEventListener('click',()=>{scores={};renderFixtures();renderTable()});
$('reset').addEventListener('click',()=>{scores={};['lib','sula','cdb','vice'].forEach(id=>$(id).value='');syncCopaFinalistOptions();renderFixtures();renderTable()});
$('toggleStandings').addEventListener('click',()=>{
  const content=$('standingsContent'),button=$('toggleStandings');
  const card=$('standingsCard');
  content.hidden=!content.hidden;
  button.setAttribute('aria-expanded',String(!content.hidden));
  button.textContent=content.hidden?'Mostrar classificação':'Ocultar classificação';
  if(content.hidden){
    $('matchesHeading').append(button);
    card.hidden=true;
  }else{
    card.hidden=false;
    $('standingsToolbar').append(button);
  }
});
renderFixtures();
renderTable();
