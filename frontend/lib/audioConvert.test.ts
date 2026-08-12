import test from 'node:test';
import assert from 'node:assert/strict';
import { audioConfigFor } from './providers/types.ts';
import { CONVERT_MAX_SECONDS } from './audioConvert.ts';

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
