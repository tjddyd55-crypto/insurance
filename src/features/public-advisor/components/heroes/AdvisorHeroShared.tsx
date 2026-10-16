export function AdvisorHeroTags({ tags }: { tags: string[] }) {
  if (!tags.length) return null
  return (
    <div className="pap-tags pap-tags--hero">
      {tags.map((tag) => (
        <span key={tag} className="pap-tag">#{tag}</span>
      ))}
    </div>
  )
}

export function AdvisorHeroNameLine({ displayName, titleSuffix }: { displayName: string; titleSuffix: string }) {
  return (
    <h1 className="pap-name pap-name--billboard">
      {displayName} {titleSuffix}
    </h1>
  )
}
