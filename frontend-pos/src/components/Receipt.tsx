import { PAYMENT_LABELS, formatDateTime, formatMoney, formatNumber } from '@market-pro/frontend-common';
import { SaleView } from '@market-pro/shared';

export function Receipt({ sale, storeName, footer }: { sale: SaleView; storeName: string; footer?: string | null }) {
  const money = (value: number) => formatMoney(value, sale.currency);
  return (
    <div className="receipt">
      <div className="center">
        <strong>{storeName}</strong>
        <div>Ticket #{sale.number}</div>
        <div>{formatDateTime(sale.createdAt)}</div>
        <div>Atendido por: {sale.sellerName}</div>
        {sale.customerName && <div>Cliente: {sale.customerName}</div>}
      </div>
      <hr />
      {sale.items?.map((item) => (
        <div key={item.id}>
          <div>{item.productName}</div>
          <div className="receipt__row">
            <span>
              {formatNumber(item.quantity)} x {money(item.unitPrice)}
              {item.discount > 0 ? ` (-${money(item.discount)})` : ''}
            </span>
            <span>{money(item.lineTotal)}</span>
          </div>
        </div>
      ))}
      <hr />
      <div className="receipt__row">
        <span>Subtotal</span>
        <span>{money(sale.subtotal)}</span>
      </div>
      <div className="receipt__row">
        <span>Impuesto</span>
        <span>{money(sale.taxTotal)}</span>
      </div>
      {sale.discountTotal > 0 && (
        <div className="receipt__row">
          <span>Descuentos</span>
          <span>-{money(sale.discountTotal)}</span>
        </div>
      )}
      <div className="receipt__row">
        <strong>TOTAL</strong>
        <strong>{money(sale.total)}</strong>
      </div>
      <div className="receipt__row">
        <span>{PAYMENT_LABELS[sale.paymentMethod]}</span>
        <span>{money(sale.amountPaid)}</span>
      </div>
      {sale.changeAmount > 0 && (
        <div className="receipt__row">
          <span>Vuelto</span>
          <span>{money(sale.changeAmount)}</span>
        </div>
      )}
      {footer && (
        <>
          <hr />
          <div className="center">{footer}</div>
        </>
      )}
    </div>
  );
}
