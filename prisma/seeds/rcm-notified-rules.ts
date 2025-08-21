import { PrismaClient } from '@prisma/client';

/**
 * Seed file for RCM Phase 2: Notified Services and Goods Rules
 * 
 * Seeds the database with all notified services and goods under RCM
 * as per Section 9(3) and 9(4) of CGST Act and GST notifications.
 */

const prisma = new PrismaClient();

export const NOTIFIED_RCM_RULES = [
  // NOTIFIED SERVICES
  {
    id: 'rcm-legal-services',
    ruleType: 'SERVICE',
    category: 'NOTIFIED',
    hsnSacCodes: ['9982', '998211', '998212', '998213'],
    description: 'Legal services provided by advocates, attorneys, solicitors, barristers',
    gstRate: 18.0,
    effectiveFrom: new Date('2017-07-01'), // GST implementation
    notificationNo: '13/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  {
    id: 'rcm-gta-services-5percent',
    ruleType: 'SERVICE',
    category: 'NOTIFIED',
    hsnSacCodes: ['9967', '996711', '996713', '996714'],
    description: 'Goods Transport Agency services (road transport)',
    gstRate: 5.0,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '13/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  {
    id: 'rcm-gta-services-12percent',
    ruleType: 'SERVICE',
    category: 'NOTIFIED',
    hsnSacCodes: ['996712', '996715'],
    description: 'Goods Transport Agency services (air/water transport)',
    gstRate: 12.0,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '13/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  {
    id: 'rcm-director-services',
    ruleType: 'SERVICE',
    category: 'NOTIFIED',
    hsnSacCodes: ['9954', '995411', '995412'],
    description: 'Services provided by a director to a company',
    gstRate: 18.0,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '13/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  {
    id: 'rcm-insurance-agent-services',
    ruleType: 'SERVICE',
    category: 'NOTIFIED',
    hsnSacCodes: ['9971', '997111', '997112'],
    description: 'Services provided by insurance agents',
    gstRate: 18.0,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '13/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  {
    id: 'rcm-recovery-agent-services',
    ruleType: 'SERVICE',
    category: 'NOTIFIED',
    hsnSacCodes: ['9983', '998311', '998312'],
    description: 'Services provided by recovery agents',
    gstRate: 18.0,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '13/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  {
    id: 'rcm-rent-a-cab-services',
    ruleType: 'SERVICE',
    category: 'NOTIFIED',
    hsnSacCodes: ['9964', '996411', '996412'],
    description: 'Rent-a-cab services',
    gstRate: 5.0,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '13/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  {
    id: 'rcm-works-contract-12percent',
    ruleType: 'SERVICE',
    category: 'NOTIFIED',
    hsnSacCodes: ['995421', '995422'],
    description: 'Works contract services - construction',
    gstRate: 12.0,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '13/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  {
    id: 'rcm-works-contract-18percent',
    ruleType: 'SERVICE',
    category: 'NOTIFIED',
    hsnSacCodes: ['995423', '995424'],
    description: 'Works contract services - specialized construction',
    gstRate: 18.0,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '13/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  {
    id: 'rcm-sponsorship-services',
    ruleType: 'SERVICE',
    category: 'NOTIFIED',
    hsnSacCodes: ['998321', '998322'],
    description: 'Sponsorship services',
    gstRate: 18.0,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '13/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  
  // NOTIFIED GOODS
  {
    id: 'rcm-cashew-nuts',
    ruleType: 'GOODS',
    category: 'NOTIFIED',
    hsnSacCodes: ['0801', '080110', '08011000', '08011100'],
    description: 'Cashew nuts, not shelled or peeled',
    gstRate: 5.0,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '8/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  {
    id: 'rcm-tobacco-leaves',
    ruleType: 'GOODS',
    category: 'NOTIFIED',
    hsnSacCodes: ['2401', '240110', '24011000', '24012000'],
    description: 'Tobacco leaves (unmanufactured)',
    gstRate: 5.0,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '8/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  {
    id: 'rcm-silk-yarn-5004',
    ruleType: 'GOODS',
    category: 'NOTIFIED',
    hsnSacCodes: ['5004', '500400', '50040000'],
    description: 'Silk yarn (not put up for retail sale)',
    gstRate: 5.0,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '8/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  {
    id: 'rcm-silk-yarn-5005',
    ruleType: 'GOODS',
    category: 'NOTIFIED',
    hsnSacCodes: ['5005', '500500', '50050000'],
    description: 'Yarn spun from silk waste (not put up for retail sale)',
    gstRate: 5.0,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '8/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  {
    id: 'rcm-silk-yarn-5006',
    ruleType: 'GOODS',
    category: 'NOTIFIED',
    hsnSacCodes: ['5006', '500600', '50060000'],
    description: 'Silk yarn and yarn spun from silk waste, put up for retail sale',
    gstRate: 5.0,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '8/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  {
    id: 'rcm-lottery-12percent',
    ruleType: 'GOODS',
    category: 'NOTIFIED',
    hsnSacCodes: ['9990', '999011', '99901100'],
    description: 'Supply of lottery (authorized by State Government)',
    gstRate: 12.0,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '8/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  {
    id: 'rcm-lottery-28percent',
    ruleType: 'GOODS',
    category: 'NOTIFIED',
    hsnSacCodes: ['999012', '99901200', '99901210'],
    description: 'Supply of lottery (State lottery)',
    gstRate: 28.0,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '8/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  {
    id: 'rcm-bidi-wrapper-leaves',
    ruleType: 'GOODS',
    category: 'NOTIFIED',
    hsnSacCodes: ['1404', '140420', '14042000'],
    description: 'Bidi wrapper leaves (tendu), whether or not in bundles',
    gstRate: 18.0,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '8/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  {
    id: 'rcm-raw-cotton',
    ruleType: 'GOODS',
    category: 'NOTIFIED',
    hsnSacCodes: ['5201', '520100', '52010000'],
    description: 'Raw cotton (not carded or combed)',
    gstRate: 5.0,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '8/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  }
];

/**
 * Seeds the RCM notified rules into the database
 */
export async function seedNotifiedRules() {
  console.log('🌱 Seeding RCM notified rules...');

  try {
    // Clear existing notified rules
    await prisma.rCMRule.deleteMany({
      where: {
        category: 'NOTIFIED'
      }
    });

    // Insert new rules
    const createdRules = [];
    for (const rule of NOTIFIED_RCM_RULES) {
      const createdRule = await prisma.rCMRule.create({
        data: rule
      });
      createdRules.push(createdRule);
    }

    console.log(`✅ Successfully seeded ${createdRules.length} RCM notified rules`);
    
    // Log summary
    const serviceRules = createdRules.filter(r => r.ruleType === 'SERVICE').length;
    const goodsRules = createdRules.filter(r => r.ruleType === 'GOODS').length;
    
    console.log(`   - ${serviceRules} Service rules`);
    console.log(`   - ${goodsRules} Goods rules`);
    
    return createdRules;
  } catch (error) {
    console.error('❌ Error seeding RCM notified rules:', error);
    throw error;
  }
}

/**
 * Clears all test RCM rules (for testing)
 */
export async function clearTestRules() {
  try {
    await prisma.rCMRule.deleteMany({
      where: {
        id: {
          startsWith: 'test-'
        }
      }
    });
    console.log('🧹 Cleared test RCM rules');
  } catch (error) {
    console.error('❌ Error clearing test rules:', error);
    throw error;
  }
}

/**
 * Gets all RCM rules from database
 */
export async function getRCMRules(category?: string) {
  const where = category ? { category } : {};
  
  return await prisma.rCMRule.findMany({
    where,
    orderBy: [
      { priority: 'desc' },
      { effectiveFrom: 'desc' }
    ]
  });
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedNotifiedRules()
    .then(() => {
      console.log('✅ RCM notified rules seeding completed');
    })
    .catch((error) => {
      console.error('❌ RCM notified rules seeding failed:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}