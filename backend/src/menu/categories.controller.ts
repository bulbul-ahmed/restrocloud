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
import { MenuService } from './menu.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ReorderDto } from './dto/reorder-items.dto';

@ApiTags('menu — categories')
@Controller('restaurants/:restaurantId/categories')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
@ApiParam({ name: 'restaurantId', description: 'Restaurant UUID' })
export class CategoriesController {
  constructor(private menuService: MenuService) {}

  // ── POST /restaurants/:restaurantId/categories ────────────────────────────

  @Post()
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a menu category (MANAGER+)' })
  @ApiResponse({ status: 201, description: 'Category created' })
  create(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.menuService.createCategory(tenantId, restaurantId, user.role, dto);
  }

  // ── GET /restaurants/:restaurantId/categories ─────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all categories for a restaurant' })
  findAll(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
  ) {
    return this.menuService.listCategories(tenantId, restaurantId);
  }

  // ── PATCH /restaurants/:restaurantId/categories/reorder ──────────────────
  // IMPORTANT: must be defined BEFORE /:categoryId to avoid param conflict

  @Patch('reorder')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder categories by setting sortOrder (MANAGER+)' })
  reorder(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
    @Body() dto: ReorderDto,
  ) {
    return this.menuService.reorderCategories(tenantId, restaurantId, user.role, dto);
  }

  // ── GET /restaurants/:restaurantId/categories/:categoryId ─────────────────

  @Get(':categoryId')
  @ApiOperation({ summary: 'Get a category with its items' })
  findOne(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.menuService.getCategory(tenantId, restaurantId, categoryId);
  }

  // ── PATCH /restaurants/:restaurantId/categories/:categoryId ──────────────

  @Patch(':categoryId')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Update a category (MANAGER+)' })
  update(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('categoryId') categoryId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.menuService.updateCategory(tenantId, restaurantId, categoryId, user.role, dto);
  }

  // ── DELETE /restaurants/:restaurantId/categories/:categoryId ─────────────

  @Delete(':categoryId')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an empty category (MANAGER+)' })
  remove(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('categoryId') categoryId: string,
    @CurrentUser() user: any,
  ) {
    return this.menuService.deleteCategory(tenantId, restaurantId, categoryId, user.role);
  }
}
