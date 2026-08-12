'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { hasConsent } from './domain';
import { settled } from './longJob';
import { useRecorder } from './recorder';
import { loadRecording } from './recordingStore';
import { currentSession, setSessionField, useSession, type SessionState } from './store';

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
 *
 * ── 그 뒤에 두 가지 사고가 더 있었다 ─────────────────────────────
 *
 * 1) 다시 녹음하면 출처가 다른 녹음을 가리켰다.
 *
 * lib/recorder.ts 의 startRecording 은 새 녹음을 시작하면서 앞 녹음을 지운다.
 * 그런데 전사와 이야기는 그대로 남는다. 예전 코드는 "전사 줄이 있는가"만
 * 봤기 때문에, 다시 녹음한 회기에서 자동 전사가 조용히 건너뛰었고 화면도
 * 아무 말을 하지 않았다. 그 상태에서 출처('어르신 음성 0:42')를 누르면
 * 지금 기기에 있는 새 녹음의 0:42 가 재생됐다 — 어르신과 가족 앞에서
 * 근거로 들려주는 자리에서 엉뚱한 소리가 났다는 뜻이다. 출처가 거짓말하면
 * 이 제품에 믿을 것이 없다.
 *
 * 그래서 "지금 전사가 어느 녹음에서 나왔는가"(transcribedFrom)와 "지금 기기에
 * 있는 녹음은 무엇인가"를 늘 견준다. 그 판단이 originOf() 이고, 화면들은
 * useTranscribeStatus() 로 그 값을 읽어 말한다.
 *
 * 견주는 값은 언제나 recordingStore 의 savedAt 이다. 녹음기 스냅샷의
 * savedAt 은 onstop 의 다른 Date.now() 라 DB 값과 몇 밀리초 어긋난다 —
 * 그 둘을 견주면 같은 녹음도 늘 "다른 녹음"이 된다.
 *
 * 2) 폴링만 끊겨도 같은 녹음을 몇 번이고 다시 업로드했다.
 *
 * POST 가 202+작업번호를 돌려준 시점에 업로드와 외부 전사 작업 시작은 이미
 * 끝나 있다 — 요금은 그때 나간다. 그 뒤 폴링이 끊기면 예전 코드는 catch 로
 * 떨어져 아무 표도 남기지 않았고, 그래서 그 화면에 돌아올 때마다 자동 전사가
 * 처음부터 다시 돌았다. 요금이 계속 나가고 어르신 음성이 반복해서 외부로
 * 나갔다. 지금은 응답을 받은 순간(=넘어간 순간) 표를 남겨 자동 재시도에서
 * 빼고, 작업 번호가 있으면 새로 올리는 대신 그 작업의 결과만 물어본다.
 */

export type TranscribeState =
  | { kind: 'idle' }
  | { kind: 'busy'; auto: boolean; resumed: boolean }
  | { kind: 'done'; lines: number; seconds: number }
  /** sent: 녹음이 이미 서버로 넘어간 뒤의 실패인가(=요금이 나간 뒤인가) */
  | { kind: 'error'; message: string; sent: boolean };

/** 지금 기기 DB 에 저장돼 있는 녹음. */
export type DeviceRecording = { savedAt: number; seconds: number } | null;

/**
 * 지금 화면에 있는 전사가 어느 녹음에서 나왔는가.
 *
 * 출처 재생과 안내 문구가 전부 이 값에서 갈린다.
 */
export type TranscriptOrigin =
  /** 기기 녹음을 아직 못 읽었다 — 아직 아무 말도 하지 않는다 */
  | 'checking'
  /** 녹음에서 옮긴 전사가 없다 (비었거나 둘러보기용 씨앗뿐) */
  | 'none'
  /** 전사는 있는데 어느 녹음에서 나왔는지 표가 없다 */
  | 'unmarked'
  /** 전사가 나온 녹음이 이 기기에 없다 (지웠거나 보관기간이 지났다) */
  | 'gone'
  /** 지금 기기에 있는 그 녹음에서 나왔다 — 출처를 들려드릴 수 있다 */
  | 'thisRecording'
  /** 앞 녹음에서 나왔고, 기기에 있는 것은 그 뒤에 새로 한 녹음이다 */
  | 'otherRecording';

