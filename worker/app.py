"""노래에서 '몇 초에 어떤 말이 불렸는지'를 뽑는 작은 서버.

── 왜 따로 두나

가사 줄을 노래에 맞추는 일은 두 단계다.

    1) 노래를 듣고 낱말과 시각을 얻는다      ← 이 서버가 하는 일
    2) 그 낱말을 아는 가사에 겹친다          ← 앱이 한다 (frontend/lib/align.ts)

2단계는 이미 만들어 두고 테스트로 묶어 놨다. 순서를 지키는 전역 정렬이라
받아쓴 글자가 군데군데 틀려도 견딘다. 바꿔야 하는 것은 1단계다 —
노래하는 목소리는 말하는 목소리보다 알아듣기 어렵고, 반주까지 섞여 있으면
더 그렇다.

── 무엇이 다른가

    지금(구글 STT)   노래 통째로 인식. 반주가 섞인 채로 듣는다.
    여기             ① 반주에서 목소리만 떼어 내고(Demucs)
                     ② 그 목소리를 단어 단위로 인식한다(WhisperX)

②의 정렬 단계는 wav2vec2 로 소리와 글자를 직접 맞추는 방식이라, 문장을
받아쓰고 시각을 어림하는 것보다 낱말 시각이 정확하다.

── 왜 Vercel 에 못 올리나

파이썬이고, 모델이 무겁고(1GB 안팎), 첫 실행에 모델을 내려받는다. 서버리스
함수의 자리가 아니다. 기관에서 쓰는 서버 한 대에 올려 두고 앱이 부른다.

── 어르신 음성은 여기 오지 않는다

여기로 오는 것은 **만들어진 노래**뿐이다. 인터뷰 녹음은 이 서버를 거치지
않는다. 그래도 노래에는 어르신의 이야기가 담겨 있으므로, 받은 파일은 응답을
보내고 나면 지운다.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

app = FastAPI(title="toktok align worker")

# 앱과 나눠 가지는 열쇠. 없으면 아무나 이 서버에 파일을 올릴 수 있다.
TOKEN = os.environ.get("ALIGN_WORKER_TOKEN", "")
# 한국어. 노래에도 그대로 쓴다.
LANG = os.environ.get("ALIGN_LANG", "ko")
# 큰 모델일수록 낫지만 느리다. 서버 사양에 맞춰 바꾼다.
MODEL = os.environ.get("ALIGN_WHISPER_MODEL", "large-v3")
DEVICE = os.environ.get("ALIGN_DEVICE", "cpu")
COMPUTE = os.environ.get("ALIGN_COMPUTE", "int8")
# 목소리 분리를 끌 수 있게 둔다. 느린 서버에서는 이것만 꺼도 쓸 만해진다.
SEPARATE = os.environ.get("ALIGN_SEPARATE", "1") == "1"

_model = None
_align = None


def _load():
    """모델은 한 번만 읽는다. 요청마다 읽으면 매번 몇 분이 걸린다."""
    global _model, _align
    import whisperx

    if _model is None:
        _model = whisperx.load_model(MODEL, DEVICE, compute_type=COMPUTE, language=LANG)
    if _align is None:
        _align = whisperx.load_align_model(language_code=LANG, device=DEVICE)
    return _model, _align


def _vocals_only(src: Path, work: Path) -> Path:
    """반주에서 목소리만 떼어 낸다. 실패하면 원본을 그대로 쓴다.

    분리가 안 됐다고 맞추기를 통째로 포기하지 않는다 — 반주가 섞인 채로도
    어느 정도는 잡히고, 지금 앱이 그렇게 쓰고 있다.
    """
    if not SEPARATE:
        return src
    try:
        subprocess.run(
            ["python", "-m", "demucs", "--two-stems=vocals", "-o", str(work), str(src)],
            check=True,
            capture_output=True,
            timeout=600,
        )
        found = list(work.rglob("vocals.wav"))
        return found[0] if found else src
    except Exception:
        return src


@app.get("/health")
def health() -> dict:
    return {"ok": True, "model": MODEL, "device": DEVICE, "separate": SEPARATE}


@app.post("/align")
async def align(file: UploadFile = File(...), token: str = "") -> JSONResponse:
    if TOKEN and token != TOKEN:
        raise HTTPException(status_code=401, detail="토큰이 맞지 않습니다.")

    work = Path(tempfile.mkdtemp(prefix="toktok-"))
    try:
        src = work / "song.mp3"
        with src.open("wb") as f:
            shutil.copyfileobj(file.file, f)

        import whisperx

        audio_path = _vocals_only(src, work)
        model, (align_model, meta) = _load()

        audio = whisperx.load_audio(str(audio_path))
        heard = model.transcribe(audio, language=LANG, batch_size=8)
        # 여기서 소리와 글자를 직접 맞춘다. 낱말 시각이 이 단계에서 나온다.
        out = whisperx.align(
            heard["segments"], align_model, meta, audio, DEVICE, return_char_alignments=False
        )

        words = [
            {"text": w["word"], "at": float(w["start"])}
            for seg in out.get("segments", [])
            for w in seg.get("words", [])
            if w.get("word") and w.get("start") is not None
        ]
        # 가사에 겹치는 일은 앱이 한다(frontend/lib/align.ts). 여기서는 들은
        # 것만 돌려준다 — 정렬 규칙이 두 곳에 있으면 언젠가 어긋난다.
        return JSONResponse({"words": words})
    finally:
        # 노래에는 어르신 이야기가 담겨 있다. 답을 보내고 나면 남기지 않는다.
        shutil.rmtree(work, ignore_errors=True)
