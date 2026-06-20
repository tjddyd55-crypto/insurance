import { FormButton } from '../../../components/form'
import { isActivePcNavigationPath } from '../../../components/layout/pcNavigationUtils'
import type { BoardWriterNavItem } from '../config/boardWriterNavigation'

type BoardWriterNavigationProps = {
  items: BoardWriterNavItem[]
  pathname: string
  search?: string
  variant: 'pc' | 'mobile'
  onNavigate: (path: string) => void
}

export function BoardWriterNavigation({
  items,
  pathname,
  search = '',
  variant,
  onNavigate,
}: BoardWriterNavigationProps) {
  const navClassName =
    variant === 'pc'
      ? 'board-writer-navigation board-writer-navigation--pc'
      : 'board-writer-navigation board-writer-navigation--mobile'

  return (
    <nav className={navClassName} aria-label="작성자 소식지 메뉴">
      {items.map((item) => {
        const isActive = isActivePcNavigationPath(pathname, item.path, search)
        return (
          <FormButton
            key={item.path}
            htmlType="button"
            variant={isActive ? 'primary' : 'secondary'}
            className={`board-writer-navigation__item${isActive ? ' board-writer-navigation__item--active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onNavigate(item.path)}
          >
            {item.label}
          </FormButton>
        )
      })}
    </nav>
  )
}
