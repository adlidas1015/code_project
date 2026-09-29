#!/usr/bin/env python3
"""Original 30-second score for the DASAN DMC ESG film (v2).

128 BPM, 16 bars = exactly 30.000 s. D minor groove resolving to F major.
  bars 0-1   intro      pads, bell motif, ticking hats
  bars 2-3   build      filtered four-on-the-floor, snare roll, riser, vacuum
  bar  4     drop       impact, full groove
  bars 5-10  groove     E / S / G, whooshes on every section change
  bars 11-12 breakdown  drums out, bells; bar 12 rebuilds with a roll
  bars 13-14 final drop full groove, one card per beat
  bar  15    finale     impact, F add9, bell resolution, fade to silence
Writes out/music30.wav, out/cues30.json and scene30/cues.js
"""
import json
import os
import sys

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy.signal import fftconvolve, resample_poly

sys.path.insert(0, os.path.dirname(__file__))
import synth  # noqa: E402
from synth import (SR, BEAT, BAR, bt, Bus, kick, snare, clap, hat, perc, crash, boom, noise_sweep,  # noqa: E402
                   whoosh, supersaw, pluck, bell, bass, make_ir, filt, tvec, pingpong, compress, limiter)

BARS = 16
DUR = BARS * BAR
synth.N = N = int(round(DUR * SR))
ROOT_DIR = os.path.join(os.path.dirname(__file__), "..")
rng = synth.rng

CH = {"Dm": [57, 62, 65, 69], "Bb": [58, 62, 65, 70], "F": [57, 60, 65, 69], "C": [55, 60, 64, 67],
      "Fadd9": [53, 60, 65, 67, 69, 72]}
ROOT = {"Dm": 38, "Bb": 34, "F": 41, "C": 36}
ARP = {"Dm": [74, 69, 77, 69, 81, 69, 77, 74], "Bb": [74, 70, 77, 70, 82, 70, 77, 74],
       "F": [72, 69, 77, 69, 81, 69, 77, 72], "C": [72, 67, 76, 67, 79, 67, 76, 72]}

chords = [(0, 4, "Dm"), (4, 8, "Bb"),
          (8, 12, "F"), (12, 16, "C"),
          (16, 20, "Dm"), (20, 24, "Bb"), (24, 28, "F"), (28, 32, "C"),
          (32, 36, "Dm"), (36, 40, "Bb"), (40, 44, "F"),
          (44, 48, "Bb"), (48, 52, "C"),
          (52, 56, "Dm"), (56, 58, "Bb"), (58, 60, "C")]
GROOVE = [(16, 44), (52, 60)]
GAPS = [(15.5, 16), (51.5, 52), (59.5, 60)]


def in_groove(b):
    return any(a <= b < z for a, z in GROOVE)


def in_gap(b):
    return any(a <= b < z for a, z in GAPS)


drums, music, fx, send, arpbus = Bus(), Bus(), Bus(), Bus(), Bus()
cues = {k: [] for k in ("kicks", "claps", "snares", "hats", "impacts", "whooshes", "bells", "perc")}

# ---------------------------------------------------------------- pads
for (b0, b1, c) in chords:
    dur = bt(b1 - b0) + 0.09
    t, n = tvec(dur)
    if b0 < 8:                                  # intro: dark, opening
        u = (bt(b0) + t) / bt(8)
        fc, g = 360 + 1900 * u ** 1.5, 0.40 + 0.1 * u
    elif b0 < 16:                               # build
        u = (bt(b0 - 8) + t) / bt(8)
        fc, g = 1000 + 5600 * u ** 2, 0.58 + 0.3 * u
    elif b0 < 44 or b0 >= 52:                   # groove
        fc, g = 2600 + 900 * np.sin(2 * np.pi * t / bt(4)) ** 2, 0.95
    elif b0 < 48:                               # breakdown: wide & soft
        fc, g = 1500 + 500 * np.sin(np.pi * t / dur), 0.72
    else:                                       # rebuild
        u = t / dur
        fc, g = 1200 + 7000 * u ** 2, 0.75 + 0.25 * u
    music.add(supersaw(CH[c], dur, fc, seed=b0), bt(b0), g)
    send.add(supersaw(CH[c], dur, fc * 0.8, seed=b0 + 99), bt(b0), (0.45 if 44 <= b0 < 48 else 0.25) * g)

