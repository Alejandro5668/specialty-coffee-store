import { ProductView } from '../../../api/types';
import { formatCop } from '../../../lib/money';
import { stockLabel } from '../../../lib/stock';
import { Button } from '../../../ui/atoms/Button';
import { QuantityStepper } from '../../../ui/molecules/QuantityStepper';
import { SizePicker } from '../../../ui/molecules/SizePicker';
import './coffee-card.css';

type Props = {
  product: ProductView;
  variantId: string;
  quantity: number;
  maxQuantity: number;
  /** The first coffees load their image right away; the rest wait until they are near the screen. */
  eager: boolean;
  onVariantChange: (id: string) => void;
  onQuantityChange: (quantity: number) => void;
  onPay: () => void;
};

export const CoffeeCard = ({
  product,
  variantId,
  quantity,
  maxQuantity,
  eager,
  onVariantChange,
  onQuantityChange,
  onPay,
}: Props) => {
  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  return (
    <article className="coffee">
      <img
        className="coffee__image"
        src={product.imageUrl}
        alt=""
        width={800}
        height={600}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
      />
      <div className="coffee__body stack">
        <h2 className="coffee__name display">{product.name}</h2>
        <p>{product.description}</p>
        <SizePicker
          name={`size-${product.id}`}
          variants={product.variants}
          value={variant.id}
          onChange={onVariantChange}
        />
        <div className="coffee__row">
          <QuantityStepper value={quantity} max={maxQuantity} onChange={onQuantityChange} />
          <p className="coffee__price" data-testid="coffee-total">
            {formatCop(variant.priceInCents * quantity)}
          </p>
        </div>
        <p className="coffee__stock">{stockLabel(variant.stock)}</p>
        <p className="coffee__note">Fees and shipping are added in the summary.</p>
        <Button disabled={maxQuantity < 1} onClick={onPay}>
          Pay with credit card
        </Button>
      </div>
    </article>
  );
};
