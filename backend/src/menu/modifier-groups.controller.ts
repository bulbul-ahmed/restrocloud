import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ModifierGroupsService } from './modifier-groups.service';
import { CreateModifierGroupDto } from './dto/create-modifier-group.dto';
import { UpdateModifierGroupDto } from './dto/update-modifier-group.dto';
import { CreateModifierDto } from './dto/create-modifier.dto';
import { UpdateModifierDto } from './dto/update-modifier.dto';
import { ReorderDto } from './dto/reorder-items.dto';

@ApiTags('menu — modifier groups')
@Controller('restaurants/:restaurantId/modifier-groups')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
@ApiParam({ name: 'restaurantId', description: 'Restaurant UUID' })
export class ModifierGroupsController {
  constructor(private modifierGroupsService: ModifierGroupsService) {}

  // ── POST /restaurants/:restaurantId/modifier-groups ───────────────────────

  @Post()
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a modifier group with optional modifiers inline (MANAGER+)' })
  @ApiResponse({ status: 201, description: 'Modifier group created' })
  create(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateModifierGroupDto,
  ) {
    return this.modifierGroupsService.createGroup(tenantId, restaurantId, user.role, dto);
  }

  // ── GET /restaurants/:restaurantId/modifier-groups ────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all modifier groups for a restaurant' })
  findAll(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
  ) {
    return this.modifierGroupsService.listGroups(tenantId, restaurantId);
  }

  // ── GET /restaurants/:restaurantId/modifier-groups/:groupId ──────────────

  @Get(':groupId')
  @ApiOperation({ summary: 'Get a modifier group with modifiers + attached items' })
  findOne(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('groupId') groupId: string,
  ) {
    return this.modifierGroupsService.getGroup(tenantId, restaurantId, groupId);
  }

  // ── PATCH /restaurants/:restaurantId/modifier-groups/:groupId ────────────

  @Patch(':groupId')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Update a modifier group (MANAGER+)' })
  update(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('groupId') groupId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateModifierGroupDto,
  ) {
    return this.modifierGroupsService.updateGroup(tenantId, restaurantId, groupId, user.role, dto);
  }

  // ── DELETE /restaurants/:restaurantId/modifier-groups/:groupId ───────────

  @Delete(':groupId')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a modifier group (cascades modifiers + item links) (MANAGER+)' })
  remove(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('groupId') groupId: string,
    @CurrentUser() user: any,
  ) {
    return this.modifierGroupsService.deleteGroup(tenantId, restaurantId, groupId, user.role);
  }

  // ─── Modifiers within a group ─────────────────────────────────────────────

  // ── POST /restaurants/:restaurantId/modifier-groups/:groupId/modifiers ────

  @Post(':groupId/modifiers')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Add a modifier to a group (MANAGER+)' })
  addModifier(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('groupId') groupId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateModifierDto,
  ) {
    return this.modifierGroupsService.addModifier(tenantId, restaurantId, groupId, user.role, dto);
  }

  // ── PATCH /restaurants/:restaurantId/modifier-groups/:groupId/modifiers/reorder ──
  // Static route — defined before /:modifierId

  @Patch(':groupId/modifiers/reorder')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder modifiers within a group (MANAGER+)' })
  reorderModifiers(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('groupId') groupId: string,
    @CurrentUser() user: any,
    @Body() dto: ReorderDto,
  ) {
    return this.modifierGroupsService.reorderModifiers(tenantId, restaurantId, groupId, user.role, dto);
  }

  // ── PATCH /restaurants/:restaurantId/modifier-groups/:groupId/modifiers/:modifierId ──

  @Patch(':groupId/modifiers/:modifierId')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Update a modifier (MANAGER+)' })
  updateModifier(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('groupId') groupId: string,
    @Param('modifierId') modifierId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateModifierDto,
  ) {
    return this.modifierGroupsService.updateModifier(
      tenantId, restaurantId, groupId, modifierId, user.role, dto,
    );
  }

  // ── DELETE /restaurants/:restaurantId/modifier-groups/:groupId/modifiers/:modifierId ──

  @Delete(':groupId/modifiers/:modifierId')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a modifier from a group (MANAGER+)' })
  deleteModifier(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('groupId') groupId: string,
    @Param('modifierId') modifierId: string,
    @CurrentUser() user: any,
  ) {
    return this.modifierGroupsService.deleteModifier(
      tenantId, restaurantId, groupId, modifierId, user.role,
    );
  }
}
