import { VariantView } from '../../api/types';
import { formatCop } from '../../lib/money';
import './size-picker.css';

type Props = {
  name: string;
  variants: VariantView[];
  value: string;
  onChange: (id: string) => void;
};

export const SizePicker = ({ name, variants, value, onChange }: Props) => (
  <div role="radiogroup" aria-label="Tamaño" className="sizes">
    {variants.map((v) => {
      const soldOut = v.stock <= 0;
      return (
        <label
          key={v.id}
          className={`size${v.id === value && !soldOut ? ' size--on' : ''}${soldOut ? ' size--off' : ''}`}
        >
          <input
            className="visually-hidden"
            type="radio"
            name={name}
            value={v.id}
            checked={v.id === value}
            disabled={soldOut}
            onChange={() => onChange(v.id)}
          />
          <span className="size__grams">{v.sizeGrams} g</span>
          <span className="size__price">{formatCop(v.priceInCents)}</span>
          {soldOut && <span className="size__note">agotado</span>}
        </label>
      );
    })}
  </div>
);
