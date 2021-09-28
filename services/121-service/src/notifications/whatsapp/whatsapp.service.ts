import { RegistrationEntity } from './../../registration/registration.entity';
import { EXTERNAL_API } from '../../config';
import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, getRepository, In, MoreThan } from 'typeorm';
import { TwilioMessageEntity, NotificationType } from '../twilio.entity';
import { twilioClient } from '../twilio.client';
import { ProgramEntity } from '../../programs/program.entity';
import { ImageCodeService } from '../imagecode/image-code.service';
import { IntersolveBarcodeEntity } from '../../fsp/intersolve-barcode.entity';
import { StatusEnum } from '../../shared/enum/status.enum';
import { FspService } from '../../fsp/fsp.service';
import { fspName } from '../../fsp/financial-service-provider.entity';
import { IntersolveService } from '../../fsp/intersolve.service';
import { CustomDataAttributes } from '../../registration/enum/custom-data-attributes';
import {
  TwilioStatusCallbackDto,
  TwilioIncomingCallbackDto,
  TwilioStatus,
} from '../twilio.dto';
import { IntersolvePayoutStatus } from '../../fsp/api/enum/intersolve-payout-status.enum';
import { TransactionEntity } from '../../programs/transactions.entity';

@Injectable()
export class WhatsappService {
  @InjectRepository(IntersolveBarcodeEntity)
  private readonly intersolveBarcodeRepository: Repository<
    IntersolveBarcodeEntity
  >;
  @InjectRepository(TwilioMessageEntity)
  private readonly twilioMessageRepository: Repository<TwilioMessageEntity>;
  @InjectRepository(RegistrationEntity)
  private readonly registrationRepository: Repository<RegistrationEntity>;
  @InjectRepository(TransactionEntity)
  public transactionRepository: Repository<TransactionEntity>;

  private readonly programId = 1;
  private readonly fallbackLanguage = 'en';

  public constructor(
    private readonly imageCodeService: ImageCodeService,
    @Inject(forwardRef(() => IntersolveService))
    private readonly intersolveService: IntersolveService,
    @Inject(forwardRef(() => FspService))
    private readonly fspService: FspService,
  ) {}

