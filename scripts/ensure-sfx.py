#!/usr/bin/env python3
"""
Procedural fallback audio synthesizer for VideoFactory.

Ensures requested `bgmPath` and `transitionSfxPath` files from a client's
`batch.json` exist on disk before Remotion resolves assets. If a custom audio
file was already pulled from Google Drive (or placed locally), it is NEVER
overwritten.

Uses only Python 3 standard library (`math`, `struct`, `wave`, `array`, etc.)
plus `ffmpeg` (from PATH on Ubuntu CI runners, falling back to Remotion's
bundled compositor ffmpeg binary if needed). Zero external pip dependencies.

Usage:
    python3 scripts/ensure-sfx.py <client_slug> <video_id>
    python3 scripts/ensure-sfx.py <client_slug>
"""

from __future__ import annotations

import array
import json
import math
import os
import random
import shutil
import struct
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
CLIENTS_DIR = ROOT_DIR / "clients"

SAMPLE_RATE = 44100
CHANNELS = 2
TWO_PI = 2.0 * math.pi


def normalize_rel_path(raw: str | None) -> str:
    if not raw or not isinstance(raw, str):
        return ""
    cleaned = raw.replace("\\", "/").lstrip("/")
    while cleaned.startswith("./"):
        cleaned = cleaned[2:]
    while "//" in cleaned:
        cleaned = cleaned.replace("//", "/")
    return cleaned.strip()


def resolve_client_target(slug: str, rel_path: str) -> Path:
    client_root = (CLIENTS_DIR / slug).resolve()
    target = (client_root / rel_path).resolve()
    try:
        target.relative_to(client_root)
    except ValueError as exc:
        raise ValueError(
            f"Refusing to write outside clients/{slug}: {rel_path}"
        ) from exc
    return target


def find_ffmpeg() -> str:
    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return system_ffmpeg

    remotion_dir = ROOT_DIR / "node_modules" / "@remotion"
    if remotion_dir.is_dir():
        for candidate in remotion_dir.glob("compositor-*/ffmpeg*"):
            if candidate.is_file() and os.access(candidate, os.X_OK):
                return str(candidate)

    raise RuntimeError(
        "ffmpeg not found on PATH or inside node_modules/@remotion/compositor-*/."
    )


def write_stereo_wav(wav_path: Path, left: array.array, right: array.array, target_peak: float) -> None:
    count = len(left)
    peak = 1e-9
    for i in range(count):
        al = abs(left[i])
        ar = abs(right[i])
        if al > peak:
            peak = al
        if ar > peak:
            peak = ar

    gain = (target_peak * 32767.0) / peak
    pcm = bytearray(count * 4)
    pack_into = struct.pack_into
    for i in range(count):
        vl = int(left[i] * gain)
        if vl > 32767:
            vl = 32767
        elif vl < -32767:
            vl = -32767
        vr = int(right[i] * gain)
        if vr > 32767:
            vr = 32767
        elif vr < -32767:
            vr = -32767
        pack_into("<hh", pcm, i * 4, vl, vr)

    with wave.open(str(wav_path), "wb") as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(pcm)


