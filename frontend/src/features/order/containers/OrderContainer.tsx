import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { DEFAULT_AUTO_RETURN_MS, useServices } from '../../../app/services';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle';
import { loadCatalog } from '../../../store/catalogSlice';
import { orderFinished, retryPayment } from '../../../store/checkoutSlice';
import { clearOrder } from '../../../store/orderSlice';
import { OrderStatusView } from '../components/OrderStatusView';
import { useAutoReturn } from '../hooks/useAutoReturn';
import { useOrderPolling } from '../hooks/useOrderPolling';

export const OrderContainer = () => {
  const { id = '' } = useParams();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { autoReturnMs = DEFAULT_AUTO_RETURN_MS } = useServices();
  const catalog = useAppSelector((state) => state.catalog);
  const order = useAppSelector((state) => state.order);
  const { exhausted, checkAgain } = useOrderPolling(id);
  useDocumentTitle('Tu pedido');

  // The coffee's name comes from the catalog; the amounts always come from the order itself.
  useEffect(() => {
    if (catalog.status === 'idle') void dispatch(loadCatalog());
  }, [dispatch, catalog.status]);

  // The purchase is over: forget everything.
  const backToCoffees = () => {
    dispatch(orderFinished());
    dispatch(clearOrder());
    navigate('/');
  };
  // A new attempt keeps the coffee and the details the shopper typed, and drops the spent card.
  const newAttempt = () => {
    dispatch(retryPayment());
    dispatch(clearOrder());
  };
  const anotherCard = () => {
    newAttempt();
    navigate('/checkout/details');
  };

  const view = order.forId === id ? order.view : null;
  const settled = view !== null && view.status !== 'PENDING';
  // Approved: the purchase is over. Declined or failed: the shopper may well try again, so the
  // details are kept when the page returns to the coffees by itself.
  const leaving = useAutoReturn(settled, autoReturnMs, () => {
    if (view?.status === 'APPROVED') {
      backToCoffees();
    } else {
      newAttempt();
      navigate('/');
    }
  });

  if (!view) {
    const failed = order.forId === id && order.status === 'failed';
    const missing = failed && order.errorStatus === 404;
    if (failed && (missing || exhausted)) {
      return (
        <OrderStatusView
          kind="problem"
          message={order.error ?? ''}
          canRetry={!missing}
          onRetry={checkAgain}
          onBack={backToCoffees}
        />
      );
    }
    return <OrderStatusView kind="checking" />;
  }

  const variant = catalog.products
    .flatMap((product) => product.variants.map((v) => ({ product, v })))
    .find(({ v }) => v.id === view.variantId);
  const summary = {
    coffee: variant?.product.name ?? null,
    sizeGrams: variant?.v.sizeGrams ?? null,
    quantity: view.quantity,
    amounts: view.amounts,
    reference: view.id,
  };
  const leave = { returnIn: leaving.remaining, onStay: leaving.cancel };

  switch (view.status) {
    case 'PENDING':
      return exhausted ? (
        <OrderStatusView
          kind="slow"
          summary={summary}
          onCheckAgain={checkAgain}
          onBack={backToCoffees}
        />
      ) : (
        <OrderStatusView kind="confirming" summary={summary} onBack={backToCoffees} />
      );
    case 'APPROVED':
      return (
        <OrderStatusView kind="approved" summary={summary} onBack={backToCoffees} {...leave} />
      );
    case 'DECLINED':
      return (
        <OrderStatusView
          kind="declined"
          summary={summary}
          onTryAnotherCard={anotherCard}
          onBack={backToCoffees}
          {...leave}
        />
      );
    case 'ERROR':
      return (
        <OrderStatusView
          kind="error"
          summary={summary}
          onTryAnotherCard={anotherCard}
          onBack={backToCoffees}
          {...leave}
        />
      );
  }
};
