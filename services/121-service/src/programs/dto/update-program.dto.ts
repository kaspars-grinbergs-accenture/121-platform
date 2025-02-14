import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class UpdateProgramDto {
  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  public readonly published: boolean;

  @ApiProperty()
  @IsOptional()
  @IsString()
  public readonly location: string;

  @ApiProperty({ example: { en: 'title' } })
  @IsOptional()
  public readonly titlePortal: JSON;

  @ApiProperty({ example: { en: 'title' } })
  @IsOptional()
  public readonly titlePaApp: JSON;

  @ApiProperty()
  @IsOptional()
  @IsString()
  public readonly ngo: string;

  @ApiProperty({ example: '2020-05-23T18:25:43.511Z' })
  @IsOptional()
  @IsDateString()
  public readonly startDate: Date;

  @ApiProperty({ example: '2020-05-23T18:25:43.511Z' })
  @IsOptional()
  @IsDateString()
  public readonly endDate: Date;

  @ApiProperty({ example: 'MWK' })
  @IsOptional()
  @IsString()
  @Length(3, 3, {
    message: 'Currency should be a 3 letter abbreviation',
  })
  public readonly currency: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  public readonly distributionFrequency: string;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  public readonly distributionDuration: number;

  @ApiProperty({ example: 500 })
  @IsOptional()
  public readonly fixedTransferValue: number;

  @ApiProperty({ example: '0 + 1 * nrOfHouseHoldMembers' })
  @IsOptional()
  @IsString()
  public readonly paymentAmountMultiplierFormula: string;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  public readonly targetNrRegistrations: number;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  public readonly validation: boolean;

  @ApiProperty({
    example: { en: 'Identity card;Health Insurance;Proof of children' },
  })
  @IsOptional()
  public readonly meetingDocuments: JSON;

  @ApiProperty({
    example: {
      en: {
        included: 'You have been included in this program.',
        rejected:
          'Unfortunately we have to inform you that you will not receive any (more) payments for this program. If you have questions, please contact us.',
      },
      nl: {
        included: 'Je zit wel in het programma',
        rejected: 'Je zit niet in het programma',
      },
    },
  })
  @IsOptional()
  public readonly notifications: JSON;

  @ApiProperty({ example: '+000 000 00 00' })
  @IsString()
  @IsOptional()
  public readonly phoneNumberPlaceholder: string;

  @ApiProperty({ example: { en: 'description' } })
  @IsOptional()
  public readonly description: JSON;
}
