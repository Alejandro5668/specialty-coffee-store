import { ReactNode, useId } from 'react';
import './fields.css';

type Props = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string | null;
  hint?: string;
  type?: 'text' | 'email' | 'tel';
  inputMode?: 'text' | 'numeric' | 'email' | 'tel';
  autoComplete?: string;
  maxLength?: number;
  trailing?: ReactNode;
};

export const TextField = ({
  label,
  name,
  value,
  onChange,
  onBlur,
  error,
  hint,
  type = 'text',
  inputMode,
  autoComplete,
  maxLength,
  trailing,
}: Props) => {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="field__control">
        <input
          id={id}
          name={name}
          type={type}
          className="field__input"
          value={value}
          inputMode={inputMode}
          autoComplete={autoComplete}
          maxLength={maxLength}
          spellCheck={false}
          autoCapitalize="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
        {trailing && <span className="field__trailing">{trailing}</span>}
      </div>
      {hint && !error && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      {/* The live region always exists, so a screen reader announces an error the moment it appears. */}
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
