import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageContentType } from '../message-type.enum';
import { twilioClient } from '../twilio.client';
import { NotificationType, TwilioMessageEntity } from '../twilio.entity';
import { EXTERNAL_API } from './../../config';

@Injectable()
export class SmsService {
  @InjectRepository(TwilioMessageEntity)
  private readonly twilioMessageRepository: Repository<TwilioMessageEntity>;

  public async sendSms(
    message: string,
    recipientPhoneNr: string,
    registrationId: number,
    messageContentType?: MessageContentType,
  ): Promise<void> {
    // Overwrite recipient phone number for testing phase
    twilioClient.messages
      .create({
        body: message,
        messagingServiceSid: process.env.TWILIO_MESSAGING_SID,
        statusCallback: EXTERNAL_API.smsStatus,
        to: recipientPhoneNr,
      })
      .then((message) =>
        this.storeSendSms(message, registrationId, messageContentType),
      )
      .catch((err) => console.log('Error from Twilio:', err));
  }

  public storeSendSms(
    message,
    registrationId: number,
    messageContentType?: MessageContentType,
  ): void {
    const twilioMessage = new TwilioMessageEntity();
    twilioMessage.accountSid = message.accountSid;
    twilioMessage.body = message.body;
    twilioMessage.to = message.to;
    twilioMessage.from = message.messagingServiceSid;
    twilioMessage.sid = message.sid;
    twilioMessage.status = message.status;
    twilioMessage.type = NotificationType.Sms;
    twilioMessage.dateCreated = message.dateCreated;
    twilioMessage.registrationId = registrationId;
    twilioMessage.contentType = messageContentType;
    this.twilioMessageRepository.save(twilioMessage);
  }

  public async findOne(sid: string): Promise<TwilioMessageEntity> {
    const findOneOptions = {
      sid: sid,
    };
    return await this.twilioMessageRepository.findOneBy(findOneOptions);
  }

  public async statusCallback(callbackData): Promise<void> {
    await this.twilioMessageRepository.update(
      { sid: callbackData.MessageSid },
      { status: callbackData.SmsStatus },
    );
  }
}
