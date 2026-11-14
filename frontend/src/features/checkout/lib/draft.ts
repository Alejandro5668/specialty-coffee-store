import { CheckoutState } from '../../../store/checkoutState';
import {
  validateAddress,
  validateCity,
  validateEmail,
  validateFullName,
  validatePhone,
  validateRecipient,
} from './details';

/** Everything the form asks for is filled in and valid, and both terms were accepted. */
export const isDetailsComplete = (state: CheckoutState): boolean =>
  state.variantId !== null &&
  state.accepted.terms &&
  state.accepted.personalData &&
  [
    validateFullName(state.customer.name),
    validateEmail(state.customer.email),
    validateRecipient(state.delivery.recipientName),
    validateAddress(state.delivery.address),
    validateCity(state.delivery.city),
    validatePhone(state.delivery.phone),
  ].every((problem) => problem === null);
