import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { useServices } from '../../../app/services';
import { loadCatalog } from '../../../store/catalogSlice';
import { isCardFresh } from '../../../store/checkoutState';
import { loadOptions } from '../../../store/optionsSlice';
import { placeOrder } from '../../../store/placeOrder';
import { Modal } from '../../../ui/organisms/Modal';
import { SummarySheet } from '../components/SummarySheet';
import { computeTotals } from '../lib/amounts';
import { brandName } from '../lib/card';
import { isDetailsComplete } from '../lib/draft';

export const SummaryContainer = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { now } = useServices();
  const checkout = useAppSelector((state) => state.checkout);
  const catalog = useAppSelector((state) => state.catalog);
  const options = useAppSelector((state) => state.options);

  // Fees are fetched fresh every time the summary opens.
  useEffect(() => {
    void dispatch(loadOptions());
  }, [dispatch]);

  // Once an order exists the shopper belongs on its page, which also stops a second payment.
  if (checkout.orderId) return <Navigate to={`/order/${checkout.orderId}`} replace />;
  if (!checkout.variantId) return <Navigate to="/" replace />;
  if (!isCardFresh(checkout.card, now()) || !isDetailsComplete(checkout)) {
    return <Navigate to="/checkout/details" replace />;
  }

  const back = () => navigate('/');
  const blocked = (message: string, onRetry?: () => void) => (
    <SummarySheet state="blocked" message={message} onRetry={onRetry} onBack={back} />
  );

  // The coffees behind this sheet load the catalog; the price shown is always the current one.
  const variant = catalog.products
    .flatMap((product) => product.variants.map((v) => ({ product, v })))
    .find(({ v }) => v.id === checkout.variantId);

  const content = (() => {
    if (!variant) {
      if (catalog.status === 'ready') {
        return blocked('That coffee is no longer available. Go back and choose another one.');
      }
      if (catalog.status === 'failed')
        return blocked(catalog.error ?? '', () => void dispatch(loadCatalog()));
      return <SummarySheet state="loading" />;
    }
    if (variant.v.stock <= 0)
      return blocked('This size is sold out. Go back and choose another coffee.');
    if (variant.v.stock < checkout.quantity) {
      return blocked(`Only ${variant.v.stock} left. Go back and choose fewer units.`);
    }
    if (options.status === 'failed')
      return blocked(options.error ?? '', () => void dispatch(loadOptions()));
    if (!options.data || options.status === 'loading' || options.status === 'idle') {
      return <SummarySheet state="loading" />;
    }

    const { customer, delivery, card } = checkout;
    return (
      <SummarySheet
        state="ready"
        coffee={variant.product.name}
        sizeGrams={variant.v.sizeGrams}
        quantity={checkout.quantity}
        totals={computeTotals(variant.v.priceInCents, checkout.quantity, options.data.fees)}
        payment={`${brandName(card!.brand)} ending ${card!.last4}`}
        recipient={delivery.recipientName.trim() || customer.name.trim()}
        address={`${delivery.address.trim()}, ${delivery.city.trim()}`}
        paying={checkout.placing === 'placing'}
        error={checkout.placing === 'failed' ? checkout.placeError : null}
        onPay={() => void dispatch(placeOrder())}
        onEdit={() => navigate('/checkout/details')}
        onBack={back}
      />
    );
  })();

  return (
    <Modal title="Order summary" variant="sheet" onClose={back}>
      {content}
    </Modal>
  );
};
