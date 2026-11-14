import { formatCop } from '../../../lib/money';
import { Button } from '../../../ui/atoms/Button';
import { AmountLines } from '../../../ui/molecules/AmountLines';
import { Totals } from '../lib/amounts';
import './summary-sheet.css';

type Ready = {
  state: 'ready';
  coffee: string;
  sizeGrams: number;
  quantity: number;
  totals: Totals;
  payment: string;
  recipient: string;
  address: string;
  paying: boolean;
  error: string | null;
  onPay: () => void;
  onEdit: () => void;
  onBack: () => void;
};

type Props =
  | { state: 'loading' }
  | { state: 'blocked'; message: string; onRetry?: () => void; onBack: () => void }
  | Ready;

export const SummarySheet = (props: Props) => {
  if (props.state === 'loading') {
    return (
      <p role="status" aria-live="polite">
        Cargando tu pedido…
      </p>
    );
  }

  if (props.state === 'blocked') {
    return (
      <div role="alert" className="stack">
        <p>{props.message}</p>
        {props.onRetry && (
          <Button block onClick={props.onRetry}>
            Intentar de nuevo
          </Button>
        )}
        <Button block variant="quiet" onClick={props.onBack}>
          Volver a los cafés
        </Button>
      </div>
    );
  }

  const { totals } = props;
  return (
    <div className="summary stack">
      {props.error && (
        <div role="alert" className="notice notice--error stack">
          <p>{props.error}</p>
          <Button variant="quiet" onClick={props.onBack}>
            Volver a los cafés
          </Button>
        </div>
      )}

      <AmountLines
        label={`${props.coffee}, ${props.sizeGrams} g × ${props.quantity}`}
        productInCents={totals.productInCents}
        baseFeeInCents={totals.baseFeeInCents}
        deliveryFeeInCents={totals.deliveryFeeInCents}
        totalInCents={totals.totalInCents}
      />

      <section className="summary__block">
        <h3>Pago</h3>
        <p>{props.payment}</p>
      </section>
      <section className="summary__block">
        <h3>Entrega</h3>
        <p>{props.recipient}</p>
        <p>{props.address}</p>
      </section>

      <Button block disabled={props.paying} onClick={props.onPay}>
        {props.paying ? 'Pagando…' : `Pagar ${formatCop(totals.totalInCents)}`}
      </Button>
      <Button block variant="quiet" onClick={props.onEdit}>
        Editar datos
      </Button>
    </div>
  );
};
