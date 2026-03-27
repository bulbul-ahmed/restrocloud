import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { OnlineOrderingService } from './online-ordering.service';
import { ListReviewsQueryDto } from './dto/list-reviews-query.dto';

/**
 * M15.7 — Review moderation (staff-facing).
 *
 * GET  /restaurants/:restaurantId/reviews/stats    — review statistics
 * GET  /restaurants/:restaurantId/reviews          — list reviews (filterable)
 * PATCH /restaurants/:restaurantId/reviews/:id/approve
 * PATCH /restaurants/:restaurantId/reviews/:id/reject
 */
@ApiTags('reviews-moderation')
@ApiBearerAuth()
@Controller('restaurants/:restaurantId')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class OnlineReviewsStaffController {
  constructor(private readonly svc: OnlineOrderingService) {}

  @Get('reviews/stats')
  @ApiOperation({ summary: 'Review statistics (totals, average rating) — MANAGER+' })
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  getReviewStats(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
  ) {
    return this.svc.getReviewStats(tenantId, restaurantId);
  }

  @Get('reviews')
  @ApiOperation({ summary: 'List reviews for moderation (filter by status, rating) — MANAGER+' })
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  listReviews(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Query() query: ListReviewsQueryDto,
  ) {
    return this.svc.listReviewsForStaff(tenantId, restaurantId, query);
  }

  @Patch('reviews/:reviewId/approve')
  @ApiOperation({ summary: 'Approve a review — makes it publicly visible — MANAGER+' })
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  approveReview(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
  ) {
    return this.svc.moderateReview(tenantId, restaurantId, reviewId, 'approve');
  }

  @Patch('reviews/:reviewId/reject')
  @ApiOperation({ summary: 'Reject a review — hides it from public view — MANAGER+' })
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  rejectReview(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
  ) {
    return this.svc.moderateReview(tenantId, restaurantId, reviewId, 'reject');
  }
}
