import { Injectable } from '@nestjs/common';
import { FspName } from '../../../fsp/enum/fsp-name.enum';
import { LookupService } from '../../../notifications/lookup/lookup.service';
import { CustomDataAttributes } from '../../../registration/enum/custom-data-attributes';
import { RegistrationEntity } from '../../../registration/registration.entity';
import { StatusEnum } from '../../../shared/enum/status.enum';
import { PaPaymentDataDto } from '../../dto/pa-payment-data.dto';
import {
  FspTransactionResultDto,
  PaTransactionResultDto,
} from '../../dto/payment-transaction-result.dto';
import { TransactionEntity } from '../../transactions/transaction.entity';
import { TransactionsService } from '../../transactions/transactions.service';
import { BobFinanceFspInstructions } from './dto/bob-finance-fsp-instructions.dto';

@Injectable()
export class BobFinanceService {
  public constructor(
    private readonly transactionsService: TransactionsService,
    private readonly lookupService: LookupService,
  ) {}

  public async sendPayment(
    paymentList: PaPaymentDataDto[],
    programId: number,
    paymentNr: number,
    amount: number,
  ): Promise<FspTransactionResultDto> {
    const fspTransactionResult = new FspTransactionResultDto();
    fspTransactionResult.paList = [];
    fspTransactionResult.fspName = FspName.bobFinance;
    for (const payment of paymentList) {
      const calculatedAmount = amount * (payment.paymentAmountMultiplier || 1);
      const transactionResult = new PaTransactionResultDto();
      transactionResult.calculatedAmount = calculatedAmount;
      transactionResult.fspName = FspName.bobFinance;
      transactionResult.referenceId = payment.referenceId;
      transactionResult.status = StatusEnum.success;
      fspTransactionResult.paList.push(transactionResult);
    }
    await this.transactionsService.storeAllTransactions(
      fspTransactionResult,
      programId,
      paymentNr,
    );

    return fspTransactionResult;
  }

  public async getFspInstructions(
    registration: RegistrationEntity,
    transaction: TransactionEntity,
  ): Promise<BobFinanceFspInstructions> {
    const bobFinanceFspInstructions = new BobFinanceFspInstructions();

    bobFinanceFspInstructions['Receiver First name'] =
      await registration.getRegistrationDataValueByName(
        CustomDataAttributes.nameFirst,
      );
    bobFinanceFspInstructions['Receiver last name'] =
      await registration.getRegistrationDataValueByName(
        CustomDataAttributes.nameLast,
      );
    bobFinanceFspInstructions['Mobile Number'] = await this.formatToLocalNumber(
      await registration.getRegistrationDataValueByName(
        CustomDataAttributes.nameLast,
      ),
    );
    bobFinanceFspInstructions.Email = null;
    bobFinanceFspInstructions.Amount = transaction.amount;
    bobFinanceFspInstructions.Currency = 'USD';
    bobFinanceFspInstructions['Expiry Date'] = null;

    return bobFinanceFspInstructions;
  }

  private async formatToLocalNumber(phonenumber: string): Promise<number> {
    return await this.lookupService.getLocalNumber(`+${phonenumber}`);
  }
}
