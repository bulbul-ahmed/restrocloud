import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PlanGuard } from '../common/guards/plan.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireFeature } from '../common/decorators/plan-feature.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CrmService } from './crm.service';
import { UpsertLoyaltyConfigDto } from './dto/upsert-loyalty-config.dto';
import { CreateStampCardDto } from './dto/create-stamp-card.dto';
import { UpdateStampCardDto } from './dto/update-stamp-card.dto';
import { AddStampDto } from './dto/add-stamp.dto';
import { RedeemStampDto } from './dto/redeem-stamp.dto';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { ValidatePromoDto } from './dto/validate-promo.dto';
import { RecordPromoUsageDto } from './dto/record-promo-usage.dto';
import { SendCampaignDto } from './dto/send-campaign.dto';
import { CustomerSegmentQueryDto } from './dto/customer-segment-query.dto';

@ApiTags('crm')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PlanGuard)
@RequireFeature('crm')
@Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.SUPER_ADMIN)
@Controller('restaurants/:restaurantId/crm')
export class CrmController {
  constructor(private crm: CrmService) {}

  // ─── M21.1 — Loyalty Config ──────────────────────────────────────────────────

  @Get('loyalty-config')
  async getLoyaltyConfig(
    @CurrentUser() user: any,
    @Param('restaurantId') restaurantId: string,
  ) {
    return this.crm.getLoyaltyConfig(user.tenantId, restaurantId);
  }

  @Patch('loyalty-config')
  async upsertLoyaltyConfig(
    @CurrentUser() user: any,
    @Param('restaurantId') restaurantId: string,
    @Body() dto: UpsertLoyaltyConfigDto,
  ) {
    return this.crm.upsertLoyaltyConfig(user.tenantId, restaurantId, dto);
  }

  // ─── M21.2 — Customer Segmentation ───────────────────────────────────────────

  @Get('customers')
  async listCustomers(
    @CurrentUser() user: any,
    @Param('restaurantId') restaurantId: string,
    @Query() query: CustomerSegmentQueryDto,
  ) {
    return this.crm.listCustomersBySegment(user.tenantId, restaurantId, query);
  }

  @Get('customers/:id')
  async getCustomerDetail(
    @CurrentUser() user: any,
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
  ) {
    return this.crm.getCustomerDetail(user.tenantId, restaurantId, id);
  }

  // ─── M21.3 — Promo Codes (static routes FIRST) ───────────────────────────────

  @Post('promo-codes/validate')
  async validatePromoCode(
    @CurrentUser() user: any,
    @Param('restaurantId') restaurantId: string,
    @Body() dto: ValidatePromoDto,
  ) {
    return this.crm.validatePromoCode(user.tenantId, restaurantId, dto);
  }

  @Post('promo-codes/record-usage')
  async recordPromoUsage(
    @CurrentUser() user: any,
    @Param('restaurantId') restaurantId: string,
    @Body() dto: RecordPromoUsageDto,
  ) {
    return this.crm.recordPromoUsage(user.tenantId, restaurantId, dto);
  }

  @Get('promo-codes')
  async listPromoCodes(
    @CurrentUser() user: any,
    @Param('restaurantId') restaurantId: string,
  ) {
    return this.crm.listPromoCodes(user.tenantId, restaurantId);
  }

  @Post('promo-codes')
  async createPromoCode(
    @CurrentUser() user: any,
    @Param('restaurantId') restaurantId: string,
    @Body() dto: CreatePromoCodeDto,
  ) {
    return this.crm.createPromoCode(user.tenantId, restaurantId, dto);
  }

  @Patch('promo-codes/:id')
  async updatePromoCode(
    @CurrentUser() user: any,
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreatePromoCodeDto> & { isActive?: boolean },
  ) {
    return this.crm.updatePromoCode(user.tenantId, restaurantId, id, dto);
  }

  @Delete('promo-codes/:id')
  async deletePromoCode(
    @CurrentUser() user: any,
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
  ) {
    return this.crm.deletePromoCode(user.tenantId, restaurantId, id);
  }

  // ─── M21.6 — Stamp Cards (static routes FIRST) ───────────────────────────────

  @Post('stamp-cards/add-stamp')
  async addStamp(
    @CurrentUser() user: any,
    @Param('restaurantId') restaurantId: string,
    @Body() dto: AddStampDto,
  ) {
    return this.crm.addStamp(user.tenantId, restaurantId, dto);
  }

  @Post('stamp-cards/redeem')
  async redeemStamp(
    @CurrentUser() user: any,
    @Param('restaurantId') restaurantId: string,
    @Body() dto: RedeemStampDto,
  ) {
    return this.crm.redeemStamp(user.tenantId, restaurantId, dto);
  }

  @Get('stamp-cards/progress/:customerId')
  async getStampProgress(
    @CurrentUser() user: any,
    @Param('restaurantId') restaurantId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.crm.getStampProgress(user.tenantId, restaurantId, customerId);
  }

  @Get('stamp-cards')
  async listStampCards(
    @CurrentUser() user: any,
    @Param('restaurantId') restaurantId: string,
  ) {
    return this.crm.listStampCards(user.tenantId, restaurantId);
  }

  @Post('stamp-cards')
  async createStampCard(
    @CurrentUser() user: any,
    @Param('restaurantId') restaurantId: string,
    @Body() dto: CreateStampCardDto,
  ) {
    return this.crm.createStampCard(user.tenantId, restaurantId, dto);
  }

  @Patch('stamp-cards/:id')
  async updateStampCard(
    @CurrentUser() user: any,
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateStampCardDto,
  ) {
    return this.crm.updateStampCard(user.tenantId, restaurantId, id, dto);
  }

  @Delete('stamp-cards/:id')
  async deleteStampCard(
    @CurrentUser() user: any,
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
  ) {
    return this.crm.deleteStampCard(user.tenantId, restaurantId, id);
  }

  // ─── M21.7 — Campaign Broadcasts ─────────────────────────────────────────────

  @Get('campaigns')
  async listCampaigns(
    @CurrentUser() user: any,
    @Param('restaurantId') restaurantId: string,
  ) {
    return this.crm.listCampaigns(user.tenantId, restaurantId);
  }

  @Post('campaigns')
  async createCampaign(
    @CurrentUser() user: any,
    @Param('restaurantId') restaurantId: string,
    @Body() dto: SendCampaignDto,
  ) {
    return this.crm.createCampaign(user.tenantId, restaurantId, dto);
  }

  @Get('campaigns/:id')
  async getCampaign(
    @CurrentUser() user: any,
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
  ) {
    return this.crm.getCampaign(user.tenantId, restaurantId, id);
  }

  @Post('campaigns/:id/send')
  async sendCampaign(
    @CurrentUser() user: any,
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
  ) {
    return this.crm.sendCampaign(user.tenantId, restaurantId, id);
  }

  // ─── M21.10 — Review Moderation ──────────────────────────────────────────────

  @Get('reviews')
  async listReviews(
    @CurrentUser() user: any,
    @Param('restaurantId') restaurantId: string,
    @Query('isApproved') isApproved?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.crm.listReviews(user.tenantId, restaurantId, {
      isApproved,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Patch('reviews/:id/approve')
  async approveReview(
    @CurrentUser() user: any,
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
  ) {
    return this.crm.approveReview(user.tenantId, restaurantId, id);
  }

  @Delete('reviews/:id')
  async rejectReview(
    @CurrentUser() user: any,
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
  ) {
    return this.crm.rejectReview(user.tenantId, restaurantId, id);
  }
}
