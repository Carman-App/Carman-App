import { NavLink, Outlet, useRouteError, isRouteErrorResponse, Link } from 'react-router'
import { useAccount, useOnline } from '../data/queries.ts'

function Mark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#1F4FD8" />
      <path d="M10 7h9l5 5v13H10z" fill="#fff" />
      <path d="M19 7v5h5" fill="none" stroke="#1F4FD8" strokeWidth="1.4" />
      <path d="M13 17h8M13 20.5h8M13 24h5" stroke="#1F4FD8" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function Layout() {
  const account = useAccount()
  const online = useOnline()
  const name = account.data?.data.user.name
  return (
    <>
      <a className="visually-hidden" href="#main">
        Skip to content
      </a>
      <header className="shell-header">
        <div className="shell-bar">
          <Link to="/expense" className="brand" aria-label="Carma Reports, home">
            <Mark />
            <span>
              Carma <small>Reports</small>
            </span>
          </Link>
          <nav className="nav" aria-label="Reports">
            <NavLink to="/expense">Expense report</NavLink>
            <NavLink to="/work">Work report</NavLink>
            <NavLink to="/archive">Archive</NavLink>
          </nav>
          <div className="shell-account">
            {!online ? <span className="status-pill offline">Offline</span> : null}
            {name ? <span>{name}</span> : null}
          </div>
        </div>
      </header>
      <main id="main" className="page">
        <Outlet />
      </main>
    </>
  )
}

export function RouteError() {
  const error = useRouteError()
  const missing = isRouteErrorResponse(error) && error.status === 404
  return (
    <main className="page">
      <div className="empty">
        <p>{missing ? 'There’s no page here.' : 'Something went wrong showing this page.'}</p>
        <Link className="btn btn-primary" to="/expense">
          Go to the expense report
        </Link>
      </div>
    </main>
  )
}

export function NotFound() {
  return (
    <div className="empty">
      <p>There’s no page here.</p>
      <Link className="btn btn-primary" to="/expense">
        Go to the expense report
      </Link>
    </div>
  )
}
