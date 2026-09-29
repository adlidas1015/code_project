#!/usr/bin/env python3
"""Original score for the DASAN DMC ESG reel.

128 BPM, D minor -> F major resolution, 8 bars = exactly 15.000 s.
Every sound is synthesised here (no samples), so the track is fully
original and license-free. Writes:
  out/music.wav  48 kHz / 24-bit stereo, -14 LUFS, -1 dBTP ceiling
  out/cues.json  beat grid + hit list consumed by the scene timeline
"""
import json
import os

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from numba import njit
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
BPM = 128
BEAT = 60.0 / BPM          # 0.46875 s
BAR = 4 * BEAT             # 1.875 s
DUR = 8 * BAR              # 15.000 s
N = int(round(DUR * SR))
OUT = os.path.join(os.path.dirname(__file__), "..", "out")

rng = np.random.default_rng(1015)


def bt(b):
    """beat index -> seconds"""
    return b * BEAT


def mf(m):
    """midi -> Hz"""
    return 440.0 * 2 ** ((m - 69) / 12.0)


# ---------------------------------------------------------------- DSP core
@njit(cache=True)
def svf(x, fc, q, mode, sr):
    """TPT state-variable filter with per-sample cutoff. mode 0=LP 1=BP 2=HP"""
    y = np.zeros_like(x)
    ic1 = 0.0
    ic2 = 0.0
    k = 1.0 / q
    for i in range(x.shape[0]):
        f = fc[i]
        if f > 0.45 * sr:
            f = 0.45 * sr
        if f < 10.0:
            f = 10.0
        g = np.tan(np.pi * f / sr)
        a1 = 1.0 / (1.0 + g * (g + k))
        a2 = g * a1
        a3 = g * a2
        v3 = x[i] - ic2
        v1 = a1 * ic1 + a2 * v3
        v2 = ic2 + a2 * ic1 + a3 * v3
        ic1 = 2.0 * v1 - ic1
        ic2 = 2.0 * v2 - ic2
        if mode == 0:
            y[i] = v2
        elif mode == 1:
            y[i] = v1 * k
        else:
            y[i] = x[i] - k * v1 - v2
    return y


@njit(cache=True)
def pingpong(L, R, d, fb, mix):
    """ping-pong delay, d in samples; returns wet stereo"""
    n = L.shape[0]
    oL = np.zeros(n)
    oR = np.zeros(n)
    for i in range(d, n):
        oL[i] = 0.5 * (L[i - d] + R[i - d]) + fb * oR[i - d]
        oR[i] = fb * oL[i - d]
    return oL * mix, oR * mix


@njit(cache=True)
def compress(L, R, thr_db, ratio, att, rel, sr):
    n = L.shape[0]
    ga = np.exp(-1.0 / (att * sr))
    gr = np.exp(-1.0 / (rel * sr))
    env = 0.0
    oL = np.empty(n)
    oR = np.empty(n)
    for i in range(n):
        lv = max(abs(L[i]), abs(R[i]))
        if lv > env:
            env = ga * env + (1 - ga) * lv
        else:
            env = gr * env + (1 - gr) * lv
        db = 20.0 * np.log10(env + 1e-9)
        over = db - thr_db
        g = 1.0
        if over > 0:
            g = 10 ** (-(over - over / ratio) / 20.0)
        oL[i] = L[i] * g
        oR[i] = R[i] * g
    return oL, oR


@njit(cache=True)
def limiter(L, R, ceil, look, rel, sr):
    """look-ahead brickwall limiter: min-hold over the window, then a
    box-average of the same length so the gain ramps into every peak"""
    n = L.shape[0]
    la = max(1, int(look * sr))
    req = np.ones(n)
    for i in range(n):
        p = max(abs(L[i]), abs(R[i]))
        if p > ceil:
            req[i] = ceil / p
    g1 = np.ones(n)
    for i in range(n):
        m = 1.0
        for j in range(i, min(n, i + la + 1)):
            if req[j] < m:
                m = req[j]
        g1[i] = m
    g2 = np.ones(n)
    acc = 0.0
    for i in range(n):
        acc += g1[i]
        if i >= la:
            acc -= g1[i - la]
            g2[i] = acc / la
        else:
            g2[i] = min(acc / (i + 1), g1[i])
    gr = np.exp(-1.0 / (rel * sr))
    g = 1.0
    oL = np.empty(n)
    oR = np.empty(n)
    for i in range(n):
        if g2[i] < g:
            g = g2[i]
        else:
            g = gr * g + (1 - gr) * g2[i]
        oL[i] = L[i] * g
        oR[i] = R[i] * g
    return oL, oR


