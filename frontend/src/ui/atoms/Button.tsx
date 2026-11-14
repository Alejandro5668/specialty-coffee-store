import { ButtonHTMLAttributes } from 'react';
import './button.css';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'quiet';
  /** Fills the width, so the main action is easy to hit on a phone. */
  block?: boolean;
};

export const Button = ({
  variant = 'primary',
  block = false,
  className = '',
  type = 'button',
  ...rest
}: Props) => (
  <button
    type={type}
    className={`button button--${variant}${block ? ' button--block' : ''} ${className}`.trim()}
    {...rest}
  />
);
