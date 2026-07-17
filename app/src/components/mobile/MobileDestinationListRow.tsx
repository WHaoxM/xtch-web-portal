import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { ChevronRight } from 'lucide-react';

export type MobileDestinationListRowProps = {
  image: string;
  name: string;
  description: string;
  onClick?: () => void;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type' | 'children'>;

/** Shared Destinations/Search list row (`iosapp-route-row`) for Mobile and Admin preview. */
export const MobileDestinationListRow = forwardRef<HTMLButtonElement, MobileDestinationListRowProps>(
  function MobileDestinationListRow({ image, name, description, onClick, className, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={className ? `iosapp-route-row ${className}` : 'iosapp-route-row'}
        onClick={onClick}
        {...rest}
      >
        <img src={image} alt={name} />
        <span>
          <strong>{name}</strong>
          <small>{description}</small>
        </span>
        <ChevronRight size={18} />
      </button>
    );
  },
);