def sos(kind, f, order=2):
    if isinstance(f, (list, tuple)):
        return butter(order, [x / (SR / 2) for x in f], kind, output="sos")
    return butter(order, f / (SR / 2), kind, output="sos")


def filt(x, kind, f, order=2):
    return sosfilt(sos(kind, f, order), x, axis=0)


def saw(freq, n, phase0=0.0):
    f = np.broadcast_to(np.asarray(freq, dtype=np.float64), (n,))
    dt = f / SR
    ph = (phase0 + np.cumsum(dt) - dt[0]) % 1.0
    y = 2.0 * ph - 1.0
    m1 = ph < dt
    x = ph[m1] / dt[m1]
    y[m1] -= x + x - x * x - 1.0
    m2 = ph > 1.0 - dt
    x = (ph[m2] - 1.0) / dt[m2]
    y[m2] -= x * x + x + x + 1.0
    return y


def tvec(dur):
    n = int(round(dur * SR))
    return np.arange(n) / SR, n


def ar(n, att=0.004, rel=0.03):
    e = np.ones(n)
    a = max(1, int(att * SR))
    r = max(1, int(rel * SR))
    e[:a] = np.linspace(0, 1, a) if a <= n else np.linspace(0, 1, n)[:n]
    if r < n:
        e[-r:] *= np.linspace(1, 0, r)
    return e


def to_st(x, pan=0.0):
    if x.ndim == 2:
        return x
    a = (pan + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], 1) * np.sqrt(2)


class Bus:
    def __init__(self):
        self.x = np.zeros((N, 2))

    def add(self, sig, t0, gain=1.0, pan=0.0):
        gain = np.asarray(gain, dtype=np.float64)
        s = to_st(sig, pan) * (gain[:, None] if gain.ndim == 1 else gain)
        i0 = int(round(t0 * SR))
        a = 0
        if i0 < 0:
            a = -i0
            i0 = 0
        i1 = min(N, i0 + s.shape[0] - a)
        if i1 > i0:
            self.x[i0:i1] += s[a:a + (i1 - i0)]


# ---------------------------------------------------------------- instruments
def kick(gain=1.0, f0=230.0, f1=47.0):
    t, n = tvec(0.62)
    f = f1 + (f0 - f1) * np.exp(-t / 0.028)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph)
    env = np.exp(-t / 0.30) * np.minimum(1.0, t / 0.0012)
    env *= np.clip(1 - (t - 0.34) / 0.26, 0, 1) ** 1.6
    body = np.tanh(2.2 * body * env) / np.tanh(2.2)
    click = filt(rng.standard_normal(n), "highpass", 2500) * np.exp(-t / 0.0035) * 0.35
    tick = np.sin(2 * np.pi * 3100 * t) * np.exp(-t / 0.002) * 0.25
    return (body + click + tick) * gain


def snare(pitch=1.0, dec=0.09):
    t, n = tvec(0.35)
    nz = filt(rng.standard_normal(n), "bandpass", [1400 * pitch, 7500], 2)
    nz *= np.exp(-t / dec)
    body = np.sin(2 * np.pi * (185 * pitch) * t + 2.0 * np.exp(-t / 0.01)) * np.exp(-t / 0.045)
    return 0.8 * nz + 0.55 * body


def clap():
    t, n = tvec(0.5)
    nz = rng.standard_normal(n)
    env = np.zeros(n)
    for k, off in enumerate([0.0, 0.0105, 0.0205, 0.031]):
        m = t >= off
        tau = 0.0065 if k < 3 else 0.13
        env[m] += np.exp(-(t[m] - off) / tau) * (0.8 if k < 3 else 1.0)
    x = filt(nz * env, "bandpass", [950, 5200], 2)
    body = np.sin(2 * np.pi * 205 * t) * np.exp(-t / 0.035) * 0.35
    return (x * 1.25 + body)


