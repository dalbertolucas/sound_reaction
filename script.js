const GAME_TIME = 30;      // segundos
const BEEPS_COUNT = 5;     // beeps aleatórios dentro dos 30s
const POINTS_BEEP = 5;     // +5 para quem reage primeiro
const PENALTY_EARLY = -2;  // -2 se tocar antes do beep
const POINTS_FINAL = 12;   // +12 no beep final (30s)

const i18n = {
  pt: {
    title: "Beep Reaction Duel",
    start_desc:
      "O jogo dura 30 segundos.\nNesse período, 5 beeps surgem em momentos imprevisíveis.\nCada vez que um beep toca, o jogador mais rápido ganha 5 pontos.\nAtenção: tocar antes do beep faz você perder 2 pontos.\nAo final dos 30 segundos, um último beep toca: o primeiro toque após ele vale 12 pontos.",
    start_btn: "INICIAR",
    stop_btn: "PARAR",
    menu_btn: "MENU",
    blue_label: "AZUL",
    red_label: "VERMELHO",
    tap_here: "TOQUE AQUI",
    status_waiting: "Aguardando beep…",
    status_go: "VALENDO!",
    status_final: "ÚLTIMO BEEP!",
    game_over: "Fim de jogo",
    play_again: "JOGAR DE NOVO",
    developed_by: "Developed by Mach One Planalto.",
    winner_blue: "VENCEDOR: AZUL 🟦",
    winner_red: "VENCEDOR: VERMELHO 🟥",
    winner_tie: "EMPATE",
  },
  en: {
    title: "Beep Reaction Duel",
    start_desc:
      "The game lasts 30 seconds.\nDuring this time, 5 beeps occur at unpredictable moments.\nEach time a beep sounds, the fastest player earns 5 points.\nWarning: tapping before the beep costs you 2 points.\nAt the end of the 30 seconds, a final beep sounds: the first tap after it is worth 12 points.",
    start_btn: "START",
    stop_btn: "STOP",
    menu_btn: "MENU",
    blue_label: "BLUE",
    red_label: "RED",
    tap_here: "TAP HERE",
    status_waiting: "Waiting for beep…",
    status_go: "GO!",
    status_final: "FINAL BEEP!",
    game_over: "Game Over",
    play_again: "PLAY AGAIN",
    developed_by: "Developed by Mach One Planalto.",
    winner_blue: "WINNER: BLUE 🟦",
    winner_red: "WINNER: RED 🟥",
    winner_tie: "TIE",
  }
};

const startScreen = document.getElementById("startScreen");
const gameScreen = document.getElementById("gameScreen");
const endScreen = document.getElementById("endScreen");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const menuBtn = document.getElementById("menuBtn");

const blueZone = document.getElementById("blueZone");
const redZone = document.getElementById("redZone");

const scoreBlueEl = document.getElementById("scoreBlue");
const scoreRedEl = document.getElementById("scoreRed");

const statusText = document.getElementById("statusText");

const finalBlueEl = document.getElementById("finalBlue");
const finalRedEl = document.getElementById("finalRed");

const winnerBanner = document.getElementById("winnerBanner");
const winnerText = document.getElementById("winnerText");

const playAgainBtn = document.getElementById("playAgainBtn");
const menuFromEndBtn = document.getElementById("menuFromEndBtn");

/* ===== idioma ===== */
let currentLang = loadLang();

function loadLang(){
  const raw = localStorage.getItem("brd_lang");
  return raw === "en" ? "en" : "pt";
}

function setLang(lang){
  currentLang = (lang === "en") ? "en" : "pt";
  localStorage.setItem("brd_lang", currentLang);
  document.documentElement.lang = currentLang === "pt" ? "pt-br" : "en";

  document.querySelectorAll(".lang-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.lang === currentLang);
  });

  renderI18n();
  updateStatusWaiting();
}

function renderI18n(){
  const dict = i18n[currentLang];
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    const v = dict[key];
    if(typeof v === "string") el.textContent = v;
  });
}

/* ===== estado do jogo ===== */
let running = false;

let scoreBlue = 0;
let scoreRed = 0;

let scheduleTimeouts = [];
let beepTimes = [];
let nextBeepIndex = 0;
let armed = false;
let claimed = false;
let finalRound = false;

let audioUnlocked = false;

/* ===== util ===== */
function setRunningUI(isRunning){
  stopBtn.disabled = !isRunning;
  menuBtn.disabled = isRunning;
}

function showStart(){
  gameScreen.classList.add("hidden");
  endScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
}

function showGame(){
  startScreen.classList.add("hidden");
  endScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
}

function showEnd(){
  startScreen.classList.add("hidden");
  gameScreen.classList.add("hidden");
  endScreen.classList.remove("hidden");
}

function updateScoresUI(){
  scoreBlueEl.textContent = String(scoreBlue);
  scoreRedEl.textContent = String(scoreRed);
}

function flashZone(zoneEl){
  zoneEl.classList.add("flash");
  setTimeout(() => zoneEl.classList.remove("flash"), 120);
}

/* ===== áudio (beep) ===== */
function ensureAudioUnlocked(){
  if(audioUnlocked) return;
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.01);
    audioUnlocked = true;
    ctx.close?.();
  } catch (_) {}
}

