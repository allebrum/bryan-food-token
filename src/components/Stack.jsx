// Apple Wallet–style stack: every child shares one grid cell and is pushed
// down by `step` px, so only each pass's header shows until the last one.
export default function Stack({ children, step = 68, className = '' }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : [children]
  return (
    <div className={`grid ${className}`}>
      {items.map((child, i) => (
        <div key={child.key ?? i} className="col-start-1 row-start-1" style={{ marginTop: i * step, zIndex: i }}>
          {child}
        </div>
      ))}
    </div>
  )
}
