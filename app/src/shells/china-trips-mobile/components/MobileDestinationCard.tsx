import { forwardRef, type ButtonHTMLAttributes } from 'react';

export type MobileDestinationCardProps = {
  image: string;
  name: string;
  routeCount: number;
  onClick?: () => void;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type' | 'children'>;

/** Shared `iosapp-destination-card` markup for China Trips Mobile and Admin preview. */
export const MobileDestinationCard = forwardRef<HTMLButtonElement, MobileDestinationCardProps>(
  function MobileDestinationCard({ image, name, routeCount, onClick, className, ...rest }, ref) {
    const label = `${routeCount} route${routeCount === 1 ? '' : 's'}`;
    return (
      <button
        ref={ref}
        type="button"
        className={className ? `iosapp-destination-card ${className}` : 'iosapp-destination-card'}
        onClick={onClick}
        {...rest}
      >
        <img src={image} alt={name} loading="lazy" decoding="async" />
        <span>
          <strong>{name}</strong>
          <small>{label}</small>
        </span>
      </button>
    );
  },
);
