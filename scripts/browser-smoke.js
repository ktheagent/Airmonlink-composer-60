'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const buildNumber = Number(process.env.AIRMON_BUILD_NUMBER || packageJson.buildNumber);
const buildLabel = `Build ${buildNumber}`;
const preview = path.join(root, 'Airmonlink-Composer-3-Preview.html');
const validation = path.join(root, 'validation');
const reportPath = path.join(validation, 'browser-smoke.json');
const screenshotPath = path.join(validation, 'composer3-browser.png');
const solfaScreenshotPath = path.join(validation, 'composer3-solfa.png');
const pdfPath = path.join(validation, 'composer3-print.pdf');
const chromium = process.env.CHROMIUM || '/usr/bin/chromium';
const constrainedLocalChromium = process.env.GITHUB_ACTIONS !== 'true' && process.env.AIRMON_CHROMIUM_MULTIPROCESS !== '1';
const port = Number(process.env.AIRMON_CDP_PORT || 9777);

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, response => {
      let data = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { data += chunk; });
      response.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (error) { reject(error); }
      });
    });
    request.on('error', reject);
    request.setTimeout(1000, () => request.destroy(new Error('timeout')));
  });
}

function startPreviewServer() {
  const content = fs.readFileSync(preview);
  const server = http.createServer((request, response) => {
    if (request.url === '/' || request.url === '/preview.html') {
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': content.length,
        'Cache-Control': 'no-store'
      });
      response.end(content);
      return;
    }
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end('Not found');
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, url: `http://127.0.0.1:${address.port}/preview.html` });
    });
  });
}

class Cdp {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.id = 0;
    this.pending = new Map();
    this.exceptions = [];
    this.consoleErrors = [];
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener('message', event => {
      const item = JSON.parse(String(event.data));
      if (item.method === 'Runtime.exceptionThrown') {
        const details = item.params?.exceptionDetails || {};
        this.exceptions.push(details.exception?.description || details.text || 'Unknown exception');
      }
      if (item.method === 'Runtime.consoleAPICalled' && item.params?.type === 'error') {
        this.consoleErrors.push((item.params.args || []).map(arg => arg.value || arg.description || '').join(' '));
      }
      if (item.id && this.pending.has(item.id)) {
        const { resolve, reject } = this.pending.get(item.id);
        this.pending.delete(item.id);
        if (item.error) reject(new Error(`${item.error.code}: ${item.error.message}`));
        else resolve(item.result || {});
      }
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WebSocket connection timeout')), 10000);
      this.socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      this.socket.addEventListener('error', event => { clearTimeout(timer); reject(new Error(String(event.message || 'WebSocket error'))); }, { once: true });
    });
  }

  call(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, 30000);
      this.pending.set(id, {
        resolve: value => { clearTimeout(timer); resolve(value); },
        reject: error => { clearTimeout(timer); reject(error); }
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression, awaitPromise = false) {
    const result = await this.call('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise
    });
    if (result.result?.subtype === 'error') throw new Error(result.result.description || 'JavaScript evaluation failed');
    return result.result?.value;
  }

  close() {
    if (this.socket) this.socket.close();
  }
}

async function waitForPage() {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    try {
      const pages = await fetchJson(`http://127.0.0.1:${port}/json`);
      const page = pages.find(item => item.type === 'page');
      if (page) return page;
    } catch (_) {}
    await sleep(100);
  }
  throw new Error('Chromium DevTools endpoint did not become available.');
}

function add(results, name, condition, details = '') {
  const passed = Boolean(condition);
  results.push({ name, status: passed ? 'PASS' : 'FAIL', details: String(details || '') });
  if (!passed) throw new Error(`${name}: ${details}`);
}

