import { useEffect } from 'react';

export const useDocumentTitle = (page: string): void => {
  useEffect(() => {
    document.title = `${page} - Tienda de café de especialidad`;
  }, [page]);
};
