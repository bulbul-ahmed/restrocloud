import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { MenuService } from './menu.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ToggleAvailabilityDto } from './dto/toggle-availability.dto';
import { BulkAvailabilityDto } from './dto/bulk-availability.dto';
import { ReorderDto } from './dto/reorder-items.dto';
import { ListItemsQueryDto } from './dto/list-items-query.dto';
import { AttachModifierGroupDto } from './dto/attach-modifier-group.dto';

@ApiTags('menu — items')
@Controller('restaurants/:restaurantId/items')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
@ApiParam({ name: 'restaurantId', description: 'Restaurant UUID' })
export class ItemsController {
  constructor(private menuService: MenuService) {}

  // ── POST /restaurants/:restaurantId/items ─────────────────────────────────

  @Post()
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a menu item (MANAGER+)' })
  @ApiResponse({ status: 201, description: 'Item created' })
  create(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateItemDto,
  ) {
    return this.menuService.createItem(tenantId, restaurantId, user.role, dto);
  }

  // ── GET /restaurants/:restaurantId/items ──────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List items — filter by categoryId, isAvailable, search' })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'isAvailable', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Query() query: ListItemsQueryDto,
  ) {
    return this.menuService.listItems(tenantId, restaurantId, query);
  }

  // ── PATCH /restaurants/:restaurantId/items/reorder ────────────────────────
  // Static route — must appear before /:itemId

  @Patch('reorder')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder items by sortOrder (MANAGER+)' })
  reorder(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
    @Body() dto: ReorderDto,
  ) {
    return this.menuService.reorderItems(tenantId, restaurantId, user.role, dto);
  }

  // ── PATCH /restaurants/:restaurantId/items/bulk-availability ──────────────
  // Static route — must appear before /:itemId

  @Patch('bulk-availability')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk toggle availability for multiple items (MANAGER+)' })
  bulkAvailability(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
    @Body() dto: BulkAvailabilityDto,
  ) {
    return this.menuService.bulkToggleAvailability(tenantId, restaurantId, user.role, dto);
  }

  // ── GET /restaurants/:restaurantId/items/:itemId ──────────────────────────

  @Get(':itemId')
  @ApiOperation({ summary: 'Get a single item with modifier groups and modifiers' })
  findOne(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.menuService.getItem(tenantId, restaurantId, itemId);
  }

  // ── PATCH /restaurants/:restaurantId/items/:itemId ────────────────────────

  @Patch(':itemId')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Update an item (MANAGER+)' })
  update(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateItemDto,
  ) {
    return this.menuService.updateItem(tenantId, restaurantId, itemId, user.role, dto);
  }

  // ── DELETE /restaurants/:restaurantId/items/:itemId ───────────────────────

  @Delete(':itemId')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an item (MANAGER+)' })
  remove(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: any,
  ) {
    return this.menuService.deleteItem(tenantId, restaurantId, itemId, user.role);
  }

  // ── PATCH /restaurants/:restaurantId/items/:itemId/availability ───────────

  @Patch(':itemId/availability')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle item availability — quick 86 (MANAGER+)' })
  toggleAvailability(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: any,
    @Body() dto: ToggleAvailabilityDto,
  ) {
    return this.menuService.toggleItemAvailability(tenantId, restaurantId, itemId, user.role, dto);
  }

  // ─── M3.5 Item ↔ ModifierGroup associations ───────────────────────────────

  @Post(':itemId/modifier-groups')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Attach a modifier group to an item (MANAGER+)' })
  attachModifierGroup(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: any,
    @Body() dto: AttachModifierGroupDto,
  ) {
    return this.menuService.attachModifierGroup(tenantId, restaurantId, itemId, user.role, dto);
  }

  @Delete(':itemId/modifier-groups/:groupId')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Detach a modifier group from an item (MANAGER+)' })
  detachModifierGroup(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('itemId') itemId: string,
    @Param('groupId') groupId: string,
    @CurrentUser() user: any,
  ) {
    return this.menuService.detachModifierGroup(tenantId, restaurantId, itemId, groupId, user.role);
  }
}