def hat(open_=False):
    t, n = tvec(0.45 if open_ else 0.12)
    metal = np.zeros(n)
    for f in (205.3, 304.4, 369.6, 522.7, 540.0, 800.0):
        metal += np.sign(np.sin(2 * np.pi * f * 1.62 * t + rng.random() * 6.28))
    x = 0.55 * rng.standard_normal(n) + 0.45 * metal / 6
    x = filt(x, "highpass", 7200, 4)
    x = filt(x, "lowpass", 15500, 2)
    dec = 0.17 if open_ else 0.028
    return x * np.exp(-t / dec) * np.minimum(1, t / 0.0007)


def perc(f=640.0):
    t, n = tvec(0.14)
    ff = f * (1 + 0.6 * np.exp(-t / 0.01))
    s = np.sin(2 * np.pi * np.cumsum(ff) / SR)
    return s * np.exp(-t / 0.045) * np.minimum(1, t / 0.0008)


def crash(dur=2.6, dec=1.05):
    t, n = tvec(dur)
    out = []
    for _ in range(2):
        metal = np.zeros(n)
        for f in (311, 422.6, 547.3, 697.1, 877.4, 1103.2, 1377.7):
            metal += np.sign(np.sin(2 * np.pi * f * 1.9 * t + rng.random() * 6.28))
        x = 0.7 * rng.standard_normal(n) + 0.3 * metal / 7
        x = filt(x, "highpass", 3300, 3)
        x = filt(x, "lowpass", 14000, 2)
        out.append(x * np.exp(-t / dec) * np.minimum(1, t / 0.001))
    return np.stack(out, 1)


def boom(dur=1.6, f0=95.0, f1=29.0):
    t, n = tvec(dur)
    f = f1 + (f0 - f1) * np.exp(-t / 0.16)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR)
    env = np.exp(-t / 0.55) * np.minimum(1, t / 0.002)
    return np.tanh(1.8 * s * env) / np.tanh(1.8)


def noise_sweep(dur, f0, f1, q=1.6, shape=2.0, st=True):
    t, n = tvec(dur)
    fc = f0 * (f1 / f0) ** (t / dur)
    outs = []
    for _ in range(2 if st else 1):
        outs.append(svf(rng.standard_normal(n), fc, q, 1, SR))
    x = np.stack(outs, 1) if st else outs[0]
    env = (t / dur) ** shape
    return x * (env[:, None] if st else env)


def whoosh(dur=0.42):
    t, n = tvec(dur)
    u = t / dur
    fc = 500 * (6500 / 500) ** (u ** 0.8)
    x = svf(rng.standard_normal(n), fc, 1.4, 1, SR)
    env = np.sin(np.pi * np.clip(u / 0.86, 0, 1) / 2) ** 3 * np.clip((1 - u) / 0.14, 0, 1) ** 0.6
    x = x * env
    pan = -0.75 + 1.5 * u
    a = (pan + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], 1) * np.sqrt(2)


def supersaw(midis, dur, cutoff, voices=7, detune=0.17, width=0.95, q=0.75,
             att=0.012, rel=0.08, seed=0):
    t, n = tvec(dur)
    r = np.random.default_rng(seed)
    L = np.zeros(n)
    R = np.zeros(n)
    for m in midis:
        f0 = mf(m)
        for v in range(voices):
            u = v / (voices - 1) * 2 - 1
            s = saw(f0 * 2 ** (u * detune / 12), n, r.random())
            a = (u * width + 1) * np.pi / 4
            L += s * np.cos(a)
            R += s * np.sin(a)
    norm = 1.0 / (len(midis) * np.sqrt(voices) * 1.6)
    fc = np.broadcast_to(np.asarray(cutoff, dtype=np.float64), (n,)).copy()
    L = svf(L * norm, fc, q, 0, SR)
    R = svf(R * norm, fc, q, 0, SR)
    e = ar(n, att, rel)
    return np.stack([L * e, R * e], 1)


