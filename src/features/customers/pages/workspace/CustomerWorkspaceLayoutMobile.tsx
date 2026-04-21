import type { CustomerWorkspaceLayoutPCProps } from './CustomerWorkspaceLayoutPC'

/**
 * Mobile 에서는 우측 workspace panel 을 렌더하지 않는다.
 * PC 와 동일한 props 시그니처를 받아(무시) `ResponsiveLayout<ViewProps>` 와
 * 타입 호환을 맞춘다. PC 에서 넘기는 `selectedCustomerId` 등 데이터는
 * Mobile 에서는 사용처가 없다.
 */
export default function CustomerWorkspaceLayoutMobile(
  // 파라미터는 `ResponsiveLayout<P>` 타입 호환을 위해서만 받고 본문에서 쓰지 않는다.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  props: CustomerWorkspaceLayoutPCProps,
) {
  return null
}