t, n = tvec(DUR - bt(60) + 0.2)
fc = 1300 + 7000 * np.exp(-t / 0.55)
fin = supersaw(CH["Fadd9"], n / SR, fc, att=0.004, rel=0.9, seed=7)
fin *= (0.25 + 0.75 * np.exp(-t / 1.1))[:, None]
fx.add(fin, bt(60), 1.05)
send.add(fin, bt(60), 0.55)

# ---------------------------------------------------------------- arp
for (b0, b1, c) in chords:
    for s in range(int((b1 - b0) * 4)):
        b = b0 + s / 4
        if in_gap(b):
            continue
        if b < 8:
            br, g = 0.1 + 0.3 * b / 8, 0.30
        elif b < 16:
            br, g = 0.4 + 0.6 * (b - 8) / 8, 0.35
        elif 44 <= b < 48:
            br, g = 0.28, 0.26
        elif 48 <= b < 52:
            br, g = 0.3 + 0.7 * (b - 48) / 4, 0.32
        else:
            br, g = 1.0, 0.38
        acc = 1.0 if s % 4 == 0 else 0.72
        arpbus.add(pluck(ARP[c][s % 8], bright=br), bt(b), g * acc, pan=0.25 * np.sin(s * 1.7))

# ---------------------------------------------------------------- bass
for (b0, b1, c) in chords:
    if in_groove(b0):
        for k in range(int((b1 - b0) * 2)):
            if k % 2 == 1:
                music.add(bass(ROOT[c], bt(0.42)), bt(b0 + k / 2), 0.9)
    elif 48 <= b0 < 52:                          # driving 8ths into the final drop
        for k in range(7):
            music.add(bass(ROOT[c], bt(0.4)), bt(b0 + k / 2), 0.55 + 0.05 * k)
music.add(bass(29, 2.2) * np.exp(-np.arange(int(2.2 * SR)) / SR / 0.9), bt(60), 1.0)


# ---------------------------------------------------------------- drums
def K(b, g=1.0):
    drums.add(kick(g), bt(b))
    cues["kicks"].append(round(bt(b), 4))


def impact(b, w=1.0, big=True):
    fx.add(boom(2.0 if big else 1.6, 110 if big else 80, 29), bt(b), 0.95 * w)
    fx.add(crash(2.4, 1.1), bt(b), 0.5 * w)
    send.add(crash(2.4, 1.1), bt(b), 0.4 * w)
    cues["impacts"].append({"t": round(bt(b), 4), "w": w})


def roll(beats, g0, g1, p0, p1):
    for i, b in enumerate(beats):
        u = i / max(1, len(beats) - 1)
        drums.add(snare(p0 + (p1 - p0) * u, 0.065), bt(b), g0 + (g1 - g0) * u)
        send.add(snare(p0 + (p1 - p0) * u, 0.065), bt(b), 0.18 * u)
        cues["snares"].append(round(bt(b), 4))


def riser(b0, b1, g=0.34):
    fx.add(noise_sweep(bt(b1 - b0), 320, 10000, 1.9, 2.3), bt(b0), g)
    n = int(round(bt(min(3, b1 - b0)) * SR))
    rc = crash(n / SR, 0.9)[::-1] * np.linspace(0, 1, n)[:, None] ** 2
    fx.add(rc, bt(b1) - n / SR, 0.5)


