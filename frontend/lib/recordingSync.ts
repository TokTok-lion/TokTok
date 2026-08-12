'use client';

import { accountReady } from './auth';
import { audit } from './repo';
import { RETENTION_DAYS, loadRecording, saveUploaded } from './recordingStore';
import { getSupabase } from './supabase';
import { currentSession } from './store';

/**
 * 녹음을 기관 저장소에 두기.
 *
 * 마지막까지 기기에만 있던 자료다. 그래서 복지사 A의 태블릿이 고장 나면 어르신
 * 목소리가 어디에도 남지 않았고, 회기를 이어받은 B는 출처를 눌러도 그 대목을
 * 들을 수 없었다.
 *
 * ── 다른 자료보다 조심하는 이유
 *
 * 원음성은 이 서비스에서 가장 민감한 자료다. 곡·전사와 같은 길로 올리되 셋을
 * 더 지킨다.
 *
 *   1. 보관 30일 (lib/recordingStore 의 RETENTION_DAYS 와 같은 값이어야 한다.
 *      두 곳이 어긋나면 "지웠다"는 말이 거짓이 된다.)
 *   2. 녹음 동의를 거두면 서버 사본까지 지운다.
 *   3. 센터장 콘솔에 재생기를 만들지 않는다 — 명세의 권한 행렬이 원음성에
 *      기본 미열람을 준다.
 *
 * ── 언제 올리는가
 *
 * 녹음이 끝난 뒤에만. 녹음 중에 올리면 어르신이 말씀하시는 동안 업로드가
 * 태블릿을 붙잡는다. 실패해도 회기를 막지 않는다 — 기기에 그대로 있다.
 */

function ext(mime: string): string {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg') || mime.includes('opus')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) return 'm4a';
  if (mime.includes('flac')) return 'flac';
  return 'bin';
}

async function ctx() {
  const sb = getSupabase();
  if (!sb) return null;
  const a = await accountReady();
  const s = currentSession();
  if (a.status !== 'in' || !s.remoteParticipantId || !s.remoteSessionId) return null;
  return {
    sb,
    tenantId: a.tenantId,
    participantId: s.remoteParticipantId,
    sessionId: s.remoteSessionId,
  };
}

function warn(what: string, message: string): void {
  console.warn(`[똑똑] 녹음을 ${what} 못했어요: ${message}`);
}

/**
 * 이 회기의 녹음을 기관 저장소에 올린다.
 *
 * 이미 같은 회기의 녹음이 올라가 있으면 덮어쓴다 — 다시 녹음하면 앞엣것은
 * 기기에서도 지워지므로, 서버에만 남겨 두면 어디에도 없는 소리가 표에만
 * 남는다.
 */
export async function uploadRecording(): Promise<boolean> {
  const c = await ctx();
  if (!c) return false;

  const rec = await loadRecording();
  if (!rec) return false;

  const mime = rec.blob.type || 'audio/webm';
  const path = `${c.tenantId}/${c.participantId}/${c.sessionId}.${ext(mime)}`;

  const up = await c.sb.storage
    .from('recordings')
    .upload(path, rec.blob, { contentType: mime, upsert: true });
  if (up.error) {
    warn('올리지', up.error.message);
    return false;
  }

  const { error } = await c.sb.from('recordings').upsert(
    {
      tenant_id: c.tenantId,
      session_id: c.sessionId,
      participant_id: c.participantId,
      storage_path: path,
      seconds: rec.seconds,
      mime,
      bytes: rec.blob.size,
      /*
       * 보관기간은 올린 시각이 아니라 **녹음한 시각**에서 센다. 기기가
       * 30일을 세고 있는 그 시작점과 같아야, 두 곳이 같은 날 지워진다.
       */
      expires_at: new Date(rec.savedAt + RETENTION_DAYS * 86_400_000).toISOString(),
    },
    { onConflict: 'session_id' },
  );
  if (error) {
    warn('표에 적지', error.message);
    return false;
  }
  return true;
}

export type ServerRecording = {
  path: string;
  seconds: number | null;
  mime: string;
  bytes: number;
  /** 보관기간이 끝나는 시각 */
  expiresAt: string;
};