/**
 * 서버로 이미 넘어간 녹음 표.
 *
 * 회기(store)에 넣지 못하는 값이라 따로 둔다. 새로고침을 견뎌야 하는 이유가
 * 분명해서 localStorage 에 남긴다 — 이 표가 사라지면 그 녹음이 다시 업로드
 * 되고, 그건 곧 요금과 어르신 음성의 재전송이다.
 *
 * savedAt 으로만 맞춰 보므로 지난 회기의 표가 남아 있어도 새 녹음에 잘못
 * 걸리는 일은 없다 — savedAt 은 그 녹음 하나의 시각이다.
 */
type Attempt = {
  savedAt: number;
  /** 202 로 받은 작업 번호. 없으면 이어 물어볼 자리가 없다는 뜻이다. */
  jobId: string | null;
  at: number;
};

const ATTEMPT_KEY = 'toktok.transcribe.attempt.v1';

type Snap = {
  state: TranscribeState;
  attempt: Attempt | null;
  /** 기기 DB 를 한 번이라도 읽었는가. 읽기 전 판단은 'checking' 이다. */
  deviceRead: boolean;
  device: DeviceRecording;
};

const SERVER_SNAP: Snap = {
  state: { kind: 'idle' },
  attempt: null,
  deviceRead: false,
  device: null,
};

let snap: Snap = SERVER_SNAP;
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
let hydrated = false;

function patch(next: Partial<Snap>) {
  snap = { ...snap, ...next };
  for (const l of listeners) l();
}

function emit(next: TranscribeState) {
  patch({ state: next });
}

