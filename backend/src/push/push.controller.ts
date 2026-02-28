import { Controller, Post, Delete, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PushService } from './push.service';
import { RegisterTokenDto } from './dto/register-token.dto';
import { DeregisterTokenDto } from './dto/deregister-token.dto';

@ApiTags('Push Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('push')
export class PushController {
  constructor(private pushService: PushService) {}

  // ── M23.3 Register device push token ─────────────────────────────────────────

  @Post('register')
  @ApiOperation({ summary: 'Register device push token for authenticated user' })
  register(@CurrentUser() user: any, @Body() dto: RegisterTokenDto) {
    return this.pushService.registerToken(user.id, user.tenantId, dto.token, dto.platform);
  }

  // ── M23.3 Deregister device push token (on logout) ───────────────────────────

  @Delete('deregister')
  @ApiOperation({ summary: 'Deregister device push token on logout' })
  deregister(@CurrentUser() user: any, @Body() dto: DeregisterTokenDto) {
    return this.pushService.deregisterToken(user.id, dto.token);
  }
}
