#!/usr/bin/env python3
"""Shared DSP + instruments for the DASAN DMC ESG scores (no samples).
Set synth.N (total samples) before creating Bus objects."""
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
