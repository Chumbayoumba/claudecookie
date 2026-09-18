export interface UsageWindow {
  percent: number | null
  resets: string | null
  resetsAt?: string | number | null
}

export interface CheckResult {
  ok: boolean
  invalidReason?: string
  email?: string | null
  name?: string | null
  planLabel?: string | null
  session?: UsageWindow | null
  weekly?: UsageWindow | null
}

export type InvalidReason =
  | 'empty'
  | 'missing_session'
  | 'expired'
  | 'unreachable'
  | 'rate_limited'
  | 'captcha_failed'
  | 'convert_failed'
  | 'reauth'
  | 'no_refresh'
  | 'no_plan'
