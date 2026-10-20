const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const fixturesSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'fixtures.js'), 'utf8');
const styleSource = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'fixtures.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

function createStandingsContext() {
  const elements = new Map();
  const listeners = new Map();
  let scoreInputs = [];
  let crestImages = [];
  const document = {
    getElementById(id) {
      if (!elements.has(id)) {
        const element = {
          value: '',
          _innerHTML: '',
          textContent: '',
          hidden: false,
          disabled: false,
          attributes: {},
          parentElement: null,
          addEventListener(type, handler) { listeners.set(`${id}:${type}`, handler); },
          setAttribute(name, value) { this.attributes[name] = value; },
          append(child) { child.parentElement = this; },
          insertAdjacentHTML(_position, html) { this.innerHTML += html; },
        };
        Object.defineProperty(element, 'innerHTML', {
          get() { return this._innerHTML; },
          set(html) {
            this._innerHTML = html;
            if (id === 'fixtures') {
              scoreInputs = Array.from(html.matchAll(/<input class="score"[^>]*data-id="([^"]+)"[^>]*data-side="([^"]+)"[^>]*value="([^"]*)"/g), match => {
                return {dataset:{id:match[1],side:match[2]},value:match[3],handlers:{},addEventListener(type,handler){this.handlers[type]=handler;}};
              });
              crestImages = Array.from(html.matchAll(/<img class="club-crest" src="([^"]+)" alt="" aria-hidden="true"><span class="crest-fallback" hidden>([^<]+)<\/span>/g), match => {
                return {src:match[1],hidden:false,nextElementSibling:{hidden:true,textContent:match[2]},handlers:{},addEventListener(type,handler){this.handlers[type]=handler;}};
              });
            }
          },
        });
        elements.set(id, element);
      }
      return elements.get(id);
    },
    querySelectorAll(selector) { return selector === '.score' ? scoreInputs : selector === '.club-crest' ? crestImages : []; },
  };
  const context = { document, listeners };
  vm.runInNewContext(
    `${appSource}\nglobalThis.standingsTestApi = {\n` +
      '  getRows,\n' +
      '  getQualification(rows = getRows()) { return getQualification(rows); },\n' +
      '  renderTable,\n' +
      '  get fixtures() { return fixtures; },\n' +
      '  get teams() { return teams; },\n' +
      '  get initialTeams() { return initialTeams; },\n' +
      '  setScores(next) { scores = next; },\n' +
      '  setTeams(next) { teams = next; },\n' +
      '  getScore(id) { return scores[id]; },\n' +
      '  getText(id) { return $(id).textContent; },\n' +
      '  getInnerHtml(id) { return $(id).innerHTML; },\n' +
      '  getRound() { return currentRound; },\n' +
      '  getRoundOptionCount() { return ($(\'roundSelect\').innerHTML.match(/<option /g) || []).length; },\n' +
      '  isRoundDisabled(id) { return $(id).disabled; },\n' +
      '  isStandingsHidden() { return $(\'standingsContent\').hidden; },\n' +
      '  isToggleInMatches() { return $(\'toggleStandings\').parentElement === $(\'matchesHeading\'); },\n' +
      '  isToggleInStandings() { return $(\'toggleStandings\').parentElement === $(\'standingsToolbar\'); },\n' +
      '  getStandingsHtml() { return $(\'tbodyTop\').innerHTML + $(\'tbodyBottom\').innerHTML; },\n' +
      '  setSelect(id, value) { $(id).value = value; },\n' +
      '  changeSelect(id, value) { $(id).value = value; listeners.get(id + ":change")(); },\n' +
      '  getSelect(id) { return $(id).value; },\n' +
      '  enterScore(id, side, value) { const input = document.querySelectorAll(\'.score\').find(item => item.dataset.id === id && item.dataset.side === String(side)); if (!input) throw new Error(\'Score input not found: \' + id); input.value = String(value); input.handlers.input(); },\n' +
      '  click(id) { return listeners.get(id + \":click\")(); },\n' +
      '  selectRound(round) { setRound(round); return { fixtures: $(\'fixtures\').innerHTML, progress: $(\'roundProgress\').textContent, title: `Rodada ${$(\'roundSelect\').value}` }; },\n' +
      '  chooseRound(round) { $(\'roundSelect\').value = String(round); listeners.get(\'roundSelect:change\')(); return currentRound; },\n' +
      '  failCrest(index = 0) { const image = document.querySelectorAll(\'.club-crest\')[index]; if (!image) throw new Error(\'Crest image not found\'); image.handlers.error(); return { imageHidden: image.hidden, fallbackHidden: image.nextElementSibling.hidden, initials: image.nextElementSibling.textContent }; },\n' +
      '};',
    context,
    { filename: 'js/app.js' },
  );
  return context.standingsTestApi;
}

function rowByName(rows, name) {
  return rows.find((row) => row.name === name);
}

test('round navigation traverses all rounds 1 through 38 and disables both boundaries', () => {
  const api = createStandingsContext();
  assert.equal(api.getRoundOptionCount(), 38);
  assert.equal(api.getRound(), 32);
  api.selectRound(1);
  assert.equal(api.isRoundDisabled('prevRound'), true);
  assert.equal(api.isRoundDisabled('nextRound'), false);
  for (let round = 2; round <= 38; round++) {
    api.click('nextRound');
    assert.equal(api.getRound(), round);
    assert.equal(api.selectRound(round).title, `Rodada ${round}`);
  }
  assert.equal(api.isRoundDisabled('nextRound'), true);
  api.click('nextRound');
  assert.equal(api.getRound(), 38);
  api.click('prevRound');
  assert.equal(api.getRound(), 37);
});

