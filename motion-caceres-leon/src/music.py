"""Banda sonora original sintetizada para el motion graphics Cáceres vs Cultural Leonesa.

120 BPM, re menor, estilo tráiler deportivo. Genera un WAV estéreo 44.1 kHz.
Uso: python3 music.py salida.wav voz.wav INICIO_VOZ DURACION
"""
import sys
import numpy as np
from scipy import signal

SR = 44100
OUT, VOICE, VSTART, DUR = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
N = int(SR * DUR)
BEAT = 0.5
rng = np.random.default_rng(7)

L = np.zeros(N)
R = np.zeros(N)


def add(x, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N:
        return
    x = x[: N - i]
    gl = gain * np.sqrt(0.5 * (1 - pan))
    gr = gain * np.sqrt(0.5 * (1 + pan))
    L[i : i + len(x)] += x * gl
    R[i : i + len(x)] += x * gr


def tt(d):
    return np.arange(int(d * SR)) / SR


def env(d, a=0.005, r=None, curve=4.0):
    t = tt(d)
    e = np.minimum(1, t / max(a, 1e-4))
    if r is None:
        r = d
    e *= np.exp(-curve * t / r)
    return e


def lp(x, f, order=2):
    b, a = signal.butter(order, min(f / (SR / 2), 0.99), "low")
    return signal.lfilter(b, a, x)


def hp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), "high")
    return signal.lfilter(b, a, x)


def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], "band")
    return signal.lfilter(b, a, x)


def note(n):  # nombre MIDI -> Hz
    return 440.0 * 2 ** ((n - 69) / 12)


def saw(f, d, phase=0.0):
    t = tt(d)
    return 2 * ((f * t + phase) % 1.0) - 1


# ------------------------------------------------------------------ instrumentos
def kick(big=False):
    d = 0.9 if big else 0.45
    t = tt(d)
    f = 45 + 120 * np.exp(-t * 30)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t * (4 if big else 8))
    x += 0.4 * np.tanh(3 * np.sin(ph)) * np.exp(-t * 14)
    click = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 300) * 0.35
    return np.tanh(1.6 * (x + click))


def snare():
    d = 0.35
    t = tt(d)
    n = bp(rng.standard_normal(len(t)), 900, 9000) * np.exp(-t * 16)
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)
    clap = sum(bp(rng.standard_normal(len(t)), 1000, 6000) * np.exp(-np.maximum(t - o, 0) * 40) * (t >= o) for o in (0, 0.011, 0.023))
    return 0.6 * n + 0.5 * body + 0.35 * clap


def hat(open_=False):
    d = 0.25 if open_ else 0.06
    t = tt(d)
    return hp(rng.standard_normal(len(t)), 7000) * np.exp(-t * (14 if open_ else 70))


def tom(f0):
    t = tt(0.5)
    f = f0 * (1 + 0.5 * np.exp(-t * 20))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)


def boom(d=4.0):
    """Impacto cinematográfico: sub + ruido + metal."""
    t = tt(d)
    f = 32 + 60 * np.exp(-t * 6)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.1)
    noise = lp(rng.standard_normal(len(t)), 1800) * np.exp(-t * 3.5) * 0.8
    crack = hp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 25) * 0.5
    metal = sum(np.sin(2 * np.pi * fr * t + rng.random() * 6) for fr in (211, 347, 523, 787, 1131)) * np.exp(-t * 2.2) * 0.06
    return np.tanh(1.3 * (sub * 1.1 + noise + crack + metal))


def riser(d, f0=200, f1=6000):
    t = tt(d)
    x = rng.standard_normal(len(t))
    out = np.zeros_like(x)
    seg = int(0.02 * SR)
    for i in range(0, len(t), seg):
        fc = f0 * (f1 / f0) ** (i / len(t))
        out[i : i + seg] = bp(x[max(0, i - 2000) : i + seg], fc * 0.7, min(fc * 1.4, 20000))[-len(out[i : i + seg]) :]
    tone = np.sin(2 * np.pi * np.cumsum(110 * (8 ** (t / d))) / SR) * 0.25
    return (out * 0.8 + tone) * (t / d) ** 2


def whoosh(d=0.8):
    t = tt(d)
    x = rng.standard_normal(len(t))
    e = np.sin(np.pi * t / d) ** 2
    return bp(x, 400, 5000) * e


def reverse_cymbal(d=2.0):
    t = tt(d)
    return hp(rng.standard_normal(len(t)), 4000) * (t / d) ** 3


