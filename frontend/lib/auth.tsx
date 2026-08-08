'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { getSupabase, isSupabaseConfigured } from './supabase';
import type { StaffRole } from './db.types';

/**
 * 로그인 상태와 소속 기관.
 *
 * RLS 는 auth.uid() 로 걸린다. 즉 로그인하지 않으면 어떤 표도 0건이다.
 * 그래서 "로그인했는가"만으로는 부족하고 "어느 기관 소속인가"까지 알아야
 * 화면이 무엇을 보여줄지 정할 수 있다.
 *
 * 네 가지 상태를 구분한다:
 *   local   서버 설정이 아예 없음 — 기기 저장만으로 도는 시연 모드
 *   loading 확인 중
 *   out     로그인 안 됨
 *   in      로그인 + 소속 확인됨
 *
 * local 을 별도로 두는 이유: 서버가 없는 것과 로그아웃된 것은 다르다.
 * 전자는 로그인하라고 하면 안 되고, 후자는 해야 한다.
 */
export type Account =
  | { status: 'local' }
  | { status: 'loading' }
  | { status: 'out' }
  | {
      status: 'in';
      userId: string;
      email: string | null;
      tenantId: string;
      tenantName: string;
      role: StaffRole;
    };

const LOCAL: Account = { status: 'local' };
const LOADING: Account = { status: 'loading' };

let snap: Account = isSupabaseConfigured ? LOADING : LOCAL;
let started = false;
const listeners = new Set<() => void>();

function emit(next: Account) {
  snap = next;
  for (const l of listeners) l();
}

/** 로그인한 사람의 소속 기관을 읽는다. 소속이 없으면 로그인해도 볼 것이 없다. */
async function loadMembership(userId: string, email: string | null) {
  const sb = getSupabase();
  if (!sb) return emit(LOCAL);

  // 조인(tenants(name)) 대신 두 번 묻는다. 로그인할 때 한 번만 도는 코드라
  // 왕복 한 번이 문제될 일이 없고, 조인은 타입에 관계 정의를 붙여야 해서
  // 스키마가 바뀔 때마다 두 곳을 맞춰야 한다.
  const { data, error } = await sb
    .from('memberships')
    .select('role, tenant_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    // 계정은 있는데 어느 기관에도 속하지 않은 경우. 로그인해도 볼 것이 없다.
    return emit({ status: 'out' });
  }

  const { data: tenant } = await sb
    .from('tenants')
    .select('name')
    .eq('id', data.tenant_id)
    .maybeSingle();

  emit({
    status: 'in',
    userId,
    email,
    tenantId: data.tenant_id,
    tenantName: tenant?.name ?? '우리 기관',
    role: data.role,
  });
}

function start() {
  const sb = getSupabase();
  if (!sb) {
    emit(LOCAL);
    return;
  }

  sb.auth.getSession().then(({ data }) => {
    const u = data.session?.user;
    if (u) void loadMembership(u.id, u.email ?? null);
    else emit({ status: 'out' });
  });

  sb.auth.onAuthStateChange((_event, session) => {
    const u = session?.user;
    if (u) void loadMembership(u.id, u.email ?? null);
    else emit({ status: 'out' });
  });
}

function subscribe(cb: () => void) {
  // 첫 구독자가 확인을 시작한다. 이펙트가 아니라 여기서 하는 이유는
  // 렌더 도중 스냅샷이 흔들리지 않게 하기 위해서다.
  if (!started) {
    started = true;
    start();
  }
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const getSnapshot = () => snap;
const getServerSnapshot = () => (isSupabaseConfigured ? LOADING : LOCAL);

export function useAccount() {
  const account = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const signIn = useCallback(async (email: string, password: string) => {
    const sb = getSupabase();
    if (!sb) return { error: '서버가 설정되지 않았습니다.' };
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (!error) return { error: null };
    // Supabase 의 원문은 영어다. 현장에서 읽을 사람을 생각해 옮긴다.
    return {
      error:
        error.message === 'Invalid login credentials'
          ? '이메일 또는 비밀번호가 맞지 않습니다.'
          : '로그인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
    };
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase()?.auth.signOut();
  }, []);

  return { account, signIn, signOut };
}

/** 화면 밖(동기 코드)에서 지금 소속 기관이 필요할 때. */
export function currentTenantId(): string | null {
  return snap.status === 'in' ? snap.tenantId : null;
}

export function currentAccount(): Account {
  return snap;
}
