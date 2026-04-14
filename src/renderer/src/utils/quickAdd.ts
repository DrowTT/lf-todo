export interface LeadingCategoryDraft {
  query: string
  remainder: string
  hasSeparator: boolean
}

export function parseLeadingCategoryDraft(value: string): LeadingCategoryDraft | null {
  if (!value.startsWith('#')) {
    return null
  }

  const withoutHash = value.slice(1)
  const separatorIndex = withoutHash.search(/\s/)

  if (separatorIndex === -1) {
    return {
      query: withoutHash.trim(),
      remainder: '',
      hasSeparator: false
    }
  }

  return {
    query: withoutHash.slice(0, separatorIndex).trim(),
    remainder: withoutHash.slice(separatorIndex).trimStart(),
    hasSeparator: true
  }
}

export function normalizeCategoryName(value: string): string {
  return value.trim().toLocaleLowerCase()
}
