import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { FspName } from '../../../fsp/enum/fsp-name.enum';
import { CustomDataAttributes } from '../../../registration/enum/custom-data-attributes';
import { StatusEnum } from '../../../shared/enum/status.enum';
import { PaPaymentDataDto } from '../../dto/pa-payment-data.dto';
import {
  FspTransactionResultDto,
  PaTransactionResultDto,
  TransactionNotificationObject,
} from '../../dto/payment-transaction-result.dto';
import { TransactionsService } from '../../transactions/transactions.service';
import { RegistrationEntity } from './../../../registration/registration.entity';
import { IntersolveActivateTokenRequestDto } from './dto/intersolve-activate-token-request.dto';
import { IntersolveCreateCustomerResponseBodyDto } from './dto/intersolve-create-customer-response.dto';
import { IntersolveCreateCustomerDto } from './dto/intersolve-create-customer.dto';
import { IntersolveCreateVirtualCardDto } from './dto/intersolve-create-virtual-card.dto';
import { IntersolveIssueTokenDto } from './dto/intersolve-issue-token.dto';
import { IntersolveLoadDto } from './dto/intersolve-load.dto';
import { IntersolveReponseErrorDto } from './dto/intersolve-response-error.dto';
import { MessageStatus as MessageStatusDto } from './dto/message-status.dto';
import { IntersolveVisaWalletStatus } from './enum/intersolve-visa-token-status.enum';
import { IntersolveVisaCustomerEntity } from './intersolve-visa-customer.entity';
import { IntersolveVisaWalletEntity } from './intersolve-visa-wallet.entity';
import { IntersolveVisaApiService } from './intersolve-visa.api.service';

@Injectable()
export class IntersolveVisaService {
  @InjectRepository(RegistrationEntity)
  public registrationRepository: Repository<RegistrationEntity>;
  @InjectRepository(IntersolveVisaCustomerEntity)
  public intersolveVisaCustomerRepo: Repository<IntersolveVisaCustomerEntity>;
  @InjectRepository(IntersolveVisaWalletEntity)
  public intersolveVisaWalletRepository: Repository<IntersolveVisaWalletEntity>;
  public constructor(
    private readonly intersolveVisaApiService: IntersolveVisaApiService,
    private readonly transactionsService: TransactionsService,
  ) {}

  public async sendPayment(
    paymentList: PaPaymentDataDto[],
    programId: number,
    paymentNr: number,
    amount: number,
  ): Promise<void> {
    const fspTransactionResult = new FspTransactionResultDto();
    fspTransactionResult.paList = [];
    fspTransactionResult.fspName = FspName.intersolveVisa;
    for (const paymentData of paymentList) {
      const calculatedAmount =
        amount * (paymentData.paymentAmountMultiplier || 1);

      const paymentRequestResultPerPa = await this.sendPaymentToPa(
        paymentData,
        paymentNr,
        calculatedAmount,
      );
      fspTransactionResult.paList.push(paymentRequestResultPerPa);
      await this.transactionsService.storeTransactionUpdateStatus(
        paymentRequestResultPerPa,
        programId,
        paymentNr,
      );
    }
  }