def synthesize_ambient_bgm_wav(wav_path: Path, duration_sec: float = 48.0) -> None:
    """
    Synthesizes a subtle, calm corporate ambient chord pad:
      - 48.0s stereo, 44.1 kHz
      - Low-passed strictly < 900 Hz (2-pole cascaded IIR at 780 Hz)
      - Gentle subtle breath pulse (4.0s cycle = 12 exact cycles in 48s)
      - Seamless loop crossfade + smooth fade-in (0.8s) and fade-out (1.2s)
      - Peak-normalized cleanly to -3 dBFS (~0.70)
    """
    sr = SAMPLE_RATE
    xfade_samples = int(round(1.2 * sr))
    out_samples = int(round(duration_sec * sr))
    gen_samples = out_samples + xfade_samples

    table_size = 8192
    mask = table_size - 1
    step = TWO_PI / table_size
    sin_tbl = [math.sin(i * step) for i in range(table_size)]
    f2i = table_size / float(sr)

    # Unrolled warm institutional chord pad (all voices well below 900 Hz):
    # Foundation: D2 (73.42), A2 (110.00), D3 (146.83)
    # Chord A (Dmaj9): A3 (220.00), E4 (329.63), F#4 (369.99)
    # Chord B (Gmaj7/D): B3 (246.94), D4 (293.66), F#4 (369.99)
    # Stereo detuning creates rich calm analog space without harsh overtones.
    i_d2_l, i_d2_r = 73.42 * f2i, 73.58 * f2i
    i_a2_l, i_a2_r = 110.00 * f2i, 110.22 * f2i
    i_d3_l, i_d3_r = 146.83 * f2i, 147.12 * f2i
    i_a3_l, i_a3_r = 220.00 * f2i, 220.30 * f2i
    i_e4_l, i_e4_r = 329.63 * f2i, 329.28 * f2i
    i_b3_l, i_b3_r = 246.94 * f2i, 247.26 * f2i
    i_d4_l, i_d4_r = 293.66 * f2i, 293.98 * f2i
    i_fs4_l, i_fs4_r = 369.99 * f2i, 369.62 * f2i

    p_d2_l = p_d2_r = 0.0
    p_a2_l = p_a2_r = 0.0
    p_d3_l = p_d3_r = 0.0
    p_a3_l = p_a3_r = 0.0
    p_e4_l = p_e4_r = 0.0
    p_b3_l = p_b3_r = 0.0
    p_d4_l = p_d4_r = 0.0
    p_fs4_l = p_fs4_r = 0.0

    # Exact integer cycles across 48.0s:
    # - Chord morph: 3 cycles in 48s (16.0s each)
    # - Calm breath pulse: 12 cycles in 48s (4.0s each)
    i_morph = (3.0 / duration_sec) * f2i
    i_pulse = (12.0 / duration_sec) * f2i
    p_morph = 0.0
    p_pulse = 0.0

    # 2-pole cascaded IIR low-pass filter (fc = 780 Hz < 900 Hz)
    alpha = 1.0 - math.exp(-TWO_PI * 780.0 / float(sr))
    lp1_l = lp2_l = 0.0
    lp1_r = lp2_r = 0.0

    raw_l = array.array("f", [0.0]) * gen_samples
    raw_r = array.array("f", [0.0]) * gen_samples

    for idx in range(gen_samples):
        morph = 0.5 - 0.5 * sin_tbl[int(p_morph) & mask]
        p_morph += i_morph
        wa = 1.0 - morph
        wb = morph

        pulse = 0.94 + 0.06 * sin_tbl[int(p_pulse) & mask]
        p_pulse += i_pulse

        sl = (
            0.26 * sin_tbl[int(p_d2_l) & mask]
            + 0.22 * sin_tbl[int(p_a2_l) & mask]
            + 0.19 * sin_tbl[int(p_d3_l) & mask]
            + 0.11 * sin_tbl[int(p_fs4_l) & mask]
            + wa * (0.15 * sin_tbl[int(p_a3_l) & mask] + 0.12 * sin_tbl[int(p_e4_l) & mask])
            + wb * (0.15 * sin_tbl[int(p_b3_l) & mask] + 0.12 * sin_tbl[int(p_d4_l) & mask])
        ) * pulse

        sr_s = (
            0.26 * sin_tbl[int(p_d2_r) & mask]
            + 0.22 * sin_tbl[int(p_a2_r) & mask]
            + 0.19 * sin_tbl[int(p_d3_r) & mask]
            + 0.11 * sin_tbl[int(p_fs4_r) & mask]
            + wa * (0.15 * sin_tbl[int(p_a3_r) & mask] + 0.12 * sin_tbl[int(p_e4_r) & mask])
            + wb * (0.15 * sin_tbl[int(p_b3_r) & mask] + 0.12 * sin_tbl[int(p_d4_r) & mask])
        ) * pulse

        p_d2_l += i_d2_l
        p_d2_r += i_d2_r
        p_a2_l += i_a2_l
        p_a2_r += i_a2_r
        p_d3_l += i_d3_l
        p_d3_r += i_d3_r
        p_a3_l += i_a3_l
        p_a3_r += i_a3_r
        p_e4_l += i_e4_l
        p_e4_r += i_e4_r
        p_b3_l += i_b3_l
        p_b3_r += i_b3_r
        p_d4_l += i_d4_l
        p_d4_r += i_d4_r
        p_fs4_l += i_fs4_l
        p_fs4_r += i_fs4_r

        lp1_l += alpha * (sl - lp1_l)
        lp2_l += alpha * (lp1_l - lp2_l)
        lp1_r += alpha * (sr_s - lp1_r)
        lp2_r += alpha * (lp1_r - lp2_r)

        raw_l[idx] = lp2_l
        raw_r[idx] = lp2_r

    # Seamless equal-power loop crossfade (blend tail over head)
    loop_l = raw_l[:out_samples]
    loop_r = raw_r[:out_samples]
    half_pi = 0.5 * math.pi
    inv_xfade = 1.0 / float(xfade_samples)
    for i in range(xfade_samples):
        ang = i * inv_xfade * half_pi
        fi = math.sin(ang)
        fo = math.cos(ang)
        ti = out_samples + i
        loop_l[i] = loop_l[i] * fi + raw_l[ti] * fo
        loop_r[i] = loop_r[i] * fi + raw_r[ti] * fo

    # Smooth fade-in (0.8s) and fade-out (1.2s) for clean start & end transitions
    fade_in_samples = min(int(round(0.8 * sr)), out_samples // 4)
    for i in range(fade_in_samples):
        env = math.sin((i / float(fade_in_samples)) * half_pi)
        loop_l[i] *= env
        loop_r[i] *= env

    fade_out_samples = min(int(round(1.2 * sr)), out_samples // 4)
    fade_out_start = out_samples - fade_out_samples
    for i in range(fade_out_samples):
        env = math.cos((i / float(fade_out_samples)) * half_pi)
        idx = fade_out_start + i
        loop_l[idx] *= env
        loop_r[idx] *= env

    write_stereo_wav(wav_path, loop_l, loop_r, target_peak=0.70)


def synthesize_whoosh_wav(wav_path: Path, duration_sec: float = 0.28) -> None:
    """
    Synthesizes a crisp, soft, low-passed (< 2800 Hz, 0.28s) air-swipe whoosh SFX:
      - Seeded stereo filtered noise swept smoothly from 380 Hz -> 2350 Hz -> 420 Hz
      - Subtle soft low-end air body (175 Hz -> 90 Hz)
      - Smooth attack/release envelope starting and ending at exact 0.0
      - Normalized cleanly to -4 dBFS (~0.63)
    """
    sr = SAMPLE_RATE
    total_samples = int(round(duration_sec * sr))
    rng = random.Random(20261127)

    buf_l = array.array("f", [0.0]) * total_samples
    buf_r = array.array("f", [0.0]) * total_samples

    lp1_l = lp2_l = 0.0
    lp1_r = lp2_r = 0.0
    hp_prev_in_l = hp_prev_out_l = 0.0
    hp_prev_in_r = hp_prev_out_r = 0.0
    hp_alpha = 0.985

    body_phase = 0.0
    denom = float(max(1, total_samples - 1))

    for i in range(total_samples):
        t = i / denom

        if t < 0.36:
            env = math.sin((t / 0.36) * 0.5 * math.pi) ** 1.6
        else:
            env = math.cos(((t - 0.36) / 0.64) * 0.5 * math.pi) ** 2.1

        # Dynamic low-pass cutoff strictly < 2800 Hz (peaks at 2350 Hz)
        sweep_bell = math.sin(math.pi * (t ** 0.85))
        cutoff_hz = 380.0 + 1970.0 * (sweep_bell ** 1.4)
        alpha = 1.0 - math.exp(-TWO_PI * cutoff_hz / float(sr))

        n_common = rng.uniform(-1.0, 1.0)
        n_l = 0.65 * n_common + 0.35 * rng.uniform(-1.0, 1.0)
        n_r = 0.65 * n_common + 0.35 * rng.uniform(-1.0, 1.0)

        lp1_l += alpha * (n_l - lp1_l)
        lp2_l += alpha * (lp1_l - lp2_l)
        lp1_r += alpha * (n_r - lp1_r)
        lp2_r += alpha * (lp1_r - lp2_r)

        hp_out_l = hp_alpha * (hp_prev_out_l + lp2_l - hp_prev_in_l)
        hp_prev_in_l = lp2_l
        hp_prev_out_l = hp_out_l

        hp_out_r = hp_alpha * (hp_prev_out_r + lp2_r - hp_prev_in_r)
        hp_prev_in_r = lp2_r
        hp_prev_out_r = hp_out_r

        body_freq = 175.0 - 85.0 * t
        body_phase += TWO_PI * body_freq / float(sr)
        body = 0.14 * math.sin(body_phase) * (sweep_bell ** 1.5)

        pan_l = 0.92 + 0.08 * math.cos(t * math.pi)
        pan_r = 0.92 - 0.08 * math.cos(t * math.pi)

        buf_l[i] = (hp_out_l * pan_l + body) * env
        buf_r[i] = (hp_out_r * pan_r + body) * env

    write_stereo_wav(wav_path, buf_l, buf_r, target_peak=0.63)


def encode_wav_to_target(wav_path: Path, target_path: Path, ffmpeg_bin: str) -> None:
    target_path.parent.mkdir(parents=True, exist_ok=True)
    ext = target_path.suffix.lower()

    if ext == ".wav":
        shutil.copyfile(wav_path, target_path)
        return

    cmd = [ffmpeg_bin, "-y", "-loglevel", "error", "-i", str(wav_path)]
    if ext == ".mp3":
        cmd += ["-codec:a", "libmp3lame", "-b:a", "192k"]
    elif ext in (".m4a", ".aac"):
        cmd += ["-codec:a", "aac", "-b:a", "192k"]
    elif ext == ".ogg":
        cmd += ["-codec:a", "libvorbis", "-q:a", "5"]

    cmd.append(str(target_path))
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(
            f"ffmpeg encoding failed ({result.returncode}): {result.stderr.strip()}"
        )


def ensure_audio_file(
    slug: str,
    rel_path: str,
    kind: str,
    ffmpeg_bin: str,
) -> bool:
    normalized = normalize_rel_path(rel_path)
    if not normalized:
        return False

    target = resolve_client_target(slug, normalized)
    if target.is_file() and target.stat().st_size > 0:
        print(f"[ensure-sfx] Existing {kind} found, preserving: clients/{slug}/{normalized}")
        return False

    print(f"[ensure-sfx] Generating procedural {kind} -> clients/{slug}/{normalized}")
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_wav = Path(tmp.name)

    try:
        if kind == "bgm":
            synthesize_ambient_bgm_wav(tmp_wav, duration_sec=48.0)
        elif kind == "transition_sfx":
            synthesize_whoosh_wav(tmp_wav, duration_sec=0.28)
        else:
            raise ValueError(f"Unsupported audio kind: {kind}")

        encode_wav_to_target(tmp_wav, target, ffmpeg_bin)
        size_kb = target.stat().st_size / 1024.0
        print(
            f"[ensure-sfx] Created clients/{slug}/{normalized} ({size_kb:.1f} KB)"
        )
        return True
    finally:
        if tmp_wav.exists():
            tmp_wav.unlink()


def load_jobs(slug: str, video_id: str | None) -> list[dict]:
    batch_path = CLIENTS_DIR / slug / "batch.json"
    if not batch_path.is_file():
        raise FileNotFoundError(f"Missing batch.json for client '{slug}': {batch_path}")

    with batch_path.open("r", encoding="utf-8") as fp:
        batch = json.load(fp)

    videos = batch.get("videos", [])
    if not isinstance(videos, list):
        return []

    if video_id:
        matches = [v for v in videos if isinstance(v, dict) and v.get("id") == video_id]
        if not matches:
            raise ValueError(
                f"Video job '{video_id}' not found in clients/{slug}/batch.json"
            )
        return matches

    return [v for v in videos if isinstance(v, dict) and v.get("enabled") is not False]


def main() -> int:
    if len(sys.argv) < 2:
        print(
            "Usage: python3 scripts/ensure-sfx.py <client_slug> [video_id]",
            file=sys.stderr,
        )
        return 1

    slug = sys.argv[1].strip()
    video_id = sys.argv[2].strip() if len(sys.argv) >= 3 and sys.argv[2].strip() else None

    jobs = load_jobs(slug, video_id)
    if not jobs:
        print(f"[ensure-sfx] No matching jobs for client '{slug}'.")
        return 0

    requested_bgm: list[str] = []
    requested_sfx: list[str] = []
    for job in jobs:
        audio = job.get("audio")
        if not isinstance(audio, dict):
            continue
        bgm = normalize_rel_path(audio.get("bgmPath"))
        sfx = normalize_rel_path(audio.get("transitionSfxPath"))
        if bgm and bgm not in requested_bgm:
            requested_bgm.append(bgm)
        if sfx and sfx not in requested_sfx:
            requested_sfx.append(sfx)

    if not requested_bgm and not requested_sfx:
        print(f"[ensure-sfx] No bgmPath or transitionSfxPath configured for {slug}/{video_id or '*'}.")
        return 0

    ffmpeg_bin = find_ffmpeg()
    generated_count = 0

    for bgm_rel in requested_bgm:
        if ensure_audio_file(slug, bgm_rel, "bgm", ffmpeg_bin):
            generated_count += 1

    for sfx_rel in requested_sfx:
        if ensure_audio_file(slug, sfx_rel, "transition_sfx", ffmpeg_bin):
            generated_count += 1

    print(
        f"[ensure-sfx] Done for {slug}/{video_id or '*'} (generated={generated_count})."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
