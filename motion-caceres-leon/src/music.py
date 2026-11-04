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


# ------------------------------------------------------------------ arreglo
HITS = [4.0, 8.0, 12.0, VSTART]

# Intro 0-4: boom grave, pad que entra, tic-tac de hats, riser
add(boom(5), 0.0, 0.55)
for bar in range(0, 2):
    root, ch = chord_at(bar * 2)
    add(supersaw([note(n) for n in ch], 2.05, cutoff=900 + bar * 500) * np.minimum(1, tt(2.05) / 0.8), bar * 2, 0.32)
for b in range(2, 8):
    add(hat(), b * BEAT, 0.18, pan=0.3)
    add(hat(), b * BEAT + 0.25, 0.10, pan=-0.3)
add(riser(2.0), 2.0, 0.6)
add(reverse_cymbal(1.5), 2.5, 0.25)

# Impactos
for h in HITS:
    add(boom(4.5), h, 0.9 if h in (12.0, VSTART) else 0.7)
    add(kick(big=True), h, 0.8)
    add(whoosh(0.7), h - 0.6, 0.25, pan=-0.5)

# Secciones 4-12 (equipos): medio tiempo + bajo + pad + arpegio
for t0 in np.arange(4.0, 12.0, 2.0):
    root, ch = chord_at(t0)
    add(supersaw([note(n) for n in ch], 2.05, cutoff=1800), t0, 0.30)
    add(supersaw([note(root - 12)], 2.05, cutoff=300, voices=3), t0, 0.35)
    if t0 != 4.0 and t0 != 8.0:
        add(kick(), t0, 0.85)
    add(snare(), t0 + 1.0, 0.55)
    add(kick(), t0 + 1.5, 0.6)
    for k in range(8):
        add(hat(), t0 + k * 0.25, 0.10 if k % 2 else 0.16, pan=0.25)
    if t0 >= 8.0:
        arp = ch + [c + 12 for c in ch]
        for k in range(16):
            add(pluck(note(arp[(k * 2) % len(arp)] + 12), 0.3), t0 + k * 0.125, 0.12, pan=(0.5 if k % 2 else -0.5))
add(riser(1.6, 300, 9000), 10.4, 0.45)
for k in range(16):  # redoble 11-12
    add(snare(), 11.0 + k * 0.0625, 0.15 + 0.25 * k / 16)

# Groove 12-24: tambores completos, bajo bombeado, arpegio, metales
for t0 in np.arange(12.0, 24.0, 2.0):
    root, ch = chord_at(t0)
    pad = supersaw([note(n) for n in ch], 2.05, cutoff=2600)
    add(pad, t0, 0.26)
    add(brass([note(n - 12) for n in ch], 2.0), t0, 0.22)
    # bajo en corcheas con sidechain
    for k in range(8):
        b = supersaw([note(root - 12)], 0.25, cutoff=500, voices=3)
        b *= np.minimum(1, tt(0.25) / 0.03) * np.minimum(1, (0.25 - tt(0.25)) / 0.02)
        add(b, t0 + k * 0.25, 0.42)
    for k in range(4):
        add(kick(), t0 + k * 0.5, 0.9)
    add(snare(), t0 + 0.5, 0.6)
    add(snare(), t0 + 1.5, 0.6)
    for k in range(16):
        add(hat(open_=(k % 4 == 2)), t0 + k * 0.125, 0.09 if k % 2 else 0.14, pan=0.3 if k % 2 else -0.2)
    arp = ch + [c + 12 for c in ch]
    for k in range(16):
        add(pluck(note(arp[(k * 5) % len(arp)] + 12), 0.28), t0 + k * 0.125, 0.11, pan=(0.6 if k % 2 else -0.6))
# fills de toms
for base in (15.5, 19.5, 23.5):
    for k, f in enumerate((180, 150, 120, 95)):
        add(tom(f), base + k * 0.125, 0.5, pan=0.4 - k * 0.25)
add(whoosh(0.9), 15.4, 0.3, pan=0.6)
add(whoosh(0.9), 19.4, 0.3, pan=-0.6)
add(boom(3), 16.0, 0.45)
add(boom(3), 20.0, 0.45)

# Breakdown 24-28: hermanamiento — pad cálido + campanas
add(reverse_cymbal(1.2), 22.8, 0.3)
add(boom(4), 24.0, 0.5)
melody = [74, 72, 69, 72, 74, 77, 76, 72]
for i, t0 in enumerate(np.arange(24.0, 28.0, 2.0)):
    root, ch = chord_at(t0)
    add(supersaw([note(n) for n in ch], 2.05, cutoff=1200) * np.minimum(1, tt(2.05) / 0.3), t0, 0.30)
    add(supersaw([note(root - 12)], 2.05, cutoff=250, voices=3), t0, 0.32)
for i, n in enumerate(melody):
    add(bell(note(n)), 24.0 + i * 0.5, 0.22, pan=(-0.3 if i % 2 else 0.3))
    add(bell(note(n + 12)), 24.0 + i * 0.5 + 0.25, 0.07, pan=(0.4 if i % 2 else -0.4))

# Build 28-30: ritmo creciente, riser, redoble acelerando, silencio antes del golpe
for t0 in (28.0,):
    root, ch = chord_at(t0)
    add(supersaw([note(n) for n in ch], 1.9, cutoff=3500), t0, 0.28)
    add(brass([note(n - 12) for n in ch], 1.85), t0, 0.25)
for k in range(4):
    add(kick(), 28.0 + k * 0.5, 0.9)
roll = np.concatenate([np.arange(28.0, 29.0, 0.125), np.arange(29.0, 29.75, 0.0625)])
for i, tr in enumerate(roll):
    add(snare(), tr, 0.2 + 0.4 * i / len(roll))
add(riser(1.9, 200, 12000), 27.9, 0.55)
add(reverse_cymbal(1.8), 28.0, 0.35)

# Final VSTART..: himno completo
t0 = VSTART
end = DUR - 1.2
k = 0
while t0 < end:
    root, ch = chord_at(t0 - VSTART)
    seg = min(2.0, end - t0)
    add(supersaw([note(n) for n in ch], seg + 0.05, cutoff=3000), t0, 0.28)
    add(supersaw([note(n + 12) for n in ch], seg + 0.05, cutoff=4000), t0, 0.10)
    add(brass([note(n - 12) for n in ch], seg), t0, 0.26)
    add(supersaw([note(root - 12)], seg + 0.05, cutoff=400, voices=3), t0, 0.40)
    for j in range(int(seg / 0.5)):
        add(kick(), t0 + j * 0.5, 0.85)
        if j % 2:
            add(snare(), t0 + j * 0.5, 0.55)
    for j in range(int(seg / 0.125)):
        add(hat(open_=(j % 4 == 2)), t0 + j * 0.125, 0.08, pan=0.3)
    t0 += 2.0
    k += 1
add(boom(5), end, 0.85)
root, ch = CHORDS[0]
final = supersaw([note(n) for n in ch + [74]], 1.3 + 0.2, cutoff=2500)
add(final * np.exp(-tt(1.5) * 2.0), end, 0.4)

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
