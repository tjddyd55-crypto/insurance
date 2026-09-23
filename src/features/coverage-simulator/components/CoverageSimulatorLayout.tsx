import '../styles/coverage-simulator.css'

export function CoverageSimulatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="coverage-simulator-root" data-testid="coverage-simulator-root">
      <div className="coverage-simulator-shell">{children}</div>
    </div>
  )
}