function subscribe(cb: () => void) {
  if (!hydrated) {
    attemptNow();
    // 화면이 열리자마자 "이 기기에 어떤 녹음이 있는가"를 알아야 출처를
    // 들려줄지 말지 판단할 수 있다.
    void refreshDevice();
  }
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const getSnapshot = () => snap;
const getServerSnapshot = () => SERVER_SNAP;

/* ------------------------------------------------- 서버로 넘어간 표 */

function readAttempt(): Attempt | null {
  try {
    const raw = localStorage.getItem(ATTEMPT_KEY);
    if (!raw) return null;
    const a = JSON.parse(raw) as Partial<Attempt>;
    if (typeof a?.savedAt !== 'number') return null;
    return {
      savedAt: a.savedAt,
      jobId: typeof a.jobId === 'string' ? a.jobId : null,
      at: typeof a.at === 'number' ? a.at : 0,
    };
  } catch {
    return null;
  }
}

function writeAttempt(next: Attempt | null) {
  try {
    if (next) localStorage.setItem(ATTEMPT_KEY, JSON.stringify(next));
    else localStorage.removeItem(ATTEMPT_KEY);
  } catch {
    // 저장이 막힌 기기(사파리 프라이빗 등). 표는 이 탭이 살아 있는 동안만
    // 산다 — 새로고침하면 다시 보낼 수 있게 되지만, 아무 표도 없는 것보다는
    // 낫다.
  }
  patch({ attempt: next });
}

/** 표를 처음 쓸 때 저장소에서 한 번 되살린다. */
function attemptNow(): Attempt | null {
  if (!hydrated) {
    hydrated = true;
    const a = readAttempt();
    if (a) patch({ attempt: a });
  }
  return snap.attempt;
}

/* --------------------------------------------------- 기기 녹음 읽기 */

/**
 * 막 멈춘 녹음은 잠깐 흔들린다.
 *
 * 녹음기는 멈추면서 마지막 조각을 한 번 더 저장하고(recorder.ts 의 onstop),
 * 그때 meta.savedAt 이 한 번 더 바뀐다. 그 사이에 읽으면 곧 낡을 savedAt 을
 * 손에 쥐게 된다 — 그 값을 transcribedFrom 으로 남기면, 같은 녹음인데도
 * 화면은 "다른 녹음"이라고 말하고 출처 재생을 막는다. 아무도 다시 녹음하지
 * 않았는데 다시 녹음했다고 말하는 화면은 고장보다 나쁘다.
 *
 * 마무리 표(meta.finished)가 붙기 전이고 방금 쓰인 값이면 한 번만 기다렸다
 * 다시 읽는다. 오래전에 끊긴 녹음은 기다려도 달라지지 않으므로 그대로 쓴다 —
 * 중간에 끊긴 녹음도 옮길 수 있어야 한다.
 *
 * 덤으로 하나가 더 고쳐진다. 기다리지 않으면 마지막 조각이 빠진 blob 을
 * 올릴 수 있었다 — 어르신의 마지막 한 마디가 전사에서 사라지는 자리다.
 */
const SETTLE_MS = 700;
const FRESH_MS = 5_000;

async function loadSettled() {
  const first = await loadRecording();
  if (!first || !first.recovered) return first;
  if (Date.now() - first.savedAt > FRESH_MS) return first;
  await new Promise((r) => setTimeout(r, SETTLE_MS));
  return (await loadRecording()) ?? first;
}

let reading: Promise<void> | null = null;

function noteDevice(next: DeviceRecording) {
  const same =
    snap.deviceRead &&
    next?.savedAt === snap.device?.savedAt &&
    next?.seconds === snap.device?.seconds;
  if (!same) patch({ deviceRead: true, device: next });
}

/**
 * 기기 DB 의 녹음을 다시 읽는다.
 *
 * 여러 화면·여러 출처 칩이 동시에 부르므로 도는 동안에는 같은 약속을
 * 돌려준다. 읽기 자체가 조각을 이어 붙이는 일이라 싸지 않다.
 */
async function refreshDevice(): Promise<void> {
  if (reading) return reading;
  reading = (async () => {
    try {
      const rec = await loadSettled();
      noteDevice(rec ? { savedAt: rec.savedAt, seconds: rec.seconds } : null);

      // 가리킬 녹음이 없어진 표는 지운다. 남겨 둬도 savedAt 이 달라 걸리지는
      // 않지만, 외부 작업 번호를 이유 없이 기기에 남겨 둘 이유가 없다.
      const a = snap.attempt;
      if (!busy && a && a.savedAt !== snap.device?.savedAt) writeAttempt(null);
    } finally {
      reading = null;
    }
  })();
  return reading;
}

/* --------------------------------------------------------- 읽는 쪽 */

export function useTranscribeJob(): TranscribeState {
  return useSyncExternalStore(subscribe, () => snap.state, () => SERVER_SNAP.state);
}

/** 지금 이 회기가 옮기는 일에 대해 아는 전부. 화면들은 이것만 읽는다. */
export type TranscribeStatus = {
  job: TranscribeState;
  origin: TranscriptOrigin;
  /** 지금 기기에 저장된 녹음 (DB 기준) */
  device: DeviceRecording;
  /** DB 를 한 번이라도 읽었는가 */
  deviceRead: boolean;
  /** 이 녹음은 이미 서버로 넘어갔다 — 자동 전사에서 빠진 상태다 */
  sent: boolean;
  /** 새로 올리지 않고 결과만 물어볼 수 있는 작업 번호 */
  resumableJob: string | null;
};

export function useTranscribeStatus(): TranscribeStatus {
  const st = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { s } = useSession();
  const rec = useRecorder();

  /*
   * 기기 녹음이 바뀌면 DB 를 다시 읽는다.
   *
   * 녹음기 스냅샷은 "달라졌다"는 신호로만 쓴다. 그쪽 savedAt 은 onstop 에서
   * 찍은 다른 Date.now() 라 DB 메타의 savedAt 과 몇 밀리초 다르고, 그 값을
   * transcribedFrom 과 견주면 방금 옮긴 녹음도 "다른 녹음"이 된다.
   *
   * 녹음 중에는 읽지 않는다. 조각이 계속 붙는 중이라 값이 곧 낡고, 한 시간
   * 짜리 녹음을 1초마다 이어 붙여 읽는 일이기도 하다.
   */
  useEffect(() => {
    if (rec.state === 'recording' || rec.state === 'paused') return;
    void refreshDevice();
  }, [rec.savedAt, rec.state]);

  const sent = Boolean(st.attempt && st.device && st.attempt.savedAt === st.device.savedAt);
  return {
    job: st.state,
    origin: originOf(s, st.deviceRead, st.device),
    device: st.device,
    deviceRead: st.deviceRead,
    sent,
    resumableJob: sent && st.attempt ? st.attempt.jobId : null,
  };
}

function originOf(
  s: SessionState,
  deviceRead: boolean,
  device: DeviceRecording,
): TranscriptOrigin {
  // 씨앗 전사에는 example 표가 붙어 있어 여기서 걸러진다.
  if (!s.transcript.some((t) => !t.example)) return 'none';
  if (s.transcribedFrom === null) return 'unmarked';
  if (!deviceRead) return 'checking';
  if (!device) return 'gone';
  return device.savedAt === s.transcribedFrom ? 'thisRecording' : 'otherRecording';
}

/** 지금 어르신 목소리를 옮기는 중인가. 화면을 다시 열면 이 일이 끊긴다. */
export function isTranscribing(): boolean {
  return busy;
}

/** 이 회기의 전사가 실제 녹음에서 나온 것인가 (씨앗 예시는 아니다). */
export function hasRealTranscript(): boolean {
  return currentSession().transcript.some((t) => !t.example);
}

/* --------------------------------------------------------- 일하는 쪽 */

/**
 * 옮길 수 있고, 옮겨야 하는 상태인가.
 *
 * savedAt 은 recordingStore 가 조각을 넣을 때마다 갱신하는 시각이라 녹음마다
 * 다르다. 이 값을 transcribedFrom·표와 견줘 "이 녹음은 이미 다뤘다"를
 * 판단한다.
 */
async function pending(): Promise<{ blob: Blob; seconds: number; savedAt: number } | null> {
  const s = currentSession();
  if (!hasConsent(s.elder.consents, 'recording')) return null;
  if (!hasConsent(s.elder.consents, 'externalAi')) return null;

  const rec = await loadSettled();
  noteDevice(rec ? { savedAt: rec.savedAt, seconds: rec.seconds } : null);
  if (!rec) return null;
  if (s.transcribedFrom === rec.savedAt) return null;

  // 이미 서버로 넘어간 녹음은 자동으로 다시 보내지 않는다. 결과를 못 받은
  // 것과 보내지 않은 것은 다르다 — 앞엣것은 이미 요금이 나갔다.
  const a = attemptNow();
  if (a && a.savedAt === rec.savedAt) return null;

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
    /*
     * 전사가 이미 있으면 자동으로는 덮지 않는다. 사람이 고친 것이 기계가
     * 다시 뽑은 것보다 언제나 낫고, 어르신 목소리를 다시 외부로 보내는 일은
     * 사람이 의도했을 때만 일어나야 한다.
     *
     * 예전에는 여기서 조용히 돌아섰다 — 그게 전부였다. 다시 녹음한 회기에서
     * 아무 일도 일어나지 않고 아무 말도 나오지 않아, 화면의 전사와 출처가
     * 지워진 앞 녹음의 것이라는 사실을 아무도 몰랐다. 지금도 돌아서지만,
     * 화면이 그것을 말한다(origin === 'otherRecording').
     */
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
      emit({ kind: 'error', message: '동의가 없어 옮길 수 없어요.', sent: false });
      return;
    }
    const rec = await loadSettled();
    noteDevice(rec ? { savedAt: rec.savedAt, seconds: rec.seconds } : null);
    if (!rec) {
      emit({
        kind: 'error',
        message: '이 기기에 녹음이 없어요. 인터뷰 화면에서 먼저 녹음해 주세요.',
        sent: false,
      });
      return;
    }

    // 이미 서버로 넘어간 녹음이고 작업 번호가 남아 있으면, 새로 올리는 대신
    // 그 작업의 결과만 물어본다. 같은 녹음을 두 번 보내면 요금이 두 번 나가고
    // 어르신 목소리도 두 번 나간다.
    const a = attemptNow();
    if (a && a.savedAt === rec.savedAt && a.jobId) {
      await resume(a.jobId, { seconds: rec.seconds, savedAt: rec.savedAt });
      return;
    }

    await start({ blob: rec.blob, seconds: rec.seconds, savedAt: rec.savedAt }, false);
  } finally {
    busy = false;
  }
}


