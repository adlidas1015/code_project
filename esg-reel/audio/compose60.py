#!/usr/bin/env python3
"""Original 60-second score for the DASAN DMC ESG film (v3).

128 BPM, 32 bars = exactly 60.000 s — the 30 s arrangement with every section
twice as long, so the picture can hold each idea for twice the time.
  bars 0-3   intro       pads, bell motif, hats fade in
  bars 4-7   build       four-on-the-floor, claps, riser, snare roll, 1-beat vacuum
  bars 8-9   drop        impact, full groove (logo, E/S/G)
  bars 10-21 groove      E / S / G; fills + crashes every 2 bars, whooshes per section,
                         offbeat chord stabs under S, bell counter-line under G
  bars 22-25 breakdown   drums out, bells; bars 24-25 rebuild with a roll, vacuum
  bars 26-29 final drop  one KPI card every two beats, vacuum
  bars 30-31 finale      impact, F add9, bell resolution, fade to silence
Writes out/music60.wav, out/cues60.json and scene60/cues.js
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

BARS = 32
DUR = BARS * BAR
synth.N = N = int(round(DUR * SR))
ROOT_DIR = os.path.join(os.path.dirname(__file__), "..")

CH = {"Dm": [57, 62, 65, 69], "Bb": [58, 62, 65, 70], "F": [57, 60, 65, 69], "C": [55, 60, 64, 67],
      "Fadd9": [53, 60, 65, 67, 69, 72]}
ROOT = {"Dm": 38, "Bb": 34, "F": 41, "C": 36}
ARP = {"Dm": [74, 69, 77, 69, 81, 69, 77, 74], "Bb": [74, 70, 77, 70, 82, 70, 77, 74],
       "F": [72, 69, 77, 69, 81, 69, 77, 72], "C": [72, 67, 76, 67, 79, 67, 76, 72]}
PROG = ["Dm", "Bb", "F", "C"]
chords = [(i * 4, i * 4 + 4, c) for i, c in enumerate(
    PROG + PROG + ["Dm", "Bb"] + ["F", "C", "Dm", "Bb"] * 3 + PROG + PROG)]
assert chords[-1][1] == 120
GROOVE = [(32, 88), (104, 120)]
GAPS = [(31, 32), (103, 104), (119, 120)]


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
    if b0 < 16:
        u = (bt(b0) + t) / bt(16)
        fc, g = 360 + 2000 * u ** 1.5, 0.40 + 0.12 * u
    elif b0 < 32:
        u = (bt(b0 - 16) + t) / bt(16)
        fc, g = 1000 + 5600 * u ** 2, 0.58 + 0.3 * u
    elif in_groove(b0):
        fc, g = 2600 + 900 * np.sin(2 * np.pi * t / bt(4)) ** 2, 0.95
    elif b0 < 96:
        fc, g = 1500 + 500 * np.sin(np.pi * t / dur), 0.72
    else:
        u = (bt(b0 - 96) + t) / bt(8)
        fc, g = 1200 + 7000 * u ** 2, 0.75 + 0.25 * u
    music.add(supersaw(CH[c], dur, fc, seed=b0), bt(b0), g)
    send.add(supersaw(CH[c], dur, fc * 0.8, seed=b0 + 99), bt(b0), (0.45 if 88 <= b0 < 96 else 0.25) * g)

t, n = tvec(DUR - bt(120) + 0.2)
fc = 1300 + 7000 * np.exp(-t / 0.6)
fin = supersaw(CH["Fadd9"], n / SR, fc, att=0.004, rel=1.2, seed=7)
fin *= (0.22 + 0.78 * np.exp(-t / 1.4))[:, None]
fx.add(fin, bt(120), 1.05)
send.add(fin, bt(120), 0.6)

# offbeat stabs under Social (bars 14-17)
for (b0, b1, c) in chords:
    if 56 <= b0 < 72:
        for k in range(int(b1 - b0)):
            b = b0 + k + 0.5
            st = supersaw(CH[c], 0.16, np.full(int(round(0.16 * SR)), 3200.0), voices=5, att=0.002, rel=0.08, seed=int(b * 4))
            music.add(st, bt(b), 0.42)

# ---------------------------------------------------------------- arp
for (b0, b1, c) in chords:
    for s in range(int((b1 - b0) * 4)):
        b = b0 + s / 4
        if in_gap(b):
            continue
        if b < 16:
            br, g = 0.1 + 0.3 * b / 16, 0.30
        elif b < 32:
            br, g = 0.4 + 0.6 * (b - 16) / 16, 0.35
        elif 88 <= b < 96:
            br, g = 0.28, 0.26
        elif 96 <= b < 104:
            br, g = 0.3 + 0.7 * (b - 96) / 8, 0.32
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
    elif 96 <= b0 < 104:
        for k in range(8):
            b = b0 + k / 2
            if not in_gap(b):
                music.add(bass(ROOT[c], bt(0.4)), bt(b), 0.5 + 0.03 * (b - 96))
music.add(bass(29, 3.0) * np.exp(-np.arange(int(3.0 * SR)) / SR / 1.1), bt(120), 1.0)


# ---------------------------------------------------------------- drums
def K(b, g=1.0):
    drums.add(kick(g), bt(b))
    cues["kicks"].append(round(bt(b), 4))


def impact(b, w=1.0):
    fx.add(boom(2.0, 110, 29), bt(b), 0.95 * w)
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
for s in range(32, 64):
    b = s / 4
    drums.add(hat(), bt(b), 0.06 + 0.16 * (s - 32) / 32, pan=0.3)
    cues["hats"].append(round(bt(b), 4))
riser(12, 16, 0.16)

# build
for b in range(16, 31):
    K(b, 0.55 + 0.013 * (b - 16))
    if b >= 20 and b % 2 == 1:
        drums.add(clap(), bt(b), 0.32)
        cues["claps"].append(round(bt(b), 4))
    drums.add(hat(), bt(b + 0.5), 0.12, pan=0.3)
roll([28 + i * 0.5 for i in range(4)] + [30 + i * 0.25 for i in range(4)], 0.22, 0.8, 1.0, 1.5)
riser(24, 32)

# groove
for (g0, g1) in GROOVE:
    for b in range(g0, g1):
        if in_gap(b):
            continue
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

impact(32)
fx.add(noise_sweep(1.6, 7000, 250, 1.2, 0.0) * np.exp(-np.arange(int(1.6 * SR)) / SR / 0.45)[:, None], bt(32), 0.16)
for b in (40, 56, 72, 88):                     # section changes
    w = whoosh()
    fx.add(w, bt(b) - w.shape[0] / SR + 0.03, 0.30)
    cues["whooshes"].append(round(bt(b), 4))
for b in (48, 56, 64, 72, 80):                 # sub-scene changes / section heads
    fx.add(crash(2.0, 0.8), bt(b), 0.24)
for b in (39, 55, 71, 87):                     # fills into each section
    roll([b, b + 0.25, b + 0.5, b + 0.75], 0.32, 0.7, 1.1, 1.35)
for b in (47, 63, 79):                         # lighter fills into sub-scenes
    roll([b + 0.5, b + 0.75], 0.3, 0.45, 1.15, 1.25)

# bell counter-line under Governance
for b, m in ((72, 81), (73.5, 79), (76, 79), (77.5, 76), (80, 81), (81.5, 77), (84, 77), (85.5, 74)):
    fx.add(bell(m, dur=2.0, index=1.2), bt(b), 0.11, pan=0.35)
    send.add(bell(m, dur=2.0, index=1.2), bt(b), 0.14)

# breakdown bars 22-23: air; bars 24-25: rebuild
fx.add(crash(2.6, 1.3), bt(88), 0.3)
send.add(crash(2.6, 1.3), bt(88), 0.5)
for s in range(16):
    drums.add(hat(), bt(88 + s / 2 + 0.5), 0.07, pan=0.4)
for b in range(96, 103):
    K(b, 0.7 + 0.04 * (b - 96))
    if b % 2 == 1:
        drums.add(clap(), bt(b), 0.4)
        cues["claps"].append(round(bt(b), 4))
roll([100 + i * 0.25 for i in range(8)] + [102 + i * 0.125 for i in range(8)], 0.25, 0.85, 1.15, 1.75)
riser(94, 104, 0.36)

# final drop + finale
impact(104)
roll([118, 118.25, 118.5, 118.75], 0.4, 0.65, 1.3, 1.45)
K(120, 1.05)
impact(120)

bell_notes = [(0, [74, 81]), (1.5, [77]), (2.25, [76]), (3.0, [72]),
              (8, [74]), (9.5, [77]), (10.25, [79]), (11.0, [81]),
              (88, [81, 86]), (89.5, [77]), (90.25, [76]), (91.0, [74]),
              (92, [74]), (93.5, [77]), (94.25, [79]), (95.0, [81]),
              (120, [77, 84]), (121, [81]), (121.75, [79]), (122.5, [77]), (124, [72, 77])]
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
fo0 = int(round(bt(125.5) * SR))
u = np.linspace(0, 1, N - fo0)
mix[fo0:] *= (np.cos(u * np.pi) * 0.5 + 0.5)[:, None] ** 1.3

meter = pyln.Meter(SR)
for _ in range(3):
    mix *= 10 ** ((-13.6 - meter.integrated_loudness(mix)) / 20)
    L, R = limiter(mix[:, 0].copy(), mix[:, 1].copy(), 10 ** (-2.3 / 20), 0.005, 0.08, SR)
    mix = np.stack([L, R], 1)
tp = 20 * np.log10(np.max(np.abs(resample_poly(mix, 4, 1, axis=0))))
print(f"integrated {meter.integrated_loudness(mix):.2f} LUFS, true-peak ~{tp:.2f} dBTP, dur {N / SR:.3f}s")

sf.write(os.path.join(ROOT_DIR, "out", "music60.wav"), mix.astype(np.float32), SR, subtype="PCM_24")
cues.update({
    "bpm": synth.BPM, "beat": BEAT, "bar": BAR, "duration": DUR,
    "downbeats": [round(bt(b), 4) for b in range(0, 128, 4)],
    "gaps": [[bt(a), bt(z)] for a, z in GAPS],
})
for k in ("kicks", "claps", "snares", "hats", "whooshes", "bells", "perc"):
    cues[k] = sorted(set(cues[k]))
json.dump(cues, open(os.path.join(ROOT_DIR, "out", "cues60.json"), "w"), indent=1)
os.makedirs(os.path.join(ROOT_DIR, "scene60"), exist_ok=True)
open(os.path.join(ROOT_DIR, "scene60", "cues.js"), "w").write("window.CUES = " + json.dumps(cues) + ";\n")