  private async sendPaymentToPa(
    paymentData: PaPaymentDataDto,
    paymentNr: number,
    calculatedAmount: number,
  ): Promise<PaTransactionResultDto> {
    const response = new PaTransactionResultDto();
    response.referenceId = paymentData.referenceId;
    response.date = new Date();
    response.calculatedAmount = calculatedAmount;
    response.fspName = FspName.intersolveVisa;

    let transactionNotifications = [];
    let tokenCode;

    const registration = await this.registrationRepository.findOne({
      where: { referenceId: paymentData.referenceId },
    });
    const customer = await this.getCustomerEntity(registration.id);

    // checks customer entity
    if (customer) {
      // checks wallet entity
      if (customer.visaCard) {
        // check if active
        if (customer.visaCard.status === IntersolveVisaWalletStatus.ACTIVE) {
          // continue with load balance
          tokenCode = customer.visaCard.tokenCode;
        } else if (
          // check if inactive
          customer.visaCard.status === IntersolveVisaWalletStatus.INACTIVE
        ) {
          // activate
          const activateResult = await this.activateToken(customer.visaCard);
          if (!activateResult.success) {
            response.status = StatusEnum.error;
            response.message = activateResult.message;
            return response;
          }
          tokenCode = customer.visaCard.tokenCode;
        } else {
          // other statuses should not happen within current scope. So if they do, an exception is thrown.
          response.status = StatusEnum.error;
          response.message = `Card status is neither 'active' nor 'inactive'.`;
          return response;
        }
      } else {
        // start create wallet flow
        const createWalletResult = await this.createWallet(
          registration,
          customer,
          response,
          transactionNotifications,
        );
        if (createWalletResult.response?.status === StatusEnum.error) {
          response.status = response.status;
          response.message = response.message;
          return response;
        }
        tokenCode = createWalletResult.tokenCode;
        transactionNotifications = createWalletResult.transactionNotifications;
      }
    } else {
      // create customer (this assumes a customer with 121's referenceId does not exist yet with Intersolve)
      const createCustomerResult = await this.createCustomer(registration);
      if (!createCustomerResult.data.success) {
        response.status = StatusEnum.error;
        response.message = createCustomerResult.data.errors.length
          ? `CREATE CUSTOMER ERROR: ${this.intersolveErrorToMessage(
              createCustomerResult.data.errors,
            )}`
          : `CREATE CUSTOMER ERROR: ${createCustomerResult.status} - ${createCustomerResult.statusText}`;
        return response;
      }

      // store customer
      const visaCustomer = new IntersolveVisaCustomerEntity();
      visaCustomer.registration = registration;
      visaCustomer.holderId = createCustomerResult.data.data.id;
      visaCustomer.blocked = createCustomerResult.data.data.blocked;
      await this.intersolveVisaCustomerRepo.save(visaCustomer);

      // start create wallet flow
      const createWalletResult = await this.createWallet(
        registration,
        visaCustomer,
        response,
        transactionNotifications,
      );

      if (createWalletResult.response?.status === StatusEnum.error) {
        response.status = response.status;
        response.message = response.message;
        return response;
      }
      tokenCode = createWalletResult.tokenCode;
      transactionNotifications = createWalletResult.transactionNotifications;
    }

    const loadBalanceResult = await this.loadBalanceVisaCard(
      tokenCode,
      calculatedAmount,
      registration.referenceId,
      paymentNr,
    );
    transactionNotifications.push(
      this.buildNotificationObjectLoadBalance(calculatedAmount),
    );
    return {
      referenceId: paymentData.referenceId,
      status: loadBalanceResult.status,
      message: loadBalanceResult.message,
      date: new Date(),
      calculatedAmount: calculatedAmount,
      fspName: FspName.intersolveVisa,
      notificationObjects: transactionNotifications,
    };
  }