def supersaw(freqs, d, cutoff=2200, voices=5, det=0.12):
    x = np.zeros(int(d * SR))
    for f in freqs:
        for v in range(voices):
            dt = (v - (voices - 1) / 2) * det / voices
            x += saw(f * 2 ** (dt / 12), d, rng.random())
    x /= len(freqs) * voices
    return lp(x, cutoff, 2)


def pluck(f, d=0.35):
    t = tt(d)
    x = saw(f, d) * 0.6 + np.sign(np.sin(2 * np.pi * f * 2 * t)) * 0.15
    cut = 600 + 5000 * np.exp(-t * 18)
    y = np.zeros_like(x)
    # filtro variable por tramos
    seg = 512
    zi = None
    for i in range(0, len(x), seg):
        b, a = signal.butter(2, min(cut[i] / (SR / 2), 0.95), "low")
        if zi is None:
            zi = signal.lfilter_zi(b, a) * 0
        y[i : i + seg], zi = signal.lfilter(b, a, x[i : i + seg], zi=zi)
    return y * np.exp(-t * 7)


def bell(f, d=2.5):
    t = tt(d)
    x = np.sin(2 * np.pi * f * t + 1.2 * np.sin(2 * np.pi * f * 3.5 * t) * np.exp(-t * 3))
    x += 0.3 * np.sin(2 * np.pi * f * 2 * t)
    return x * np.exp(-t * 2.2) * np.minimum(1, t / 0.003)


def brass(freqs, d):
    """Metales sintéticos épicos."""
    t = tt(d)
    x = np.zeros(len(t))
    for f in freqs:
        for v in (-0.08, 0, 0.08):
            x += saw(f * 2 ** (v / 12), d, rng.random())
    x /= len(freqs) * 3
    cut = 500 + 2800 * np.minimum(1, t / 0.25)
    y = np.zeros_like(x)
    seg = 512
    zi = None
    for i in range(0, len(x), seg):
        b, a = signal.butter(2, min(cut[i] / (SR / 2), 0.95), "low")
        if zi is None:
            zi = signal.lfilter_zi(b, a) * 0
        y[i : i + seg], zi = signal.lfilter(b, a, x[i : i + seg], zi=zi)
    a_ = np.minimum(1, t / 0.06) * np.minimum(1, (d - t) / 0.3)
    return y * a_


# ------------------------------------------------------------------ armonía
# Dm - Bb - F - C  (i VI III VII) — un acorde por compás (2 s)
CHORDS = [
    (50, [62, 65, 69]),  # Dm
    (46, [62, 65, 70]),  # Bb
    (41, [60, 65, 69]),  # F
    (48, [60, 64, 67]),  # C
]


def chord_at(t):
    return CHORDS[int(t // 2) % 4]


# ------------------------------------------------------------------ efectos de partido
import json, os

_md = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "match-data.js")).read()
MD = json.loads(_md[_md.index("{"): _md.rindex("}") + 1])
M0 = MD["start"]
RESULT0 = M0 + MD["length"]


def whistle(d=0.7):
    t = tt(d)
    trill = 0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 28 * t))
    x = np.sin(2 * np.pi * (2850 + 60 * np.sin(2 * np.pi * 28 * t)) * t) + 0.25 * np.sin(2 * np.pi * 5700 * t)
    x += 0.15 * bp(rng.standard_normal(len(t)), 2500, 4000)
    e = np.minimum(1, t / 0.02) * np.minimum(1, (d - t) / 0.08)
    return x * trill * e


def thump():
    t = tt(0.14)
    f = 95 + 60 * np.exp(-t * 60)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 30)
    x += 0.5 * bp(rng.standard_normal(len(t)), 600, 3000) * np.exp(-t * 120)
    return x


def swish(d=0.45):
    t = tt(d)
    e = np.minimum(1, t / 0.03) * np.exp(-t * 7)
    return bp(rng.standard_normal(len(t)), 1800, 7000) * e


def clank(d=0.9):
    t = tt(d)
    x = sum(a * np.sin(2 * np.pi * f * t) for f, a in ((420, 1), (1130, .6), (1870, .4), (2650, .3), (3900, .2)))
    return x * np.exp(-t * 6) * 0.4 + 0.6 * bp(rng.standard_normal(len(t)), 300, 4000) * np.exp(-t * 40)


def squeak():
    d = 0.13
    t = tt(d)
    f = 1700 + 1100 * t / d
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.4 * np.sin(2 * ph) + 0.2 * np.sin(3 * ph)
    return x * np.sin(np.pi * t / d) ** 2 * (0.7 + 0.3 * np.sin(2 * np.pi * 60 * t))


