import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Button } from './atoms/Button';
import { CardBrandMark } from './atoms/CardBrandMark';
import { Checkbox } from './atoms/Checkbox';
import { TextField } from './atoms/TextField';
import { Modal } from './organisms/Modal';

describe('Button', () => {
  it('is a plain button by default, and fills the width when asked', () => {
    render(
      <>
        <Button>Plain</Button>
        <Button block variant="quiet">
          Wide
        </Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Plain' })).toHaveAttribute('type', 'button');
    expect(screen.getByRole('button', { name: 'Plain' })).not.toHaveClass('button--block');
    expect(screen.getByRole('button', { name: 'Wide' })).toHaveClass(
      'button--block',
      'button--quiet',
    );
  });

  it('can submit a form', () => {
    render(<Button type="submit">Send</Button>);
    expect(screen.getByRole('button', { name: 'Send' })).toHaveAttribute('type', 'submit');
  });
});

describe('TextField', () => {
  it('connects the label, the hint and the error to the input', () => {
    render(
      <TextField
        label="Email"
        name="email"
        value=""
        onChange={jest.fn()}
        hint="We send the receipt here."
        error={null}
      />,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAccessibleDescription('We send the receipt here.');
    expect(input).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('marks the input invalid and reads the error instead of the hint', () => {
    render(
      <TextField
        label="Email"
        name="email"
        value="x"
        onChange={jest.fn()}
        hint="We send the receipt here."
        error="Enter a valid email."
      />,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a valid email.');
    expect(screen.queryByText('We send the receipt here.')).not.toBeInTheDocument();
  });

  it('reports what is typed and passes the input hints to the browser', async () => {
    const Harness = () => {
      const [value, setValue] = useState('');
      return (
        <TextField
          label="Card"
          name="card"
          value={value}
          onChange={setValue}
          inputMode="numeric"
          autoComplete="cc-number"
          maxLength={5}
        />
      );
    };
    render(<Harness />);
    const input = screen.getByLabelText('Card');
    await userEvent.type(input, '12345678');
    expect(input).toHaveValue('12345');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('autocomplete', 'cc-number');
    expect(input).toHaveAttribute('spellcheck', 'false');
  });

  it('shows something next to the input, such as a card brand', () => {
    render(
      <TextField
        label="Card"
        name="card"
        value=""
        onChange={jest.fn()}
        trailing={<span>brand</span>}
      />,
    );
    expect(screen.getByText('brand')).toBeInTheDocument();
  });

  it('tells the parent when the shopper leaves the field', () => {
    const onBlur = jest.fn();
    render(<TextField label="Name" name="name" value="" onChange={jest.fn()} onBlur={onBlur} />);
    fireEvent.blur(screen.getByLabelText('Name'));
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});

describe('Checkbox', () => {
  it('toggles and keeps links in its label usable', async () => {
    const onChange = jest.fn();
    render(
      <Checkbox checked={false} onChange={onChange} error={null}>
        I accept the <a href="https://example.test/terms.pdf">terms</a>
      </Checkbox>,
    );
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('link', { name: 'terms' })).toHaveAttribute(
      'href',
      'https://example.test/terms.pdf',
    );
  });

  it('reads its error', () => {
    render(
      <Checkbox checked={false} onChange={jest.fn()} error="Accept the terms to continue.">
        Terms
      </Checkbox>,
    );
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('checkbox')).toHaveAccessibleDescription(
      'Accept the terms to continue.',
    );
  });
});

describe('CardBrandMark', () => {
  it.each([
    ['visa', 'Visa'],
    ['mastercard', 'Mastercard'],
  ] as const)('shows the %s mark with a name for screen readers', (brand, name) => {
    render(<CardBrandMark brand={brand} />);
    expect(screen.getByRole('img', { name })).toBeInTheDocument();
  });

  it('shows nothing for a card it does not recognize', () => {
    const { container } = render(<CardBrandMark brand="unknown" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Modal', () => {
  it('opens as a modal dialog named by its title', () => {
    render(
      <Modal title="Card and delivery" onClose={jest.fn()}>
        <p>Body</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Card and delivery' });
    expect(dialog).toHaveAttribute('open');
    expect(screen.getByText('Body')).toBeInTheDocument();
  });

  it('starts on its title, so a screen reader reads where it is and the phone keyboard does not pop up', () => {
    render(
      <Modal title="Card and delivery" onClose={jest.fn()}>
        <input aria-label="First field" />
      </Modal>,
    );
    expect(screen.getByRole('heading', { name: 'Card and delivery' })).toHaveFocus();
  });

  it('closes with its button and with the Escape key, without leaving the page by itself', async () => {
    const onClose = jest.fn();
    render(
      <Modal title="T" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    const cancel = new Event('cancel', { cancelable: true });
    screen.getByRole('dialog').dispatchEvent(cancel);
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(cancel.defaultPrevented).toBe(true);
  });

  it('closes the dialog when it goes away', () => {
    const { unmount } = render(
      <Modal title="T" onClose={jest.fn()}>
        <p>Body</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    unmount();
    expect(dialog).not.toHaveAttribute('open');
  });
});
