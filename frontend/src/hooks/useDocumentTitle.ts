import { useEffect } from 'react';

export const useDocumentTitle = (page: string): void => {
  useEffect(() => {
    document.title = `${page} - Specialty Coffee Store`;
  }, [page]);
};