def buzzer(d=1.3):
    t = tt(d)
    x = np.sign(np.sin(2 * np.pi * 196 * t)) * 0.6 + np.sign(np.sin(2 * np.pi * 247 * t)) * 0.4
    x = lp(x, 2500)
    return x * np.minimum(1, t / 0.01) * np.minimum(1, (d - t) / 0.05)


def crowd_noise(d, seed):
    r = np.random.default_rng(seed)
    n = int(d * SR)
    x = np.zeros(n)
    for lo, hi, g in ((250, 700, 1.0), (700, 1600, .8), (1600, 3500, .45)):
        layer = bp(r.standard_normal(n), lo, hi)
        mod = lp(r.standard_normal(n), 6)
        mod = 0.6 + 0.4 * mod / (np.abs(mod).max() + 1e-9)
        x += g * layer * mod
    return x / (np.abs(x).max() + 1e-9)


def claps(d, density, seed):
    r = np.random.default_rng(seed)
    n = int(d * SR)
    x = np.zeros(n)
    for _ in range(int(d * density)):
        i = int(r.random() * (n - 3000))
        L_ = 1500
        tt_ = np.arange(L_) / SR
        x[i : i + L_] += bp(r.standard_normal(L_), 900, 5000) * np.exp(-tt_ * 90) * (0.4 + 0.6 * r.random())
    return x


def cheer(d=3.0, seed=0, big=1.0):
    t = tt(d)
    e = np.minimum(1, t / 0.18) * np.exp(-np.maximum(t - 0.4, 0) * (1.2 / big))
    c = crowd_noise(d, seed) * 1.0 + claps(d, 90 * big, seed + 1) * 0.6
    return c * e


# ------------------------------------------------------------------ arreglo
HITS = [5.0, 9.0, 13.0]

# Intro 0-5
add(boom(5), 0.0, 0.55)
for bar in range(0, 3):
    root, ch = chord_at(bar * 2)
    add(supersaw([note(n) for n in ch], 2.05, cutoff=900 + bar * 400) * np.minimum(1, tt(2.05) / 0.8), bar * 2, 0.3)
for b in range(3, 10):
    add(hat(), b * BEAT, 0.18, pan=0.3)
    add(hat(), b * BEAT + 0.25, 0.10, pan=-0.3)
add(riser(2.0), 3.0, 0.6)
add(reverse_cymbal(1.5), 3.5, 0.25)

for h in HITS:
    add(boom(4.5), h, 0.9 if h == 13.0 else 0.7)
    add(kick(big=True), h, 0.8)
    add(whoosh(0.7), h - 0.6, 0.25, pan=-0.5)

# Equipos 5-13
for t0 in np.arange(5.0, 13.0, 2.0):
    root, ch = chord_at(t0)
    add(supersaw([note(n) for n in ch], 2.05, cutoff=1800), t0, 0.30)
    add(supersaw([note(root - 12)], 2.05, cutoff=300, voices=3), t0, 0.35)
    if t0 not in (5.0, 9.0):
        add(kick(), t0, 0.85)
    add(snare(), t0 + 1.0, 0.55)
    add(kick(), t0 + 1.5, 0.6)
    for k in range(8):
        add(hat(), t0 + k * 0.25, 0.10 if k % 2 else 0.16, pan=0.25)
    if t0 >= 9.0:
        arp = ch + [c + 12 for c in ch]
        for k in range(16):
            add(pluck(note(arp[(k * 2) % len(arp)] + 12), 0.3), t0 + k * 0.125, 0.12, pan=(0.5 if k % 2 else -0.5))
add(riser(1.6, 300, 9000), 11.4, 0.45)
for k in range(16):
    add(snare(), 12.0 + k * 0.0625, 0.15 + 0.25 * k / 16)


