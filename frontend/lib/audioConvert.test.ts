import test from 'node:test';
import assert from 'node:assert/strict';
import { audioConfigFor } from './providers/types.ts';
import { CONVERT_MAX_SECONDS, wavDuration } from './audioConvert.ts';

/**
 * 변환기 본체(decodeAudioData)는 브라우저 것이라 여기서 못 돌린다. 대신
 * 변환할지 말지를 가르는 규칙만 잠근다 — 그 규칙이 틀리면 멀쩡한 파일을
 * 다시 풀거나(느리고 원본에서 멀어진다), 못 읽을 파일을 그대로 보낸다.
 */

test('보낼 수 있는 형식은 다시 풀지 않는다', () => {
  // audioConfigFor 가 답을 주면 toTranscribable 은 손대지 않고 넘긴다.
  for (const t of ['audio/wav', 'audio/mpeg', 'audio/webm', 'audio/ogg', 'audio/flac']) {
    assert.ok(audioConfigFor(t), `${t} 는 그대로 보낼 수 있어야 한다`);
  }
});

test('m4a·mp4 는 변환 대상이다', () => {
  // 아이폰 음성 메모와 사파리 MediaRecorder 가 내는 것. 구글 v1 이 못 읽으니
  // 변환을 거쳐야 하고, 따라서 audioConfigFor 는 null 이어야 한다.
  for (const t of ['audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/mp4;codecs=mp4a.40.2']) {
    assert.equal(audioConfigFor(t), null, `${t} 는 변환을 거쳐야 한다`);
  }
});

test('변환 상한은 사람이 읽을 수 있는 값이다', () => {
  // 화면이 "N분 이내로 나눠 주세요"라고 안내한다. 분으로 딱 떨어지지 않으면
  // 그 문장이 '39.7분'처럼 나온다.
  assert.equal(CONVERT_MAX_SECONDS % 60, 0);
  // 회기가 5~30분이라 그보다는 넉넉해야 하고, 태블릿 메모리상 한 시간은 무리다.
  assert.ok(CONVERT_MAX_SECONDS >= 30 * 60);
  assert.ok(CONVERT_MAX_SECONDS <= 45 * 60);
});

/* ------------------------------------------------------------------ *
 * WAV 머리말에서 길이 읽기
 *
 * 재생기가 답하지 않을 때 쓰는 길이다(숨은 탭에서는 loadedmetadata 가 끝내
 * 오지 않는다 — 실제로 재현했다). 여기가 틀리면 화면이 잰 적 없는 숫자를
 * 잰 값처럼 말하게 되므로, 못 읽는 경우에 null 을 주는지까지 잠근다.
 * ------------------------------------------------------------------ */

/** rate Hz · 16bit 모노 · seconds 초짜리 WAV 머리말. extra 는 끼워 넣을 조각. */
function wavHead(seconds: number, rate = 16000, extra: string | null = null): ArrayBuffer {
  const dataBytes = Math.round(seconds * rate * 2);
  const chunks: Array<[string, number]> = [['fmt ', 16]];
  if (extra) chunks.push([extra, 8]);
  chunks.push(['data', dataBytes]);

  const headBytes = 12 + chunks.reduce((n, [, size]) => n + 8 + (size === dataBytes ? 0 : size), 0);
  const buf = new ArrayBuffer(headBytes);
  const v = new DataView(buf);
  const ascii = (at: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) v.setUint8(at + i, s.charCodeAt(i));
  };

  ascii(0, 'RIFF');
  v.setUint32(4, 0, true);
  ascii(8, 'WAVE');

  let at = 12;
  for (const [kind, size] of chunks) {
    ascii(at, kind);
    v.setUint32(at + 4, size, true);
    if (kind === 'fmt ') {
      v.setUint16(at + 8, 1, true); // PCM
      v.setUint16(at + 10, 1, true); // 모노
      v.setUint32(at + 12, rate, true);
      v.setUint32(at + 16, rate * 2, true); // 초당 바이트 — 길이는 여기서 나온다
      v.setUint16(at + 20, 2, true);
      v.setUint16(at + 22, 16, true);
    }
    // data 조각은 크기만 적고 알맹이는 안 붙인다. 머리말만 읽는 함수다.
    at += 8 + (kind === 'data' ? 0 : size);
  }
  return buf;
}

test('WAV 머리말에서 길이를 읽는다', () => {
  assert.equal(wavDuration(wavHead(68)), 68);
  assert.equal(wavDuration(wavHead(1.5)), 1.5);
  assert.equal(wavDuration(wavHead(90, 44100)), 90);
});

test('fmt 와 data 사이에 다른 조각이 끼어 있어도 읽는다', () => {
  // LIST 조각을 넣고 내보내는 녹음기가 흔하다. 조각을 건너뛰지 못하면
  // 멀쩡한 파일을 '길이 모름'으로 떨어뜨린다.
  assert.equal(wavDuration(wavHead(30, 16000, 'LIST')), 30);
});

test('WAV 가 아니거나 망가졌으면 길이를 지어내지 않는다', () => {
  // 여기서 0 을 돌려주면 화면이 「0:00 녹음을 올렸어요」라고 말한다.
  assert.equal(wavDuration(new ArrayBuffer(10)), null);

  const mp3 = new ArrayBuffer(64);
  new DataView(mp3).setUint8(0, 0xff);
  assert.equal(wavDuration(mp3), null);

  // data 크기가 0 인 WAV — 소리가 없다. 0초를 잰 값으로 내주지 않는다.
  assert.equal(wavDuration(wavHead(0)), null);
});
