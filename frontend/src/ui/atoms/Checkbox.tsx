import { ReactNode, useId } from 'react';
import './fields.css';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error: string | null;
  children: ReactNode;
};

export const Checkbox = ({ checked, onChange, error, children }: Props) => {
  const errorId = useId();
  return (
    <div className="check">
      <label className="check__label">
        <input
          type="checkbox"
          className="check__box"
          checked={checked}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>{children}</span>
      </label>
      <div aria-live="polite">
        {error && (
          <p id={errorId} className="field__error">
            {error}
          </p>
        )}
      </div>
    </div>
  );
};
