import type { ComponentType } from 'react'
import useIsMobile from '../hooks/useIsMobile'

/**
 * PC/Mobile View 분기 공용 추상화. (AGENTS §8-2 원칙 1 단일 진입점)
 *
 * ## 기본 사용 (props 없는 View)
 *
 *   <ResponsiveLayout PC={ExamplePCView} Mobile={ExampleMobileView} />
 *
 * ## 동일 props (Container 가 View 로 props 를 주입)
 *
 *   <ResponsiveLayout<ViewProps> PC={...} Mobile={...} viewProps={{ ... }} />
 *
 * ## PC/Mobile props 분리 (플랫폼별 View props 시그니처가 다를 때)
 *
 *   <ResponsiveLayout
 *     PC={ExamplePCView}
 *     Mobile={ExampleMobileView}
 *     pcViewProps={{ ... }}
 *     mobileViewProps={{ ... }}
 *   />
 */
type ResponsiveLayoutProps<P extends object, M extends object = P> = {
  PC: ComponentType<P>
  Mobile: ComponentType<M>
  /** PC/Mobile 동일 props (기본) */
  viewProps?: P & M
  /** PC 전용 props — `mobileViewProps` 와 함께 사용 */
  pcViewProps?: P
  /** Mobile 전용 props — `pcViewProps` 와 함께 사용 */
  mobileViewProps?: M
}

export default function ResponsiveLayout<P extends object, M extends object = P>({
  PC,
  Mobile,
  viewProps,
  pcViewProps,
  mobileViewProps,
}: ResponsiveLayoutProps<P, M>) {
  const isMobile = useIsMobile()
  const Component = isMobile ? Mobile : PC
  const props = (
    pcViewProps != null && mobileViewProps != null
      ? isMobile
        ? mobileViewProps
        : pcViewProps
      : (viewProps ?? ({} as P & M))
  ) as P & M

  return <Component {...props} />
}
