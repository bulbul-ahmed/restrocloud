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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { TablesService } from './tables.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { UpdateTableStatusDto } from './dto/update-table-status.dto';
import { OpenSessionDto } from './dto/open-session.dto';
import { CloseSessionDto } from './dto/close-session.dto';
import { ListTablesQueryDto } from './dto/list-tables-query.dto';

@ApiTags('tables')
@Controller('restaurants/:restaurantId/tables')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
@ApiParam({ name: 'restaurantId', description: 'Restaurant UUID' })
export class TablesController {
  constructor(private tablesService: TablesService) {}

  // ─── M5.10 POS overview (static — before :tableId) ───────────────────────

  @Get('overview')
  @ApiOperation({ summary: 'POS floor plan overview: all tables with live status + active session + orders' })
  getOverview(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
  ) {
    return this.tablesService.getTablesOverview(tenantId, restaurantId);
  }

  // ─── M5.2 Tables CRUD ────────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a table (MANAGER+)' })
  create(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateTableDto,
  ) {
    return this.tablesService.createTable(tenantId, restaurantId, user.role as UserRole, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List tables with optional filters (floorSectionId, status)' })
  findAll(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Query() query: ListTablesQueryDto,
  ) {
    return this.tablesService.listTables(tenantId, restaurantId, query);
  }

  @Get(':tableId')
  @ApiOperation({ summary: 'Get table with current session and active orders' })
  findOne(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('tableId') tableId: string,
  ) {
    return this.tablesService.getTable(tenantId, restaurantId, tableId);
  }

  @Patch(':tableId')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Update table properties (MANAGER+)' })
  update(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('tableId') tableId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateTableDto,
  ) {
    return this.tablesService.updateTable(tenantId, restaurantId, tableId, user.role as UserRole, dto);
  }

  @Delete(':tableId')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a table (MANAGER+). Fails if occupied or has active session.' })
  remove(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('tableId') tableId: string,
    @CurrentUser() user: any,
  ) {
    return this.tablesService.deleteTable(tenantId, restaurantId, tableId, user.role as UserRole);
  }

  // ─── M5.3 Table status ───────────────────────────────────────────────────

  @Patch(':tableId/status')
  @Roles(UserRole.WAITER)
  @ApiOperation({ summary: 'Update table status (WAITER+)' })
  updateStatus(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('tableId') tableId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateTableStatusDto,
  ) {
    return this.tablesService.updateTableStatus(
      tenantId,
      restaurantId,
      tableId,
      user.role as UserRole,
      dto,
    );
  }

  // ─── M5.4 Open session ───────────────────────────────────────────────────

  @Post(':tableId/sessions')
  @Roles(UserRole.WAITER)
  @ApiOperation({ summary: 'Open a table session / seat guests (WAITER+)' })
  openSession(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('tableId') tableId: string,
    @CurrentUser() user: any,
    @Body() dto: OpenSessionDto,
  ) {
    return this.tablesService.openSession(
      tenantId,
      restaurantId,
      tableId,
      user.id,
      user.role as UserRole,
      dto,
    );
  }

  // ─── M5.5 Get current session ────────────────────────────────────────────

  @Get(':tableId/sessions/current')
  @ApiOperation({ summary: 'Get the active session for a table with all open orders' })
  getCurrentSession(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('tableId') tableId: string,
  ) {
    return this.tablesService.getCurrentSession(tenantId, restaurantId, tableId);
  }

  // ─── M5.6 Request bill ───────────────────────────────────────────────────

  @Patch(':tableId/sessions/current/bill-request')
  @Roles(UserRole.WAITER)
  @ApiOperation({ summary: 'Request bill for the active session (WAITER+)' })
  requestBill(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('tableId') tableId: string,
    @CurrentUser() user: any,
  ) {
    return this.tablesService.requestBill(tenantId, restaurantId, tableId, user.role as UserRole);
  }

  // ─── M5.7 Close session ──────────────────────────────────────────────────

  @Patch(':tableId/sessions/:sessionId/close')
  @Roles(UserRole.WAITER)
  @ApiOperation({
    summary: 'Close a table session (WAITER+). Fails if there are incomplete orders.',
  })
  closeSession(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('tableId') tableId: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: any,
    @Body() dto: CloseSessionDto,
  ) {
    return this.tablesService.closeSession(
      tenantId,
      restaurantId,
      tableId,
      sessionId,
      user.id,
      user.role as UserRole,
      dto,
    );
  }

  // ─── Table transfer ───────────────────────────────────────────────────────

  @Patch(':tableId/sessions/current/transfer')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Transfer active session to another table (MANAGER+). Target must be AVAILABLE.' })
  transferSession(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('tableId') tableId: string,
    @Body() body: { targetTableId: string },
  ) {
    return this.tablesService.transferSession(tenantId, restaurantId, tableId, body.targetTableId);
  }
}