def pluck(m, dur=0.34, bright=1.0):
    t, n = tvec(dur)
    f = mf(m)
    s = 0.6 * saw(f, n, rng.random()) + 0.4 * saw(f * 1.006, n, rng.random())
    fc = 220 + bright * 6200 * np.exp(-t / 0.055)
    s = svf(s, fc, 1.25, 0, SR)
    return s * np.exp(-t / 0.15) * ar(n, 0.002, 0.03)


def bell(m, dur=2.8, index=1.6):
    t, n = tvec(dur)
    f = mf(m)
    I = index * np.exp(-t / 0.28)
    car = np.sin(2 * np.pi * f * t + I * np.sin(2 * np.pi * f * 3.5 * t))
    oct_ = 0.22 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t / 0.35)
    env = np.exp(-t / 0.95) * np.minimum(1, t / 0.003)
    return (car * env + oct_) * ar(n, 0.002, 0.2)


def bass(m, dur):
    t, n = tvec(dur)
    f = mf(m)
    sub = np.tanh(1.4 * np.sin(2 * np.pi * f * t)) / np.tanh(1.4)
    mid = svf(saw(f * 2, n), np.full(n, 900.0), 0.9, 0, SR) * 0.32
    return (sub + mid) * ar(n, 0.004, 0.025)


def make_ir(rt60=2.3, pre=0.018, damp=3200):
    t, n = tvec(rt60 * 1.15)
    env = 10 ** (-3 * t / rt60)
    ch = []
    for _ in range(2):
        x = rng.standard_normal(n) * env
        lp = filt(x, "lowpass", damp)
        w = np.clip(t / 0.7, 0, 1)
        x = x * (1 - w) + lp * w
        # early reflections
        for d, g in ((0.0071, .5), (0.0133, .38), (0.0219, .3), (0.0297, .22)):
            k = int((d + rng.random() * 0.003) * SR)
            x[k] += g
        ch.append(np.concatenate([np.zeros(int(pre * SR)), x]))
    ir = np.stack(ch, 1)
    ir /= np.sqrt(np.sum(ir ** 2) / 2)
    return ir


# ---------------------------------------------------------------- arrangement
CH = {
    "Dm": [57, 62, 65, 69], "Bb": [58, 62, 65, 70],
    "F": [57, 60, 65, 69], "C": [55, 60, 64, 67],
    "Fadd9": [53, 60, 65, 67, 69, 72],
}
ROOT = {"Dm": 38, "Bb": 34, "F": 41, "C": 36, "Fadd9": 29}
ARP = {  # 8-step cells over chord tones, repeated per half-bar
    "Dm": [74, 69, 77, 69, 81, 69, 77, 74],
    "Bb": [74, 70, 77, 70, 82, 70, 77, 74],
    "F": [72, 69, 77, 69, 81, 69, 77, 72],
    "C": [72, 67, 76, 67, 79, 67, 76, 72],
}

drums, music, fx, send = Bus(), Bus(), Bus(), Bus()
arpbus = Bus()
cues = {"kicks": [], "claps": [], "snares": [], "hats": [], "impacts": [],
        "whooshes": [], "bells": [], "perc": []}

# chord timeline: (start_beat, end_beat, chord)
chords = [(0, 4, "Dm"), (4, 6, "Bb"), (6, 8, "C"),
          (8, 12, "Dm"), (12, 16, "Bb"), (16, 20, "F"), (20, 24, "C"),
          (24, 26, "Bb"), (26, 28, "C")]

# --- pads
for (b0, b1, c) in chords:
    dur = bt(b1 - b0) + 0.09
    t, n = tvec(dur)
    if b0 < 4:            # intro: dark, slowly opening
        fc = 380 + 1500 * (t / dur) ** 1.6
        g = 0.42
    elif b0 < 8:          # build
        u = (bt(b0 - 4) + t) / bt(4)
        fc = 900 + 5200 * u ** 2
        g = 0.62 + 0.25 * u
    elif b0 < 24:         # drop
        fc = 2600 + 900 * np.sin(2 * np.pi * t / bt(4)) ** 2
        g = 0.95
    else:                 # lift
        u = (bt(b0 - 24) + t) / bt(4)
        fc = 1400 + 6500 * u ** 2
        g = 0.8 + 0.2 * u
    music.add(supersaw(CH[c], dur, fc, seed=b0), bt(b0), g)
    send.add(supersaw(CH[c], dur, fc * 0.8, seed=b0 + 99), bt(b0), 0.25 * g)