/**
 * 이 녹음에 사람 목소리가 담겨 있는가.
 *
 * 무음을 보내면 구글은 요금을 받고 "말씀이 잡히지 않았어요"를 돌려준다.
 * 실제로 그 일이 일어났다 — 마이크가 안 잡힌 채 50초를 녹음하고, 두 화면을
 * 지나, 한도를 한 번 쓰고 나서야 알았다. 기기에서 먼저 들어 보면 요금도
 * 한도도 쓰지 않고 그 자리에서 말할 수 있다.
 *
 * 판정은 넉넉하게 한다. 어르신 목소리는 작고 방은 조용하다 — 조금이라도
 * 사람 소리 같은 것이 있으면 보낸다. 못 들어 보는 브라우저에서는 판단하지
 * 않고 그냥 보낸다(모르는 것을 '무음'으로 단정하지 않는다).
 */
async function soundless(blob: Blob): Promise<boolean> {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return false;
    const ctx = new Ctx();
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const ch = buf.getChannelData(0);
    // 최댓값과 실효값을 함께 본다. 툭 하는 소리 하나로 통과시키지 않고,
    // 고르게 낮기만 한 것도 무음으로 보지 않기 위해서다.
    let peak = 0;
    let sum = 0;
    for (let i = 0; i < ch.length; i += 16) {
      const v = Math.abs(ch[i]);
      if (v > peak) peak = v;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / Math.ceil(ch.length / 16));
    void ctx.close().catch(() => {});
    return peak < 0.01 && rms < 0.002;
  } catch {
    // 디코딩을 못 했다. 형식이 낯선 것일 수 있고, 그건 무음과 다르다.
    return false;
  }
}

