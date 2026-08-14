/**
 * 招待リンク（/join/:code）の解析と組み立て。
 *
 * 招待コードの受け渡しは、これまで「6文字を伝える → 相手が登録 →
 * チームタブを探して貼り付け」の4手だった。リンク1つで済むようにする。
 *
 * ルーターは導入していない。画面遷移は state 管理で、URL で指定したい
 * 経路はここだけなので、pathname を読むだけで足りる。
 */

/** 招待コードを一時退避する sessionStorage のキー。 */
export const PENDING_INVITE_KEY = 'daily-share:pending-invite-code'

/** 招待リンクのパス接頭辞。 */
const JOIN_PREFIX = '/join/'

/**
 * 招待コードとして受け付ける形。
 * 現行は create_team が md5 から6文字（0-9a-f）を採るが、
 * 過去に Math.random().toString(36) で作られた英数字のコードも
 * 残っているため、両方を許容する。
 */
const CODE_PATTERN = /^[A-Za-z0-9]{1,32}$/

/**
 * pathname から招待コードを取り出す。該当しなければ null。
 *
 * 末尾スラッシュや大文字小文字の揺れを吸収する。コードそのものは
 * 大文字小文字を保ったまま返す（照合はサーバ側の責務）。
 */
export function parseInviteCode(pathname: string): string | null {
  if (!pathname) return null

  // 先頭の /join/ を（大文字小文字を無視して）判定する
  const lower = pathname.toLowerCase()
  if (!lower.startsWith(JOIN_PREFIX)) return null

  // 接頭辞の後ろを取り出し、末尾スラッシュとクエリ・ハッシュを落とす
  let rest = pathname.slice(JOIN_PREFIX.length)
  rest = rest.split('?')[0].split('#')[0]
  rest = rest.replace(/\/+$/, '')

  if (!rest) return null
  // さらに階層があるものは招待リンクとみなさない（/join/a/b など）
  if (rest.includes('/')) return null
  if (!CODE_PATTERN.test(rest)) return null

  return rest
}

/** 共有用の招待リンクを組み立てる。 */
export function buildInviteUrl(origin: string, code: string): string {
  const trimmedOrigin = origin.replace(/\/+$/, '')
  return `${trimmedOrigin}${JOIN_PREFIX}${code}`
}