# --- final chord (bar 7)
t, n = tvec(DUR - bt(28) + 0.2)
fc = 1300 + 7000 * np.exp(-t / 0.55)
fin = supersaw(CH["Fadd9"], len(t) / SR, fc, att=0.004, rel=0.9, seed=7)
fin *= (0.25 + 0.75 * np.exp(-t / 1.1))[:, None]
fx.add(fin, bt(28), 1.05)
send.add(fin, bt(28), 0.55)

# --- arp
for (b0, b1, c) in chords:
    steps = int((b1 - b0) * 4)
    for s in range(steps):
        b = b0 + s / 4
        m = ARP[c][s % 8]
        if b < 4:
            br, g = 0.12 + 0.35 * b / 4, 0.33
        elif b < 8:
            br, g = 0.45 + 0.55 * (b - 4) / 4, 0.36
        else:
            br, g = 1.0, 0.38
        if 7.5 <= b < 8 or 27.5 <= b < 28:
            continue
        acc = 1.0 if s % 4 == 0 else 0.72
        arpbus.add(pluck(m, bright=br), bt(b), g * acc, pan=0.25 * np.sin(s * 1.7))

# --- bass (offbeat 8ths in drop, sustained in lift)
for (b0, b1, c) in chords:
    if 8 <= b0 < 24:
        for k in range(int((b1 - b0) * 2)):
            b = b0 + k / 2
            if k % 2 == 1:  # offbeats
                music.add(bass(ROOT[c], bt(0.42)), bt(b), 0.9)
    elif b0 >= 24:
        music.add(bass(ROOT[c], bt(b1 - b0) - 0.02), bt(b0), 0.7)
music.add(bass(29, 2.2) * np.exp(-np.arange(int(2.2 * SR)) / SR / 0.9), bt(28), 1.0)

# --- drums
def K(b, g=1.0):
    drums.add(kick(g), bt(b), 1.0)
    cues["kicks"].append(round(bt(b), 4))


# intro heartbeat + soft impact at 0
fx.add(boom(2.0, 80, 30), 0, 0.85)
fx.add(crash(2.4, 0.8), 0, 0.10)
send.add(crash(2.4, 0.8), 0, 0.14)
cues["impacts"].append({"t": 0.0, "w": 0.6})
for s in range(8, 16):     # 16th hats beat 2..4, fading in
    b = s / 4
    drums.add(hat(), bt(b), 0.10 + 0.18 * (s - 8) / 8, pan=0.3)
    cues["hats"].append(round(bt(b), 4))

# build: four-on-floor + snare roll + risers
for b in (4, 5, 6, 7):
    K(b, 0.68)
roll = [4 + i * 0.5 for i in range(4)] + [6 + i * 0.25 for i in range(6)] + [7.5 + i * 0.125 for i in range(0)]
for i, b in enumerate(roll):
    u = i / (len(roll) - 1)
    drums.add(snare(1.0 + 0.5 * u, 0.07), bt(b), 0.22 + 0.55 * u)
    send.add(snare(1.0 + 0.5 * u, 0.07), bt(b), 0.18 * u)
    cues["snares"].append(round(bt(b), 4))
fx.add(noise_sweep(bt(5), 300, 9500, 1.8, 2.2), bt(3), 0.34)
rc = crash(bt(3), 0.9)[::-1] * np.linspace(0, 1, int(round(bt(3) * SR)))[:, None] ** 2
fx.add(rc, bt(5), 0.5)

# drop bars 2-5
for b in range(8, 24):
    K(b)
    if b % 2 == 1:
        drums.add(clap(), bt(b), 0.62)
        send.add(clap(), bt(b), 0.16)
        cues["claps"].append(round(bt(b), 4))
    drums.add(hat(True), bt(b + 0.5), 0.26, pan=-0.15)
    for k, v in enumerate((0.16, 0.10, 0.0, 0.12)):
        if v:
            drums.add(hat(), bt(b + k / 4), v, pan=0.35)
