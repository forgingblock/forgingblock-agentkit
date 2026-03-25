export function isWoocommerceUrl(input: string): {
  url: string
  host: string
  isValidUrl: boolean
  isForgingBlockApi: boolean
  isForgingBlockMain: boolean
  isForgingBlockWoo: boolean
  isWooCandidate: boolean
} | null {
  const match = input.match(/https?:\/\/[^\s]+/)
  if (!match) return null

  const url = match[0]

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  const host = parsed.hostname

  const isForgingBlockApi = host === "api.forgingblock.io"
  const isForgingBlockMain = host === "forgingblock.io"
  const isForgingBlockWoo = host === "woocommerce.forgingblock.io"

  const isWooPath =
    /^\/(product|product-category|shop|cart|checkout)(\/|$)/.test(
      parsed.pathname
    )

  const isWooCandidate =
    !isForgingBlockApi &&
    !isForgingBlockMain &&
    isWooPath

  return {
    url,
    host,
    isValidUrl: true,

    isForgingBlockApi,
    isForgingBlockMain,
    isForgingBlockWoo,

    isWooCandidate
  }
}