import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { TablesService } from './tables.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateFloorSectionDto } from './dto/create-floor-section.dto';
import { UpdateFloorSectionDto } from './dto/update-floor-section.dto';

@ApiTags('tables — floor sections')
@Controller('restaurants/:restaurantId/floor-sections')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
@ApiParam({ name: 'restaurantId', description: 'Restaurant UUID' })
export class FloorSectionsController {
  constructor(private tablesService: TablesService) {}

  @Post()
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a floor section (MANAGER+)' })
  create(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateFloorSectionDto,
  ) {
    return this.tablesService.createSection(tenantId, restaurantId, user.role as UserRole, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all floor sections with their tables' })
  findAll(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
  ) {
    return this.tablesService.listSections(tenantId, restaurantId);
  }

  @Get(':sectionId')
  @ApiOperation({ summary: 'Get a floor section with its tables' })
  findOne(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('sectionId') sectionId: string,
  ) {
    return this.tablesService.getSection(tenantId, restaurantId, sectionId);
  }

  @Patch(':sectionId')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Update a floor section (MANAGER+)' })
  update(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('sectionId') sectionId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateFloorSectionDto,
  ) {
    return this.tablesService.updateSection(tenantId, restaurantId, sectionId, user.role as UserRole, dto);
  }

  @Delete(':sectionId')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a floor section (MANAGER+). Fails if active tables exist.' })
  remove(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('sectionId') sectionId: string,
    @CurrentUser() user: any,
  ) {
    return this.tablesService.deleteSection(tenantId, restaurantId, sectionId, user.role as UserRole);
  }
}
