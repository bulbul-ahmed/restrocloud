import { Controller, Post, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { QrOrderingService } from './qr-ordering.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('qr-staff')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('restaurants/:restaurantId/tables/:tableId')
export class QrStaffController {
  constructor(private readonly svc: QrOrderingService) {}

  // ─── M12.12 Generate QR code ─────────────────────────────────────────────

  @Post('qr-code')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  @ApiOperation({ summary: 'Generate/regenerate QR code for a table (MANAGER+)' })
  generateQrCode(
    @CurrentUser() user: any,
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
  ) {
    return this.svc.generateQrCode(user.tenantId, restaurantId, tableId);
  }
}