def groove(t0, gain=1.0, brass_on=True):
    root, ch = chord_at(t0)
    add(supersaw([note(n) for n in ch], 2.05, cutoff=2600), t0, 0.26 * gain)
    if brass_on:
        add(brass([note(n - 12) for n in ch], 2.0), t0, 0.22 * gain)
    for k in range(8):
        b = supersaw([note(root - 12)], 0.25, cutoff=500, voices=3)
        b *= np.minimum(1, tt(0.25) / 0.03) * np.minimum(1, (0.25 - tt(0.25)) / 0.02)
        add(b, t0 + k * 0.25, 0.42 * gain)
    for k in range(4):
        add(kick(), t0 + k * 0.5, 0.9 * gain)
    add(snare(), t0 + 0.5, 0.6 * gain)
    add(snare(), t0 + 1.5, 0.6 * gain)
    for k in range(16):
        add(hat(open_=(k % 4 == 2)), t0 + k * 0.125, (0.09 if k % 2 else 0.14) * gain, pan=0.3 if k % 2 else -0.2)
    arp = ch + [c + 12 for c in ch]
    for k in range(16):
        add(pluck(note(arp[(k * 5) % len(arp)] + 12), 0.28), t0 + k * 0.125, 0.11 * gain, pan=(0.6 if k % 2 else -0.6))


# VS + clasificación 13-21
for t0 in np.arange(13.0, 21.0, 2.0):
    groove(t0)
for base in (16.5, 19.5):
    for k, f in enumerate((180, 150, 120, 95)):
        add(tom(f), base + k * 0.125, 0.5, pan=0.4 - k * 0.25)
add(boom(3), 17.0, 0.45)
add(reverse_cymbal(1.2), 19.8, 0.3)

# Partido 21-38: groove más ligero bajo los efectos
BUZ = M0 + MD["buzzer"]
t0 = M0
while t0 < BUZ - 0.01:
    root, ch = chord_at(t0)
    g = 0.85 if t0 < M0 + 12 else 1.0
    add(supersaw([note(n) for n in ch], 2.05, cutoff=1500), t0, 0.22 * g)
    for k in range(8):
        b = supersaw([note(root - 12)], 0.25, cutoff=420, voices=3)
        b *= np.minimum(1, tt(0.25) / 0.03) * np.minimum(1, (0.25 - tt(0.25)) / 0.02)
        add(b, t0 + k * 0.25, 0.40 * g)
    for k in range(4):
        add(kick(), t0 + k * 0.5, 0.75 * g)
    add(snare(), t0 + 0.5, 0.45 * g)
    add(snare(), t0 + 1.5, 0.45 * g)
    for k in range(8):
        add(hat(), t0 + k * 0.25, 0.08 * g, pan=0.3)
    t0 += 2.0
add(riser(3.0, 200, 9000), BUZ - 3.0, 0.35)  # tensión de los últimos segundos

# efectos del partido
add(whistle(0.75), M0 + 0.0, 0.35, pan=0.1)
add(cheer(2.5, 11, 0.8), M0 + 0.1, 0.35)
# ambiente de público continuo
amb = crowd_noise(MD["length"] + 1.0, 3) * 0.35 + claps(MD["length"] + 1.0, 20, 4) * 0.25
amb *= np.minimum(1, tt(MD["length"] + 1.0) / 0.5) * np.minimum(1, (MD["length"] + 1.0 - tt(MD["length"] + 1.0)) / 0.6)
add(amb, M0 - 0.2, 0.55)
f = MD["dribbleFreq"]
for s, e, team in MD["dribbles"]:
    k = 0
    while s + (k + 0.5) / f < e:
        add(thump(), M0 + s + (k + 0.5) / f, 0.9, pan=-0.3 if team == "L" else 0.3)
        k += 1
for tq in MD["squeaks"]:
    add(squeak(), M0 + tq, 0.10, pan=0.2)
# rebotes del balón tras cada canasta (misma física que la animación)
def bounce_times(dur):
    y, v, dt, out = 0.0, 250.0, 1 / 240, []
    floor = 881 - 550  # distancia desde la red (y=550) hasta el suelo (y=881)
    t = 0.0
    while t < dur:
        v += 2400 * dt
        y += v * dt
        if y > floor:
            y = floor
            out.append((t, abs(v)))
            v = -abs(v) * 0.55
        t += dt
    return out


for sh in MD["shots"]:
    ta = M0 + sh["arr"]
    pan = 0.75 if sh["team"] == "C" else -0.75
    add(swish(), ta - 0.02, 0.9, pan=pan)
    if sh["kind"] == "dunk":
        add(clank(), ta, 0.45, pan=pan)
        add(boom(2.0), ta, 0.35)
    big = 1.6 if sh["kind"] in ("dunk", "three", "layup") else 1.0
    add(cheer(3.2, int(sh["arr"] * 10), big), ta + 0.05, 0.9 * min(big, 1.3), pan=pan * 0.5)
    for tb, vb in bounce_times(sh["next"] - sh["arr"] - 0.4):
        add(thump(), ta + 0.2 + tb, 0.5 * min(1, vb / 1400), pan=pan)
