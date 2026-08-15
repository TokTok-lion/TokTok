# 노래 맞추기 일꾼.
#
# 모델이 무거워서 첫 실행에 몇 분이 걸린다(내려받기). 이미지를 만들 때
# 미리 받아 두면 배포 뒤 첫 요청이 빨라지지만, 그만큼 이미지가 커진다 —
# 기관 서버 사정에 맞춰 아래 주석 한 줄을 켜면 된다.
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg git && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

# 미리 모델을 받아 두려면 아래 줄의 주석을 푼다.
# RUN python -c "import whisperx; whisperx.load_model('large-v3','cpu',compute_type='int8',language='ko')"

ENV ALIGN_DEVICE=cpu ALIGN_COMPUTE=int8 ALIGN_SEPARATE=1
EXPOSE 8080
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
