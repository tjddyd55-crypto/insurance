type IntroFeatureImageProps = {
  src: string
  alt: string
  srcSet?: string
}

export function IntroFeatureImage({ src, alt, srcSet }: IntroFeatureImageProps) {
  return (
    <figure className="intro-v2-feature-image-card">
      <img
        className="intro-v2-feature-image"
        src={src}
        srcSet={srcSet}
        alt={alt}
        loading="lazy"
        decoding="async"
      />
    </figure>
  )
}
