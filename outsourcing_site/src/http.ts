export async function readJsonResponse<T>(res: Response): Promise<T | null> {
  const text = await res.text()
  if (!text) return null

  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

/**
 * 백엔드 에러 응답을 한국어로 변환합니다.
 *
 * 백엔드에서 이미 한국어로 번역된 에러가 오지만,
 * 혹시 영어가 오 경우를 대비한 프론트엔드 레벨 번역도 포함합니다.
 */
export function formatError(error: unknown, fallback = '요청 중 오류가 발생했습니다.'): string {
  if (!error) return fallback
  if (typeof error === 'string') return translateError(error)
  if (typeof error === 'object' && !Array.isArray(error)) {
    return Object.entries(error as Record<string, unknown>)
      .map(([field, msgs]) => {
        const msgStr = Array.isArray(msgs) ? msgs.join(', ') : String(msgs)
        return translateError(`${field}: ${msgStr}`)
      })
      .join('\n')
  }
  return fallback
}

/**
 * HTTP 응답 상태 코드에 따라 한국어 에러 메시지를 반환합니다.
 */
export function formatHttpError(status: number, retryAfter?: string | null, bodyError?: unknown): string {
  switch (status) {
    case 429:
      if (retryAfter) {
        const seconds = parseInt(retryAfter, 10)
        if (!isNaN(seconds)) {
          return `요청이 너무 많습니다. ${seconds}초 후에 다시 시도해주세요.`
        }
      }
      return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'

    case 423:
      return formatError(bodyError, '계정이 잠겼습니다. 잠시 후 다시 시도해주세요.')

    case 401:
      return formatError(bodyError, '이메일 또는 비밀번호가 올바르지 않습니다.')

    case 403:
      return '접근 권한이 없습니다.'

    case 404:
      return '요청한 데이터를 찾을 수 없습니다.'

    case 422:
      return formatError(bodyError, '입력한 정보를 확인해주세요.')

    default:
      return formatError(bodyError)
  }
}

const errorTranslations: Record<string, string> = {
  // DB 제약 조건 에러
  'has already been taken': '이미 사용 중인 값입니다',
  "can't be blank": '이(가) 비어 있습니다. 입력해주세요.',
  'is invalid': '형식이 올바르지 않습니다',
  'is not a number': '숫자여야 합니다',
  'must be greater than': '보다 큰 값이어야 합니다',
  'has already been taken for this project': '이미 이 프로젝트에 지원하셨습니다',

  // 로그인/회원가입
  'invalid credentials': '이메일 또는 비밀번호가 올바르지 않습니다',
  'unauthorized': '로그인이 필요합니다',
  'forbidden': '접근 권한이 없습니다',

  // 일반 에러
  'not found': '요청한 데이터를 찾을 수 없습니다',
  'internal server error': '서버 내부 오류가 발생했습니다',
  'unhandled exception': '서버에서 오류가 발생했습니다',
  'AI 기능이 설정되지 않았습니다. OPENAI_API_KEY 환경변수를 확인해주세요.':
    'AI 기능이 설정되지 않았습니다.',
  'prompt is required': '질문을 입력해주세요.',
  'prompt must be a non-empty string': '질문을 입력해주세요.',
}

function translateError(msg: string): string {
  // 이미 한국어인 경우 그대로 반환
  if (/[가-힣]/.test(msg)) return msg

  // 영어 에러를 한국어로 번역
  for (const [en, kr] of Object.entries(errorTranslations)) {
    if (msg.toLowerCase().includes(en.toLowerCase())) {
      return kr
    }
  }

  // 번역 불가능한 경우 원본 반환
  return msg
}

/**
 * 가격 문자열을 한국어 형식으로 변환합니다.
 * "₩500,000" → "500,000원", "500000" → "500,000원", "500,000원" → "500,000원"
 */
export function formatPrice(price: string | number | null | undefined): string {
  if (price == null || price === '') return '가격 미정'
  const str = String(price).trim()
  const numeric = str.replace(/[^0-9]/g, '')
  if (!numeric) return str
  return `${Number(numeric).toLocaleString('ko-KR')}원`
}
