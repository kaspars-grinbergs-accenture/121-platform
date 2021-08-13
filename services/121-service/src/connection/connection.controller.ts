import { ReferenceIdDto } from './dto/reference-id.dto';
import { ConnectionService } from './connection.service';
import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Get,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiUseTags,
  ApiOperation,
  ApiResponse,
  ApiImplicitParam,
  ApiConsumes,
  ApiImplicitFile,
} from '@nestjs/swagger';
import { ConnectionEntity } from './connection.entity';
import {
  SetPhoneRequestDto,
  UpdatePhoneRequestDto,
} from './dto/set-phone-request.dto';
import { SetFspDto, UpdateChosenFspDto } from './dto/set-fsp.dto';
import { CustomDataDto } from '../programs/program/dto/custom-data.dto';
import { RolesGuard } from '../roles.guard';
import { Roles } from '../roles.decorator';
import { UserRole } from '../user-role.enum';
import { AddQrIdentifierDto } from './dto/add-qr-identifier.dto';
import { QrIdentifierDto } from './dto/qr-identifier.dto';
import { FspAnswersAttrInterface } from 'src/programs/fsp/fsp-interface';
import { FileInterceptor } from '@nestjs/platform-express';
import { User } from '../user/user.decorator';
import { ImportResult } from './dto/bulk-import.dto';
import { NoteDto, UpdateNoteDto } from './dto/note.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';

@ApiBearerAuth()
@UseGuards(RolesGuard)
@ApiUseTags('connection')
@Controller('connection')
export class ConnectionController {
  private readonly connectionService: ConnectionService;
  public constructor(connectionService: ConnectionService) {
    this.connectionService = connectionService;
  }

  @ApiOperation({ title: 'Create connection' })
  @ApiResponse({ status: 200, description: 'Created connection' })
  @Post()
  public async create(
    @Body() referenceIdDto: ReferenceIdDto,
  ): Promise<ConnectionEntity> {
    return await this.connectionService.create(referenceIdDto.referenceId);
  }

  @ApiOperation({ title: 'Delete connection' })
  @ApiResponse({ status: 200, description: 'Deleted connection' })
  @Post('/delete')
  public async delete(@Body() referenceIdDto: ReferenceIdDto): Promise<void> {
    return await this.connectionService.delete(referenceIdDto.referenceId);
  }

  @Roles(UserRole.FieldValidation)
  @ApiOperation({ title: 'Find connection using qr identifier' })
  @ApiResponse({
    status: 200,
    description: 'Found connection using qr',
  })
  @Post('/qr-find-connection')
  public async findConnectionWithQrIdentifier(
    @Body() data: QrIdentifierDto,
  ): Promise<ReferenceIdDto> {
    return await this.connectionService.findConnectionWithQrIdentifier(
      data.qrIdentifier,
    );
  }

  @Roles(UserRole.FieldValidation)
  @ApiOperation({ title: 'Find fsp and attributes' })
  @ApiResponse({
    status: 200,
    description: 'Found fsp and attributes',
  })
  @Post('/get-fsp')
  public async getFspAnswersAttributes(
    @Body() referenceIdDto: ReferenceIdDto,
  ): Promise<FspAnswersAttrInterface> {
    return await this.connectionService.getFspAnswersAttributes(
      referenceIdDto.referenceId,
    );
  }
}
