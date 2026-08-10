'use client';

import { useSyncExternalStore } from 'react';
import { hasConsent } from './domain';
import { settled } from './longJob';
import { loadRecording } from './recordingStore';
import { currentSession, setSessionField } from './store';

/**
 * 녹음을 글로 옮기는 일 하나.
 *
 * 화면 밖에 둔 이유가 있다. 예전에는 전사 교정 화면의 버튼이 이 일을 통째로
 * 들고 있었다 — 상태도, 결과를 받는 자리도 그 컴포넌트 안이었다. 그래서
 * 복지사가 인터뷰를 마치고 넘어오는 길에 미리 시작해 둘 수가 없었고,
 * 30분짜리 녹음이면 전사 교정 화면에 도착해서야 버튼을 누르고 몇 분을 서서
 * 기다려야 했다.
 *
 * 더 나쁜 것은 이것이 눌러야만 일어난다는 사실이 화면 어디에도 없었다는
 * 점이다. 29초를 녹음하고 다음 화면으로 넘어간 사람이 "왜 텍스트가 그대로
 * 냐"고 물었다. 녹음과 전사 사이에 사람이 눌러야 하는 버튼이 있다는 것을
 * 아무도 말해 주지 않았다.
 *
 * 그래서 일을 모듈로 꺼냈다. 인터뷰를 마치는 순간(=녹음이 끝나는 순간)
 * 시작해 두고, 어느 화면에서든 진행 상태를 볼 수 있고, 시작한 화면이
 * 사라져도 결과는 회기에 들어간다.
 *
 * 자동으로 돌더라도 지켜야 하는 것들:
 *   · 동의 두 가지(녹음·외부 AI)가 없으면 아무것도 하지 않는다. 어르신
 *     목소리가 기기를 떠나는 일이라 이것만은 자동일 수 없다.
 *   · 같은 녹음을 두 번 보내지 않는다. 실패한 녹음도 마찬가지다 —
 *     안 되는 녹음을 화면 열 때마다 다시 보내면 한도만 깎인다.
 *   · 복지사가 손으로 고친 전사는 덮지 않는다.
 *   · 실패해도 회기를 막지 않는다. 버튼은 그대로 남아 다시 누를 수 있다.
 */

export type TranscribeState =
  | { kind: 'idle' }
  | { kind: 'busy'; auto: boolean }
  | { kind: 'done'; lines: number; seconds: number }
  | { kind: 'error'; message: string };

let state: TranscribeState = { kind: 'idle' };
const listeners = new Set<() => void>();
/**
 * 지금 일이 잡혀 있는가.
 *
 * Promise 를 들고 판단하면 늦다 — 검사와 시작 사이에 await 이 하나라도 있으면
 * 두 호출이 나란히 통과한다. 리액트가 이펙트를 두 번 실행하는 개발 모드에서
 * 그대로 재현되고, 그 결과는 어르신 목소리가 두 번 외부로 나가는 것이다.
 * 그래서 잠금은 동기 불리언으로 먼저 건다.
 */
let busy = false;

