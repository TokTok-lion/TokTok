/**
 * Vendor seams for the three AI capabilities the product depends on.
 *
 * This build ships local implementations: nothing leaves the device. The
 * interfaces exist so a real backend can be dropped in without touching a
 * single screen, and so the obligations the spec attaches to each vendor call
 * are expressed in types rather than left to memory:
 *
 *   NFR-SEC-002  provider keys live on a server, never in the browser bundle
 *   NFR-PRI-006  the caller must know which vendor and which region processes
 *   NFR-AI-002   generated text carries the source ids it was derived from
 *   NFR-AI-003   only VERIFIED story items may ever be passed in
 *   NFR-AI-008   model + prompt version is recorded with every result
 *   NFR-OPS-001  every job takes an idempotency key
 */

import { lyricInputs, type LyricSection, type StoryItem } from './domain';

/** Where a vendor physically processes the data — shown on the consent screen. */
export type VendorInfo = {
  name: string;
  /** ISO 3166 region code, e.g. 'KR'. 국외 이전은 별도 고지 대상. */
  region: string;
  purpose: string;
};

export type JobMeta = {
  /** 재전송이 결과를 중복 생성하지 않도록 하는 키 (NFR-OPS-001) */
  idempotencyKey: string;
  vendor: VendorInfo;
  /** 결과 재현을 위한 모델·프롬프트 버전 (NFR-AI-008) */
  modelVersion: string;
  promptVersion: string;
};

export type JobResult<T> =
  | { ok: true; value: T; meta: JobMeta }
  | { ok: false; code: 'consent' | 'vendor' | 'timeout' | 'unsafe'; message: string };

/* ------------------------------------------------------------- transcription */

export type TranscriptSegment = { id: string; text: string; at: number; confident: boolean };

export interface TranscriptionService {
  vendor: VendorInfo;
  transcribe(audio: Blob, opts: { hints: string[]; idempotencyKey: string }): Promise<JobResult<TranscriptSegment[]>>;
}

/* -------------------------------------------------------------- lyric drafting */

export interface LyricService {
  vendor: VendorInfo;
  /**
   * Only accepts already-verified story items. Callers must pass the result of
   * `lyricInputs()`; `draftLyrics` re-checks rather than trusting them, because
   * this is the last gate before text becomes a song (NFR-AI-003).
   */
  draft(items: StoryItem[], opts: { avoidTopics: string[]; idempotencyKey: string }): Promise<JobResult<LyricSection[]>>;
}

/* ------------------------------------------------------------------- music */

export interface MusicService {
  vendor: VendorInfo;
  /** 비동기 작업. 진행률·취소·재시도가 있어야 한다 (NFR-PERF-004). */
  start(req: { lyrics: LyricSection[]; styleId: string; idempotencyKey: string }): Promise<JobResult<{ jobId: string }>>;
  poll(jobId: string): Promise<JobResult<{ percent: number; audioUrl?: string }>>;
  cancel(jobId: string): Promise<void>;
}

/* ------------------------------------------------------ local implementations */

const LOCAL: VendorInfo = {
  name: '기기 내 처리',
  region: 'KR',
  purpose: '이 기기 안에서만 처리하며 외부로 전송하지 않습니다.',
};

function meta(idempotencyKey: string): JobMeta {
  return {
    idempotencyKey,
    vendor: LOCAL,
    modelVersion: 'local-0',
    promptVersion: 'local-0',
  };
}

/**
 * The guard that every real LyricService implementation must also apply.
 * Exported so a server implementation can reuse it verbatim.
 */
export function assertOnlyVerified(items: StoryItem[]): StoryItem[] {
  const allowed = lyricInputs(items);
  const rejected = items.filter((i) => !allowed.includes(i));
  if (rejected.length) {
    throw new Error(
      `확인되지 않았거나 출처가 없는 이야기 ${rejected.length}건이 가사 생성 입력에 포함됐습니다: ` +
        rejected.map((r) => r.id).join(', '),
    );
  }
  return allowed;
}

export const localLyricService: LyricService = {
  vendor: LOCAL,
  async draft(items, { idempotencyKey }) {
    try {
      assertOnlyVerified(items);
    } catch (e) {
      return { ok: false, code: 'unsafe', message: (e as Error).message };
    }
    // The shipped build shows the reviewed draft from lib/seed rather than
    // inventing lines locally — an on-device model is out of scope here.
    const { SEED_LYRICS } = await import('./seed');
    return { ok: true, value: SEED_LYRICS, meta: meta(idempotencyKey) };
  },
};
