import { Module } from '@nestjs/common';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { CategoriesController } from './categories.controller';
import { ItemsController } from './items.controller';
import { ModifierGroupsController } from './modifier-groups.controller';
import { ModifierGroupsService } from './modifier-groups.service';
import { CombosController } from './combos.controller';
import { CombosService } from './combos.service';

@Module({
  controllers: [
    MenuController,
    CategoriesController,
    ItemsController,
    ModifierGroupsController,
    CombosController,
  ],
  providers: [
    MenuService,
    ModifierGroupsService,
    CombosService,
  ],
  exports: [MenuService],
})
export class MenuModule {}
