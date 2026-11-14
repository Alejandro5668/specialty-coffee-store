import { CardBrand } from '../../api/types';

/** Simple drawn marks that show which kind of card was recognized. */
export const CardBrandMark = ({ brand }: { brand: CardBrand }) => {
  if (brand === 'visa') {
    return (
      <svg role="img" aria-label="Visa" viewBox="0 0 48 32" width="40" height="27">
        <rect width="48" height="32" rx="6" fill="#ffffff" stroke="#5e7c66" />
        <text
          x="24"
          y="21.5"
          textAnchor="middle"
          fontSize="14"
          fontWeight="800"
          fontStyle="italic"
          fill="#1a1f71"
        >
          VISA
        </text>
      </svg>
    );
  }
  if (brand === 'mastercard') {
    return (
      <svg role="img" aria-label="Mastercard" viewBox="0 0 48 32" width="40" height="27">
        <rect width="48" height="32" rx="6" fill="#ffffff" stroke="#5e7c66" />
        <circle cx="19" cy="16" r="9" fill="#eb001b" />
        <circle cx="29" cy="16" r="9" fill="#f79e1b" fillOpacity="0.9" />
      </svg>
    );
  }
  return null;
};
