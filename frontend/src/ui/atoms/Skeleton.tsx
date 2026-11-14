import './skeleton.css';

/** A still placeholder. It does not animate: movement is reserved for what the shopper does. */
export const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`skeleton ${className}`.trim()} aria-hidden="true" />
);