add(buzzer(1.3), BUZ, 0.32)
add(cheer(3.5, 99, 2.2), BUZ + 0.1, 0.75)
add(riser(1.3, 300, 10000), RESULT0 - 1.3, 0.45)
add(reverse_cymbal(1.2), RESULT0 - 1.2, 0.3)

# RESULTADO 38-48.5
add(boom(5), RESULT0, 1.0)
add(kick(big=True), RESULT0, 0.9)
HEART = RESULT0 + 2.2
MOG = VSTART + 6.0  # justo al terminar «mogollón»
melody = [74, 72, 69, 72, 74, 77, 76, 72, 74, 72, 69, 67, 69, 72, 74, 74]
t0 = RESULT0
end = DUR - 1.4
i = 0
while t0 < end:
    root, ch = chord_at(t0 - RESULT0)
    seg = min(2.0, end - t0)
    full = t0 >= MOG - 0.01 or (t0 + 2 > MOG and False)
    add(supersaw([note(n) for n in ch], seg + 0.05, cutoff=1400 if t0 < HEART else 2400) * np.minimum(1, tt(seg + 0.05) / 0.25), t0, 0.30)
    add(supersaw([note(root - 12)], seg + 0.05, cutoff=260, voices=3), t0, 0.32)
    if t0 >= HEART - 0.01:
        add(brass([note(n - 12) for n in ch], seg), t0, 0.16)
    t0 += 2.0
for j, n in enumerate(melody):
    tm = RESULT0 + 0.5 + j * 0.5
    if tm > end:
        break
    add(bell(note(n)), tm, 0.16, pan=(-0.3 if j % 2 else 0.3))
# percusión suave desde el corazón, fuerte desde "mogollón"
tb = HEART
while tb < end:
    strong = tb >= MOG - 0.01
    add(kick(), tb, 0.8 if strong else 0.45)
    if strong:
        add(snare(), tb + 0.5, 0.5)
        for k in range(4):
            add(hat(), tb + k * 0.25, 0.08, pan=0.3)
    tb += 1.0
add(boom(3), HEART, 0.5)
add(boom(4.5), MOG - 0.05, 0.8)
add(cheer(4.0, 123, 2.0), MOG, 0.5)
add(boom(5), end, 0.6)
root, ch = CHORDS[0]
final = supersaw([note(n) for n in ch + [74]], 1.6, cutoff=2500)
add(final * np.exp(-tt(1.6) * 1.6), end, 0.4)

# ------------------------------------------------------------------ reverb
def reverb(x, secs=2.2, mix=0.22, seed=0):
    r = np.random.default_rng(seed)
    t = tt(secs)
    ir = r.standard_normal(len(t)) * np.exp(-t * 6.9 / secs)
    ir = lp(ir, 6000)
    ir /= np.sqrt(np.sum(ir ** 2))
    wet = signal.fftconvolve(x, ir)[: len(x)]
    return x + mix * wet


L = reverb(L, seed=1)
R = reverb(R, seed=2)

# ------------------------------------------------------------------ voz + ducking
v = np.frombuffer(
    __import__("subprocess").run(["ffmpeg", "-v", "error", "-i", VOICE, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout,
    np.float32,
).astype(float)
vi = int(VSTART * SR)
vlen = min(len(v), N - vi)
duck = np.ones(N)
venv = np.convolve(np.abs(v), np.ones(2205) / 2205, "same")
dk = 1 - 0.8 * np.clip(venv / (venv.max() + 1e-9) * 3, 0, 1)
dk = signal.lfilter([0.002], [1, -0.998], dk - 1) + 1  # suavizado
duck[vi : vi + vlen] = np.clip(dk[:vlen], 0.2, 1)
L *= duck
R *= duck

# master: normalizar música, sumar voz
m = max(np.abs(L).max(), np.abs(R).max())
L = L / m * 0.80
R = R / m * 0.80
vv = v[:vlen] / (np.abs(v).max() + 1e-9) * 0.95
L[vi : vi + vlen] += vv
R[vi : vi + vlen] += vv

# fundido final
fade = int(0.8 * SR)
L[-fade:] *= np.linspace(1, 0, fade)
R[-fade:] *= np.linspace(1, 0, fade)
mix = np.stack([L, R], 1)
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix /= np.abs(mix).max() / 0.97

import wave

with wave.open(OUT, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print("ok", OUT, DUR)