async function start(
  job: { blob: Blob; seconds: number; savedAt: number },
  auto: boolean,
): Promise<void> {
  emit({ kind: 'busy', auto, resumed: false });

  // 보내기 전에 기기에서 먼저 들어 본다. 무음이면 요금도 한도도 쓰지 않는다.
  if (await soundless(job.blob)) {
    // 표를 남겨 자동 재시도에서 뺀다. 같은 무음을 열 때마다 다시
    // 들어 보게 두면 화면이 매번 같은 말을 반복한다. 버튼으로는
    // 다시 시도할 수 있다.
    writeAttempt({ savedAt: job.savedAt, jobId: null, at: Date.now() });
    emit({
      kind: 'error',
      sent: false,
      message:
        '이 녹음에는 소리가 담겨 있지 않아요. 마이크가 꺼져 있었거나 다른 장치가 ' +
        '잡혔을 수 있어요 — 브라우저 주소창의 마이크 표시에서 입력 장치를 확인하신 뒤 ' +
        '다시 녹음해 주세요. 지금 화면에서 복지사가 직접 받아 적으셔도 됩니다.',
    });
    return;
  }

  let first: Response;
  try {
    first = await send(job.blob);
  } catch {
    // 여기서 끊긴 것은 녹음 탓이 아니고, 음성도 아직 기기를 떠나지 않았다.
    // 표를 남기지 않아 다음에 다시 시도한다.
    emit({
      kind: 'error',
      message: '연결하지 못했어요. 녹음은 그대로 남아 있습니다.',
      sent: false,
    });
    return;
  }

  /*
   * 응답이 돌아온 순간, 녹음은 이미 업로드됐고 외부 전사 작업도 시작됐다 —
   * 요금은 여기서 나간다. 그래서 결과를 받기 전에 표부터 남긴다. 이 한 줄이
   * 없어서, 폴링만 끊긴 회기가 그 화면에 돌아올 때마다 같은 녹음을 처음부터
   * 다시 올렸다.
   */
  const jobId = first.status === 202 ? await peekJob(first) : null;
  writeAttempt({ savedAt: job.savedAt, jobId, at: Date.now() });

  await finish(first, job, jobId);
}

/**
 * 우리 함수를 거쳐 갈 수 있는 크기. 그 위는 저장소로 바로 올린다.
 *
 * Vercel 함수의 본문 한도가 4.5MB 다. 여유를 두고 3.5MB 로 잡았다 —
 * multipart 경계와 파일 이름이 본문에 얹히고, 그 얹히는 양을 우리가 정확히
 * 세고 있지 않다. 한도 언저리에서 아슬아슬하게 실패하는 것보다 조금 일찍
 * 다른 길로 가는 편이 낫다.
 */
const DIRECT_LIMIT = 3.5 * 1024 * 1024;

/**
 * 녹음을 전사 쪽으로 보낸다. 길면 저장소를 거친다.
 *
 * 예전에는 무조건 함수로 보냈고, 4MB 를 넘으면 413 이었다. 브라우저 기본
 * 비트레이트로는 4분 22초가 그 크기라, 회기 대부분이 그 벽에 부딪혔다.
 *
 * 저장소로 바로 올리는 길이 막히면(주소를 못 열거나 업로드가 실패하면) 그냥
 * 함수 쪽으로 보낸다. 짧은 녹음이면 그래도 성공하고, 길면 어차피 실패하지만
 * 실패하는 자리가 하나로 모인다 — 여기서 따로 오류 문구를 만들면 화면이
 * 아는 실패 모양이 둘로 늘어난다.
 */