test('round dropdown selects any round and stays synchronized with the arrows', () => {
  const api = createStandingsContext();
  assert.equal(api.chooseRound(1), 1);
  api.click('nextRound');
  assert.equal(api.getRound(), 2);
  assert.equal(api.chooseRound(38), 38);
  assert.equal(api.isRoundDisabled('nextRound'), true);
});

test('selecting a round displays its registered games and leaves unregistered rounds empty', () => {
  const api = createStandingsContext();
  const historicalRound = api.selectRound('1');
  const postponedRound = api.selectRound('21');
  const currentRound = api.selectRound('32');

  assert.equal((historicalRound.fixtures.match(/class="fixture(?:\s|\")/g) || []).length, 10);
  
  assert.match(postponedRound.fixtures, /CHA[\s\S]*VAS/);
  assert.equal((currentRound.fixtures.match(/class="fixture(?:\s|\")/g) || []).length, 10);
  assert.match(currentRound.fixtures, /CRU[\s\S]*REM/);
});

test('hiding and showing the standings preserves simulated and official state', () => {
  const api = createStandingsContext();
  const official = api.fixtures.find((fixture) => fixture.officialResult);
  const officialResult = JSON.stringify(official.officialResult);
  api.setSelect('lib', 'Flamengo');
  api.setSelect('cdb', 'Palmeiras');
  api.setScores({ '316': [2, 1] });
  const before = api.getStandingsHtml();
  api.click('toggleStandings');
  assert.equal(api.isStandingsHidden(), true);
  assert.equal(api.isToggleInMatches(), true);
  assert.equal(api.getStandingsHtml(), before);
  api.click('toggleStandings');
  assert.equal(api.isStandingsHidden(), false);
  assert.equal(api.isToggleInStandings(), true);
  assert.equal(api.getStandingsHtml(), before);
  assert.equal(api.getSelect('lib'), 'Flamengo');
  assert.equal(api.getSelect('cdb'), 'Palmeiras');
  assert.deepEqual(JSON.parse(JSON.stringify(official.officialResult)), JSON.parse(officialResult));
});

test('champion selectors start empty and default projection uses four groups and one preliminary place', () => {
  const api = createStandingsContext();
  const options = id => [...api.getInnerHtml(id).matchAll(/<option value="([^"]*)"/g)].map(match => match[1]).slice(1);
  for (const id of ['lib', 'sula', 'cdb', 'vice']) {
    assert.equal(api.getSelect(id), '');
    assert.match(api.getInnerHtml(id), /Selecione um clube/);
  }
  const atletico = api.getRows().find(row => row.name.includes('Atl') && row.name.includes('MG')).name;
  assert.deepEqual(options('lib'), ['Estudiantes','Flamengo','Fluminense','Palmeiras']);
  assert.deepEqual(options('sula'), [atletico,'Boca Juniors','Montevideo City Torque','Vasco']);
  const copaOptions = [atletico,'Grêmio','Palmeiras','Vasco'];
  assert.deepEqual(options('cdb'), copaOptions);
  assert.deepEqual(options('vice'), copaOptions);
  const qualification = api.getQualification();
  assert.equal(qualification.direct, 4);
  assert.equal(qualification.pre, 1);
  assert.equal(qualification.leagueQualified.length, 5);
  assert.match(qualification.notes.join(' '), /Nenhum campe\u00e3o foi presumido/);
  assert.equal(api.getRows().length, 20);
});

test('selecting, changing, and clearing a Libertadores champion updates the projection', () => {
  const api = createStandingsContext();
  const first = api.getRows()[0].name;
  const second = api.getRows()[1].name;
  api.changeSelect('lib', first);
  const selected = api.getQualification();
  assert.equal(selected.direct, 5);
  assert.ok(selected.groups[first].includes('Campe\u00e3o da Libertadores'));
  api.changeSelect('lib', second);
  assert.ok(api.getQualification().groups[second].includes('Campe\u00e3o da Libertadores'));
  assert.equal(api.getQualification().groups[first]?.includes('Campe\u00e3o da Libertadores') || false, false);
  api.changeSelect('lib', '');
  assert.equal(api.getQualification().direct, 4);
  assert.equal(api.getSelect('lib'), '');
});

test('Copa do Brasil champion outside the league top four receives groups', () => {
  const api = createStandingsContext();
  const champion = api.getRows().find(row => row.name.includes('Atl') && row.name.includes('MG')).name;
  api.changeSelect('cdb', champion);
  const qualification = api.getQualification();
  assert.ok(qualification.groups[champion].includes('Copa do Brasil: campe\u00e3o'));
  assert.equal(qualification.direct, 5);
  assert.equal(qualification.pre, 1);
  assert.match(api.getStandingsHtml(), new RegExp(`data-club="${champion}" data-qualification="groups"`));
});

test('Copa do Brasil selectors disable the same club and clear a duplicate choice', () => {
  const api = createStandingsContext();
  const champion = api.getRows().find(row => row.name.includes('Atl') && row.name.includes('MG')).name;
  api.changeSelect('cdb', champion);
  assert.match(api.getInnerHtml('vice'), new RegExp(`<option value="${champion}" disabled>`));
  api.changeSelect('vice', champion);
  assert.equal(api.getSelect('vice'), '');
  const runnerUp = 'Vasco';
  api.changeSelect('vice', runnerUp);
  assert.match(api.getInnerHtml('cdb'), new RegExp(`<option value="${runnerUp}" disabled>`));
  api.changeSelect('cdb', runnerUp);
  assert.equal(api.getSelect('cdb'), runnerUp);
  assert.equal(api.getSelect('vice'), '');
  assert.equal(api.getQualification().groups[runnerUp].includes('Copa do Brasil: campe\u00e3o'), true);
});

test('foreign Libertadores champion gets a separate direct place without entering league standings', () => {
  const api = createStandingsContext();
  api.changeSelect('lib', 'Estudiantes');
  const qualification = api.getQualification();
  assert.equal(api.getSelect('lib'), 'Estudiantes');
  assert.equal(qualification.direct, 5);
  assert.equal(qualification.externalGroups.Estudiantes, 'Campe\u00e3o da Libertadores');
  assert.equal(qualification.groups.Estudiantes, undefined);
  assert.equal(qualification.pos.Estudiantes, undefined);
  assert.equal(qualification.leagueQualified.length, 5);
  assert.ok(qualification.notes.join(' ').includes('Estudiantes n\u00e3o disputa o Brasileir\u00e3o 2026'));
  api.changeSelect('lib', '');
  assert.equal(api.getQualification().direct, 4);
});

test('invalid identical Copa do Brasil finalists are rejected by qualification projection', () => {
  const api = createStandingsContext();
  const champion = api.getRows()[5].name;
  api.setSelect('cdb', champion);
  api.setSelect('vice', champion);
  assert.match(api.getQualification().notes.join(' '), /Seleção inválida/);
  assert.equal(api.getQualification().pre, 1);
});

test('Copa champion already in the league top four transfers the direct cup place to the runner-up', () => {
  const api = createStandingsContext();
  const champion = 'Palmeiras';
  const runnerUp = api.getRows().find(row => row.name.includes('Atl') && row.name.includes('MG')).name;
  api.changeSelect('cdb', champion);
  api.changeSelect('vice', runnerUp);
  const qualification = api.getQualification();
  assert.ok(qualification.groups[champion].includes('Brasileirao: fase de grupos'));
  assert.ok(qualification.groups[runnerUp].includes('Copa do Brasil: vaga direta redirecionada'));
  assert.equal(qualification.pre, 2);
});

test('qualification status is on rows and zone colors are applied to position numbers', () => {
  const api = createStandingsContext();
  const qualification = api.getQualification();
  const html = api.getStandingsHtml();
  for (const club of Object.keys(qualification.groups)) {
    assert.match(html, new RegExp(`<tr data-club="${club}" data-qualification="groups"><td class="pos"><span class="position-number position-groups">`));
  }
  for (const club of Object.keys(qualification.preliminary)) {
    assert.match(html, new RegExp(`<tr data-club="${club}" data-qualification="pre"><td class="pos"><span class="position-number position-pre">`));
  }
  for (const club of qualification.sulaClubs) {
    assert.match(html, new RegExp(`<tr data-club="${club}" data-qualification="sula"><td class="pos"><span class="position-number position-sula">`));
  }
  for (const club of Object.keys(qualification.status).filter(name => qualification.status[name].phase === 'relegation')) {
    assert.match(html, new RegExp(`<tr data-club="${club}" data-qualification="relegation"><td class="pos"><span class="position-number position-relegation">`));
  }
  assert.doesNotMatch(html, /qualification-status|qualification-source/);
});

test('standings table shows club names without abbreviation badges', () => {
  const api = createStandingsContext();
  const html = api.getStandingsHtml();
  assert.match(html, /Flamengo/);
  assert.doesNotMatch(html, /class="crest"/);
});

test('standings use circular position markers and show local crests beside club names', () => {
  const api = createStandingsContext();
  const html = api.getStandingsHtml();
  assert.equal((html.match(/class="position-number position-/g) || []).length, 20);
  assert.equal((html.match(/class="standings-club"/g) || []).length, 20);
  assert.equal((html.match(/class="club-name"/g) || []).length, 20);
  assert.match(styleSource, /\.position-number\s*\{[^}]*border-radius:\s*50%;/s);
  assert.match(styleSource, /\.position-groups\s*\{\s*background:\s*var\(--groups\);\s*border-color:\s*var\(--groups\);/);
  assert.match(styleSource, /\.position-pre\s*\{\s*background:\s*var\(--pre\);\s*border-color:\s*var\(--pre\);/);
  assert.match(styleSource, /\.position-sula\s*\{\s*background:\s*var\(--sula\);\s*border-color:\s*var\(--sula\);/);
  assert.match(styleSource, /\.position-relegation\s*\{\s*background:\s*var\(--relegation\);\s*border-color:\s*var\(--relegation\);/);
  assert.match(styleSource, /\.position-neutral\s*\{\s*color:\s*#465367;\s*background:\s*transparent;\s*border-color:\s*transparent;/);
});

test('base records Bragantino with corrected goals and +3 goal difference', () => {
  const api = createStandingsContext();
  const row = rowByName(api.getRows(), 'Bragantino');
  assert.ok(row, api.getRows().map(team => JSON.stringify(team.name)).join(', '));

  assert.equal(row.gp, 39);
  assert.equal(row.gc, 36);
  assert.equal(row.sg, 3);
});

test('official 1-1 in round 31 between Corinthians and Vitória is read-only and reflected in the base standings', () => {
  const api = createStandingsContext();
  const fixture = api.fixtures.find(item => item.id === '304');
  assert.deepEqual(JSON.parse(JSON.stringify(fixture.officialResult)), { homeGoals: 1, awayGoals: 1 });

  const round = api.selectRound(31);
  assert.match(round.fixtures, /class="fixture fixture-official" data-fixture-id="304"/);
  assert.match(round.fixtures, /<b class="official-score"[^>]*>1 × 1<\/b>/);
  assert.doesNotMatch(round.fixtures, /class="score"[^>]*data-id="304"/);

  const rows = api.getRows();
  const corinthians = rowByName(rows, 'Corinthians');
  const vitoria = rowByName(rows, 'Vitória');
  assert.deepEqual([corinthians.j, corinthians.e, corinthians.pts, corinthians.gp, corinthians.gc, corinthians.sg], [31, 9, 33, 32, 39, -7]);
  assert.deepEqual([vitoria.j, vitoria.e, vitoria.pts, vitoria.gp, vitoria.gc, vitoria.sg], [31, 7, 37, 34, 45, -11]);
});

test('a simulated win updates games, goals, goal difference, wins, losses, and points', () => {
  const api = createStandingsContext();
  api.enterScore('316', 0, 2); // Cruzeiro x Remo
  api.enterScore('316', 1, 1);
  const rows = api.getRows();
  const cruzeiro = rowByName(rows, 'Cruzeiro');
  const remo = rowByName(rows, 'Remo');

  assert.deepEqual(
    [cruzeiro.j, cruzeiro.v, cruzeiro.e, cruzeiro.d, cruzeiro.gp, cruzeiro.gc, cruzeiro.sg, cruzeiro.pts],
    [32, 16, 6, 10, 52, 47, 5, 54],
  );
  assert.deepEqual(
    [remo.j, remo.v, remo.e, remo.d, remo.gp, remo.gc, remo.sg, remo.pts],
    [32, 5, 11, 16, 35, 51, -16, 26],
  );
});

test('entering score fields recalculates and rerenders both standings tables', () => {
  const api = createStandingsContext();
  const fixture = api.fixtures.find((game) => game.id === '311');
  api.enterScore(fixture.id, 0, 2);
  api.enterScore(fixture.id, 1, 0);

  const rows = api.getRows();
  const home = rowByName(rows, fixture.home);
  const away = rowByName(rows, fixture.away);
  assert.ok(home, `Mandante ${fixture.home} deve existir na classificação`);
  assert.ok(away, `Visitante ${fixture.away} deve existir na classificação`);
  assert.equal(home.j, api.teams.find((team) => team[0] === fixture.home)[1] + 1);
  assert.equal(away.j, api.teams.find((team) => team[0] === fixture.away)[1] + 1);
  assert.match(api.getStandingsHtml(), /<tr/);
});

test('all simulatable fixtures resolve to clubs in the base table', () => {
  const api = createStandingsContext();
  const openFixtures = api.fixtures.filter((game) => !game.officialResult);
  api.setScores(Object.fromEntries(openFixtures.map((game) => [game.id, [1, 0]])));
  assert.doesNotThrow(() => api.getRows());
});

test('changing a simulated score recalculates standings without accumulating the previous result', () => {
  const api = createStandingsContext();
  api.enterScore('316', 0, 2); // Cruzeiro x Remo
  api.enterScore('316', 1, 1);
  api.enterScore('316', 0, 0);
  api.enterScore('316', 1, 0);
  const rows = api.getRows();
  const cruzeiro = rowByName(rows, 'Cruzeiro');
  const remo = rowByName(rows, 'Remo');

  assert.deepEqual(
    [cruzeiro.j, cruzeiro.v, cruzeiro.e, cruzeiro.d, cruzeiro.gp, cruzeiro.gc, cruzeiro.sg, cruzeiro.pts],
    [32, 15, 7, 10, 50, 46, 4, 52],
  );
  assert.deepEqual(
    [remo.j, remo.v, remo.e, remo.d, remo.gp, remo.gc, remo.sg, remo.pts],
    [32, 5, 12, 15, 34, 49, -15, 27],
  );
});

test('clearing simulated scores restores the base standings', () => {
  const api = createStandingsContext();
  api.setSelect('lib', 'Flamengo');
  api.setScores({ '316': [2, 1], '210': [0, 0] });
  api.click('clearScores');
  assert.equal(api.getSelect('lib'), 'Flamengo');

  const rows = api.getRows();
  const base = api.initialTeams;
  for (const name of ['Cruzeiro', 'Remo', 'Chapecoense', 'Vasco']) {
    const actual = rowByName(rows, name);
    const expected = base.find((team) => team[0] === name);
    assert.deepEqual(
      [actual.j, actual.v, actual.e, actual.d, actual.gp, actual.gc, actual.sg, actual.pts],
      [expected[1], expected[2], expected[3], expected[4], expected[7], expected[8], expected[7] - expected[8], expected[6]],
    );
  }
  assert.equal(api.getScore('316'), undefined);
});

test('restoring the initial scenario clears scores and leaves all champion selectors empty', () => {
  const api = createStandingsContext();
  api.setScores({ '316': [2, 1] });
  for (const [id, club] of [['lib', 'Flamengo'], ['sula', 'Palmeiras'], ['cdb', 'Cruzeiro'], ['vice', 'Vasco']]) api.setSelect(id, club);
  api.click('reset');
  for (const id of ['lib', 'sula', 'cdb', 'vice']) assert.equal(api.getSelect(id), '');
  assert.equal(api.getScore('316'), undefined);
  assert.equal(api.getQualification().direct, 4);
  assert.equal(api.getQualification().pre, 1);
});

test('scores injected for official fixtures are ignored and official results stay intact', () => {
  const api = createStandingsContext();
  const officialFixture = api.fixtures.find((fixture) => fixture.officialResult);
  const originalResult = { ...officialFixture.officialResult };
  const before = api.getRows().map((row) => [row.name, row.j, row.v, row.e, row.d, row.gp, row.gc, row.sg, row.pts]);

  api.setScores({ [officialFixture.id]: [0, 0] });
  const after = api.getRows().map((row) => [row.name, row.j, row.v, row.e, row.d, row.gp, row.gc, row.sg, row.pts]);

  assert.deepEqual(after, before);
  assert.deepEqual(JSON.parse(JSON.stringify(officialFixture.officialResult)), originalResult);
  api.click('clearScores');
  assert.deepEqual(JSON.parse(JSON.stringify(officialFixture.officialResult)), originalResult);
});

test('simulated standings continue to feed the qualification projection', () => {
  const api = createStandingsContext();
  api.setTeams([
    ['Flamengo', 10, 3, 1, 6, 2, 10, 12, 10],
    ['Palmeiras', 10, 2, 4, 4, 1, 10, 11, 10],
    ['Athletico-PR', 10, 2, 4, 4, 0, 10, 10, 10],
    ['Cruzeiro', 10, 1, 7, 2, 0, 10, 10, 10],
    ['Chapecoense', 10, 2, 3, 5, -1, 9, 9, 10],
    ['Vasco', 10, 1, 5, 4, -2, 8, 8, 10],
  ]);
  api.setSelect('lib', '');
  api.setSelect('sula', 'Vasco');
  api.setSelect('cdb', '');
  api.setSelect('vice', '');
  api.setScores({ '210': [0, 30] }); // Chapecoense x Vasco
  api.renderTable();

  assert.equal(api.getText('directCount'), 5);
  assert.equal(rowByName(api.getRows(), 'Vasco').j, 11);
  assert.ok(api.getQualification().groups.Vasco);
});

test('entering a simulated score automatically refreshes the qualification projection', () => {
  const api = createStandingsContext();
  api.setTeams([
    ['Flamengo', 10, 3, 1, 6, 2, 10, 12, 10],
    ['Palmeiras', 10, 2, 4, 4, 1, 10, 11, 10],
    ['Athletico-PR', 10, 2, 4, 4, 0, 10, 10, 10],
    ['Cruzeiro', 10, 1, 7, 2, 0, 10, 10, 10],
    ['Chapecoense', 10, 2, 3, 5, -1, 9, 9, 10],
    ['Vasco', 10, 1, 5, 4, -2, 8, 8, 10],
  ]);
  api.changeSelect('sula', 'Vasco');
  api.selectRound('21');
  assert.equal(api.getQualification().pos.Vasco, 6);
  api.enterScore('210', 0, 0);
  api.enterScore('210', 1, 30);
  const qualification = api.getQualification();
  assert.equal(qualification.pos.Vasco, 1);
  assert.equal(api.getText('directCount'), qualification.direct);
  assert.match(api.getStandingsHtml(), /data-club="Vasco" data-qualification="groups"/);
});

test('a simulated draw adds one game and one point to each club', () => {
  const api = createStandingsContext();
  api.setScores({ '210': [0, 0] }); // Chapecoense x Vasco
  const rows = api.getRows();
  const chape = rowByName(rows, 'Chapecoense');
  const vasco = rowByName(rows, 'Vasco');

  assert.deepEqual([chape.j, chape.e, chape.pts, chape.gp, chape.gc, chape.sg], [31, 10, 19, 30, 62, -32]);
  assert.deepEqual([vasco.j, vasco.e, vasco.pts, vasco.gp, vasco.gc, vasco.sg], [31, 9, 36, 36, 43, -7]);
});

test('incomplete, fractional, negative, and above-limit scores are ignored', () => {
  const api = createStandingsContext();
  api.setScores({
    '316': [2, ''],
    '315': [1.5, 0],
    '317': [-1, 0],
    '319': [31, 0],
  });
  const rows = api.getRows();

  assert.equal(rowByName(rows, 'Cruzeiro').j, 31);
  assert.equal(rowByName(rows, 'Mirassol').j, 31);
  assert.equal(rowByName(rows, 'Internacional').j, 31);
  assert.equal(rowByName(rows, api.initialTeams[12][0]).j, api.initialTeams[12][1]);
});

test('sorts by each implemented tie-break in order', () => {
  const api = createStandingsContext();
  const cases = [
    {
      teams: [['More points', 2, 1, 1, 0, 0, 4, 2, 2], ['Fewer points', 1, 1, 0, 0, 0, 3, 1, 1]],
      expected: ['More points', 'Fewer points'],
    },
    {
      teams: [['More wins', 1, 1, 0, 0, 0, 3, 1, 1], ['Fewer wins', 3, 0, 3, 0, 2, 3, 3, 1]],
      expected: ['More wins', 'Fewer wins'],
    },
    {
      teams: [['Better goal difference', 1, 1, 0, 0, 2, 3, 3, 1], ['Lower goal difference', 1, 1, 0, 0, 1, 3, 2, 1]],
      expected: ['Better goal difference', 'Lower goal difference'],
    },
    {
      teams: [['More goals scored', 1, 1, 0, 0, 1, 3, 3, 2], ['Fewer goals scored', 1, 1, 0, 0, 1, 3, 2, 1]],
      expected: ['More goals scored', 'Fewer goals scored'],
    },
  ];

  for (const scenario of cases) {
    api.setTeams(scenario.teams);
    assert.deepEqual(api.getRows().map((row) => row.name), scenario.expected);
  }
});

test('CBF schedule has 380 unique references and ten games in each round', () => {
  const sandbox = {};
  vm.runInNewContext(fixturesSource, sandbox);
  const fixtures = sandbox.BRASILEIRAO_FIXTURES_2026;
  assert.equal(fixtures.length, 380);
  assert.equal(new Set(fixtures.map((fixture) => fixture.id)).size, 380);
  assert.equal(new Set(fixtures.flatMap((fixture) => [fixture.home, fixture.away])).size, 20);
  assert.ok(fixtures.every((fixture) => fixture.home !== fixture.away));
  const roundCounts = Array.from({ length: 38 }, (_, index) => fixtures.filter((fixture) => fixture.round === index + 1).length);
  assert.deepEqual(roundCounts, Array(38).fill(10));
  assert.equal(fixtures.filter((fixture) => fixture.officialResult).length, 309);
  assert.deepEqual(Array.from(fixtures.filter((fixture) => !fixture.officialResult), (fixture) => fixture.id), [
    '210', ...Array.from({ length: 70 }, (_, index) => String(index + 311)),
  ]);
});

test('fixture cards use all local club crests and expose initials when an image fails', () => {
  const api = createStandingsContext();
  const { fixtures } = api.selectRound('32');
  const imagePaths = Array.from(fixtures.matchAll(/src="(assets\/crests\/[^\"]+)"/g), (match) => match[1]);
  assert.equal(imagePaths.length, 20);
  assert.equal(new Set(imagePaths).size, 20);
  assert.ok(imagePaths.every((asset) => fs.existsSync(path.join(__dirname, '..', asset))));
  for (const abbreviation of ['FLA', 'PAL', 'CAP', 'CRU', 'FLU', 'CAM', 'BAH', 'SAN', 'SAO', 'RBB', 'BOT', 'CFC', 'VIT', 'MIR', 'VAS', 'COR', 'INT', 'GRE', 'REM', 'CHA']) {
    assert.match(fixtures, new RegExp(`>${abbreviation}<\\/span>`));
  }
  assert.equal(api.failCrest().imageHidden, true);
  const fallback = api.failCrest();
  assert.equal(fallback.fallbackHidden, false);
  assert.match(fallback.initials, /^[A-Z]{3}$/);
});

test('official scores stay read-only and simulated scores remain editable', () => {
  const api = createStandingsContext();
  const official = api.fixtures.find((fixture) => fixture.officialResult);
  const officialCard = api.selectRound(String(official.round)).fixtures.match(new RegExp(`<article class="fixture[^>]*data-fixture-id="${official.id}"[\\s\\S]*?<\\/article>`))[0];
  assert.match(officialCard, /class="official-score"/);
  assert.doesNotMatch(officialCard, /<input class="score"/);
  assert.match(officialCard, /aria-label="Resultado oficial"/);

  const simulatable = api.fixtures.find((fixture) => !fixture.officialResult && (Number(fixture.id) >= 311 || fixture.id === '210'));
  const simulatedCard = api.selectRound(String(simulatable.round)).fixtures.match(new RegExp(`<article class="fixture[^>]*data-fixture-id="${simulatable.id}"[\\s\\S]*?<\\/article>`))[0];
  assert.equal((simulatedCard.match(/<input class="score"/g) || []).length, 2);
});

test('AUDIT: every valid cup-selector combination preserves league data and projection invariants', () => {
  const api = createStandingsContext();
  const baseline = api.getRows().map(({ name, j, v, e, d, pts, gp, gc, sg }) => ({ name, j, v, e, d, pts, gp, gc, sg }));
  const groups = ['Estudiantes', 'Flamengo', 'Fluminense', 'Palmeiras'];
  const sula = ['Atlético-MG', 'Boca Juniors', 'Montevideo City Torque', 'Vasco'];
  const copa = ['Atlético-MG', 'Grêmio', 'Palmeiras', 'Vasco'];
  let combinations = 0;

  for (const lib of ['', ...groups]) for (const south of ['', ...sula]) {
    for (const champion of ['', ...copa]) for (const runnerUp of ['', ...copa]) {
      if (champion && champion === runnerUp) continue;
      api.setSelect('lib', lib);
      api.setSelect('sula', south);
      api.setSelect('cdb', champion);
      api.setSelect('vice', runnerUp);
      api.renderTable();

      const qualification = api.getQualification();
      const currentRows = api.getRows().map(({ name, j, v, e, d, pts, gp, gc, sg }) => ({ name, j, v, e, d, pts, gp, gc, sg }));
      assert.deepEqual(currentRows, baseline, 'cup selections must not alter standings or statistics');
      assert.equal(qualification.direct, Object.keys(qualification.groups).length + Object.keys(qualification.externalGroups).length);
      assert.equal(qualification.pre, Object.keys(qualification.preliminary).length);
      assert.equal(qualification.total, qualification.direct + qualification.pre);

      const groupNames = new Set(Object.keys(qualification.groups));
      const preNames = new Set(Object.keys(qualification.preliminary));
      assert.equal([...groupNames].some(name => preNames.has(name)), false, 'a league club cannot occupy two phases');
      assert.equal(qualification.sulaClubs.some(name => groupNames.has(name) || preNames.has(name)), false, 'continental zones cannot overlap');
      for (const [name, status] of Object.entries(qualification.status)) {
        assert.equal(status.phase, groupNames.has(name) ? 'groups' : preNames.has(name) ? 'pre' : qualification.sulaClubs.includes(name) ? 'sula' : qualification.pos[name] >= 17 ? 'relegation' : '');
      }
      assert.equal(Number(api.getText('directCount')), qualification.direct);
      assert.equal(Number(api.getText('preCount')), qualification.pre);
      const expectedLastPlace = qualification.leagueQualified.length
        ? `${Math.max(...[...Object.keys(qualification.groups), ...Object.keys(qualification.preliminary)].filter(name => qualification.pos[name]).map(name => qualification.pos[name]))}º`
        : '-';
      assert.equal(api.getText('lastPlace'), expectedLastPlace);
      const explanation = api.getInnerHtml('explain');
      assert.match(explanation, /Projeção de vagas para 2027/);
      for (const note of qualification.notes) assert.ok(explanation.includes(note), `rendered explanation must reflect calculation: ${note}`);
      combinations++;
    }
  }

  assert.equal(combinations, 525);
});

test('AUDIT: every base standings row satisfies the points, matches, and goal equations', () => {
  const api = createStandingsContext();
  const rows = api.getRows();
  assert.equal(rows.length, 20);
  for (const row of rows) {
    assert.equal(row.j, row.v + row.e + row.d, `${row.name}: played matches must equal W + D + L`);
    assert.equal(row.pts, row.v * 3 + row.e, `${row.name}: points must equal 3 × wins + draws`);
    assert.equal(row.sg, row.gp - row.gc, `${row.name}: goal difference must equal goals for minus against`);
  }
});

test('AUDIT: classification number colors and legend use matching zone tokens', () => {
  for (const [positionClass, legendClass, token] of [
    ['position-groups', 'zone-groups', '--groups'],
    ['position-pre', 'zone-pre', '--pre'],
    ['position-sula', 'zone-sula', '--sula'],
    ['position-relegation', 'zone-relegation', '--relegation'],
  ]) {
    assert.match(styleSource, new RegExp(`\\.${positionClass}\\s*\\{\\s*background:\\s*var\\(${token}\\);`));
    assert.match(styleSource, new RegExp(`\\.${legendClass}\\s*\\{\\s*background:\\s*var\\(${token}\\);`));
  }
});

test('AUDIT: a foreign Libertadores winner is counted separately and does not enter the league table', () => {
  const api = createStandingsContext();
  const namesBefore = api.getRows().map(row => row.name);
  api.changeSelect('lib', 'Estudiantes');
  const qualification = api.getQualification();
  assert.equal(qualification.externalGroups.Estudiantes, 'Campeão da Libertadores');
  assert.equal(qualification.direct, Object.keys(qualification.groups).length + 1);
  assert.deepEqual(api.getRows().map(row => row.name), namesBefore);
  assert.match(qualification.notes.join(' '), /Estudiantes não disputa o Brasileirão 2026/);
});

test('AUDIT: Copa do Brasil overlaps follow the confirmed REC destinations for the vacated places', () => {
  const api = createStandingsContext();
  const names = api.initialTeams.map(team => team[0]);
  const rankedInput = order => {
    api.setTeams(order.map((name, index) => {
      const wins = 19 - index;
      return [name, 38, wins, 0, 38 - wins, 0, 3 * wins, 100 - index, 40];
    }));
    return api.getRows();
  };
  const reordered = (first, second) => [first, second, ...names.filter(name => name !== first && name !== second)];

  // REC 2026, Art. 6, §§ 3–5: champion/runner-up already qualified through
  // the league use the applicable cup vacancy at the next league positions.
  let rows = rankedInput(reordered('Palmeiras', 'Atlético-MG'));
  api.setSelect('cdb', 'Palmeiras');
  api.setSelect('vice', 'Atlético-MG');
  let q = api.getQualification(rows);
  assert.deepEqual(Object.keys(q.groups), rows.slice(0, 5).map(row => row.name));
  assert.deepEqual(Object.keys(q.preliminary), rows.slice(5, 7).map(row => row.name));
  assert.equal(q.direct, 5);
  assert.equal(q.pre, 2);

  // Champion occupies a league group place; Copa's direct place goes to the
  // runner-up, while the runner-up's preliminary place is passed down.
  rows = rankedInput(['Palmeiras', 'Cruzeiro', 'Flamengo', 'Fluminense', 'Grêmio', 'Atlético-MG', ...names.filter(name => !['Palmeiras','Cruzeiro','Flamengo','Fluminense','Grêmio','Atlético-MG'].includes(name))]);
  api.setSelect('cdb', 'Palmeiras');
  api.setSelect('vice', 'Atlético-MG');
  q = api.getQualification(rows);
  assert.ok(q.groups['Atlético-MG']?.includes('Copa do Brasil: vaga direta redirecionada'));
  assert.deepEqual(Object.keys(q.preliminary).sort((a, b) => q.pos[a] - q.pos[b]), [rows[4].name, rows[6].name]);
  assert.equal(q.direct, 5);
  assert.equal(q.pre, 2);

  // Champion placed fifth moves from preliminary to groups; the fifth-place
  // league vacancy and the already-qualified runner-up's cup vacancy move on.
  rows = rankedInput(['Flamengo', 'Palmeiras', 'Fluminense', 'Cruzeiro', 'Atlético-MG', ...names.filter(name => !['Flamengo','Palmeiras','Fluminense','Cruzeiro','Atlético-MG'].includes(name))]);
  api.setSelect('cdb', 'Atlético-MG');
  api.setSelect('vice', 'Palmeiras');
  q = api.getQualification(rows);
  assert.ok(q.groups['Atlético-MG']?.includes('Copa do Brasil: fase de grupos'));
  assert.deepEqual(Object.keys(q.preliminary), rows.slice(5, 7).map(row => row.name));
  assert.equal(q.direct, 5);
  assert.equal(q.pre, 2);
  assert.match(q.notes.join(' '), /vaga preliminar da Copa do Brasil é repassada ao clube mais bem colocado no Brasileirão/);
});

test('AUDIT: relegated titleholders are tested for each selector, without treating the current policy as official', () => {
  const cases = [
    ['lib', 'Palmeiras'],
    ['sula', 'Vasco'],
    ['cdb', 'Vasco'],
    ['vice', 'Vasco'],
  ];
  for (const [selector, club] of cases) {
    const api = createStandingsContext();
    const names = api.initialTeams.map(team => team[0]);
    const order = [...names.filter(name => name !== club), club];
    api.setTeams(order.map((name, index) => {
      const wins = 19 - index;
      return [name, 38, wins, 0, 38 - wins, 0, 3 * wins, 100 - index, 40];
    }));
    api.changeSelect(selector, club);

    const qualification = api.getQualification();
    assert.equal(qualification.pos[club], 20, `${selector} candidate is in the projected relegation zone`);
    assert.equal(qualification.status[club].phase, 'relegation');
    assert.equal(Object.hasOwn(qualification.groups, club), false);
    assert.equal(Object.hasOwn(qualification.preliminary, club), false);
  }
});

test('AUDIT: relegation status uses the projected table after a simulated score', () => {
  const api = createStandingsContext();
  const names = api.initialTeams.map(team => team[0]);
  const order = [...names.filter(name => name !== 'Vasco'), 'Vasco'];
  api.setTeams(order.map((name, index) => {
    const wins = 19 - index;
    return [name, 38, wins, 0, 38 - wins, 0, 3 * wins, 100 - index, 40];
  }));
  api.setScores({ '210': [30, 0] }); // partida simulável com o Vasco; mantém a equipe na última posição
  api.changeSelect('sula', 'Vasco');
  const qualification = api.getQualification();
  assert.equal(qualification.pos.Vasco, 20);
  assert.equal(qualification.status.Vasco.phase, 'relegation');
});

test('AUDIT: relegated Libertadores titleholders expose provisional exclusion, redistribution, zones, indicators, and explanation', () => {
  const scenarios = [
    { selector: 'lib', relegated: 'Palmeiras' },
    { selector: 'sula', relegated: 'Vasco' },
    { selector: 'cdb', relegated: 'Vasco', runnerUp: 'Grêmio' },
    { selector: 'vice', relegated: 'Vasco', champion: 'Grêmio' },
  ];
  const preferredOrder = ['Flamengo', 'Palmeiras', 'Cruzeiro', 'Fluminense', 'Atlético-MG', 'Bahia', 'Santos', 'Grêmio'];

  for (const scenario of scenarios) {
    const api = createStandingsContext();
    const names = api.initialTeams.map(team => team[0]);
    const order = [...new Set([
      ...preferredOrder.filter(name => name !== scenario.relegated),
      ...names.filter(name => name !== scenario.relegated && !preferredOrder.includes(name)),
      scenario.relegated,
    ])];
    api.setTeams(order.map((name, index) => {
      const wins = 19 - index;
      return [name, 38, wins, 0, 38 - wins, 0, wins * 3, 100 - index, 40];
    }));
    if (scenario.champion) api.setSelect('cdb', scenario.champion);
    if (scenario.runnerUp) api.setSelect('vice', scenario.runnerUp);
    api.changeSelect(scenario.selector, scenario.relegated);

    const qualification = api.getQualification();
    const standings = api.getStandingsHtml();
    const renderedExplanation = api.getInnerHtml('explain');
    const brazilianLibertadoresClubs = [...Object.keys(qualification.groups), ...Object.keys(qualification.preliminary)]
      .filter(name => qualification.pos[name]);
    const expectedLastPlace = `${Math.max(...brazilianLibertadoresClubs.map(name => qualification.pos[name]))}º`;

    assert.equal(qualification.pos[scenario.relegated], 20, `${scenario.selector} titleholder is projected 20th`);
    assert.equal(qualification.status[scenario.relegated].phase, 'relegation');
    assert.equal(Object.hasOwn(qualification.groups, scenario.relegated), false);
    assert.equal(Object.hasOwn(qualification.preliminary, scenario.relegated), false);
    assert.equal(qualification.sulaClubs.includes(scenario.relegated), false);
    assert.match(standings, new RegExp(`<tr data-club="${scenario.relegated}" data-qualification="relegation"><td class="pos"><span class="position-number position-relegation">`));
    assert.equal(Number(api.getText('directCount')), qualification.direct);
    assert.equal(Number(api.getText('preCount')), qualification.pre);
    assert.equal(api.getText('lastPlace'), expectedLastPlace);
    assert.match(renderedExplanation, new RegExp(`${scenario.relegated} foi escolhido`));
    assert.match(renderedExplanation, /Regra confirmada pela CBF/);
    assert.match(renderedExplanation, /Hipótese provisória do simulador/);
    assert.match(renderedExplanation, /ainda não confirmado nesta auditoria/);

    if (scenario.selector === 'cdb') {
      assert.ok(qualification.groups[scenario.runnerUp]?.includes('Copa do Brasil: vaga direta redirecionada'));
      assert.equal(qualification.direct, 5);
      assert.equal(qualification.pre, 2);
      assert.equal(expectedLastPlace, '8º', 'the indicator includes the eligible runner-up’s table position');
    }
    if (scenario.selector === 'vice') {
      assert.ok(qualification.groups[scenario.champion]?.includes('Copa do Brasil: campe\u00e3o'));
      assert.equal(qualification.direct, 5);
      assert.equal(qualification.pre, 2);
      assert.equal(expectedLastPlace, '8º', 'the indicator includes the eligible cup champion’s table position');
    }
  }
});

// Remaining official tie-break tests need historical head-to-head results,
// disciplinary-card totals, and a draw outcome. Those data are not in app.js.