/** 이 회기의 녹음이 기관 저장소에 있는지 본다. 파일은 아직 받지 않는다. */
export async function findServerRecording(): Promise<ServerRecording | null> {
  const c = await ctx();
  if (!c) return null;
  const { data, error } = await c.sb
    .from('recordings')
    .select('storage_path, seconds, mime, bytes, expires_at')
    .eq('session_id', c.sessionId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    path: data.storage_path,
    seconds: data.seconds,
    mime: data.mime,
    bytes: data.bytes,
    expiresAt: data.expires_at,
  };
}

/**
 * 기관 저장소의 녹음을 이 기기로 받아 이번 회기의 녹음으로 삼는다.
 *
 * 받아 오면 전사·출처 되짚어 듣기·보관기간·철회 시 삭제가 기기 쪽에도 그대로
 * 걸린다(saveUploaded 가 그 자리에 넣는다).
 *
 * 여는 일에는 흔적을 남긴다. 원음성은 '기본 미열람'이 원칙이라, 누가 언제
 * 열었는지가 남아야 그 원칙이 말뿐이 아니게 된다.
 */
export async function fetchServerRecording(): Promise<boolean> {
  const c = await ctx();
  if (!c) return false;
  const found = await findServerRecording();
  if (!found) return false;

  const file = await c.sb.storage.from('recordings').download(found.path);
  if (file.error || !file.data) {
    warn('받지', file.error?.message ?? '파일이 없어요');
    return false;
  }

  const ok = await saveUploaded(file.data, found.seconds);
  if (!ok) return false;

  /*
   * 연 사실을 남긴다.
   *
   * 원음성은 '기본 미열람'이 원칙이다(명세의 권한 행렬). 원칙이 말뿐이 되지
   * 않으려면 누가 언제 열었는지가 남아야 한다. 이 줄이 그 흔적이다.
   */
  void audit('recording.open', `participant:${c.participantId}`, `session:${c.sessionId}`);
  return true;
}

/**
 * 이 어르신의 서버 녹음을 전부 지운다 — 녹음 동의를 거두면 반드시 불린다.
 *
 * 기기에만 있던 동안에는 이 약속이 저절로 지켜졌다. 서버에 두는 순간부터는
 * 코드가 지켜야 한다. 파일을 먼저 지우고 표를 지운다 — 순서가 바뀌면 주인
 * 없는 음성이 저장소에 남는다.
 */
export async function deleteServerRecordingsOf(participantId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const a = await accountReady();
  if (a.status !== 'in') return;

  const { data } = await sb
    .from('recordings')
    .select('storage_path')
    .eq('participant_id', participantId);
  const paths = (data ?? []).map((r) => r.storage_path).filter(Boolean);
  if (paths.length) {
    const { error } = await sb.storage.from('recordings').remove(paths);
    // 파일을 못 지웠으면 표도 남긴다. 표가 사라지면 그 파일을 다시 찾을 길이
    // 없어서, 지우지 못한 음성이 영영 저장소에 남는다.
    if (error) {
      warn('지우지', error.message);
      return;
    }
  }
  await sb.from('recordings').delete().eq('participant_id', participantId);
}

/**
 * 보관기간이 지난 녹음을 치운다.
 *
 * 기기 쪽은 녹음을 읽을 때마다 스스로 청소한다(recordingStore 의 prune). 서버는
 * 아무도 부르지 않으면 청소되지 않으므로, 앱이 녹음을 다룰 때 함께 돌린다.
 *
 * 정해진 시각에 도는 작업이 아니라는 점은 분명히 해 둔다 — 앱을 아무도 안 쓰면
 * 그날은 안 돈다. 기관이 매일 쓰는 도구라 실제로는 매일 돌지만, 이 약속을
 * 확실히 하려면 서버 쪽 스케줄러가 필요하다.
 */
export async function purgeExpiredRecordings(): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;
  const a = await accountReady();
  if (a.status !== 'in') return 0;

  const { data, error } = await sb.rpc('expired_recordings');
  if (error || !data?.length) return 0;

  const paths = data.map((r) => r.storage_path);
  const rm = await sb.storage.from('recordings').remove(paths);
  if (rm.error) {
    warn('보관기간이 지난 것을 지우지', rm.error.message);
    return 0;
  }
  await sb
    .from('recordings')
    .delete()
    .in(
      'id',
      data.map((r) => r.id),
    );
  return data.length;
}
