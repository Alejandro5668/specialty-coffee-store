export type Field =
  | 'number'
  | 'expiry'
  | 'cvc'
  | 'holder'
  | 'name'
  | 'email'
  | 'recipientName'
  | 'address'
  | 'city'
  | 'phone';

export type Values = Record<Field, string>;
export type Errors = Partial<Record<Field | 'terms' | 'personalData', string>>;
