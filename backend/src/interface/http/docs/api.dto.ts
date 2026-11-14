import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Classes used only to describe the API in Swagger; the controllers validate the real input. */

export class VariantDto {
  @ApiProperty({ example: 'huila-washed-250' }) id!: string;
  @ApiProperty({ enum: [250, 500] }) sizeGrams!: number;
  @ApiProperty({ example: 3_200_000, description: 'Price in cents of COP.' }) priceInCents!: number;
  @ApiProperty({ enum: ['COP'] }) currency!: string;
  @ApiProperty({ example: 20, description: 'Units available now.' }) stock!: number;
}

export class ProductDto {
  @ApiProperty({ example: 'huila-washed' }) id!: string;
  @ApiProperty({ example: 'Huila Washed' }) name!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ example: '/images/coffees/huila-washed.webp' }) imageUrl!: string;
  @ApiProperty({ type: [VariantDto], description: 'Sizes, smallest first.' })
  variants!: VariantDto[];
}

export class AmountsDto {
  @ApiProperty({ enum: ['COP'] }) currency!: string;
  @ApiProperty({ example: 6_400_000 }) productAmountInCents!: number;
  @ApiProperty({ example: 300_000 }) baseFeeInCents!: number;
  @ApiProperty({ example: 800_000 }) deliveryFeeInCents!: number;
  @ApiProperty({ example: 7_500_000 }) totalInCents!: number;
}

export class TransactionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'DECLINED', 'ERROR'] }) status!: string;
  @ApiProperty({ example: 'huila-washed-250' }) variantId!: string;
  @ApiProperty({ example: 2 }) quantity!: number;
  @ApiProperty({
    type: AmountsDto,
    description: 'Computed by the server, never taken from the client.',
  })
  amounts!: AmountsDto;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class CustomerDto {
  @ApiProperty({ example: 'Ana Pérez', maxLength: 100 }) name!: string;
  @ApiProperty({ example: 'ana@example.com' }) email!: string;
}

export class DeliveryDto {
  @ApiProperty({ example: 'Ana Pérez', maxLength: 200 }) recipientName!: string;
  @ApiProperty({ example: 'Calle 10 # 5-20', maxLength: 200 }) address!: string;
  @ApiProperty({ example: 'Medellín', maxLength: 200 }) city!: string;
  @ApiProperty({ example: '3001234567', description: '7 to 15 digits, optional leading +.' })
  phone!: string;
}

export class CheckoutRequestDto {
  @ApiProperty({
    example: '0b8f5c3e-6f1a-4c47-9d71-2f6a4a1d9c11',
    description:
      'Chosen by the client once per purchase. Repeating it returns the same order and never charges twice.',
  })
  idempotencyKey!: string;
  @ApiProperty({ example: 'huila-washed-250' }) variantId!: string;
  @ApiProperty({ example: 2, minimum: 1, maximum: 10 }) quantity!: number;
  @ApiProperty({ type: CustomerDto }) customer!: CustomerDto;
  @ApiProperty({ type: DeliveryDto }) delivery!: DeliveryDto;
  @ApiProperty({
    description: 'Card token from the payment provider. The card number never reaches this API.',
  })
  cardToken!: string;
  @ApiProperty({
    description: 'Acceptance token for the terms. Single use: request a new one per attempt.',
  })
  acceptanceToken!: string;
  @ApiProperty({ description: 'Acceptance token for personal data processing.' })
  personalAuthToken!: string;
}

export class ErrorDto {
  @ApiProperty({ example: 409 }) statusCode!: number;
  @ApiProperty({ example: 'OUT_OF_STOCK', description: 'Stable code for the frontend.' })
  code!: string;
  @ApiProperty({ example: 'There is not enough stock for that quantity. Choose fewer units.' })
  message!: string;
  @ApiPropertyOptional({
    type: [String],
    description: 'Fields with missing or wrongly typed data (400 only).',
  })
  fields?: string[];
}

export class WebhookReceivedDto {
  @ApiProperty({ example: true }) received!: boolean;
}
