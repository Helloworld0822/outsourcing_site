/* =========================================================================
 * 공유 타입 정의
 * ========================================================================= */

export type SessionUser = {
  id: string
  email: string
  name: string
  account_type: 'client' | 'freelancer'
}

export type Session = {
  token: string
  refresh_token: string
  user: SessionUser
}

export type AccountType = 'client' | 'freelancer'
