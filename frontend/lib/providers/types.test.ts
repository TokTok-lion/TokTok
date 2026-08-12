import test from 'node:test';
import assert from 'node:assert/strict';
import { audioConfigFor, toSegments } from './types.ts';

/**
 * 전사에 보낼 수 있는 형식인지 가리는 규칙.
 *
 * 이 표가 조용히 틀리면 화면에는 "전사하지 못했어요"만 뜬다. 형식이 틀렸다는
 * 말은 어디에도 안 나오므로, 마이크가 나쁜 줄 알고 마이크를 바꾸게 된다.
 * 실제로 그랬다 — 사파리 녹음(AAC)을 WEBM_OPUS 라고 말하고 보내고 있었다.
 */

test('브라우저가 내는 녹음 형식이 제대로 선언된다', () => {
  assert.deepEqual(audioConfigFor('audio/webm;codecs=opus'), {
    encoding: 'WEBM_OPUS',
    sampleRateHertz: 48000,
  });
  assert.deepEqual(audioConfigFor('audio/webm'), {
    encoding: 'WEBM_OPUS',
    sampleRateHertz: 48000,
  });
  assert.deepEqual(audioConfigFor('audio/ogg;codecs=opus'), {
    encoding: 'OGG_OPUS',
    sampleRateHertz: 48000,
  });
});

test('AAC 는 못 받는다고 말한다 — 사파리·아이패드가 내는 것이다', () => {
  /*
   * 구글 v1 이 아는 인코딩에 AAC 가 없다. 그런데 사파리의 MediaRecorder 는
   * audio/mp4 를 준다. 예전에는 무엇이 오든 WEBM_OPUS 로 박아 보냈으므로,
   * 아이패드로 받은 회기는 형식을 속인 채 전사를 걸고 있었다.
   *
   * 못 받는 것을 못 받는다고 말해야 화면이 "wav·mp3 로 바꿔 주세요"까지
   * 안내할 수 있다.
   */
  assert.equal(audioConfigFor('audio/mp4'), null);
  assert.equal(audioConfigFor('audio/mp4;codecs=mp4a.40.2'), null);
  assert.equal(audioConfigFor('audio/aac'), null);
  assert.equal(audioConfigFor('audio/x-m4a'), null);
});

test('녹음기에서 가져오는 형식도 받는다', () => {
  assert.deepEqual(audioConfigFor('audio/wav'), { encoding: 'LINEAR16' });
  assert.deepEqual(audioConfigFor('audio/mpeg'), { encoding: 'MP3' });
  assert.deepEqual(audioConfigFor('audio/flac'), { encoding: 'FLAC' });
});

test('wav·flac 은 샘플레이트를 우기지 않는다', () => {
  // 머리말만 보고 구글이 알아낸다. 우리가 48000 을 넣으면 실제 파일이
  // 44100 일 때 어긋난다 — 소리가 빨라지거나 느려진 채로 인식된다.
  assert.equal(audioConfigFor('audio/wav')?.sampleRateHertz, undefined);
  assert.equal(audioConfigFor('audio/flac')?.sampleRateHertz, undefined);
});

test('모르는 형식은 짐작하지 않는다', () => {
  assert.equal(audioConfigFor(''), null);
  assert.equal(audioConfigFor('application/octet-stream'), null);
  assert.equal(audioConfigFor('video/mp4'), null);
});

test('전사 줄나누기는 서브워드를 단어로 되돌린다', () => {
  // 한국어는 단어별 시각이 조각으로 온다. ▁ 가 새 단어의 시작 표시다.
  const segs = toSegments([
    { text: '▁열', start: 0 },
    { text: '아', start: 0.1 },
    { text: '홉', start: 0.2 },
    { text: '▁그', start: 0.3 },
    { text: '▁공', start: 0.4 },
    { text: '장', start: 0.5 },
  ]);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, '열아홉 그 공장');
});