# intro
fx.add(boom(2.0, 80, 30), 0, 0.8)
fx.add(crash(2.4, 0.8), 0, 0.10)
send.add(crash(2.4, 0.8), 0, 0.14)
cues["impacts"].append({"t": 0.0, "w": 0.35})
for s in range(16, 32):
    b = s / 4
    drums.add(hat(), bt(b), 0.08 + 0.16 * (s - 16) / 16, pan=0.3)
    cues["hats"].append(round(bt(b), 4))

# build
for b in range(8, 16):
    K(b, 0.6 + 0.02 * (b - 8))
    if b % 2 == 1:
        drums.add(clap(), bt(b), 0.3)
        cues["claps"].append(round(bt(b), 4))
    drums.add(hat(), bt(b + 0.5), 0.12, pan=0.3)
roll([12 + i * 0.5 for i in range(4)] + [14 + i * 0.25 for i in range(6)], 0.22, 0.8, 1.0, 1.5)
riser(10, 16)

# groove blocks
for (g0, g1) in GROOVE:
    for b in range(g0, g1):
        K(b)
        if b % 2 == 1:
            drums.add(clap(), bt(b), 0.62)
            send.add(clap(), bt(b), 0.16)
            cues["claps"].append(round(bt(b), 4))
        drums.add(hat(True), bt(b + 0.5), 0.26, pan=-0.15)
        for k, v in enumerate((0.16, 0.10, 0.0, 0.12)):
            if v and not in_gap(b + k / 4):
                drums.add(hat(), bt(b + k / 4), v, pan=0.35)
    for bar in range(g0 // 4, g1 // 4):
        for s16, f in ((3, 720), (6, 540), (11, 820), (14, 610)):
            b = bar * 4 + s16 / 4
            if in_gap(b):
                continue
            drums.add(perc(f), bt(b), 0.13, pan=-0.4 if s16 % 2 else 0.4)
            send.add(perc(f), bt(b), 0.08)
            cues["perc"].append(round(bt(b), 4))

impact(16)
fx.add(noise_sweep(1.6, 7000, 250, 1.2, 0.0) * np.exp(-np.arange(int(1.6 * SR)) / SR / 0.45)[:, None], bt(16), 0.16)
for b in (28, 36):
    fx.add(crash(2.0, 0.8), bt(b), 0.26)
for b in (20, 28, 36, 44):
    w = whoosh()
    fx.add(w, bt(b) - w.shape[0] / SR + 0.03, 0.30)
    cues["whooshes"].append(round(bt(b), 4))
roll([43, 43.25, 43.5, 43.75], 0.35, 0.7, 1.1, 1.35)

# breakdown bar 11: air; bar 12: rebuild
fx.add(crash(2.6, 1.3), bt(44), 0.3)
send.add(crash(2.6, 1.3), bt(44), 0.5)
for s in range(8):
    drums.add(hat(), bt(44 + s / 2 + 0.5), 0.07, pan=0.4)
for b in (48, 49, 50, 51):
    K(b, 0.75 + 0.07 * (b - 48))
roll([50 + i * 0.25 for i in range(4)] + [51 + i * 0.125 for i in range(4)], 0.25, 0.85, 1.15, 1.75)
riser(46, 52, 0.36)

# final drop + finale
impact(52)
roll([59, 59.25], 0.4, 0.55, 1.3, 1.4)
K(60, 1.05)
impact(60)

# bells
bell_notes = [(0, [74, 81]), (1.5, [77]), (2.25, [76]), (3.0, [72]),
              (4, [74]), (5.5, [77]), (6.25, [79]), (7.0, [81]),
              (44, [81, 86]), (45.5, [77]), (46.25, [76]), (47.0, [74]),
              (60, [77, 84]), (61, [81]), (61.75, [79]), (62.5, [77])]
for b, ms in bell_notes:
    for m in ms:
        fx.add(bell(m), bt(b), 0.20, pan=0.15 if m % 2 else -0.15)
        send.add(bell(m), bt(b), 0.22)
    cues["bells"].append(round(bt(b), 4))


# ---------------------------------------------------------------- mix
def sidechain(depth, tau):
    g = np.ones(N)
    for tk in cues["kicks"]:
        i0 = int(round(tk * SR))
        seg = np.arange(min(int(0.45 * SR), N - i0)) / SR
        g[i0:i0 + len(seg)] = np.minimum(g[i0:i0 + len(seg)], 1 - depth * np.exp(-(seg / tau) ** 1.5))
    return filt(g, "lowpass", 180, 1)


music.x *= sidechain(0.78, 0.13)[:, None]
arpbus.x *= sidechain(0.45, 0.10)[:, None]
dL, dR = pingpong(arpbus.x[:, 0].copy(), arpbus.x[:, 1].copy(), int(round(bt(0.75) * SR)), 0.38, 0.45)
dly = filt(filt(np.stack([dL, dR], 1), "highpass", 500), "lowpass", 5200)

for (a, z) in GAPS:
    i0, i1 = int(round(bt(a) * SR)), int(round(bt(z) * SR))
    r = int(0.004 * SR)
    for bus in (drums, music, arpbus):
        bus.x[i0:i1] = 0
        bus.x[i0 - r:i0] *= np.linspace(1, 0, r)[:, None]

send.x += arpbus.x * 0.35
ir = make_ir()
rev = np.stack([fftconvolve(send.x[:, 0], ir[:, 0])[:N], fftconvolve(send.x[:, 1], ir[:, 1])[:N]], 1)
rev = filt(rev, "highpass", 220)
mix = drums.x + music.x * 0.72 + arpbus.x * 0.62 + dly * 0.55 + fx.x * 0.9 + rev * 0.30
mix = filt(mix, "highpass", 24, 2)
L, R = compress(mix[:, 0].copy(), mix[:, 1].copy(), -14.0, 2.2, 0.012, 0.14, SR)
mix = np.stack([L, R], 1)
fi = int(0.003 * SR)
mix[:fi] *= np.linspace(0, 1, fi)[:, None]
fo0 = int(round(bt(62.2) * SR))
u = np.linspace(0, 1, N - fo0)
mix[fo0:] *= (np.cos(u * np.pi) * 0.5 + 0.5)[:, None] ** 1.3

meter = pyln.Meter(SR)
for _ in range(3):
    mix *= 10 ** ((-13.6 - meter.integrated_loudness(mix)) / 20)
    L, R = limiter(mix[:, 0].copy(), mix[:, 1].copy(), 10 ** (-1.75 / 20), 0.005, 0.08, SR)
    mix = np.stack([L, R], 1)
tp = 20 * np.log10(np.max(np.abs(resample_poly(mix, 4, 1, axis=0))))
print(f"integrated {meter.integrated_loudness(mix):.2f} LUFS, true-peak ~{tp:.2f} dBTP, dur {N / SR:.3f}s")

sf.write(os.path.join(ROOT_DIR, "out", "music30.wav"), mix.astype(np.float32), SR, subtype="PCM_24")
cues.update({
    "bpm": synth.BPM, "beat": BEAT, "bar": BAR, "duration": DUR,
    "downbeats": [round(bt(b), 4) for b in range(0, 64, 4)],
    "gaps": [[bt(a), bt(z)] for a, z in GAPS],
})
for k in ("kicks", "claps", "snares", "hats", "whooshes", "bells", "perc"):
    cues[k] = sorted(set(cues[k]))
json.dump(cues, open(os.path.join(ROOT_DIR, "out", "cues30.json"), "w"), indent=1)
os.makedirs(os.path.join(ROOT_DIR, "scene30"), exist_ok=True)
open(os.path.join(ROOT_DIR, "scene30", "cues.js"), "w").write("window.CUES = " + json.dumps(cues) + ";\n")