function playBeep(freq = 880, durationMs = 120){
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if(!AudioCtx) return;

  const ctx = new AudioCtx();
  const o = ctx.createOscillator();
  const g = ctx.createGain();

  o.type = "square";
  o.frequency.value = freq;

  const now = ctx.currentTime;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.25, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + (durationMs/1000));

  o.connect(g);
  g.connect(ctx.destination);

  o.start(now);
  o.stop(now + (durationMs/1000) + 0.02);

  o.onended = () => ctx.close();
}

/* ===== geração dos beeps aleatórios ===== */
function generateRandomBeepTimes(){
  const MIN_T = 2.0;
  const MAX_T = 28.0;
  const MIN_GAP = 2.0;

  for(let attempt=0; attempt<200; attempt++){
    const times = [];
    while(times.length < BEEPS_COUNT){
      const t = MIN_T + Math.random() * (MAX_T - MIN_T);
      times.push(t);
    }
    times.sort((a,b)=>a-b);

    let ok = true;
    for(let i=1;i<times.length;i++){
      if(times[i] - times[i-1] < MIN_GAP){ ok = false; break; }
    }
    if(ok) return times;
  }
  return [5, 10, 15, 20, 25];
}

/* ===== lógica de rodada ===== */
function updateStatusWaiting(){
  const dict = i18n[currentLang];
  statusText.textContent = dict.status_waiting;
}

function armRound(isFinal){
  const dict = i18n[currentLang];
  armed = true;
  claimed = false;
  finalRound = isFinal;

  statusText.textContent = isFinal ? dict.status_final : dict.status_go;
  playBeep(isFinal ? 1200 : 880, isFinal ? 160 : 120);
}

function disarmRound(){
  armed = false;
  finalRound = false;
  updateStatusWaiting();
}

function awardBlue(points){
  scoreBlue += points;
  updateScoresUI();
  flashZone(blueZone);
}

function awardRed(points){
  scoreRed += points;
  updateScoresUI();
  flashZone(redZone);
}

function handleTap(player){
  if(!running) return;

  // tocou antes do beep => punição
  if(!armed){
    if(player === "blue") awardBlue(PENALTY_EARLY);
    else awardRed(PENALTY_EARLY);
    return;
  }

  // já teve vencedor nesse beep
  if(claimed) return;
  claimed = true;

  const points = finalRound ? POINTS_FINAL : POINTS_BEEP;
  if(player === "blue") awardBlue(points);
  else awardRed(points);

  if(finalRound){
    finishGame();
    return;
  }

  disarmRound();
}

/* ===== schedule ===== */
function clearSchedule(){
  for(const t of scheduleTimeouts) clearTimeout(t);
  scheduleTimeouts = [];
}

function scheduleBeepAt(secondsFromStart, fn){
  const ms = Math.max(0, Math.floor(secondsFromStart * 1000));
  scheduleTimeouts.push(setTimeout(fn, ms));
}

/* ===== start/stop/end ===== */
function resetGameState(){
  running = false;
  armed = false;
  claimed = false;
  finalRound = false;

  nextBeepIndex = 0;
  beepTimes = [];
  clearSchedule();

  scoreBlue = 0;
  scoreRed = 0;
  updateScoresUI();

  updateStatusWaiting();

  winnerText.textContent = "—";
  winnerBanner.classList.remove("winner-blue", "winner-red", "winner-tie");
  winnerBanner.classList.add("winner-tie");
}

function startGame(){
  resetGameState();
  ensureAudioUnlocked();

  showGame();
  running = true;
  setRunningUI(true);

  beepTimes = generateRandomBeepTimes();

  for(let i=0;i<beepTimes.length;i++){
    scheduleBeepAt(beepTimes[i], () => {
      if(!running) return;
      nextBeepIndex = i;
      armRound(false);
    });
  }

  // beep final (vale 12)
  scheduleBeepAt(GAME_TIME, () => {
    if(!running) return;
    armRound(true);

    // segurança: se ninguém tocar após o final, encerra em 3s
    scheduleBeepAt(GAME_TIME + 3, () => {
      if(running && finalRound && !claimed){
        finishGame();
      }
    });
  });
}

function stopGame(){
  if(!running) return;
  running = false;
  setRunningUI(false);
  clearSchedule();
  disarmRound();
}

function finishGame(){
  running = false;
  setRunningUI(false);
  clearSchedule();

  finalBlueEl.textContent = String(scoreBlue);
  finalRedEl.textContent = String(scoreRed);

  const dict = i18n[currentLang];

  winnerBanner.classList.remove("winner-blue", "winner-red", "winner-tie");
  if(scoreBlue > scoreRed){
    winnerText.textContent = dict.winner_blue;
    winnerBanner.classList.add("winner-blue");
  } else if(scoreRed > scoreBlue){
    winnerText.textContent = dict.winner_red;
    winnerBanner.classList.add("winner-red");
  } else {
    winnerText.textContent = dict.winner_tie;
    winnerBanner.classList.add("winner-tie");
  }

  showEnd();
}

/* ===== eventos ===== */
startBtn.addEventListener("click", startGame);
stopBtn.addEventListener("click", stopGame);

menuBtn.addEventListener("click", () => {
  if(running) return;
  resetGameState();
  showStart();
});

playAgainBtn.addEventListener("click", startGame);

menuFromEndBtn.addEventListener("click", () => {
  resetGameState();
  showStart();
});

blueZone.addEventListener("pointerdown", () => handleTap("blue"));
redZone.addEventListener("pointerdown", () => handleTap("red"));

document.querySelectorAll(".lang-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    if(running) return;
    setLang(btn.dataset.lang);
  });
});

/* init */
resetGameState();
setLang(currentLang);
showStart();
