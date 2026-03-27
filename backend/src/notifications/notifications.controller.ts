import {
  Controller,
  Get,
  Patch,
  Delete,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { MarkReadDto } from './dto/mark-read.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('restaurants/:restaurantId/notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  // ─── My Notifications ────────────────────────────────────────────────────

  @Get('me')
  @ApiOperation({ summary: 'List my notifications (current user)' })
  listMine(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @CurrentUser() user: any,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.service.listNotifications(restaurantId, user.id, user.tenantId, query);
  }

  @Get('me/unread-count')
  @ApiOperation({ summary: 'Get my unread notification count (for bell icon badge)' })
  unreadCount(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.getUnreadCount(restaurantId, user.id, user.tenantId);
  }

  @Patch('me/:notificationId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a single notification as read' })
  markOne(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.markRead(notificationId, user.id, user.tenantId);
  }

  @Post('me/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark multiple notifications as read' })
  markMany(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Body() dto: MarkReadDto,
    @CurrentUser() user: any,
  ) {
    return this.service.markManyRead(dto, user.id, user.tenantId);
  }

  @Patch('me/read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  markAll(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.markAllRead(restaurantId, user.id, user.tenantId);
  }

  @Delete('me/:notificationId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a notification' })
  deleteOne(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.deleteNotification(notificationId, user.id, user.tenantId);
  }

  // ─── Preferences ─────────────────────────────────────────────────────────

  @Get('me/preferences')
  @ApiOperation({ summary: 'Get my notification preferences' })
  getPrefs(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.getPreferences(restaurantId, user.id, user.tenantId);
  }

  @Put('me/preferences')
  @ApiOperation({ summary: 'Update my notification preferences' })
  updatePrefs(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Body() dto: UpdatePreferencesDto,
    @CurrentUser() user: any,
  ) {
    return this.service.updatePreferences(restaurantId, user.id, user.tenantId, dto);
  }

  // ─── Admin: all restaurant notifications (MANAGER+) ──────────────────────

  @Get()
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: '[MANAGER+] List all notifications for this restaurant' })
  listAll(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @CurrentUser() user: any,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.service.listRestaurantNotifications(restaurantId, user.tenantId, query);
  }
}
