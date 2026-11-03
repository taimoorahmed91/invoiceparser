import { LoaderCircle } from 'lucide-react';

/** 16 px spinner, stroke 2, 700 ms linear; static under reduced motion (see controls.css). */
export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return <LoaderCircle className={`spinner ${className}`} size={size} strokeWidth={2} aria-hidden="true" />;
}
