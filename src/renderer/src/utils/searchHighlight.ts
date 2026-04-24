export interface SearchHighlightPart {
  text: string
  matched: boolean
}

export function buildSearchHighlightParts(content: string, query: string): SearchHighlightPart[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) {
    return [{ text: content, matched: false }]
  }

  const normalizedContent = content.toLocaleLowerCase()
  const parts: SearchHighlightPart[] = []
  let cursor = 0

  while (cursor < content.length) {
    const matchIndex = normalizedContent.indexOf(normalizedQuery, cursor)
    if (matchIndex === -1) {
      parts.push({
        text: content.slice(cursor),
        matched: false
      })
      break
    }

    if (matchIndex > cursor) {
      parts.push({
        text: content.slice(cursor, matchIndex),
        matched: false
      })
    }

    parts.push({
      text: content.slice(matchIndex, matchIndex + normalizedQuery.length),
      matched: true
    })
    cursor = matchIndex + normalizedQuery.length
  }

  return parts.filter((part) => part.text.length > 0)
}

export function buildSearchSnippet(content: string, query: string, radius = 36): string {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const normalizedContent = content.toLocaleLowerCase()
  if (!normalizedQuery) {
    return content
  }

  const matchIndex = normalizedContent.indexOf(normalizedQuery)
  if (matchIndex === -1) {
    return content
  }

  const matchEnd = matchIndex + normalizedQuery.length
  const start = Math.max(0, matchIndex - radius)
  const end = Math.min(content.length, matchEnd + radius)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < content.length ? '…' : ''
  const snippet = content
    .slice(start, end)
    .replace(/\s*\r?\n\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return `${prefix}${snippet}${suffix}`
}