  public async notifyByWhatsapp(
    registrationId: number,
    recipientPhoneNr: string,
    language: string,
    programId: number,
    message?: string,
    key?: string,
  ): Promise<void> {
    if (!recipientPhoneNr) {
      throw new HttpException(
        'A recipientPhoneNr should be supplied.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!message && !key) {
      throw new HttpException(
        'A message or a key should be supplied.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const whatsappText =
      message || (await this.getWhatsappText(language, key, programId));
    await this.sendWhatsapp(
      whatsappText,
      recipientPhoneNr,
      null,
      null,
      registrationId,
    );
  }

  public async sendWhatsapp(
    message: string,
    recipientPhoneNr: string,
    messageType: null | IntersolvePayoutStatus,
    mediaUrl: null | string,
    registrationId?: number,
  ): Promise<any> {
    const payload = {
      body: message,
      messagingServiceSid: process.env.TWILIO_MESSAGING_SID,
      from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER,
      statusCallback: EXTERNAL_API.whatsAppStatus,
      to: 'whatsapp:' + recipientPhoneNr,
    };
    if (mediaUrl) {
      payload['mediaUrl'] = mediaUrl;
    }
    if (!!process.env.MOCK_TWILIO) {
      payload['messageType'] = messageType;
    }
    return twilioClient.messages
      .create(payload)
      .then(message => {
        this.storeSendWhatsapp(message, registrationId, mediaUrl);
        return message.sid;
      })
      .catch(err => {
        console.log('Error from Twilio:', err);
        throw err;
      });
  }

  public async getWhatsappText(
    language: string,
    key: string,
    programId: number,
  ): Promise<string> {
    const program = await getRepository(ProgramEntity).findOne(programId);
    const fallbackNotifications = program.notifications[this.fallbackLanguage];
    let notifications = fallbackNotifications;

    if (program.notifications[language]) {
      notifications = program.notifications[language];
    }
    if (notifications[key]) {
      return notifications[key];
    }
    return fallbackNotifications[key] ? fallbackNotifications[key] : '';
  }

  public storeSendWhatsapp(
    message,
    registrationId: number,
    mediaUrl: string,
  ): void {
    const twilioMessage = new TwilioMessageEntity();
    twilioMessage.accountSid = message.accountSid;
    twilioMessage.body = message.body;
    twilioMessage.mediaUrl = mediaUrl;
    twilioMessage.to = message.to;
    twilioMessage.from = message.messagingServiceSid;
    twilioMessage.sid = message.sid;
    twilioMessage.status = message.status;
    twilioMessage.type = NotificationType.Whatsapp;
    twilioMessage.dateCreated = message.dateCreated;
    twilioMessage.registrationId = registrationId;
    this.twilioMessageRepository.save(twilioMessage);
  }

  public async findOne(sid: string): Promise<TwilioMessageEntity> {
    const findOneOptions = {
      sid: sid,
    };
    return await this.twilioMessageRepository.findOne(findOneOptions);
  }

  public async statusCallback(
    callbackData: TwilioStatusCallbackDto,
  ): Promise<void> {
    await this.twilioMessageRepository.update(
      { sid: callbackData.MessageSid },
      { status: callbackData.MessageStatus },
    );

    const statuses = [
      TwilioStatus.delivered,
      TwilioStatus.read,
      TwilioStatus.failed,
      TwilioStatus.undelivered,
    ];
    if (statuses.includes(callbackData.MessageStatus)) {
      await this.fspService.processPaymentStatus(
        fspName.intersolve,
        callbackData,
      );
    }
  }

  private async getRegistrationsWithPhoneNumber(
    phoneNumber,
  ): Promise<RegistrationEntity[]> {
    const registrationsWithPhoneNumber = await getRepository(RegistrationEntity)
      .createQueryBuilder('registration')
      .select('registration.id')
      .where('registration.customData ::jsonb @> :customData', {
        customData: {
          whatsappPhoneNumber: phoneNumber,
        },
      })
      .getMany();

    if (!registrationsWithPhoneNumber.length) {
      console.log(
        'Incoming WhatsApp-message from non-registered phone-number: ',
        phoneNumber.substr(-5).padStart(phoneNumber.length, '*'),
      );
    }
    return registrationsWithPhoneNumber;
  }

  private async getRegistrationsWithOpenVouchers(
    registrations: RegistrationEntity[],
  ): Promise<RegistrationEntity[]> {
    // Trim registrations down to only those with outstanding vouchers
    const registrationIds = registrations.map(c => c.id);
    const registrationWithVouchers = await this.registrationRepository.find({
      where: { id: In(registrationIds) },
      relations: ['images', 'images.barcode'],
    });

    // Don't send more then 3 vouchers, so no vouchers of more than 2 installments ago
    const lastInstallment = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('MAX(transaction.installment)', 'max')
      .getRawOne();
    const minimumInstallment = lastInstallment ? lastInstallment.max - 2 : 0;

    return registrationWithVouchers
      .map(registration => {
        registration.images = registration.images.filter(
          image =>
            !image.barcode.send &&
            image.barcode.installment >= minimumInstallment,
        );
        return registration;
      })
      .filter(registration => registration.images.length > 0);
  }

  private cleanWhatsAppNr(value: string): string {
    return value.replace('whatsapp:+', '');
  }

  public async handleIncoming(
    callbackData: TwilioIncomingCallbackDto,
  ): Promise<void> {
    if (!callbackData.From) {
      throw new HttpException(
        `No "From" address specified.`,
        HttpStatus.BAD_REQUEST,
      );
    }
    const fromNumber = this.cleanWhatsAppNr(callbackData.From);
    const regisrationsWithPhoneNumber = await this.getRegistrationsWithPhoneNumber(
      fromNumber,
    );
    const registrationsWithOpenVouchers = await this.getRegistrationsWithOpenVouchers(
      regisrationsWithPhoneNumber,
    );

    // If no registrations with outstanding barcodes: send auto-reply
    const program = await getRepository(ProgramEntity).findOne(this.programId);
    const language =
      registrationsWithOpenVouchers[0]?.preferredLanguage || 'en';
    if (registrationsWithOpenVouchers.length === 0) {
      const whatsappDefaultReply =
        program.notifications[language]['whatsappReply'];
      await this.sendWhatsapp(
        whatsappDefaultReply,
        fromNumber,
        null,
        null,
        null,
      );
      return;
    }

    // Start loop over (potentially) multiple PA's
    let firstVoucherSent = false;
    for await (let registration of registrationsWithOpenVouchers) {
      const intersolveBarcodesPerPa = registration.images.map(
        image => image.barcode,
      );

      // Loop over current and (potentially) old barcodes per PA
      for await (let intersolveBarcode of intersolveBarcodesPerPa) {
        const mediaUrl = await this.imageCodeService.createVoucherUrl(
          intersolveBarcode,
        );

        // Only include text with first voucher (across PA's and installments)
        let message = firstVoucherSent
          ? ''
          : registrationsWithOpenVouchers.length > 1
          ? program.notifications[language]['whatsappVoucherMultiple'] ||
            program.notifications[language]['whatsappVoucher']
          : program.notifications[language]['whatsappVoucher'];
        message = message.split('{{1}}').join(intersolveBarcode.amount);
        await this.sendWhatsapp(
          message,
          fromNumber,
          IntersolvePayoutStatus.VoucherSent,
          mediaUrl,
          registration.id,
        );
        firstVoucherSent = true;

        // Save results
        intersolveBarcode.send = true;
        await this.intersolveBarcodeRepository.save(intersolveBarcode);
        await this.intersolveService.insertTransactionIntersolve(
          intersolveBarcode.installment,
          intersolveBarcode.amount,
          registration.id,
          2,
          StatusEnum.success,
          null,
        );

        // Add small delay/sleep to ensure the order in which messages are received
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    // Send instruction message only once (outside of loops)
    if (registrationsWithOpenVouchers.length > 0) {
      await this.sendWhatsapp(
        '',
        fromNumber,
        null,
        EXTERNAL_API.voucherInstructionsUrl,
        registrationsWithOpenVouchers[0].id,
      );
    }
  }
}