for bar in range(2, 6):
    for s16, f in ((3, 720), (6, 540), (11, 820), (14, 610)):
        b = bar * 4 + s16 / 4
        drums.add(perc(f), bt(b), 0.13, pan=-0.4 if s16 % 2 else 0.4)
        send.add(perc(f), bt(b), 0.08)
        cues["perc"].append(round(bt(b), 4))
# drop impact
fx.add(boom(1.8, 110, 30), bt(8), 0.9)
fx.add(crash(), bt(8), 0.5)
send.add(crash(), bt(8), 0.35)
fx.add(noise_sweep(1.6, 7000, 250, 1.2, 0.0)[::1] * np.exp(-np.arange(int(1.6 * SR)) / SR / 0.45)[:, None],
       bt(8), 0.16)
cues["impacts"].append({"t": round(bt(8), 4), "w": 1.0})
fx.add(crash(2.0, 0.8), bt(16), 0.28)
# whooshes into scene changes
for b in (12, 16, 20):
    w = whoosh()
    fx.add(w, bt(b) - w.shape[0] / SR + 0.03, 0.30)
    cues["whooshes"].append(round(bt(b), 4))
# fill into the lift
for i, b in enumerate((23.0, 23.25, 23.5, 23.75)):
    drums.add(snare(1.1 + 0.08 * i, 0.06), bt(b), 0.35 + 0.12 * i)
    cues["snares"].append(round(bt(b), 4))

# lift bar 6
for b in (24, 25):
    K(b, 0.9)
drums.add(clap(), bt(25), 0.55)
cues["claps"].append(round(bt(25), 4))
roll2 = [26 + i * 0.25 for i in range(4)] + [27 + i * 0.125 for i in range(6)]
for i, b in enumerate(roll2):
    u = i / (len(roll2) - 1)
    drums.add(snare(1.15 + 0.6 * u, 0.06), bt(b), 0.25 + 0.55 * u)
    send.add(snare(1.15 + 0.6 * u, 0.06), bt(b), 0.2 * u)
    cues["snares"].append(round(bt(b), 4))
fx.add(noise_sweep(bt(4), 500, 11000, 2.0, 2.4), bt(24), 0.36)
rc2 = crash(bt(2), 0.9)[::-1] * np.linspace(0, 1, int(round(bt(2) * SR)))[:, None] ** 2
fx.add(rc2, bt(26), 0.55)

# finale bar 7
K(28, 1.05)
fx.add(boom(2.2, 120, 28), bt(28), 1.0)
fx.add(crash(2.4, 1.2), bt(28), 0.55)
send.add(crash(2.4, 1.2), bt(28), 0.45)
cues["impacts"].append({"t": round(bt(28), 4), "w": 1.0})

# bells (hook) — intro motif, echo on the Bb, resolution at the end
bell_notes = [(0, [74, 81]), (1.5, [77]), (2.25, [76]), (3.0, [72]), (4.0, [74]),
              (28, [77, 84]), (29, [81]), (29.75, [79]), (30.5, [77])]
for b, ms in bell_notes:
    for m in ms:
        fx.add(bell(m), bt(b), 0.20, pan=0.15 if m % 2 else -0.15)
        send.add(bell(m), bt(b), 0.22)
    cues["bells"].append(round(bt(b), 4))

# ---------------------------------------------------------------- mix
t_all = np.arange(N) / SR


def sidechain(depth, tau):
    g = np.ones(N)
    for tk in cues["kicks"]:
        i0 = int(round(tk * SR))
        m = int(0.45 * SR)
        seg = np.arange(min(m, N - i0)) / SR
        dip = 1 - depth * np.exp(-(seg / tau) ** 1.5)
        g[i0:i0 + len(seg)] = np.minimum(g[i0:i0 + len(seg)], dip)
    # smooth the attack of the duck (2 ms)
    return filt(g, "lowpass", 180, 1)


music.x *= sidechain(0.78, 0.13)[:, None]
arpbus.x *= sidechain(0.45, 0.10)[:, None]

