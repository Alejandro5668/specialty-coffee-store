import { ReactNode, useEffect, useId, useRef } from 'react';
import { Button } from '../atoms/Button';
import './modal.css';

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** A dialog fills the screen on a phone and floats on a wide one. A sheet rises from the bottom. */
  variant?: 'dialog' | 'sheet';
};

/** The browser's own modal dialog: it traps the focus, makes the page behind inert and handles Escape. */
export const Modal = ({ title, onClose, children, variant = 'dialog' }: Props) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    // Not the first control: the heading tells where the shopper is without opening the keyboard.
    titleRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={`modal modal--${variant}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // The route decides what closing means; the dialog must not close by itself.
        event.preventDefault();
        onClose();
      }}
    >
      <div className="modal__header">
        <h2 id={titleId} ref={titleRef} tabIndex={-1} className="display modal__title">
          {title}
        </h2>
        <Button variant="quiet" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="modal__body">{children}</div>
    </dialog>
  );
};
