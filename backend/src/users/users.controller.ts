import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class UsersController {
  constructor(private usersService: UsersService) {}

  // ─── M1.5 Staff Management ────────────────────────────────────────────────

  @Post('staff')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a new staff member (M1.5)' })
  async createStaff(
    @CurrentTenant() tenantId: string,
    @CurrentUser() caller: any,
    @Body() dto: CreateStaffDto,
  ) {
    return this.usersService.createStaff(tenantId, caller.role, dto);
  }

  @Get('staff')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'List all staff in tenant/restaurant (M1.5)' })
  @ApiQuery({ name: 'restaurantId', required: false })
  async listStaff(
    @CurrentTenant() tenantId: string,
    @Query('restaurantId') restaurantId?: string,
  ) {
    return this.usersService.listStaff(tenantId, restaurantId);
  }

  @Get('staff/:id')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Get a specific staff member (M1.5)' })
  async getStaff(@CurrentTenant() tenantId: string, @Param('id') userId: string) {
    return this.usersService.getStaff(tenantId, userId);
  }

  @Patch('staff/:id')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update staff role or name (M1.5)' })
  async updateStaff(
    @CurrentTenant() tenantId: string,
    @CurrentUser() caller: any,
    @Param('id') userId: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.usersService.updateStaff(tenantId, userId, caller.role, dto);
  }

  @Delete('staff/:id')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a staff member (M1.5)' })
  async deactivateStaff(
    @CurrentTenant() tenantId: string,
    @CurrentUser() caller: any,
    @Param('id') userId: string,
  ) {
    return this.usersService.deactivateStaff(tenantId, userId, caller.role);
  }

  // ─── M1.6 Permission Management ───────────────────────────────────────────

  @Get('permissions')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'List all available permissions (M1.6)' })
  async listPermissions() {
    return this.usersService.listPermissions();
  }

  @Get('staff/:id/permissions')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Get permissions for a specific user (M1.6)' })
  async getUserPermissions(@CurrentTenant() tenantId: string, @Param('id') userId: string) {
    return this.usersService.getUserPermissions(tenantId, userId);
  }

  @Post('staff/:id/permissions')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Grant a permission to a staff member (M1.6)' })
  async grantPermission(
    @CurrentTenant() tenantId: string,
    @Param('id') userId: string,
    @Body() body: { permissionId: string },
  ) {
    return this.usersService.grantPermission(tenantId, userId, body.permissionId);
  }

  @Delete('staff/:id/permissions/:permissionId')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a permission from a staff member (M1.6)' })
  async revokePermission(
    @CurrentTenant() tenantId: string,
    @Param('id') userId: string,
    @Param('permissionId') permissionId: string,
  ) {
    return this.usersService.revokePermission(tenantId, userId, permissionId);
  }
}