  private async createWallet(
    registration: RegistrationEntity,
    visaCustomer: IntersolveVisaCustomerEntity,
    response: PaTransactionResultDto,
    transactionNotifications: any[],
  ): Promise<{
    response?: PaTransactionResultDto;
    tokenCode?: string;
    transactionNotifications?: any[];
  }> {
    // check for custom attribute wallet token code
    let tokenCode = await registration.getRegistrationDataValueByName(
      CustomDataAttributes.tokenCodeVisa,
    );

    if (tokenCode) {
      // PHYSICAL CARD FLOW

      // link tokenCode to customer
      const registerResult = await this.registerCustomerToWallet(
        tokenCode,
        visaCustomer,
      );
      if (!registerResult.success) {
        response.status = StatusEnum.error;
        response.message = registerResult.message;
        return { response };
      }

      // get wallet data
      const token = await this.intersolveVisaApiService.getToken(tokenCode);

      // store wallet data
      const intersolveVisaWallet = new IntersolveVisaWalletEntity();
      intersolveVisaWallet.tokenCode = token.data.data.code;
      intersolveVisaWallet.tokenBlocked = token.data.data.blocked;
      intersolveVisaWallet.status = token.data.data.status;
      intersolveVisaWallet.type = token.data.data.type;
      intersolveVisaWallet.intersolveVisaCustomer = visaCustomer;
      await this.intersolveVisaWalletRepository.save(intersolveVisaWallet);

      // activate wallet and store status
      if (intersolveVisaWallet.status === IntersolveVisaWalletStatus.INACTIVE) {
        const activateResult = await this.activateToken(intersolveVisaWallet);
        if (!activateResult.success) {
          response.status = StatusEnum.error;
          response.message = activateResult.message;
          return { response };
        }
      }

      // add message for 'created physical card'
      transactionNotifications.push(
        this.buildNotificationObjectIssuePhysicalCard(tokenCode),
      );
    } else {
      // DIGITAL CARD FLOW

      // create wallet
      const issueTokenPayload = new IntersolveIssueTokenDto();
      issueTokenPayload.holderId = visaCustomer.holderId;
      const issueTokenResult = await this.intersolveVisaApiService.issueToken(
        issueTokenPayload,
      );

      if (!issueTokenResult.data?.success) {
        response.status = StatusEnum.error;
        response.message = issueTokenResult.data?.errors?.length
          ? `ISSUE TOKEN ERROR: ${this.intersolveErrorToMessage(
              issueTokenResult.data.errors,
            )}`
          : `ISSUE TOKEN ERROR: ${issueTokenResult.status} - ${issueTokenResult.statusText}`;
        return { response };
      }

      // store wallet data
      const intersolveVisaWallet = new IntersolveVisaWalletEntity();
      intersolveVisaWallet.tokenCode = issueTokenResult.data.data.code;
      intersolveVisaWallet.tokenBlocked = issueTokenResult.data.data.blocked;
      intersolveVisaWallet.status = issueTokenResult.data.data.status;
      intersolveVisaWallet.type = issueTokenResult.data.data.type;
      intersolveVisaWallet.intersolveVisaCustomer = visaCustomer;
      await this.intersolveVisaWalletRepository.save(intersolveVisaWallet);

      // also store as custom attribute
      registration.saveData(issueTokenResult.data.data.code, {
        name: CustomDataAttributes.tokenCodeVisa,
      });
      tokenCode = issueTokenResult.data.data.code;

      // create virtual card
      const createVirtualCardPayload = new IntersolveCreateVirtualCardDto();
      createVirtualCardPayload.brand = 'VISA_CARD';
      const createVirtualCardResult =
        await this.intersolveVisaApiService.createVirtualCard(
          issueTokenResult.data.data.code,
          createVirtualCardPayload,
        );
      if (createVirtualCardResult.status !== 200) {
        response.status = StatusEnum.error;
        response.message = createVirtualCardResult.data?.errors?.length
          ? `CREATE VIRTUAL CARD ERROR: ${this.intersolveErrorToMessage(
              createVirtualCardResult.data.errors,
            )}`
          : `CREATE VIRTUAL CARD ERROR: ${createVirtualCardResult.status} - ${createVirtualCardResult.statusText}`;
        return { response };
      }

      // get and store virtual card details
      const getVirtualCardResult =
        await this.intersolveVisaApiService.getVirtualCard(tokenCode);

      if (getVirtualCardResult.status !== 200) {
        response.status = StatusEnum.error;
        response.message = getVirtualCardResult.data?.errors?.length
          ? `GET VIRTUAL CARD ERROR: ${this.intersolveErrorToMessage(
              getVirtualCardResult.data.errors,
            )}`
          : `GET VIRTUAL CARD ERROR: ${getVirtualCardResult.status} - ${getVirtualCardResult.statusText}`;
        return { response };
      }

      intersolveVisaWallet.cardUrl = getVirtualCardResult.data.carddataurl;
      intersolveVisaWallet.controlToken =
        getVirtualCardResult.data.controltoken;

      await this.intersolveVisaWalletRepository.save(intersolveVisaWallet);

      // add message for 'created digital card'
      transactionNotifications.push(
        this.buildNotificationObjectIssueDigitalCard(
          tokenCode,
          intersolveVisaWallet.cardUrl,
          intersolveVisaWallet.controlToken,
        ),
      );
    }

    return { tokenCode, transactionNotifications };
  }

  private async getCustomerEntity(
    registrationId: number,
  ): Promise<IntersolveVisaCustomerEntity> {
    return await this.intersolveVisaCustomerRepo.findOne({
      where: { registrationId: registrationId },
      relations: ['visaCard'],
    });
  }

  private buildNotificationObjectIssuePhysicalCard(
    token: string,
  ): TransactionNotificationObject {
    return {
      notificationKey: 'physicalVisaCardCreated',
      dynamicContent: [token],
    };
  }

  private buildNotificationObjectIssueDigitalCard(
    token: string,
    url: string,
    controltoken: string,
  ): TransactionNotificationObject {
    return {
      notificationKey: 'digitalVisaCardCreated',
      dynamicContent: [token, url, controltoken],
    };
  }

