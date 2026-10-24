// Speech / text -> sign: hearing person talks or types, the deaf person watches the signs and reads the captions.
import { builtinPoses, poseFromVec, avgVec, lerp, drawPose } from "./poses.js";

const $ = id => document.getElementById(id);
const KEY = "signbridge_signs_v2";
const canvas = $("signCanvas"), ctx = canvas.getContext("2d");
const ALIAS = {
  hi: "Hello", hey: "Hello", hii: "Hello", "1": "One", "2": "Two", "3": "Three", "4": "Four",
  ok: "Good", okay: "Good", great: "Good", nice: "Good", yeah: "Yes", yep: "Yes", nope: "No",
  "नमस्ते": "Namaste", "हेलो": "Hello", "हाँ": "Yes", "नहीं": "No", "रुको": "Stop", "स्वागत": "Welcome",
  "നമസ്കാരം": "Namaste", "ഹലോ": "Hello"
};
let queue = [], playing = false, cur = null, lastText = "", wantListen = false, recog = null;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const speed = () => parseFloat($("speed").value);
const say = m => { $("status2").textContent = m; };

function buildMap() {
  const m = new Map(), b = builtinPoses();
  Object.keys(b).forEach(l => m.set(l.toLowerCase(), { label: l, pose: b[l] }));
  Object.entries(ALIAS).forEach(([k, l]) => m.set(k, m.get(l.toLowerCase())));
  const by = {};
  try { JSON.parse(localStorage.getItem(KEY) || "[]").forEach(s => (by[s.label] = by[s.label] || []).push(s.vec)); } catch {}
  Object.entries(by).forEach(([l, v]) => m.set(l.toLowerCase(), { label: l, pose: poseFromVec(avgVec(v)) }));
  return m;
}
// Longest phrase first (up to 3 words), so "I love you" wins over single words
function tokenize(text) {
  const w = text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}' ]/gu, " ").split(/\s+/).filter(Boolean), m = buildMap(), out = [];
  for (let i = 0; i < w.length;) {
    let hit = null, n = Math.min(3, w.length - i);
    for (; n > 0; n--) { hit = m.get(w.slice(i, i + n).join(" ")); if (hit) break; }
    if (hit) { out.push({ word: hit.label, sign: hit }); i += n; } else { out.push({ word: w[i], sign: null }); i++; }
  }
  return out;
}

function addText(text) {
  text = text.trim(); if (!text) return;
  lastText = text;
  tokenize(text).forEach(t => {
    const li = document.createElement("li");
    li.textContent = t.word; li.className = t.sign ? "hit" : "miss";
    if (!t.sign) li.title = "No sign recorded yet";
    $("chips").append(li); t.el = li; queue.push(t);
  });
  while ($("chips").children.length > 80) $("chips").firstChild.remove();
  pump();
}
function tween(to, ms) {
  return new Promise(res => {
    const from = cur || to, t0 = performance.now();
    (function f(n) {
      const t = Math.min(1, (n - t0) / ms);
      cur = lerp(from, to, t * t * (3 - 2 * t)); drawPose(ctx, canvas.width, canvas.height, cur);
      t < 1 ? requestAnimationFrame(f) : res();
    })(t0);
  });
}
async function pump() {
  if (playing) return; playing = true;
  while (queue.length) {
    const t = queue.shift();
    document.querySelectorAll("#chips .on").forEach(e => e.classList.remove("on"));
    t.el.classList.add("on");
    $("signWord").innerHTML = t.word + (t.sign ? "" : "<small>No sign recorded for this word yet</small>");
    if (t.sign) { const d = 350 / speed(); await tween(t.sign.pose, d); await sleep(1500 / speed() - d); }
    else await sleep(800 / speed());
  }
  document.querySelectorAll("#chips .on").forEach(e => e.classList.remove("on"));
  playing = false;
}

/* ---------- microphone ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
function listen() {
  recog = new SR(); recog.lang = $("langL").value; recog.continuous = true; recog.interimResults = true;
  recog.onresult = e => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) addText(r[0].transcript); else interim += r[0].transcript;
    }
    $("heard").textContent = interim;
  };
  recog.onerror = e => { if (e.error === "not-allowed") { wantListen = false; say("Microphone blocked. Allow microphone access and try again."); } else if (e.error !== "no-speech") say("Speech error: " + e.error); };
  recog.onend = () => { if (wantListen) { try { listen(); } catch {} } else { $("micBtn").textContent = "Start listening"; $("heard").textContent = ""; } };
  recog.start();
}
function toggleMic() {
  if (!SR) return say("Speech recognition is not supported in this browser. Use Chrome, Edge or Safari, or type below.");
  if (wantListen) { wantListen = false; recog.stop(); return; }
  wantListen = true; $("micBtn").textContent = "Stop listening"; say("Listening… speak now."); listen();
}
const stopMic = () => { if (wantListen) { wantListen = false; recog && recog.stop(); } };

/* ---------- tabs + buttons ---------- */
function show(n) {
  $("mode1").hidden = n !== 1; $("mode2").hidden = n !== 2;
  $("tab1").setAttribute("aria-selected", n === 1); $("tab2").setAttribute("aria-selected", n === 2);
  if (n === 2) document.dispatchEvent(new Event("leave-camera")); else stopMic();
}
$("tab1").onclick = () => show(1); $("tab2").onclick = () => show(2);
$("micBtn").onclick = toggleMic;
$("showBtn").onclick = () => { addText($("typed").value); $("typed").value = ""; };
$("typed").onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("showBtn").click(); } };
$("replayBtn").onclick = () => { queue = []; addText(lastText); };
$("clearChips").onclick = () => { queue = []; $("chips").innerHTML = ""; $("signWord").textContent = ""; cur = null; drawPose(ctx, canvas.width, canvas.height, null); };
