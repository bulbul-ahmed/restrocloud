import {
  Controller, Get, Post, Body, Query, ParseIntPipe, DefaultValuePipe, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { UpgradePlanDto } from './dto/upgrade-plan.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('OWNER', 'MANAGER')
@Controller('billing')
export class BillingController {
  constructor(private readonly svc: BillingService) {}

  @Get()
  @ApiOperation({ summary: 'Get current subscription details and available plans' })
  getMySubscription(@CurrentUser() user: any) {
    return this.svc.getMySubscription(user.tenantId);
  }

  @Post('upgrade')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Upgrade or change subscription plan' })
  upgradePlan(@CurrentUser() user: any, @Body() dto: UpgradePlanDto) {
    return this.svc.upgradePlan(user.tenantId, dto);
  }

  @Post('cancel')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Cancel subscription at end of current period' })
  cancelSubscription(@CurrentUser() user: any) {
    return this.svc.cancelSubscription(user.tenantId);
  }

  @Post('reactivate')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Undo cancellation — keep subscription active' })
  reactivateSubscription(@CurrentUser() user: any) {
    return this.svc.reactivateSubscription(user.tenantId);
  }

  @Post('pause')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Pause subscription (up to 60 days)' })
  pauseSubscription(@CurrentUser() user: any) {
    return this.svc.pauseSubscription(user.tenantId);
  }

  @Post('resume')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Resume a paused subscription' })
  resumeSubscription(@CurrentUser() user: any) {
    return this.svc.resumeSubscription(user.tenantId);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'List billing invoices for this tenant' })
  listInvoices(
    @CurrentUser() user: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.svc.listInvoices(user.tenantId, page, limit);
  }
}
