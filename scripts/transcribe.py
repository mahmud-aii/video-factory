#!/usr/bin/env python3
"""
Standalone Faster-Whisper word-level transcription helper for VideoFactory.

Usage:
    python3 scripts/transcribe.py <audio_path> <output_json_path> [language]

Output JSON schema:
    {"words": [{"word": "...", "start": 0.0, "end": 0.3}]}
"""

import json
import os
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 3:
        print(
            "Usage: python3 scripts/transcribe.py <audio_path> <output_json_path> [language]",
            file=sys.stderr,
        )
        return 1

    audio_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    language = sys.argv[3].strip() if len(sys.argv) >= 4 else ""

    if not audio_path.is_file():
        print(f"Error: Audio file not found: {audio_path}", file=sys.stderr)
        return 1

    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        print(
            "Error: faster-whisper is not installed. Run: pip install faster-whisper",
            file=sys.stderr,
        )
        print(str(exc), file=sys.stderr)
        return 1

    model_size = os.environ.get("WHISPER_MODEL", "small")
    print(f"Loading faster-whisper model='{model_size}' (device=cpu, compute_type=int8)...")
    model = WhisperModel(model_size, device="cpu", compute_type="int8")

    transcribe_kwargs = {
        "word_timestamps": True,
        "beam_size": 5,
    }
    if language and language.lower() != "auto":
        transcribe_kwargs["language"] = language

    print(f"Transcribing: {audio_path}")
    segments, info = model.transcribe(str(audio_path), **transcribe_kwargs)

    words = []
    for segment in segments:
        if not segment.words:
            continue
        for item in segment.words:
            token = (item.word or "").strip()
            if not token:
                continue
            start = round(float(item.start), 3)
            end = round(float(item.end), 3)
            if end < start:
                end = start
            words.append(
                {
                    "word": token,
                    "start": start,
                    "end": end,
                }
            )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"words": words}
    with output_path.open("w", encoding="utf-8") as fp:
        json.dump(payload, fp, ensure_ascii=False, indent=2)
        fp.write("\n")

    detected_lang = getattr(info, "language", language or "unknown")
    print(
        f"Transcription complete: {len(words)} words (language={detected_lang}) -> {output_path}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
