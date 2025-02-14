import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import { IntersolveVoucherPayoutStatus } from '../payments/fsp-integration/intersolve-voucher/enum/intersolve-voucher-payout-status.enum';
import { API_PATHS, EXTERNAL_API } from './../config';
import {
  TwilioIncomingCallbackDto,
  TwilioMessagesCreateDto,
  TwilioStatus,
  TwilioStatusCallbackDto,
} from './twilio.dto';

class PhoneNumbers {
  public phoneNumber;
  public constructor(phoneNumber = '+31600000000') {
    this.phoneNumber = phoneNumber;
  }
  public async fetch(_: any): Promise<any> {
    if (!this.phoneNumber) {
      this.phoneNumber = '+31600000000';
    }

    return {
      phoneNumber: this.phoneNumber,
      nationalFormat: this.phoneNumber,
    };
  }
}

class LookUp {
  public phoneNumbers(nr): any {
    return new PhoneNumbers(nr);
  }
}

@Injectable()
export class TwilioClientMock {
  public messages;
  public lookups;
  public constructor() {
    this.messages = new this.Messages();
    this.lookups = new LookUp();
  }

  public Messages = class {
    public async create(
      twilioMessagesCreateDto: TwilioMessagesCreateDto,
    ): Promise<object> {
      // console.log('TwilioClientMock: create():', twilioMessagesCreateDto);

      const messageSid = 'SM' + this.createRandomHexaDecimalString(32);

      const response = {
        body: twilioMessagesCreateDto.body,
        numSegments: twilioMessagesCreateDto.mediaUrl ? '1' : '0',
        direction: 'outbound-api',
        from: twilioMessagesCreateDto.from,
        to: twilioMessagesCreateDto.to,
        dateUpdated: new Date(),
        price: null,
        errorMessage: null,
        uri: `/2010-04-01/Accounts/${process.env.TWILIO_SID}/Messages/${twilioMessagesCreateDto.messagingServiceSid}.json`,
        accountSid: process.env.TWILIO_SID,
        numMedia: twilioMessagesCreateDto.mediaUrl ? '1' : '0',
        status: 'accepted',
        messagingServiceSid: twilioMessagesCreateDto.messagingServiceSid,
        sid: messageSid,
        dateSent: null,
        dateCreated: new Date(),
        errorCode: null,
        priceUnit: null,
        apiVersion: '2010-04-01',
        subresourceUris: {
          media: `/2010-04-01/Accounts/${process.env.TWILIO_SID}/Messages/${twilioMessagesCreateDto.messagingServiceSid}/Media.json`,
        },
      };
      if (twilioMessagesCreateDto.to.includes('15005550001')) {
        response.status = TwilioStatus.failed;
        response.errorCode = '1';
        response.errorMessage = 'Magic fail';
      }
      // console.log('TwilioClientMock create(): response:', response);
      this.sendStatusResponse121(twilioMessagesCreateDto, messageSid);

      if (
        twilioMessagesCreateDto.messageType ===
        IntersolveVoucherPayoutStatus.InitialMessage
      ) {
        this.sendIncomingWhatsapp(twilioMessagesCreateDto, messageSid);
      }
      return response;
    }

    private createRandomHexaDecimalString(length: number): string {
      let result = '';
      const characters = 'abcdef0123456789';
      const charactersLength = characters.length;

      for (let i = 0; i < length; i++) {
        result += characters.charAt(
          Math.floor(Math.random() * charactersLength),
        );
      }

      return result;
    }

    private async sendStatusResponse121(
      twilioMessagesCreateDto: TwilioMessagesCreateDto,
      messageSid: string,
    ): Promise<void> {
      if (
        twilioMessagesCreateDto.from &&
        twilioMessagesCreateDto.from.includes('whatsapp')
      ) {
        const request = new TwilioStatusCallbackDto();
        request.MessageSid = messageSid;
        request.MessageStatus = TwilioStatus.delivered;

        if (twilioMessagesCreateDto.to.includes('15005550001')) {
          request.MessageStatus = TwilioStatus.failed;
          request.ErrorCode = '1';
          request.ErrorMessage = 'Magic fail';
        }
        const httpService = new HttpService();
        try {
          await lastValueFrom(
            httpService.post(EXTERNAL_API.whatsAppStatus, request),
          );
        } catch (error) {
          // In case external API is not reachable try localhost
          const urlLocalhost = `${EXTERNAL_API.rootApi}/${API_PATHS.whatsAppStatus}`;
          await lastValueFrom(httpService.post(urlLocalhost, request)).catch(
            (error) => console.log(error),
          );
        }
      }
    }

    private async sendIncomingWhatsapp(
      twilioMessagesCreateDto: TwilioMessagesCreateDto,
      messageSid: string,
    ): Promise<void> {
      if (
        twilioMessagesCreateDto.from &&
        twilioMessagesCreateDto.from.includes('whatsapp')
      ) {
        await new Promise((r) => setTimeout(r, 300));
        const request = new TwilioIncomingCallbackDto();
        request.MessageSid = messageSid;
        request.From = twilioMessagesCreateDto.to.replace('whatsapp:', '');
        const httpService = new HttpService();
        try {
          await lastValueFrom(
            httpService.post(EXTERNAL_API.whatsAppIncoming, request),
          );
        } catch (error) {
          // In case external API is not reachable try localhost
          const urlLocalhost = `${EXTERNAL_API.rootApi}/${API_PATHS.whatsAppIncoming}`;
          await lastValueFrom(httpService.post(urlLocalhost, request)).catch(
            (error) => console.log(error),
          );
        }
      }
    }
  };

  public validateRequest(): // twilioValidateRequestDto: TwilioValidateRequestDto,
  boolean {
    // console.log(
    //   'TwilioClientMock: validateRequest():',
    //   twilioValidateRequestDto,
    // );
    return true;
  }
}
