/**
 * RestroCloud — Database Seed Script (M0.1.9)
 * Creates a demo restaurant with menu, tables, staff, and sample data.
 * Run: npm run db:seed
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding RestroCloud demo data...\n');

  // ─── Tenant ─────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'spice-garden-demo' },
    update: {},
    create: {
      name: 'Spice Garden Group',
      slug: 'spice-garden-demo',
      plan: 'PRO',
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  console.log(`✅ Tenant: ${tenant.name} (${tenant.id})`);

  // ─── Restaurant ──────────────────────────────────────────
  const restaurant = await prisma.restaurant.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'spice-garden-gulshan' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Spice Garden — Gulshan',
      slug: 'spice-garden-gulshan',
      description: 'Authentic Bangladeshi cuisine in the heart of Gulshan',
      phone: '+8801712345678',
      email: 'gulshan@spicegarden.bd',
      address: '45 Gulshan Avenue, Gulshan-2',
      city: 'Dhaka',
      country: 'BD',
      currency: 'BDT',
      timezone: 'Asia/Dhaka',
      taxRate: 15,
      taxInclusive: false,
      serviceCharge: 5,
      operatingHours: {
        regularHours: {
          mon: { open: '11:00', close: '23:00', closed: false },
          tue: { open: '11:00', close: '23:00', closed: false },
          wed: { open: '11:00', close: '23:00', closed: false },
          thu: { open: '11:00', close: '23:00', closed: false },
          fri: { open: '12:00', close: '23:30', closed: false },
          sat: { open: '12:00', close: '23:30', closed: false },
          sun: { open: '12:00', close: '22:00', closed: false },
        },
      },
    },
  });
  console.log(`✅ Restaurant: ${restaurant.name} (${restaurant.id})`);

  // ─── Users (Owner + Staff) ──────────────────────────────
  const passwordHash = await bcrypt.hash('Admin@SpiceGarden2026', 12);

  const owner = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'owner@spicegarden.bd' } },
    update: {},
    create: {
      tenantId: tenant.id,
      restaurantId: restaurant.id,
      email: 'owner@spicegarden.bd',
      firstName: 'Karim',
      lastName: 'Hossain',
      passwordHash,
      role: 'OWNER',
      isVerified: true,
    },
  });

  const manager = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'manager@spicegarden.bd' } },
    update: {},
    create: {
      tenantId: tenant.id,
      restaurantId: restaurant.id,
      email: 'manager@spicegarden.bd',
      firstName: 'Rina',
      lastName: 'Begum',
      passwordHash,
      role: 'MANAGER',
      isVerified: true,
    },
  });

  const cashier = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'cashier@spicegarden.bd' } },
    update: {},
    create: {
      tenantId: tenant.id,
      restaurantId: restaurant.id,
      email: 'cashier@spicegarden.bd',
      firstName: 'Nabil',
      lastName: 'Ahmed',
      passwordHash,
      pinHash: await bcrypt.hash('1234', 12),
      role: 'CASHIER',
      isVerified: true,
    },
  });

  const waiter = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'waiter@spicegarden.bd' } },
    update: {},
    create: {
      tenantId: tenant.id,
      restaurantId: restaurant.id,
      email: 'waiter@spicegarden.bd',
      firstName: 'Sadia',
      lastName: 'Islam',
      passwordHash,
      pinHash: await bcrypt.hash('5678', 12),
      role: 'WAITER',
      isVerified: true,
    },
  });

  console.log(`✅ Users: Owner, Manager, Cashier, Waiter created`);

  // ─── Menu Categories ─────────────────────────────────────
  const catStarters = await prisma.category.upsert({
    where: { id: 'cat-starters-demo' },
    update: {},
    create: {
      id: 'cat-starters-demo',
      tenantId: tenant.id,
      restaurantId: restaurant.id,
      name: 'Starters',
      sortOrder: 1,
    },
  });

  const catMains = await prisma.category.upsert({
    where: { id: 'cat-mains-demo' },
    update: {},
    create: {
      id: 'cat-mains-demo',
      tenantId: tenant.id,
      restaurantId: restaurant.id,
      name: 'Main Course',
      sortOrder: 2,
    },
  });

  const catBiryani = await prisma.category.upsert({
    where: { id: 'cat-biryani-demo' },
    update: {},
    create: {
      id: 'cat-biryani-demo',
      tenantId: tenant.id,
      restaurantId: restaurant.id,
      name: 'Biryani & Rice',
      sortOrder: 3,
    },
  });

  const catDrinks = await prisma.category.upsert({
    where: { id: 'cat-drinks-demo' },
    update: {},
    create: {
      id: 'cat-drinks-demo',
      tenantId: tenant.id,
      restaurantId: restaurant.id,
      name: 'Drinks',
      sortOrder: 4,
    },
  });

  console.log(`✅ Categories: Starters, Main Course, Biryani & Rice, Drinks`);

  // ─── Modifier Groups ─────────────────────────────────────
  const sizeGroup = await prisma.modifierGroup.upsert({
    where: { id: 'mg-size-demo' },
    update: {},
    create: {
      id: 'mg-size-demo',
      tenantId: tenant.id,
      restaurantId: restaurant.id,
      name: 'Portion Size',
      minSelect: 1,
      maxSelect: 1,
      isRequired: true,
    },
  });

  const spiceGroup = await prisma.modifierGroup.upsert({
    where: { id: 'mg-spice-demo' },
    update: {},
    create: {
      id: 'mg-spice-demo',
      tenantId: tenant.id,
      restaurantId: restaurant.id,
      name: 'Spice Level',
      minSelect: 0,
      maxSelect: 1,
      isRequired: false,
    },
  });

  // Modifiers for Size
  await prisma.modifier.upsert({
    where: { id: 'mod-half-demo' },
    update: {},
    create: { id: 'mod-half-demo', tenantId: tenant.id, modifierGroupId: sizeGroup.id, name: 'Half', priceAdjustment: -100, sortOrder: 1 },
  });
  await prisma.modifier.upsert({
    where: { id: 'mod-full-demo' },
    update: {},
    create: { id: 'mod-full-demo', tenantId: tenant.id, modifierGroupId: sizeGroup.id, name: 'Full', priceAdjustment: 0, isDefault: true, sortOrder: 2 },
  });

  // Modifiers for Spice
  await prisma.modifier.upsert({
    where: { id: 'mod-mild-demo' },
    update: {},
    create: { id: 'mod-mild-demo', tenantId: tenant.id, modifierGroupId: spiceGroup.id, name: 'Mild', priceAdjustment: 0, sortOrder: 1 },
  });
  await prisma.modifier.upsert({
    where: { id: 'mod-medium-demo' },
    update: {},
    create: { id: 'mod-medium-demo', tenantId: tenant.id, modifierGroupId: spiceGroup.id, name: 'Medium', priceAdjustment: 0, isDefault: true, sortOrder: 2 },
  });
  await prisma.modifier.upsert({
    where: { id: 'mod-hot-demo' },
    update: {},
    create: { id: 'mod-hot-demo', tenantId: tenant.id, modifierGroupId: spiceGroup.id, name: 'Extra Hot', priceAdjustment: 0, sortOrder: 3 },
  });

  console.log(`✅ Modifier groups: Portion Size, Spice Level`);

  // ─── Menu Items ──────────────────────────────────────────
  const items = [
    { id: 'item-singara', categoryId: catStarters.id, name: 'Vegetable Singara', price: 50, preparationTime: 5, dietaryTags: ['vegetarian'] },
    { id: 'item-chicken-roast', categoryId: catMains.id, name: 'Half Roast Chicken', price: 450, preparationTime: 20 },
    { id: 'item-beef-bhuna', categoryId: catMains.id, name: 'Beef Bhuna', price: 380, preparationTime: 25 },
    { id: 'item-mutton-curry', categoryId: catMains.id, name: 'Mutton Curry', price: 420, preparationTime: 30 },
    { id: 'item-chicken-biryani', categoryId: catBiryani.id, name: 'Chicken Biryani', price: 350, preparationTime: 25 },
    { id: 'item-mutton-biryani', categoryId: catBiryani.id, name: 'Mutton Biryani', price: 450, preparationTime: 30 },
    { id: 'item-plain-rice', categoryId: catBiryani.id, name: 'Plain Rice', price: 80, preparationTime: 10 },
    { id: 'item-borhani', categoryId: catDrinks.id, name: 'Borhani', price: 80, preparationTime: 2, dietaryTags: ['vegetarian'] },
    { id: 'item-lassi', categoryId: catDrinks.id, name: 'Mango Lassi', price: 120, preparationTime: 3, dietaryTags: ['vegetarian'] },
    { id: 'item-water', categoryId: catDrinks.id, name: 'Mineral Water', price: 30, preparationTime: 1, dietaryTags: ['vegan'] },
  ];

  for (const item of items) {
    await prisma.item.upsert({
      where: { id: item.id },
      update: {},
      create: {
        id: item.id,
        tenantId: tenant.id,
        restaurantId: restaurant.id,
        categoryId: item.categoryId,
        name: item.name,
        price: item.price,
        preparationTime: item.preparationTime,
        dietaryTags: item.dietaryTags || [],
      },
    });
  }

  console.log(`✅ Menu items: ${items.length} items created`);

  // ─── Floor Sections & Tables ─────────────────────────────
  const indoorSection = await prisma.floorSection.upsert({
    where: { id: 'section-indoor-demo' },
    update: {},
    create: {
      id: 'section-indoor-demo',
      tenantId: tenant.id,
      restaurantId: restaurant.id,
      name: 'Indoor',
      sortOrder: 1,
    },
  });

  const vipSection = await prisma.floorSection.upsert({
    where: { id: 'section-vip-demo' },
    update: {},
    create: {
      id: 'section-vip-demo',
      tenantId: tenant.id,
      restaurantId: restaurant.id,
      name: 'VIP',
      sortOrder: 2,
    },
  });

  // Indoor tables (T01–T10)
  for (let i = 1; i <= 10; i++) {
    const tableNum = `T${String(i).padStart(2, '0')}`;
    await prisma.restaurantTable.upsert({
      where: { restaurantId_floorSectionId_tableNumber: { restaurantId: restaurant.id, floorSectionId: indoorSection.id, tableNumber: tableNum } },
      update: {},
      create: {
        tenantId: tenant.id,
        restaurantId: restaurant.id,
        floorSectionId: indoorSection.id,
        tableNumber: tableNum,
        capacity: i <= 5 ? 2 : 4,
        qrCode: `QR-${restaurant.id}-${tableNum}`,
      },
    });
  }

  // VIP tables (V01–V03)
  for (let i = 1; i <= 3; i++) {
    const tableNum = `V${String(i).padStart(2, '0')}`;
    await prisma.restaurantTable.upsert({
      where: { restaurantId_floorSectionId_tableNumber: { restaurantId: restaurant.id, floorSectionId: vipSection.id, tableNumber: tableNum } },
      update: {},
      create: {
        tenantId: tenant.id,
        restaurantId: restaurant.id,
        floorSectionId: vipSection.id,
        tableNumber: tableNum,
        capacity: 8,
        qrCode: `QR-${restaurant.id}-${tableNum}`,
      },
    });
  }

  console.log(`✅ Tables: 10 indoor + 3 VIP tables created`);

  // ─── Sample Customer ─────────────────────────────────────
  const customer = await prisma.customer.upsert({
    where: { restaurantId_phone: { restaurantId: restaurant.id, phone: '+8801912345678' } },
    update: {},
    create: {
      tenantId: tenant.id,
      restaurantId: restaurant.id,
      firstName: 'Ayesha',
      lastName: 'Chowdhury',
      phone: '+8801912345678',
      email: 'ayesha@example.com',
    },
  });

  await prisma.loyaltyAccount.upsert({
    where: { customerId: customer.id },
    update: {},
    create: {
      tenantId: tenant.id,
      customerId: customer.id,
      points: 250,
      totalEarned: 250,
    },
  });

  await prisma.address.create({
    data: {
      tenantId: tenant.id,
      customerId: customer.id,
      label: 'Home',
      line1: '12 Banani Road 11',
      city: 'Dhaka',
      country: 'BD',
      isDefault: true,
    },
  }).catch(() => {}); // ignore duplicates

  console.log(`✅ Sample customer: ${customer.firstName} ${customer.lastName}`);

  // ─── Permissions (M1.6) ──────────────────────────────────
  const permissions = [
    // Orders
    { resource: 'orders', action: 'read' },
    { resource: 'orders', action: 'write' },
    { resource: 'orders', action: 'cancel' },
    { resource: 'orders', action: 'refund' },
    // Menu
    { resource: 'menu', action: 'read' },
    { resource: 'menu', action: 'write' },
    { resource: 'menu', action: 'delete' },
    // Reports
    { resource: 'reports', action: 'read' },
    { resource: 'reports', action: 'export' },
    // Tables
    { resource: 'tables', action: 'read' },
    { resource: 'tables', action: 'write' },
    // Payments
    { resource: 'payments', action: 'read' },
    { resource: 'payments', action: 'process' },
    // Customers
    { resource: 'customers', action: 'read' },
    { resource: 'customers', action: 'write' },
    // Staff
    { resource: 'staff', action: 'read' },
    { resource: 'staff', action: 'write' },
    // Settings
    { resource: 'settings', action: 'read' },
    { resource: 'settings', action: 'write' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { resource_action: { resource: perm.resource, action: perm.action } },
      update: {},
      create: { resource: perm.resource, action: perm.action },
    });
  }
  console.log(`✅ Permissions: ${permissions.length} permissions seeded`);

  // ─── Super Admin (M10) ───────────────────────────────────
  const superAdminPasswordHash = await bcrypt.hash('SuperAdmin@RestroCloud2026', 12);

  const platformTenant = await prisma.tenant.upsert({
    where: { slug: 'restrocloud-platform' },
    update: {},
    create: {
      name: 'RestroCloud Platform',
      slug: 'restrocloud-platform',
      plan: 'ENTERPRISE',
    },
  });

  const superAdmin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: platformTenant.id, email: 'superadmin@restrocloud.com' } },
    update: {},
    create: {
      tenantId: platformTenant.id,
      email: 'superadmin@restrocloud.com',
      firstName: 'Super',
      lastName: 'Admin',
      passwordHash: superAdminPasswordHash,
      role: 'SUPER_ADMIN',
      isVerified: true,
      isActive: true,
    },
  });
  console.log(`✅ Super Admin: ${superAdmin.email} (${superAdmin.id})`);

  // ─── Plans ───────────────────────────────────────────────
  const planDefs = [
    { tier: 'STARTER',    name: 'Starter',    priceMonthly: 49,  priceAnnual: 470,  sortOrder: 1, maxLocations: 1,  features: ['1 location', 'Menu & Orders', 'Basic POS', 'Email support'] },
    { tier: 'GROWTH',     name: 'Growth',     priceMonthly: 129, priceAnnual: 1238, sortOrder: 2, maxLocations: 3,  features: ['Up to 3 locations', 'All Starter features', 'Analytics', 'KDS', 'Priority support'] },
    { tier: 'PRO',        name: 'Pro',        priceMonthly: 299, priceAnnual: 2870, sortOrder: 3, maxLocations: -1, features: ['Unlimited locations', 'All Growth features', 'Aggregators', 'Delivery management', 'Dedicated support'] },
    { tier: 'ENTERPRISE', name: 'Enterprise', priceMonthly: 0,   priceAnnual: 0,    sortOrder: 4, maxLocations: -1, features: ['Custom locations', 'White-label', 'SLA guarantee', 'Dedicated account manager'] },
  ] as const;
  for (const p of planDefs) {
    await prisma.plan.upsert({
      where: { tier: p.tier },
      update: { priceMonthly: p.priceMonthly, priceAnnual: p.priceAnnual, features: p.features, maxLocations: p.maxLocations },
      create: { name: p.name, tier: p.tier, priceMonthly: p.priceMonthly, priceAnnual: p.priceAnnual, features: p.features, maxLocations: p.maxLocations, sortOrder: p.sortOrder },
    });
  }
  console.log('✅ Plans seeded (4 tiers with features)');

  // ─── Summary ─────────────────────────────────────────────
  console.log('\n🎉 Seed complete! Demo credentials:');
  console.log('   Owner:      owner@spicegarden.bd      / Admin@SpiceGarden2026');
  console.log('   Manager:    manager@spicegarden.bd    / Admin@SpiceGarden2026');
  console.log('   Cashier:    cashier@spicegarden.bd    / Admin@SpiceGarden2026 (PIN: 1234)');
  console.log('   Waiter:     waiter@spicegarden.bd     / Admin@SpiceGarden2026 (PIN: 5678)');
  console.log('   SuperAdmin: superadmin@restrocloud.com / SuperAdmin@RestroCloud2026');
  console.log('\n   Tenant ID:', tenant.id);
  console.log('   Restaurant ID:', restaurant.id);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