async function send(blob: Blob): Promise<Response> {
  const type = blob.type || 'audio/webm';
  const form = () => {
    const f = new FormData();
    f.append('file', blob, 'interview.webm');
    return fetch('/api/transcribe', { method: 'POST', body: f });
  };

  if (blob.size <= DIRECT_LIMIT) return form();

  try {
    const opened = await fetch('/api/transcribe/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: type }),
    });
    // 형식을 못 다룬다는 답(415)은 저장소를 거쳐도 같다. 그대로 화면에
    // 넘겨야 "m4a 는 안 된다"는 말이 복지사에게 닿는다.
    if (opened.status === 415) return opened;
    if (!opened.ok) return form();

    const { uploadUrl, object } = (await opened.json()) as {
      uploadUrl?: string;
      object?: string;
    };
    if (!uploadUrl || !object) return form();

    const put = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': type },
      body: blob,
    });
    if (!put.ok) return form();

    return fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ object, contentType: type }),
    });
  } catch {
    return form();
  }
}

/** 이미 맡겨 둔 작업의 결과만 받아온다. 녹음은 다시 올리지 않는다. */
async function resume(
  jobId: string,
  job: { seconds: number; savedAt: number },
): Promise<void> {
  emit({ kind: 'busy', auto: false, resumed: true });
  let first: Response;
  try {
    first = await fetch(`/api/transcribe?job=${encodeURIComponent(jobId)}`);
  } catch {
    emit({
      kind: 'error',
      message:
        '연결하지 못했어요. 서버에 맡긴 작업은 그대로 있으니 잠시 뒤 다시 눌러 주세요.',
      sent: true,
    });
    return;
  }
  await finish(first, job, jobId);
}

/** 202 로 온 작업 번호를 몰래 들여다본다. 본문은 settled 가 다시 읽는다. */
async function peekJob(res: Response): Promise<string | null> {
  try {
    const { job } = (await res.clone().json()) as { job?: string };
    return typeof job === 'string' ? job : null;
  } catch {
    return null;
  }
}

async function finish(
  first: Response,
  job: { seconds: number; savedAt: number },
  jobId: string | null,
): Promise<void> {
  let res: Response;
  try {
    // 긴 녹음은 한 요청 안에서 안 끝난다. 서버가 작업 번호를 주면 끝날
    // 때까지 대신 물어봐 준다.
    res = await settled(first, (id) => `/api/transcribe?job=${encodeURIComponent(id)}`);
  } catch {
    // 폴링이 끊겼다. 녹음은 이미 넘어간 뒤이므로 자동 재시도에서 뺀다.
    emit({
      kind: 'error',
      sent: true,
      message: jobId
        ? '옮기는 중에 연결이 끊겼어요. 녹음은 이미 서버로 보낸 뒤라 다시 보내지 않아요 — 「이어서 결과 받기」를 누르면 그 작업의 결과만 받아옵니다.'
        : '옮기는 중에 연결이 끊겼어요. 녹음은 이미 서버로 보낸 뒤라 자동으로 다시 보내지 않아요 — 다시 보내시려면 아래 버튼을 눌러 주세요.',
    });
    return;
  }

  let json: {
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
  try {
    json = (await res.json()) as typeof json;
  } catch {
    json = {};
  }

  if (!res.ok || !json.segments) {
    // 표는 그대로 둔다. 안 되는 녹음을 화면 열 때마다 다시 보내면 한도만
    // 깎이고 어르신 목소리만 반복해서 나간다. 버튼으로는 다시 시도할 수 있다.
    emit({ kind: 'error', message: json.error ?? '전사하지 못했어요.', sent: true });
    return;
  }

  setSessionField('transcript', json.segments);
  // 이 전사가 어느 녹음에서 나왔는지는 여기서만 적는다. 실패한 시도에까지
  // 이 표를 찍던 시절에는, 옮기지도 못한 녹음이 "이 전사의 출처"가 되어
  // 출처 재생이 엉뚱한 대목을 틀었다.
  setSessionField('transcribedFrom', job.savedAt);
  writeAttempt(null);
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
  // 옮기는 몇 분 사이에 기기 녹음이 바뀌었을 수도 있다. 출처를 들려줄지 말지
  // 판단하는 값이라, 끝나고 한 번 다시 맞춘다.
  void refreshDevice();
}
