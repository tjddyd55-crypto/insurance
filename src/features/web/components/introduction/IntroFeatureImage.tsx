type IntroFeatureImageProps = {
  src: string
  alt: string
}

export function IntroFeatureImage({ src, alt }: IntroFeatureImageProps) {
  return (
    <figure className="intro-v2-feature-image-card">
      <img className="intro-v2-feature-image" src={src} alt={alt} loading="lazy" decoding="async" />
    </figure>
  )
}
