import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { loadCatalog } from '../../../store/catalogSlice';
import { CatalogView } from '../components/CatalogView';
import { CoffeeCardContainer } from './CoffeeCardContainer';

const EAGER_IMAGES = 2;

export const CatalogContainer = () => {
  const dispatch = useAppDispatch();
  const { status, products, error } = useAppSelector((state) => state.catalog);

  // Always ask again, so the stock is fresh when the shopper comes back after paying.
  useEffect(() => {
    void dispatch(loadCatalog());
  }, [dispatch]);

  const coffees = products.filter((p) => p.variants.length > 0);
  return (
    <CatalogView
      status={status}
      error={error}
      hasCoffees={coffees.length > 0}
      onRetry={() => void dispatch(loadCatalog())}
    >
      {coffees.map((product, index) => (
        <CoffeeCardContainer key={product.id} product={product} eager={index < EAGER_IMAGES} />
      ))}
    </CatalogView>
  );
};