# arp delay (dotted 8th ping-pong)
dL, dR = pingpong(arpbus.x[:, 0].copy(), arpbus.x[:, 1].copy(), int(round(bt(0.75) * SR)), 0.38, 0.45)
dly = np.stack([dL, dR], 1)
dly = filt(dly, "highpass", 500)
dly = filt(dly, "lowpass", 5200)

# gaps (vacuum before the drop and before the finale)
def gap(b0, b1, *buses):
    i0, i1 = int(round(bt(b0) * SR)), int(round(bt(b1) * SR))
    ramp = int(0.004 * SR)
    for bus in buses:
        bus.x[i0:i1] = 0
        bus.x[i0 - ramp:i0] *= np.linspace(1, 0, ramp)[:, None]


gap(7.5, 8, drums, music, arpbus)
gap(27.5, 28, drums, music, arpbus)

send.x += arpbus.x * 0.35
ir = make_ir()
rev = np.stack([fftconvolve(send.x[:, 0], ir[:, 0])[:N], fftconvolve(send.x[:, 1], ir[:, 1])[:N]], 1)
rev = filt(rev, "highpass", 220)

mix = drums.x * 1.0 + music.x * 0.72 + arpbus.x * 0.62 + dly * 0.55 + fx.x * 0.9 + rev * 0.30
mix = filt(mix, "highpass", 24, 2)

# glue
L, R = compress(mix[:, 0].copy(), mix[:, 1].copy(), -14.0, 2.2, 0.012, 0.14, SR)
mix = np.stack([L, R], 1)

# fades: tiny fade-in, musical tail fade to digital silence at 15.000
fi = int(0.003 * SR)
mix[:fi] *= np.linspace(0, 1, fi)[:, None]
fo0 = int(round(bt(30.2) * SR))
u = np.linspace(0, 1, N - fo0)
mix[fo0:] *= (np.cos(u * np.pi) * 0.5 + 0.5)[:, None] ** 1.3

# loudness -> -14 LUFS then limit to -1 dBFS (4x oversampled peak check below)
meter = pyln.Meter(SR)
for _ in range(3):
    lufs = meter.integrated_loudness(mix)
    mix *= 10 ** ((-13.6 - lufs) / 20)
    L, R = limiter(mix[:, 0].copy(), mix[:, 1].copy(), 10 ** (-1.75 / 20), 0.005, 0.08, SR)
    mix = np.stack([L, R], 1)
lufs = meter.integrated_loudness(mix)
from scipy.signal import resample_poly
tp = 20 * np.log10(np.max(np.abs(resample_poly(mix, 4, 1, axis=0))))
print(f"integrated {lufs:.2f} LUFS, true-peak ~{tp:.2f} dBTP, dur {N / SR:.3f}s")

os.makedirs(OUT, exist_ok=True)
sf.write(os.path.join(OUT, "music.wav"), mix.astype(np.float32), SR, subtype="PCM_24")

cues.update({
    "bpm": BPM, "beat": BEAT, "bar": BAR, "duration": DUR,
    "downbeats": [round(bt(b), 4) for b in range(0, 32, 4)],
    "beats": [round(bt(b), 4) for b in range(32)],
    "sections": [
        {"name": "intro", "t0": 0.0, "t1": bt(4)},
        {"name": "build", "t0": bt(4), "t1": bt(8)},
        {"name": "drop", "t0": bt(8), "t1": bt(24)},
        {"name": "lift", "t0": bt(24), "t1": bt(28)},
        {"name": "finale", "t0": bt(28), "t1": DUR},
    ],
    "gaps": [[bt(7.5), bt(8)], [bt(27.5), bt(28)]],
    "chords": [{"t0": bt(a), "t1": bt(b), "c": c} for a, b, c in chords] + [{"t0": bt(28), "t1": DUR, "c": "Fadd9"}],
})
for k in ("kicks", "claps", "snares", "hats", "whooshes", "bells", "perc"):
    cues[k] = sorted(set(cues[k]))
with open(os.path.join(OUT, "cues.json"), "w") as f:
    json.dump(cues, f, indent=1)
with open(os.path.join(os.path.dirname(__file__), "..", "scene", "cues.js"), "w") as f:
    f.write("window.CUES = " + json.dumps(cues) + ";\n")
