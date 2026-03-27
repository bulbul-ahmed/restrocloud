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
import { CombosService } from './combos.service';
import { CreateComboDto } from './dto/create-combo.dto';
import { UpdateComboDto } from './dto/update-combo.dto';
import { ToggleAvailabilityDto } from './dto/toggle-availability.dto';

@ApiTags('menu — combos')
@Controller('restaurants/:restaurantId/combos')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
@ApiParam({ name: 'restaurantId', description: 'Restaurant UUID' })
export class CombosController {
  constructor(private combosService: CombosService) {}

  // ── POST /restaurants/:restaurantId/combos ────────────────────────────────

  @Post()
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a combo bundle (MANAGER+)' })
  @ApiResponse({ status: 201, description: 'Combo created' })
  create(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateComboDto,
  ) {
    return this.combosService.createCombo(tenantId, restaurantId, user.role, dto);
  }

  // ── GET /restaurants/:restaurantId/combos ─────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all combos for a restaurant' })
  findAll(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
  ) {
    return this.combosService.listCombos(tenantId, restaurantId);
  }

  // ── GET /restaurants/:restaurantId/combos/:comboId ────────────────────────

  @Get(':comboId')
  @ApiOperation({ summary: 'Get a combo with full item details' })
  findOne(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('comboId') comboId: string,
  ) {
    return this.combosService.getCombo(tenantId, restaurantId, comboId);
  }

  // ── PATCH /restaurants/:restaurantId/combos/:comboId ─────────────────────

  @Patch(':comboId')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Update a combo (MANAGER+). Providing items replaces all combo items.' })
  update(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('comboId') comboId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateComboDto,
  ) {
    return this.combosService.updateCombo(tenantId, restaurantId, comboId, user.role, dto);
  }

  // ── DELETE /restaurants/:restaurantId/combos/:comboId ────────────────────

  @Delete(':comboId')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a combo (MANAGER+)' })
  remove(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('comboId') comboId: string,
    @CurrentUser() user: any,
  ) {
    return this.combosService.deleteCombo(tenantId, restaurantId, comboId, user.role);
  }

  // ── PATCH /restaurants/:restaurantId/combos/:comboId/availability ─────────

  @Patch(':comboId/availability')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle combo availability (MANAGER+)' })
  toggleAvailability(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('comboId') comboId: string,
    @CurrentUser() user: any,
    @Body() dto: ToggleAvailabilityDto,
  ) {
    return this.combosService.toggleComboAvailability(tenantId, restaurantId, comboId, user.role, dto);
  }
}