  private buildNotificationObjectLoadBalance(
    amount: number,
  ): TransactionNotificationObject {
    return {
      notificationKey: 'visaLoad',
      dynamicContent: [String(amount)],
    };
  }

  private async registerCustomerToWallet(
    tokenCode: string,
    customerEntity: IntersolveVisaCustomerEntity,
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    const registerHolderResult =
      await this.intersolveVisaApiService.registerHolder(
        {
          holderId: customerEntity.holderId,
        },
        tokenCode,
      );

    if (registerHolderResult.status !== 204) {
      return {
        success: false,
        message: registerHolderResult.data?.errors?.length
          ? `LINK CUSTOMER ERROR: ${this.intersolveErrorToMessage(
              registerHolderResult.data.errors,
            )}`
          : registerHolderResult.data?.code ||
            `LINK CUSTOMER ERROR: ${registerHolderResult.status} - ${registerHolderResult.statusText}`,
      };
    }

    return {
      success: true,
    };
  }

  private async createCustomer(
    registration: RegistrationEntity,
  ): Promise<IntersolveCreateCustomerResponseBodyDto> {
    const lastName = await registration.getRegistrationDataValueByName(
      CustomDataAttributes.lastName,
    );
    const createCustomerRequest: IntersolveCreateCustomerDto = {
      externalReference: registration.referenceId,
      individual: {
        lastName: lastName,
        estimatedAnnualPaymentVolumeMajorUnit: 12 * 44, // This is assuming 44 euro per month for a year for 1 child
      },
    };
    return await this.intersolveVisaApiService.createCustomer(
      createCustomerRequest,
    );
  }

  private async loadBalanceVisaCard(
    tokenCode: string,
    calculatedAmount: number,
    referenceId: string,
    payment: number,
  ): Promise<MessageStatusDto> {
    const amountInCents = calculatedAmount * 100;
    const reference = uuid();
    const saleId = `${referenceId}-${payment}`;

    const payload: IntersolveLoadDto = {
      reference: reference,
      saleId: saleId,
      quantities: [
        {
          quantity: {
            value: amountInCents,
            assetCode: process.env.INTERSOLVE_VISA_ASSET_CODE,
          },
        },
      ],
    };
    const loadBalanceResult =
      await this.intersolveVisaApiService.loadBalanceCard(tokenCode, payload);

    return {
      status: loadBalanceResult.data?.success
        ? StatusEnum.success
        : StatusEnum.error,
      message: loadBalanceResult.data?.success
        ? null
        : loadBalanceResult.data?.errors?.length
        ? `LOAD BALANCE ERROR: ${this.intersolveErrorToMessage(
            loadBalanceResult.data?.errors,
          )}`
        : `LOAD BALANCE ERROR: ${loadBalanceResult.status} - ${loadBalanceResult.statusText}`,
    };
  }

  private async activateToken(
    intersolveVisaWallet: IntersolveVisaWalletEntity,
  ): Promise<{ success: boolean; message?: string }> {
    const reference = uuid();

    const payload: IntersolveActivateTokenRequestDto = {
      reference: reference,
    };
    const activateResult = await this.intersolveVisaApiService.activateToken(
      intersolveVisaWallet.tokenCode,
      payload,
    );
    if (!activateResult.data?.success) {
      return {
        success: false,
        message: activateResult.data?.errors?.length
          ? `ACTIVATE CARD ERROR: ${this.intersolveErrorToMessage(
              activateResult.data?.errors,
            )}`
          : `ACTIVATE CARD ERROR: ${activateResult.status} - ${activateResult.statusText}`,
      };
    }

    // store activated status
    intersolveVisaWallet.status = IntersolveVisaWalletStatus.ACTIVE;
    await this.intersolveVisaWalletRepository.save(intersolveVisaWallet);

    return {
      success: true,
    };
  }

  private intersolveErrorToMessage(
    errors: IntersolveReponseErrorDto[],
  ): string {
    let allMessages = '';
    for (const [i, error] of errors.entries()) {
      const newLine = i < errors.length - 1 ? '\n' : '';
      allMessages = `${allMessages}${error.code}: ${error.description} Field: ${error.field}${newLine}`;
    }
    return allMessages;
  }
}
