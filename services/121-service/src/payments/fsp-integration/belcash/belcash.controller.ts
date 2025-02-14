import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { BelcashService } from './belcash.service';
import { BelcashPaymentStatusDto } from './dto/belcash-payment-status.dto';

@ApiTags('payments/belcash')
@Controller('payments/belcash')
export class BelcashController {
  public constructor(private belcashService: BelcashService) {}

  @SkipThrottle()
  @ApiOperation({
    summary:
      'Notification callback used by Belcash to notify status of payment to us.',
  })
  @ApiResponse({ status: 201, description: 'Notified' })
  @Post('payment-status')
  public async notificationCallback(
    @Body() belcashCallbackData: BelcashPaymentStatusDto,
  ): Promise<void> {
    await this.belcashService.processTransactionStatus(belcashCallbackData);
  }
}