function emit(next: TranscribeState) {
  state = next;
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const snapshot = () => state;
const serverSnapshot = (): TranscribeState => ({ kind: 'idle' });

export function useTranscribeJob(): TranscribeState {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/** 지금 어르신 목소리를 옮기는 중인가. 화면을 다시 열면 이 일이 끊긴다. */
export function isTranscribing(): boolean {
  return busy;
}

/** 이 회기의 전사가 실제 녹음에서 나온 것인가 (씨앗 예시는 아니다). */
export function hasRealTranscript(): boolean {
  return currentSession().transcript.some((t) => !t.example);
}

/**
 * 옮길 수 있고, 옮겨야 하는 상태인가.
 *
 * savedAt 은 recordingStore 가 조각을 넣을 때마다 갱신하는 시각이라 녹음마다
 * 다르다. 이 값을 transcribedFrom 과 견줘 "이 녹음은 이미 다뤘다"를 판단한다.
 */
async function pending(): Promise<{ blob: Blob; seconds: number; savedAt: number } | null> {
  const s = currentSession();
  if (!hasConsent(s.elder.consents, 'recording')) return null;
  if (!hasConsent(s.elder.consents, 'externalAi')) return null;

  const rec = await loadRecording();
  if (!rec) return null;
  if (s.transcribedFrom === rec.savedAt) return null;
  return { blob: rec.blob, seconds: rec.seconds, savedAt: rec.savedAt };
}

/** 자동으로 시작해도 되는 상태면 시작한다. 아니면 조용히 아무것도 안 한다. */
export async function autoTranscribe(): Promise<void> {
  // 잠금을 먼저 건다. 아래 await 뒤에 걸면 두 번째 호출이 그 틈으로 들어온다.
  if (busy) return;
  busy = true;
  try {
    const job = await pending();
    if (!job) return;
    // 복지사가 이미 손으로 고쳐 둔 전사가 있으면 덮지 않는다. 사람이 고친 것이
    // 기계가 다시 뽑은 것보다 언제나 낫다.
    if (hasRealTranscript()) return;
    await start(job, true);
  } finally {
    busy = false;
  }
}

/** 버튼으로 시작한다. 이미 전사가 있어도 다시 옮긴다. */
export async function runTranscribe(): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    const s = currentSession();
    if (
      !hasConsent(s.elder.consents, 'recording') ||
      !hasConsent(s.elder.consents, 'externalAi')
    ) {
      emit({ kind: 'error', message: '동의가 없어 옮길 수 없어요.' });
      return;
    }
    const rec = await loadRecording();
    if (!rec) {
      emit({
        kind: 'error',
        message: '이 기기에 녹음이 없어요. 인터뷰 화면에서 먼저 녹음해 주세요.',
      });
      return;
    }
    await start({ blob: rec.blob, seconds: rec.seconds, savedAt: rec.savedAt }, false);
  } finally {
    busy = false;
  }
}

async function start(
  job: { blob: Blob; seconds: number; savedAt: number },
  auto: boolean,
): Promise<void> {
  emit({ kind: 'busy', auto });
  const form = new FormData();
  form.append('file', job.blob, 'interview.webm');
  try {
    // 긴 녹음은 한 요청 안에서 안 끝난다. 서버가 작업 번호를 주면 끝날
    // 때까지 대신 물어봐 준다.
    const res = await settled(
      await fetch('/api/transcribe', { method: 'POST', body: form }),
      (id) => `/api/transcribe?job=${encodeURIComponent(id)}`,
    );
    const json = (await res.json()) as {
      // 화자 분리가 켜지면 speaker 가 함께 온다. 타입을 좁게 두면 다음
      // 사람이 그 값이 없다고 믿고 지우거나 안 쓴다.
      segments?: {
        id: string;
        text: string;
        at: number;
        speaker?: 'elder' | 'worker';
      }[];
      error?: string;
    };
    if (!res.ok || !json.segments) {
      // 표를 남긴다. 안 되는 녹음을 화면 열 때마다 다시 보내면 한도만 깎이고
      // 어르신 목소리만 반복해서 나간다. 버튼으로는 다시 시도할 수 있다.
      setSessionField('transcribedFrom', job.savedAt);
      emit({ kind: 'error', message: json.error ?? '전사하지 못했어요.' });
      return;
    }

    setSessionField('transcript', json.segments);
    setSessionField('transcribedFrom', job.savedAt);
    /*
     * 진짜 전사가 들어왔으면 둘러보기용 예시 이야기는 물러난다.
     *
     * 전사는 통째로 교체되는데 이야기 목록은 '이야기 뽑기'를 눌러야 바뀐다.
     * 그 사이에 내 녹음에서 나온 전사와 씨앗 이야기가 한 회기에 나란히
     * 놓였고, 씨앗 쪽에도 '출처 · 어르신 음성 0:42'가 붙어 있어서 어느
     * 것이 자기 녹음인지 알 수 없었다.
     */
    const kept = currentSession().story.filter((i) => !i.example);
    if (kept.length !== currentSession().story.length) setSessionField('story', kept);

    emit({ kind: 'done', lines: json.segments.length, seconds: job.seconds });
  } catch {
    // 연결 실패는 녹음 탓이 아니다. 표를 남기지 않아 다음에 다시 시도한다.
    emit({ kind: 'error', message: '연결하지 못했어요. 녹음은 그대로 남아 있습니다.' });
  }
}
