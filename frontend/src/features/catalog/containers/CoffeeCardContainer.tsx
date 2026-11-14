import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProductView } from '../../../api/types';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { MAX_PER_ORDER } from '../../../lib/limits';
import { selectCoffee } from '../../../store/checkoutSlice';
import { CoffeeCard } from '../components/CoffeeCard';
import { initialSelection, safeQuantity } from '../selection';

export const CoffeeCardContainer = ({
  product,
  eager,
}: {
  product: ProductView;
  eager: boolean;
}) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const saved = useAppSelector((state) => state.checkout);
  const [choice, setChoice] = useState(() => initialSelection(product, saved));

  const variant = product.variants.find((v) => v.id === choice.variantId) ?? product.variants[0];
  // The stock can change while the page is open, so the quantity is capped every time it is shown.
  const quantity = safeQuantity(choice.quantity, variant.stock);
  const maxQuantity = variant.stock > 0 ? Math.min(variant.stock, MAX_PER_ORDER) : 0;

  const changeVariant = (variantId: string) => {
    const next = product.variants.find((v) => v.id === variantId);
    if (next) setChoice({ variantId, quantity: safeQuantity(quantity, next.stock) });
  };

  const pay = () => {
    dispatch(selectCoffee({ variantId: variant.id, quantity }));
    navigate('/checkout/details');
  };

  return (
    <CoffeeCard
      product={product}
      variantId={variant.id}
      quantity={quantity}
      maxQuantity={maxQuantity}
      eager={eager}
      onVariantChange={changeVariant}
      onQuantityChange={(next) => setChoice({ variantId: variant.id, quantity: next })}
      onPay={pay}
    />
  );
};
