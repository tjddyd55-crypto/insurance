function lineText(value) {
  if (value == null) return null
  const trimmed = String(value).trim()
  return trimmed || null
}

function isVisible(flag) {
  return flag !== false
}

/** @param {{ heroDisplayEyebrow?: string | null, heroDisplayTitle?: string | null, heroDisplaySubtitle?: string | null, heroDisplayEyebrowVisible?: boolean | null, heroDisplayTitleVisible?: boolean | null, heroDisplaySubtitleVisible?: boolean | null }} input */
export function resolveAdvisorHeroDisplayLines(input) {
  return {
    eyebrow: isVisible(input.heroDisplayEyebrowVisible) ? lineText(input.heroDisplayEyebrow) : null,
    title: isVisible(input.heroDisplayTitleVisible) ? lineText(input.heroDisplayTitle) : null,
    subtitle: isVisible(input.heroDisplaySubtitleVisible) ? lineText(input.heroDisplaySubtitle) : null,
  }
}
