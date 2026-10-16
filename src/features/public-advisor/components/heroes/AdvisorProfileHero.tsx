import type { AdvisorProfileTheme } from '../../profileTheme'
import type { AdvisorProfileHeroProps } from './advisorProfileHeroTypes'
import { AdvisorProfileHeroBrand } from './AdvisorProfileHeroBrand'
import { AdvisorProfileHeroClassic } from './AdvisorProfileHeroClassic'
import { AdvisorProfileHeroPremium } from './AdvisorProfileHeroPremium'

type Props = AdvisorProfileHeroProps & { theme: AdvisorProfileTheme }

export function AdvisorProfileHero({ theme, ...props }: Props) {
  const actionBarTheme = theme
  const heroProps = { ...props, actionBarTheme }

  switch (theme) {
    case 'brand':
      return <AdvisorProfileHeroBrand {...heroProps} />
    case 'premium':
      return <AdvisorProfileHeroPremium {...heroProps} />
    default:
      return <AdvisorProfileHeroClassic {...heroProps} />
  }
}
