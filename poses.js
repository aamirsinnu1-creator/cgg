// Draws signs as animated hand skeletons. Built-in signs are generated from finger states;
// recorded signs are rebuilt from the saved landmark vectors (see gestures.js buildFeature).
const CONN = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
const MCP = { 5: [-0.38, -0.92], 9: [0, -1], 13: [0.36, -0.92], 17: [0.68, -0.78] };
const LEN = [[.42, .3, .25], [.48, .33, .27], [.44, .3, .25], [.34, .24, .2]];

function handPts(f, thumbDown = false) {
  const p = Array(21); p[0] = [0, 0]; p[1] = [-0.3, -0.25];
  [5, 9, 13, 17].forEach((b, i) => {
    const [x, y] = MCP[b], L = LEN[i]; p[b] = [x, y];
    if (f[i + 1] === "1") {
      const s = (i - 1.5) * 0.04;
      p[b + 1] = [x + s, y - L[0]]; p[b + 2] = [x + 2 * s, y - L[0] - L[1]]; p[b + 3] = [x + 3 * s, y - L[0] - L[1] - L[2]];
    } else { p[b + 1] = [x, y - 0.25]; p[b + 2] = [x, y - 0.1]; p[b + 3] = [x, y + 0.08]; }
  });
  const othersUp = f.slice(1).includes("1");
  const T = f[0] !== "1" ? [[-0.42, -0.45], [-0.25, -0.6], [-0.1, -0.62]]
    : thumbDown ? [[-0.55, 0.1], [-0.55, 0.45], [-0.55, 0.8]]
    : othersUp ? [[-0.62, -0.45], [-0.85, -0.6], [-1.05, -0.72]]
    : [[-0.5, -0.55], [-0.5, -0.9], [-0.5, -1.25]];
  p[2] = T[0]; p[3] = T[1]; p[4] = T[2];
  return p;
}
const mirror = h => h.map(q => [-q[0], q[1]]);

// pose = { pts: Float32Array(84) (two hands x 21 points x [x,y]), a2: opacity of the second hand }
function compose(h0, h1, gap) {
  const pts = new Float32Array(84);
  const put = (h, ox, oy, o) => h.forEach((q, i) => { pts[o + i * 2] = q[0] + ox; pts[o + i * 2 + 1] = q[1] + oy; });
  if (!h1) { put(h0, 0, 0, 0); put(h0, 0, 0, 42); return { pts, a2: 0 }; }
  put(h0, -gap[0] / 2, -gap[1] / 2, 0); put(h1, gap[0] / 2, gap[1] / 2, 42);
  return { pts, a2: 1 };
}

export function builtinPoses() {
  const one = f => compose(handPts(f), null, [0, 0]);
  const two = (a, b, gap) => compose(handPts(a), mirror(handPts(b)), [gap, 0]);
  return {
    One: one("01000"), Two: one("01100"), Three: one("01110"), Four: one("01111"), Hello: one("11111"),
    Yes: one("00000"), Good: one("10000"), No: compose(handPts("10000", true), null, [0, 0]),
    "Call me": one("10001"), "I love you": one("11001"),
    Namaste: two("11111", "11111", 1.5), Welcome: two("11111", "11111", 3.4),
    "Very good": two("10000", "10000", 1.9), Stop: two("00000", "00000", 1.9)
  };
}

export function avgVec(list) {
  return list[0].map((_, i) => list.reduce((s, v) => s + v[i], 0) / list.length);
}
export function poseFromVec(v) {
  const hand = s => Array.from({ length: 21 }, (_, i) => [v[s * 63 + i * 3], v[s * 63 + i * 3 + 1]]);
  const two = v.slice(63, 126).some(x => x !== 0);
  const c = (x, m) => Math.max(-m, Math.min(m, x));
  return compose(hand(0), two ? hand(1) : null, [c(v[126], 3.2), c(v[127], 2)]);
}

export const lerp = (a, b, t) => ({ pts: a.pts.map((x, i) => x + (b.pts[i] - x) * t), a2: a.a2 + (b.a2 - a.a2) * t });

export function drawPose(ctx, W, H, pose) {
  ctx.clearRect(0, 0, W, H);
  if (!pose) return;
  const u = H * 0.24, cx = W / 2, cy = H * 0.7;
  for (let h = 0; h < 2; h++) {
    if (h && pose.a2 < 0.02) break;
    ctx.globalAlpha = h ? pose.a2 : 1;
    const o = h * 42, P = i => [cx + pose.pts[o + i * 2] * u, cy + pose.pts[o + i * 2 + 1] * u];
    ctx.beginPath();
    [0, 5, 9, 13, 17].forEach((i, k) => { const [x, y] = P(i); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.closePath(); ctx.fillStyle = "rgba(255,200,87,.2)"; ctx.fill();
    ctx.lineWidth = u * 0.07; ctx.lineCap = "round"; ctx.strokeStyle = "#ffc857"; ctx.beginPath();
    CONN.forEach(([a, b]) => { const A = P(a), B = P(b); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); });
    ctx.stroke(); ctx.fillStyle = "#fff";
    for (let i = 0; i < 21; i++) { const [x, y] = P(i); ctx.beginPath(); ctx.arc(x, y, u * 0.045, 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}
