import { ButtonHTMLAttributes } from 'react';
import './button.css';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'quiet' };

export const Button = ({
  variant = 'primary',
  className = '',
  type = 'button',
  ...rest
}: Props) => (
  <button type={type} className={`button button--${variant} ${className}`.trim()} {...rest} />
);