async function main() {
  if (!fs.existsSync(preview)) throw new Error('Run npm run preview first.');
  if (!fs.existsSync(chromium)) throw new Error(`Chromium unavailable: ${chromium}`);
  fs.mkdirSync(validation, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'airmon-composer3-cdp-'));
  const chromiumArgs = [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-gpu-sandbox',
    '--disable-software-rasterizer',
    '--remote-allow-origins=*',
    '--remote-debugging-address=127.0.0.1',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--window-size=1600,1000',
    'about:blank'
  ];
  if (constrainedLocalChromium) {
    chromiumArgs.splice(-1, 0, ['--single', 'process'].join('-'), ['--no', 'zygote'].join('-'));
  }
  const child = spawn(chromium, chromiumArgs, {
    stdio: ['ignore', 'ignore', 'pipe'],
    detached: process.platform !== 'win32',
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'DBUS_SESSION_BUS_ADDRESS'))
  });

  let stderr = '';
  child.stderr.on('data', chunk => { stderr += String(chunk); });
  const results = [];
  let cdp = null;

  try {
    const page = await waitForPage();
    cdp = new Cdp(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.call('Runtime.enable');
    await cdp.call('Page.enable');
    await cdp.call('Console.enable');
    const frameTree = await cdp.call('Page.getFrameTree');
    const frameId = frameTree.frameTree.frame.id;
    const previewHtml = fs.readFileSync(preview, 'utf8');
    await cdp.call('Page.setDocumentContent', { frameId, html: previewHtml });

    let ready = false;
    for (let attempt = 0; attempt < 300; attempt += 1) {
      ready = await cdp.evaluate("Boolean(window.AirmonComposer3 && document.documentElement.dataset.composer3Ready === 'true')");
      if (ready) break;
      await sleep(50);
    }
    add(results, 'Composer 3 mounted', ready);

    const verification = await cdp.evaluate('window.AirmonComposer3.verify()');
    add(results, 'Canonical semantic model', verification.canonicalModel, JSON.stringify(verification));
    add(results, 'Direct engine API', verification.directApi, JSON.stringify(verification));
    add(results, 'Exactly four voice layers', verification.fourVoiceLayers, JSON.stringify(verification));
    add(results, 'No legacy selectors', verification.legacySelectors === 0, JSON.stringify(verification));
    add(results, 'Six work-area tabs', verification.tabs === 6, JSON.stringify(verification));
    add(results, 'One active panel', verification.activePanels === 1, JSON.stringify(verification));
    add(results, 'Visible score viewport', verification.scoreViewport, JSON.stringify(verification));
    add(results, 'All commands connected', verification.allControlsConnected, JSON.stringify(verification));
    const shellGeometry = await cdp.evaluate(`(()=>{const area=document.querySelector('#scoreArea').getBoundingClientRect();const shell=document.querySelector('#app').getBoundingClientRect();return {innerWidth,areaLeft:area.left,areaRight:area.right,areaWidth:area.width,shellRight:shell.right,shellWidth:shell.width};})()`);
    add(results, 'Window shell and score workspace stay inside the viewport',
      shellGeometry.shellRight <= shellGeometry.innerWidth + 1 && shellGeometry.areaRight <= shellGeometry.innerWidth + 1,
      JSON.stringify(shellGeometry));

    const templateWizardProof = await cdp.evaluate(`(()=>{
      const wizard=window.AirmonNewScoreWizard;
      if(!wizard) return {available:false};
      wizard.open('staff-solfa');
      const dialog=document.querySelector('#newScoreWizard');
      const proof={
        available:true,
        open:dialog?.open===true || dialog?.hasAttribute('open'),
        templates:dialog?.querySelectorAll('[data-template-id]').length || 0,
        search:Boolean(dialog?.querySelector('#templateGallerySearch')),
        setup:['wizardTitle','wizardKey','wizardMeter','wizardTempo','wizardPickup','wizardInstruments','wizardTranspositions','wizardCreateScore'].every(id=>Boolean(dialog?.querySelector('#'+id)))
      };
      if(dialog?.open && typeof dialog.close==='function') dialog.close();
      return proof;
    })()`);
    add(results, 'Build 52 semantic New Score wizard is interactive',
      templateWizardProof.available && templateWizardProof.open && templateWizardProof.templates >= 15 && templateWizardProof.search && templateWizardProof.setup,
      JSON.stringify(templateWizardProof));

    const directEntryProof = await cdp.evaluate(`(()=>{
      const api=window.AirmonDirectNoteEntry;
      const group=document.querySelector('[data-group="DIRECT PROFESSIONAL ENTRY"]');
      const piano=document.querySelector('#build53VirtualPiano');
      const guide=document.querySelector('#entryShortcutGuide');
      api?.enable(true);
      const proof={
        available:Boolean(api),enabled:api?.state().enabled===true,group:Boolean(group),
        modes:['insert','overwrite','chord'].every(value=>Boolean(group?.querySelector('[data-entry-field="mode"] option[value="'+value+'"]'))),
        pianoKeys:piano?.querySelectorAll('[data-piano-midi]').length||0,
        guide:Boolean(guide),staffGeometry:Boolean(document.querySelector('[data-staff-hit-target][data-staff-top][data-staff-clef]'))
      };
      api?.enable(false);
      return proof;
    })()`);
    add(results, 'Build 53 direct professional note entry is interactive',
      directEntryProof.available && directEntryProof.enabled && directEntryProof.group && directEntryProof.modes && directEntryProof.pianoKeys >= 24 && directEntryProof.guide && directEntryProof.staffGeometry,
      JSON.stringify(directEntryProof));

    const safetyProof = await cdp.evaluate(`(()=>{
      const api=window.AirmonRhythmicSafetyUi;
      if(!api)return {available:false};
      const notice=api.notify(Object.assign(new Error('Invariant violation: overlapping events'),{code:'OVERLAP'}));
      const host=document.querySelector('#rhythmicSafetyStatus');
      const proof={available:true,visible:host?.hidden===false,human:!host?.textContent.toLowerCase().includes('invariant'),bottom:notice.placement==='bottom-status-area',coversScore:notice.coversScore};
      api.clear();return proof;
    })()`);
    add(results, 'Build 54 humane rhythmic safety feedback is interactive',
      safetyProof.available && safetyProof.visible && safetyProof.human && safetyProof.bottom && safetyProof.coversScore===false,
      JSON.stringify(safetyProof));

    const build55Proof = await cdp.evaluate(`(()=>{
      const controller=window.AirmonInspectorHubController;
      const card=document.querySelector('#voiceAppearanceCard');
      const colours=[...document.querySelectorAll('[data-voice-colour]')];
      document.querySelector('[data-input-control="voice"][data-voice="3"]')?.click();
      return {
        available:Boolean(controller),
        colours:colours.length,
        customPalette:Boolean(document.querySelector('#customPaletteCard')),
        activeVoice:document.body.dataset.activeVoice,
        contextual:Boolean(document.querySelector('.contextual-inspector-status')),
        audit:document.documentElement.dataset.build55CommandAudit
      };
    })()`);
    add(results, 'Build 55 inspector, voice identity and custom palettes are interactive',
      build55Proof.available && build55Proof.colours===4 && build55Proof.customPalette && build55Proof.activeVoice==='3' && build55Proof.contextual && build55Proof.audit==='pass',
      JSON.stringify(build55Proof));

    const build56Proof=await cdp.evaluate(`(()=>({
      available:Boolean(window.AirmonEngravingController),
      printProjection:window.AirmonEngravingController?.printProjection([{kind:'note',color:'#1768d5'},{kind:'selection-handle'}]).length,
      layout:window.AirmonEngravingController?.pageLayout({systems:4}).professional,
      offsets:[...document.querySelectorAll('.note-event')].slice(0,4).map(node=>node.getAttribute('transform')||node.dataset.eventVoice)
    }))()`);
    add(results, 'Build 56 professional engraving and print sanitisation are interactive',
      build56Proof.available&&build56Proof.printProjection===1&&build56Proof.layout===true,
      JSON.stringify(build56Proof));

    const build57Proof=await cdp.evaluate(`(()=>{
      const controller=window.AirmonStaffSolfaController;
      controller?.setMode('split');
      const result={available:Boolean(controller),mode:controller?.mode(),buttons:document.querySelectorAll('[data-sync-view]').length,split:document.querySelector('#scoreArea')?.classList.contains('synchronized-split-view'),status:document.querySelector('#staffSolfaSyncStatus')?.textContent||''};
      controller?.setMode('staff');return result;
    })()`);
    add(results, 'Build 57 Staff, Sol-fa and lyrics share an interactive synchronized view',
      build57Proof.available&&build57Proof.mode==='split'&&build57Proof.buttons===3&&build57Proof.split&&/synchronized/i.test(build57Proof.status),
      JSON.stringify(build57Proof));

    const workspaceModes = await cdp.evaluate(`(()=>{
      const map={setup:'compose',write:'notation',engrave:'view',play:'playback',publish:'publish'};
      const results=[];
      for(const [mode,tab] of Object.entries(map)){
        const button=document.querySelector('[data-workspace-mode="'+mode+'"]');
        const visible=Boolean(button&&!button.hidden&&getComputedStyle(button).display!=='none');
        button?.click();
        results.push({
          mode,
          visible,
          pressed:button?.getAttribute('aria-pressed')==='true',
          tabSelected:document.querySelector('[data-tab="'+tab+'"]')?.getAttribute('aria-selected')==='true',
          panelVisible:document.querySelector('#panel-'+tab)?.hidden===false
        });
      }
      document.querySelector('[data-workspace-mode="write"]')?.click();
      return results;
    })()`);
    add(results, 'All five workspace modes are visible and activate their real work areas',
      workspaceModes.length === 5 && workspaceModes.every(item => item.visible && item.pressed && item.tabSelected && item.panelVisible),
      JSON.stringify(workspaceModes));

    const compositionHub = await cdp.evaluate(`(()=>{
      const launcher=document.querySelector('#compositionHubLauncher');
      const hub=document.querySelector('#compositionHub');
      const launcherVisible=Boolean(launcher&&!launcher.closest('.composition-launcher')?.hidden&&getComputedStyle(launcher).display!=='none');
      launcher?.click();
      const opened=hub?.hidden===false&&launcher?.getAttribute('aria-expanded')==='true';
      const toolCount=hub?.querySelectorAll('[data-composition-tool]').length||0;
      document.querySelector('#compositionHubClose')?.click();
      return {launcherVisible,opened,toolCount,closed:hub?.hidden===true&&launcher?.getAttribute('aria-expanded')==='false'};
    })()`);
    add(results, 'Composition Hub is visible, populated, openable and closable',
      compositionHub.launcherVisible && compositionHub.opened && compositionHub.toolCount > 0 && compositionHub.closed,
      JSON.stringify(compositionHub));

    const before = await cdp.evaluate('window.AirmonComposer3.state().score.parts.flatMap(part=>part.events||[]).length');
    await cdp.evaluate("window.AirmonComposer3.command('addNote')", true);
    const after = await cdp.evaluate('window.AirmonComposer3.state().score.parts.flatMap(part=>part.events||[]).length');
    add(results, 'Note command changes canonical score', after === before + 1, `before=${before};after=${after}`);

    await cdp.evaluate("document.querySelector('#voiceSelect').value='2';document.querySelector('#voiceSelect').dispatchEvent(new Event('change',{bubbles:true}))");
    await cdp.evaluate("window.AirmonComposer3.command('addNote')", true);
    add(results, 'Independent Voice 2 entry', await cdp.evaluate("window.AirmonComposer3.state().score.parts.some(part=>(part.events||[]).some(event=>Number(event.voice)===2))"));

    const build42Input = await cdp.evaluate(`(()=>{
      const engine=window.AirmonComposer3.engine;
      document.querySelector('[data-input-control="voice"][data-voice="1"]').click();
      engine.seek(3);
      const before=engine.score.parts.flatMap(part=>part.events||[]).filter(event=>event.generatedBy!=='gap-fill').length;
      document.querySelector('[data-input-control="duration"][data-duration-denominator="2"]').click();
      document.querySelector('[data-input-control="pitch"][data-pitch-letter="G"]').click();
      const authored=engine.score.parts.flatMap(part=>part.events||[]).filter(event=>event.generatedBy!=='gap-fill');
      const entered=authored.filter(event=>event.type==='note'&&event.pitch==='G4'&&event.start>=3&&event.start<5);
      const tie=engine.score.spanners.some(item=>item.type==='tie'&&entered.some(event=>event.id===item.startEventId)&&entered.some(event=>event.id===item.endEventId));
      const activeDuration=document.querySelector('[data-input-control="duration"].active')?.dataset.durationDenominator;
      const activeVoice=document.querySelector('[data-input-control="voice"].active')?.dataset.voice;
      return {before,after:authored.length,entered:entered.map(event=>({start:event.start,duration:event.duration,tieStart:event.tieStart,tieStop:event.tieStop})),tie,cursor:engine.cursor,activeDuration,activeVoice,caret:Boolean(document.querySelector('.insertion-caret'))};
    })()`);
    add(results, 'Build 42 keypad performs safe tied barline entry',
      build42Input.after === build42Input.before + 2 &&
      build42Input.entered.length === 2 &&
      build42Input.tie === true &&
      build42Input.cursor === 5,
      JSON.stringify(build42Input));
    add(results, 'Build 42 keypad mirrors active duration and voice',
      build42Input.activeDuration === '2' && build42Input.activeVoice === '1',
      JSON.stringify(build42Input));
    add(results, 'Build 42 renders a visible insertion caret', build42Input.caret, JSON.stringify(build42Input));

    const build42Chord = await cdp.evaluate(`(()=>{
      const engine=window.AirmonComposer3.engine;
      engine.seek(8);
      document.querySelector('[data-input-control="duration"][data-duration-denominator="4"]').click();
      document.querySelector('[data-input-control="pitch"][data-pitch-letter="C"]').click();
      document.querySelector('[data-input-control="chord"]').click();
      document.querySelector('[data-input-control="pitch"][data-pitch-letter="E"]').click();
      const beforeDuplicate=engine.score.parts.flatMap(part=>part.events||[]).filter(event=>event.generatedBy!=='gap-fill').length;
      document.querySelector('[data-input-control="pitch"][data-pitch-letter="C"]').click();
      const afterDuplicate=engine.score.parts.flatMap(part=>part.events||[]).filter(event=>event.generatedBy!=='gap-fill').length;
      const chord=engine.score.parts.flatMap(part=>part.events||[]).filter(event=>event.type==='note'&&event.start===8);
      const banner=document.querySelector('#errorBanner');
      document.querySelector('[data-input-control="chord"]').click();
      document.querySelector('[data-input-control="rest"]').click();
      return {
        pitches:chord.map(event=>event.pitch).sort(),
        beforeDuplicate,
        afterDuplicate,
        recoverableStatus:document.querySelector('#status').textContent,
        persistentErrorVisible:Boolean(banner&&!banner.hidden),
        cursor:engine.cursor,
        restAtNine:engine.score.parts.flatMap(part=>part.events||[]).some(event=>event.type==='rest'&&event.start===9)
      };
    })()`);
    add(results, 'Build 42 chord entry uses one onset and rejects duplicate pitch',
      JSON.stringify(build42Chord.pitches) === JSON.stringify(['C4','E4']) &&
      build42Chord.beforeDuplicate === build42Chord.afterDuplicate,
      JSON.stringify(build42Chord));
    add(results, 'Build 42 recoverable input error does not leave a persistent failure banner',
      build42Chord.persistentErrorVisible === false,
      JSON.stringify(build42Chord));
    add(results, 'Build 42 rest keypad advances the same staff caret',
      build42Chord.restAtNine === true && build42Chord.cursor === 10,
      JSON.stringify(build42Chord));


    const completionControls = await cdp.evaluate(`(async()=>{
      const engine=window.AirmonComposer3.engine;
      engine.markSaved();
      document.querySelector('#scoreTemplate').value='lead';
      document.querySelector('#initialMeasures').value='6';
      document.querySelector('#pickupBeats').value='1';
      document.querySelector('#keySignature').value='G';
      document.querySelector('#timeSignature').value='3/4';
      await window.AirmonComposer3.command('applyScoreSetup');
      const setup={
        measures:engine.score.measures.length,
        key:engine.score.settings.key,
        time:engine.score.settings.timeSignature,
        pickup:engine.score.settings.pickupBeats
      };

      document.querySelector('#instrumentSelect').value='violin';
      document.querySelector('#clefSelect').value='treble';
      await window.AirmonComposer3.command('addPart');
      const partCountAfterAdd=engine.score.parts.length;
      await window.AirmonComposer3.command('applyPart');
      const editedPart={...engine.activePart()};
      await window.AirmonComposer3.command('removePart');
      const partCountAfterRemove=engine.score.parts.length;

      engine.setActivePart(engine.score.parts[0].id);
      engine.seek(0);
      engine.setDuration(1);
      const noteA=engine.addNote({pitch:'C4',start:0,duration:1,advance:false});
      const noteB=engine.addNote({pitch:'D4',start:1,duration:1,advance:false});
      engine.selectEvents([noteA.id,noteB.id]);
      await window.AirmonComposer3.command('copy');
      engine.seek(4);
      const beforePaste=engine.activePart().events.filter(event=>event.generatedBy!=='gap-fill').length;
      await window.AirmonComposer3.command('paste');
      const afterPaste=engine.activePart().events.filter(event=>event.generatedBy!=='gap-fill').length;

      engine.selectEvents([noteA.id,noteB.id]);
      document.querySelector('#targetVoiceSelect').value='2';
      await window.AirmonComposer3.command('copyToLayer');
      const voice2=engine.activePart().events.filter(event=>Number(event.voice)===2&&event.start<2).length;

      engine.selectEvents([noteA.id,noteB.id]);
      document.querySelector('#replaceMode').value='pitch-only';
      await window.AirmonComposer3.command('replaceSelection');
      const replacementIds=engine.state().selectedEvents.map(item=>item.event.id);
      const replacementSelection=replacementIds.length;

      engine.selectEvent(replacementIds[0]);
      await window.AirmonComposer3.command('repeatStart');
      await window.AirmonComposer3.command('repeatEnd');
      await window.AirmonComposer3.command('systemBreak');
      const measureAfterSystem={...engine.score.measures[0]};
      await window.AirmonComposer3.command('pageBreak');
      const measureAfterPage={...engine.score.measures[0]};

      document.querySelector('#dynamicSelect').value='ff';
      await window.AirmonComposer3.command('applyDynamic');
      document.querySelector('#chordSymbolInput').value='Cmaj7';
      await window.AirmonComposer3.command('addChordSymbol');
      document.querySelector('#annotationType').value='expression';
      document.querySelector('#annotationText').value='dolce';
      await window.AirmonComposer3.command('addTextAnnotation');

      engine.selectEvents(replacementIds);
      document.querySelector('#lyricVerse').value='1';
      document.querySelector('#lyricsInput').value='Sing';
      await window.AirmonComposer3.command('applyLyric');
      document.querySelector('#lyricsParagraph').value='Bright morning';
      await window.AirmonComposer3.command('applyLyricsParagraph');
      document.querySelector('#lyricSourceVerse').value='1';
      document.querySelector('#lyricTargetVerse').value='2';
      await window.AirmonComposer3.command('copyLyricVerse');
      document.querySelector('#lyricTargetVerse').value='1';
      document.querySelector('#lyricOffsetX').value='5';
      document.querySelector('#lyricOffsetY').value='-3';
      await window.AirmonComposer3.command('applyLyricOffset');
      document.querySelector('#lyricSearch').value='Bright';
      document.querySelector('#lyricReplacement').value='Praise';
      await window.AirmonComposer3.command('replaceLyrics');
      const lyricBeforeReset=engine.activePart().events.flatMap(event=>event.lyrics||[]).map(item=>({...item}));
      await window.AirmonComposer3.command('resetLyricOffset');
      document.querySelector('#lyricTargetVerse').value='2';
      window.confirm=()=>true;
      await window.AirmonComposer3.command('deleteLyricVerse');
      const lyricAfterDelete=engine.activePart().events.flatMap(event=>event.lyrics||[]).map(item=>({...item}));

      const serialized=engine.serializeAirscore();
      const roundTrip=window.AirmonAirscore.deserialize(serialized);
      const xml=engine.exportMusicXml();

      let playbackStarted=false;
      try{
        await window.AirmonComposer3.command('play');
        playbackStarted=Boolean(engine.playbackState().playing);
      }finally{
        await window.AirmonComposer3.command('stop');
      }

      document.querySelector('[data-command="showStaff"]').click();
      window.__desktopMock.exports=[];
      await window.AirmonComposer3.command('exportPng');
      const png=window.__desktopMock.exports.find(item=>String(item.defaultName||'').endsWith('.png'));
      const pngBytes=png?.content?Uint8Array.from(atob(png.content),character=>character.charCodeAt(0)):new Uint8Array();

      window.__desktopMock.printed=false;
      window.airmonDesktop.print=async payload=>{window.__desktopMock.printPayload=payload;return {success:true,canceled:false};};
      await window.AirmonComposer3.command('print');
      const printSuccess={printed:document.querySelector('#status').textContent.includes('Print job sent'),payload:window.__desktopMock.printPayload};
      window.airmonDesktop.print=async payload=>{window.__desktopMock.printCancelPayload=payload;return {success:false,canceled:true,reason:'Print job canceled'};};
      document.querySelector('#errorBanner').hidden=true;
      await window.AirmonComposer3.command('print');
      const printCancelled={
        status:document.querySelector('#status').textContent,
        errorVisible:!document.querySelector('#errorBanner').hidden,
        payload:window.__desktopMock.printCancelPayload
      };

      return {
        setup,
        partCountAfterAdd,
        partCountAfterRemove,
        editedPart:{instrumentKey:editedPart.instrumentKey,clef:editedPart.clef},
        paste:{beforePaste,afterPaste},
        voice2,
        replacementSelection,
        measureAfterSystem,
        measureAfterPage,
        dynamics:engine.score.annotations.filter(item=>item.type==='dynamics').map(item=>item.text),
        chordSymbols:engine.score.chordSymbols.map(item=>item.symbol),
        annotations:engine.score.annotations.filter(item=>item.type==='expression').map(item=>item.text),
        lyricBeforeReset,
        lyricAfterDelete,
        roundTrip:{
          measures:roundTrip.measures.length,
          repeatStart:roundTrip.measures[0].repeatStart,
          repeatEnd:roundTrip.measures[0].repeatEnd,
          newPage:roundTrip.measures[0].newPage,
          chordSymbols:roundTrip.chordSymbols.length,
          annotations:roundTrip.annotations.length
        },
        xml:{
          repeat:xml.includes('<repeat direction="forward"/>')&&xml.includes('<repeat direction="backward"'),
          pageBreak:xml.includes('new-page="yes"'),
          dynamics:xml.includes('<ff/>'),
          chord:xml.includes('<harmony'),
          text:xml.includes('dolce')
        },
        playbackStarted,
        png:{
          found:Boolean(png),
          defaultName:png?.defaultName||'',
          bytes:pngBytes.length,
          signature:Array.from(pngBytes.slice(0,8))
        },
        printSuccess,
        printCancelled
      };
    })()`, true);
    add(results, 'Complete score setup command applies template, key, meter and pickup',
      completionControls.setup.measures===6&&completionControls.setup.key==='G'&&
      completionControls.setup.time==='3/4'&&completionControls.setup.pickup===1,
      JSON.stringify(completionControls.setup));
    add(results, 'Part add, edit and remove commands mutate the authoritative score',
      completionControls.partCountAfterAdd===2&&completionControls.partCountAfterRemove===1&&
      completionControls.editedPart.instrumentKey==='violin'&&completionControls.editedPart.clef==='treble',
      JSON.stringify(completionControls));
    add(results, 'Clipboard paste and voice-layer copy create semantic events',
      completionControls.paste.afterPaste===completionControls.paste.beforePaste+2&&completionControls.voice2===2,
      JSON.stringify(completionControls));
    add(results, 'Selection replacement preserves an active semantic selection',
      completionControls.replacementSelection===2,
      JSON.stringify(completionControls));
    add(results, 'Repeat, system-break and page-break commands persist without conflicting flags',
      completionControls.measureAfterSystem.repeatStart===true&&completionControls.measureAfterSystem.repeatEnd===true&&
      completionControls.measureAfterSystem.newSystem===true&&completionControls.measureAfterPage.newPage===true&&
      completionControls.measureAfterPage.newSystem===false&&completionControls.roundTrip.newPage===true,
      JSON.stringify(completionControls));
    add(results, 'Dynamics, chord symbols and score text reach semantic storage and MusicXML',
      completionControls.dynamics.includes('ff')&&completionControls.chordSymbols.includes('Cmaj7')&&
      completionControls.annotations.includes('dolce')&&Object.values(completionControls.xml).every(Boolean),
      JSON.stringify(completionControls));
    add(results, 'Lyric paragraph, verse copy, search/replace, offsets, reset and deletion are functional',
      completionControls.lyricBeforeReset.some(item=>item.text==='Praise'&&item.offsetX===5&&item.offsetY===-3)&&
      completionControls.lyricAfterDelete.every(item=>Number(item.verse)!==2),
      JSON.stringify(completionControls));
    add(results, 'Playback command starts and stop command terminates the semantic transport',
      completionControls.playbackStarted===true&&!await cdp.evaluate('window.AirmonComposer3.engine.playbackState().playing'),
      JSON.stringify(completionControls));
    add(results, 'PNG export produces a genuine PNG payload through the desktop save service',
      completionControls.png.found&&completionControls.png.defaultName.endsWith('.png')&&
      completionControls.png.bytes>1000&&JSON.stringify(completionControls.png.signature)===JSON.stringify([137,80,78,71,13,10,26,10]),
      JSON.stringify(completionControls.png));
    add(results, 'Print success and cancellation are distinct non-error outcomes',
      completionControls.printSuccess.printed===true&&completionControls.printCancelled.status.includes('cancelled')&&
      completionControls.printCancelled.errorVisible===false,
      JSON.stringify(completionControls));

    await cdp.evaluate(`(()=>{
      const engine=window.AirmonComposer3.engine;
      const note=engine.score.parts.flatMap(part=>part.events||[]).find(event=>event.type==='note'&&event.generatedBy!=='gap-fill');
      if(note) engine.selectEvent(note.id);
    })()`);
    await cdp.evaluate("window.AirmonComposer3.command('trill')", true);
    add(results, 'Ornament command updates selected semantic note', await cdp.evaluate("window.AirmonComposer3.state().selectedEvents.some(item=>(item.event.ornaments||[]).includes('trill-mark'))"));

    await cdp.evaluate("document.querySelector('#techniqueType').value='fingering';document.querySelector('#techniqueValue').value='3';window.AirmonComposer3.command('applyTechnique')", true);
    add(results, 'Technique command updates selected semantic note', await cdp.evaluate("window.AirmonComposer3.state().selectedEvents.some(item=>(item.event.technical||[]).some(mark=>mark.type==='fingering'&&mark.value==='3'))"));

    const build43Rhythm = await cdp.evaluate(`(async()=>{
      const engine=window.AirmonComposer3.engine;
      engine.newScore({title:'Build 43 Rhythm Proof',measures:8,timeSignature:'4/4',autoFillRests:false});
      const notes=[
        engine.addNote({pitch:'C4',start:0,duration:.5,advance:false}),
        engine.addNote({pitch:'D4',start:.5,duration:.5,advance:false}),
        engine.addNote({pitch:'E4',start:1,duration:.5,advance:false})
      ];
      engine.selectEvents(notes.map(note=>note.id));
      engine.setTuplet(3,2);
      const triplet=engine.activePart().events.filter(event=>event.type==='note'&&event.start<1);
      const tripletPattern=triplet.map(event=>({
        start:event.start,
        duration:event.duration,
        actual:event.tuplet?.actual,
        normal:event.tuplet?.normal,
        beam:(event.beam||[]).find(mark=>mark.number===1)?.value
      }));

      const tieA=engine.addNote({pitch:'G4',start:2,duration:1,advance:false});
      const tieB=engine.addNote({pitch:'G4',start:3,duration:1,advance:false});
      engine.selectEvents([tieA.id,tieB.id]);
      engine.addTie();

      const phrase=[
        engine.addNote({pitch:'A4',start:4,duration:1,advance:false}),
        engine.addNote({pitch:'B4',start:5,duration:1,advance:false}),
        engine.addNote({pitch:'C5',start:6,duration:1,advance:false})
      ];
      engine.selectEvents(phrase.map(note=>note.id));
      engine.addSlur();
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

      const semantic={
        tuplets:tripletPattern,
        ties:engine.score.spanners.filter(item=>item.type==='tie').length,
        slurs:engine.score.spanners.filter(item=>item.type==='slur').length
      };
      const rendered={
        beams:document.querySelectorAll('.rhythmic-beam').length,
        tupletNumbers:document.querySelectorAll('.tuplet-number').length,
        ties:document.querySelectorAll('.spanner-path.tie').length,
        slurs:document.querySelectorAll('.spanner-path.slur').length
      };
      const xml=engine.exportMusicXml();
      engine.selectEvent(triplet[0].id);
      return {
        semantic,
        rendered,
        xml:{
          tuplet:xml.includes('<actual-notes>3</actual-notes>')&&xml.includes('<normal-notes>2</normal-notes>'),
          beam:xml.includes('<beam number="1">begin</beam>'),
          tie:xml.includes('<tie type="start"/>'),
          slur:xml.includes('<slur type="start"')
        },
        scoreErrors:window.AirmonScoreModel.validateScore(engine.score)
      };
    })()`, true);
    add(results, 'Build 43 creates a real 3:2 tuplet with retimed onsets',
      build43Rhythm.semantic.tuplets.length===3 &&
      Math.abs(build43Rhythm.semantic.tuplets[1].start-1/3)<1e-8 &&
      build43Rhythm.semantic.tuplets.every(item=>item.actual===3&&item.normal===2),
      JSON.stringify(build43Rhythm));
    add(results, 'Build 43 creates grouped semantic beams',
      JSON.stringify(build43Rhythm.semantic.tuplets.map(item=>item.beam))===JSON.stringify(['begin','continue','end']),
      JSON.stringify(build43Rhythm));
    add(results, 'Build 43 creates strict ties and phrase slurs',
      build43Rhythm.semantic.ties===1&&build43Rhythm.semantic.slurs===1,
      JSON.stringify(build43Rhythm));
    add(results, 'Build 43 renders beams, tuplets, ties and slurs on the staff',
      build43Rhythm.rendered.beams>=1&&build43Rhythm.rendered.tupletNumbers>=1&&
      build43Rhythm.rendered.ties>=1&&build43Rhythm.rendered.slurs>=1,
      JSON.stringify(build43Rhythm));
    add(results, 'Build 43 exports rhythmic notation to MusicXML',
      Object.values(build43Rhythm.xml).every(Boolean)&&build43Rhythm.scoreErrors.length===0,
      JSON.stringify(build43Rhythm));

    await cdp.evaluate("window.AirmonComposer3.command('fermata')", true);
    add(results, 'Fermata command updates selected semantic note', await cdp.evaluate("window.AirmonComposer3.state().selectedEvents.some(item=>item.event.fermata===true)"));

    await cdp.evaluate("document.querySelector('#solfaSyllableInput').value='s';window.AirmonComposer3.command('applySolfaSyllable')", true);
    const solfaEdited = await cdp.evaluate("(()=>{const state=window.AirmonComposer3.state();return state.selectedEvents.map(item=>{const part=state.score.parts.find(part=>part.id===item.partId);const converted=window.AirmonSolfa.eventToSolfa(item.event,state.score,part,{notationMode:'traditional'});return {midi:item.event.midi,pitch:item.event.pitch,syllable:converted.syllable}})})()");
    add(results, 'Sol-fa syllable edits the selected staff note', solfaEdited.some(item=>String(item.syllable).toLowerCase().startsWith('s')), JSON.stringify(solfaEdited));

    await cdp.evaluate(`document.querySelector('#voiceSelect').value='4';document.querySelector('#voiceSelect').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#solfaPassageInput').value="d r m f | s l t d'";window.AirmonComposer3.command('applySolfaPassage')`, true);
    add(results, 'Sol-fa passage creates authoritative Voice 4 events', await cdp.evaluate("window.AirmonComposer3.state().score.parts.some(part=>(part.events||[]).filter(event=>event.generatedBy!=='gap-fill'&&Number(event.voice)===4).length>=8)"));

    await cdp.evaluate("window.AirmonComposer3.command('verifySolfa')", true);
    add(results, 'Staff playback and Sol-fa verification passes', await cdp.evaluate("document.querySelector('#solfaStatus').textContent.includes('synchronized')"));

    await cdp.evaluate("document.querySelector('#showSolfaOverlay').checked=true;document.querySelector('#showSolfaOverlay').dispatchEvent(new Event('change',{bubbles:true}))");
    add(results, 'Optional Sol-fa staff overlay is stored in score settings', await cdp.evaluate("window.AirmonComposer3.state().score.settings.showSolfa===true"));

    await cdp.evaluate("document.querySelector('#lyricVerse').value='2';document.querySelector('#lyricsInput').value='Rejoice';window.AirmonComposer3.command('applyLyric')", true);
    const browserLyrics = await cdp.evaluate("window.AirmonComposer3.state().selectedEvents.flatMap(item=>item.event.lyrics||[])");
    add(results, 'Multi-verse lyric entry stores verse as metadata', browserLyrics.some(item=>item.verse===2&&item.text==='Rejoice')&&!browserLyrics.some(item=>/^2Rejoice$/.test(item.text)), JSON.stringify(browserLyrics));

    await cdp.evaluate("document.querySelector('#publicationSubtitle').value='Festival Edition';document.querySelector('#publicationDedication').value='For every choir';document.querySelector('#publicationLyricist').value='Airmon Writer';document.querySelector('#publicationDate').value='2026';window.AirmonComposer3.command('applyPublication')", true);
    add(results, 'Publication hierarchy renders semantic metadata', await cdp.evaluate("document.querySelector('#subtitleView').textContent==='Festival Edition'&&document.querySelector('#dedicationView').textContent==='For every choir'&&document.querySelector('#lyricistView').textContent.includes('Airmon Writer')&&document.querySelector('#compositionDateView').textContent==='2026'"));

    await cdp.evaluate("document.querySelector('#publicationField').value='staff:title';document.querySelector('#publicationOffsetX').value='16';document.querySelector('#publicationOffsetY').value='-5';window.AirmonComposer3.command('applyPublicationLayout')", true);
    add(results, 'Publication text position persists in semantic layout', await cdp.evaluate("window.AirmonComposer3.state().score.publicationTextLayout['staff:title'].offsetX===16&&window.AirmonComposer3.state().score.publicationTextLayout['staff:title'].offsetY===-5&&document.querySelector('#scoreTitleView').style.transform.includes('16px')"));

    await cdp.evaluate("document.querySelector('#pageTextPage').value='1';document.querySelector('#pageTextValue').value='Continuation header';window.AirmonComposer3.command('addPageText')", true);
    add(results, 'Page-scoped text is visible and semantic', await cdp.evaluate("window.AirmonComposer3.state().score.annotations.some(item=>item.type==='page-text'&&item.scope==='page'&&item.text==='Continuation header')&&document.querySelector('#pageTextView').textContent.includes('Continuation header')"));

    await cdp.evaluate("document.querySelector('#lyricsInput').value='Airmonlink';window.AirmonComposer3.command('applyLyric')", true);
    add(results, 'Lyric command updates score', await cdp.evaluate("window.AirmonComposer3.state().score.parts.some(part=>(part.events||[]).some(event=>Array.isArray(event.lyrics)&&event.lyrics.length))"));


    const pianoBefore = await cdp.evaluate("(()=>{const area=document.querySelector('#scoreArea').getBoundingClientRect();const panel=document.querySelector('#pianoPanel');return {height:area.height,hidden:panel.hidden}})()");
    add(results, 'Piano panel is hidden by default', pianoBefore.hidden === true, JSON.stringify(pianoBefore));

    await cdp.evaluate("window.AirmonComposer3.command('togglePianoPanel')", true);
    const pianoOpen = await cdp.evaluate("(()=>{const area=document.querySelector('#scoreArea').getBoundingClientRect();const panel=document.querySelector('#pianoPanel').getBoundingClientRect();return {hidden:document.querySelector('#pianoPanel').hidden,scoreHeight:area.height,panelHeight:panel.height,expanded:document.querySelector('[data-command=\"togglePianoPanel\"]').getAttribute('aria-expanded')}})()");
    add(results, 'Docked piano panel opens below score without overlay', !pianoOpen.hidden && pianoOpen.panelHeight > 0 && pianoOpen.scoreHeight < pianoBefore.height && pianoOpen.expanded === 'true', JSON.stringify({ before: pianoBefore, after: pianoOpen }));

    await cdp.evaluate("document.querySelector('#pianoOctave').value='4';document.querySelector('#pianoOctave').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#pianoVelocity').value='96';document.querySelector('#pianoVelocity').dispatchEvent(new Event('change',{bubbles:true}));");
    const chordResult = await cdp.evaluate("(()=>{const e=window.AirmonComposer3.engine;e.setActiveVoice(3);e.seek(0);e.setDuration(1);const before=e.score.parts.flatMap(p=>p.events||[]).length;const created=e.addPianoChord([60,64,67,64],{velocity:96,inputSource:'browser-piano'});const after=e.score.parts.flatMap(p=>p.events||[]).length;return {before,after,count:created.length,midis:created.map(n=>n.midi).sort((a,b)=>a-b),voices:created.map(n=>n.voice),chords:[...new Set(created.map(n=>n.chordId))],selected:document.querySelectorAll('.piano-key.selected').length};})()");
    add(results, 'Piano chord enters one deduplicated semantic chord in active Voice 3', chordResult.count === 3 && chordResult.after === chordResult.before + 3 && JSON.stringify(chordResult.midis) === JSON.stringify([60,64,67]) && chordResult.voices.every(voice => voice === 3) && chordResult.chords.length === 1, JSON.stringify(chordResult));
    add(results, 'Piano selection is reflected on visible keys', chordResult.selected >= 3, JSON.stringify(chordResult));

    const auditionOnly = await cdp.evaluate("(async()=>{const input=document.querySelector('#pianoInputMode');input.checked=false;input.dispatchEvent(new Event('change',{bubbles:true}));const before=window.AirmonComposer3.engine.score.parts.flatMap(p=>p.events||[]).length;window.dispatchEvent(new KeyboardEvent('keydown',{key:'a',bubbles:true}));await new Promise(resolve=>setTimeout(resolve,100));const after=window.AirmonComposer3.engine.score.parts.flatMap(p=>p.events||[]).length;return {before,after,inputMode:window.AirmonComposer3.engine.score.settings.pianoInputMode};})()", true);
    add(results, 'Piano audition mode does not create score events', auditionOnly.before === auditionOnly.after && auditionOnly.inputMode === false, JSON.stringify(auditionOnly));

    await cdp.evaluate("window.AirmonComposer3.command('collapsePianoPanel')", true);
    add(results, 'Piano panel collapses and returns score space', await cdp.evaluate("document.querySelector('#pianoPanel').hidden===true&&document.querySelector('[data-command=\"togglePianoPanel\"]').getAttribute('aria-expanded')==='false'"));


    await cdp.evaluate("document.querySelector('#countInMeasures').value='2';document.querySelector('#metronome').checked=true;window.AirmonComposer3.command('applyLoop')", true);
    add(results, 'Count-in and metronome options reach semantic transport', await cdp.evaluate("window.AirmonComposer3.engine.playbackState().countInMeasures===2&&window.AirmonComposer3.engine.playbackState().metronome===true"));

    await cdp.evaluate("document.querySelector('#jumpMeasureNumber').value='2';window.AirmonComposer3.command('jumpMeasure')", true);
    add(results, 'Measure navigation moves to exact measure boundary', await cdp.evaluate("window.AirmonComposer3.engine.cursor===window.AirmonScoreModel.measureStartBeat(window.AirmonComposer3.engine.score,1)"));

    const pausedState = await cdp.evaluate("(()=>{const e=window.AirmonComposer3.engine;e.playback={playing:true,currentBeat:1.75,stop(){this.playing=false;}};window.AirmonComposer3.command('pause');return e.playbackState();})()");
    add(results, 'Pause preserves playback position', pausedState.paused === true && pausedState.beat === 1.75, JSON.stringify(pausedState));

    const midiFailure = await cdp.evaluate("(async()=>{const original=navigator.requestMIDIAccess;Object.defineProperty(navigator,'requestMIDIAccess',{configurable:true,value:async()=>{throw new Error('Permission denied for reliability test')}});await window.AirmonComposer3.command('enableMidi');const status=document.querySelector('#midiStatus').dataset.status;const message=document.querySelector('#midiStatus').textContent;Object.defineProperty(navigator,'requestMIDIAccess',{configurable:true,value:original});return {status,message,errorVisible:!document.querySelector('#errorBanner').hidden};})()", true);
    add(results, 'MIDI permission failure is visible and nonfatal', midiFailure.status === 'permission-denied' && midiFailure.errorVisible, JSON.stringify(midiFailure));
    cdp.consoleErrors = cdp.consoleErrors.filter(message => !message.includes('Permission denied for reliability test'));
    await cdp.evaluate("document.querySelector('#dismissError').click()");


    const midiInputWorkflow = await cdp.evaluate(`(async()=>{
      const engine=window.AirmonComposer3.engine;
      const before=engine.score.parts.flatMap(part=>part.events||[]).filter(event=>event.inputSource==='midi-realtime').length;
      await window.AirmonComposer3.command('enableMidi');
      const connected={...engine.midiState()};
      document.querySelector('#midiMode').value='realtime';
      document.querySelector('#midiMode').dispatchEvent(new Event('change',{bubbles:true}));
      await window.AirmonComposer3.command('startMidiRecord');
      const recording={...engine.midiState()};
      const started=performance.now();
      window.__desktopMock.midiInput.emit([0x90,67,104],started+10);
      window.__desktopMock.midiInput.emit([0x80,67,0],started+510);
      await window.AirmonComposer3.command('stopMidiRecord');
      const stopped={...engine.midiState()};
      const after=engine.score.parts.flatMap(part=>part.events||[]).filter(event=>event.inputSource==='midi-realtime');
      await window.AirmonComposer3.command('disconnectMidi');
      const disconnected={...engine.midiState()};
      return {
        before,
        connected,
        recording,
        stopped,
        entered:after.map(event=>({midi:event.midi,duration:event.duration,voice:event.voice})),
        disconnected,
        status:document.querySelector('#midiStatus').textContent
      };
    })()`, true);
    add(results, 'MIDI input connects, records a real note, stops and disconnects cleanly',
      midiInputWorkflow.connected.deviceId==='preview-input'&&midiInputWorkflow.recording.recording===true&&
      midiInputWorkflow.stopped.recording===false&&midiInputWorkflow.entered.length===midiInputWorkflow.before+1&&
      midiInputWorkflow.entered.at(-1).midi===67&&midiInputWorkflow.disconnected.status==='disabled',
      JSON.stringify(midiInputWorkflow));

    await cdp.evaluate("window.AirmonComposer3.engine.playback=null;window.AirmonComposer3.command('enableMidiOutput')", true);
    await cdp.evaluate("window.AirmonComposer3.engine.seek(0);window.AirmonComposer3.command('playMidiOutput')", true);
    const midiOutput = await cdp.evaluate("({device:document.querySelector('#midiOutputSelect').value,messages:window.__desktopMock.midiMessages||[],status:document.querySelector('#midiOutputStatus').textContent})");
    add(results, 'Web MIDI output schedules note-on and note-off messages', midiOutput.device === 'preview-output' && midiOutput.messages.some(item=>(item.data[0]&0xf0)===0x90) && midiOutput.messages.some(item=>(item.data[0]&0xf0)===0x80), JSON.stringify(midiOutput));

    const publicationProof = await cdp.evaluate(`(()=>{
      const engine=window.AirmonComposer3.engine;
      engine.newScore({title:'Airmonlink Composer ${buildLabel}',composer:'Airmonlink',measures:8,timeSignature:'4/4',autoFillRests:false});
      const words=['Sing','with','joy','to-day','Music','lifts','every','heart'];
      const pitches=[60,62,64,65,67,69,71,72];
      words.forEach((word,index)=>{
        engine.addNote({midi:pitches[index],start:index,duration:1,voice:1,staff:1,advance:false,inputSource:'build${buildNumber}-publication-proof'});
        engine.setLyric(word,{verse:1,syllabic:word.includes('-')?'begin':'single'});
      });
      return {
        notes:engine.score.parts.flatMap(part=>part.events||[]).filter(event=>event.type==='note').length,
        lyrics:engine.score.parts.flatMap(part=>part.events||[]).flatMap(event=>event.lyrics||[]).map(item=>item.text),
        title:engine.score.metadata.title
      };
    })()`);
    await cdp.evaluate("document.querySelector('#publicationSubtitle').value='Release Candidate';document.querySelector('#publicationDedication').value='Verified browser publication proof';document.querySelector('#publicationLyricist').value='Airmonlink';document.querySelector('#publicationDate').value='2026';window.AirmonComposer3.command('applyPublication')", true);
    add(results, `Clean ${buildLabel} publication proof is prepared for PNG and PDF inspection`,
      publicationProof.notes===8&&publicationProof.lyrics.length===8&&publicationProof.title===`Airmonlink Composer ${buildLabel}`,
      JSON.stringify(publicationProof));
    const build58 = await cdp.evaluate(`(()=>{const c=window.AirmonPerformancePublishingController,r=c?.report?.();return {present:Boolean(c&&document.querySelector('#build58PerformanceGroup')),status:r?.status,notes:r?.performance?.playableNotes,channels:r?.mixer?.channels?.length,parts:r?.parts?.linkedParts?.length};})()`);
    add(results, 'Build 58 integrated performance, mixer, parts and publishing report',
      build58.present&&build58.status==='PASS'&&build58.notes>0&&build58.channels>0&&build58.parts>0,
      JSON.stringify(build58));

    const build59 = await cdp.evaluate(`(()=>{const c=window.AirmonReleaseQualityController,r=c?.render?.();return {present:Boolean(c&&document.querySelector('#build59QualityGroup')),accessibility:r?.accessibility?.status,interchange:r?.interchange?.status,controls:r?.accessibility?.controls};})()`);
    add(results, 'Build 59 accessibility, interchange and interface audit',
      build59.present&&build59.accessibility==='PASS'&&build59.interchange==='PASS'&&build59.controls>0,
      JSON.stringify(build59));

    add(results, 'Window title and score-information fields follow authoritative metadata',
      await cdp.evaluate(`document.querySelector('#documentTitle').textContent==='Airmonlink Composer ${buildLabel}'&&document.querySelector('#scoreTitle').value==='Airmonlink Composer ${buildLabel}'&&document.querySelector('#composerName').value==='Airmonlink'`));

    await cdp.evaluate("window.AirmonComposer3.command('printPreview')", true);
    add(results, 'Print preview reaches isolated desktop service', await cdp.evaluate("Boolean(window.__desktopMock.printPreview&&window.__desktopMock.printPreview.pageSize)"));

    await cdp.evaluate("window.AirmonComposer3.command('showSolfa')", true);
    add(results, 'Dedicated Tonic Sol-fa page', await cdp.evaluate("!document.querySelector('#solfaPage').hidden&&document.querySelector('#solfaPages').textContent.trim().length>0"));
    const solfaShot = await cdp.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(solfaScreenshotPath, Buffer.from(solfaShot.data, 'base64'));

    await cdp.evaluate("window.AirmonComposer3.command('showStaff')", true);
    const shot = await cdp.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(screenshotPath, Buffer.from(shot.data, 'base64'));

    await cdp.evaluate("window.AirmonComposer3.command('save')", true);
    add(results, 'Save reaches desktop service', await cdp.evaluate('window.__desktopMock.saved.length===1'));

    await cdp.evaluate("window.AirmonComposer3.command('exportMusicXml')", true);
    add(results, 'MusicXML export reaches desktop service', await cdp.evaluate("window.__desktopMock.exports.some(item=>item.defaultName.endsWith('.musicxml'))"));

    await cdp.evaluate("window.AirmonComposer3.command('exportMidi')", true);
    add(results, 'MIDI export reaches desktop service', await cdp.evaluate("window.__desktopMock.exports.some(item=>item.defaultName.endsWith('.mid'))"));

    await cdp.evaluate("window.AirmonComposer3.command('exportPdf')", true);
    add(results, 'PDF command reaches desktop service', await cdp.evaluate('Boolean(window.__desktopMock.pdf)'));

    const pdf = await cdp.call('Page.printToPDF', { printBackground: true, preferCSSPageSize: true });
    fs.writeFileSync(pdfPath, Buffer.from(pdf.data, 'base64'));
    add(results, 'Browser PDF signature', fs.readFileSync(pdfPath).subarray(0, 5).toString('ascii') === '%PDF-', fs.statSync(pdfPath).size);

    const colours = await cdp.evaluate("(()=>{const s=getComputedStyle(document.documentElement);return ['--navy-950','--royal-600','--gold-500'].map(n=>s.getPropertyValue(n).trim())})()");
    add(results, 'Official colour identity', colours.every(Boolean), JSON.stringify(colours));
    add(results, 'No runtime exceptions', cdp.exceptions.length === 0, JSON.stringify(cdp.exceptions));
    add(results, 'No console errors', cdp.consoleErrors.length === 0, JSON.stringify(cdp.consoleErrors));

    fs.writeFileSync(reportPath, JSON.stringify({ status: 'PASS', checks: results, exceptions: cdp.exceptions, consoleErrors: cdp.consoleErrors }, null, 2) + '\n');
    console.log(`Browser validation passed: ${results.length}/${results.length} checks.`);
    console.log(`Screenshot: ${screenshotPath}`);
    console.log(`Sol-fa screenshot: ${solfaScreenshotPath}`);
    console.log(`PDF: ${pdfPath}`);
  } catch (error) {
    fs.writeFileSync(reportPath, JSON.stringify({ status: 'FAIL', checks: results, error: error.stack || String(error), chromiumStderr: stderr.slice(-10000) }, null, 2) + '\n');
    throw error;
  } finally {
    if (cdp) cdp.close();
    try {
      if (child.exitCode === null && child.signalCode === null) {
        if (process.platform === 'win32') child.kill('SIGTERM');
        else process.kill(-child.pid, 'SIGTERM');
      }
    } catch (_) {}
    await Promise.race([
      new Promise(resolve => child.once('exit', resolve)),
      sleep(3000)
    ]);
    try {
      if (child.exitCode === null && child.signalCode === null) {
        if (process.platform === 'win32') child.kill('SIGKILL');
        else process.kill(-child.pid, 'SIGKILL');
      }
    } catch (_) {}
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error.stack || String(error));
  process.exitCode = 1;
});
