/** Placeholder with the final layout height, so nothing jumps when data arrives. Static under reduced motion. */
export function Skeleton({ height, className = '', label = 'Loading' }: { height: number; className?: string; label?: string }) {
  return <div role="status" aria-label={label} className={`skeleton ${className}`} style={{ height }} />;
}
