import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { ChevronRight } from 'lucide-react';

export type MobileRouteListCardProps = {
  image: string;
  title: string;
  meta: string;
  onClick?: () => void;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type' | 'children'>;

/** Shared `iosapp-route-row` markup for China Trips Mobile and Admin preview. */
export const MobileRouteListCard = forwardRef<HTMLButtonElement, MobileRouteListCardProps>(
  function MobileRouteListCard({ image, title, meta, onClick, className, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={className ? `iosapp-route-row ${className}` : 'iosapp-route-row'}
        onClick={onClick}
        {...rest}
      >
        <img src={image} alt={title} />
        <span>
          <strong>{title}</strong>
          <small>{meta}</small>
        </span>
        <ChevronRight size={18} />
      </button>
    );
  },
);
