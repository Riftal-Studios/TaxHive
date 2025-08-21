/**
 * RCM Phase 2: Notified Services and Goods Registry
 * 
 * Central registry of all services and goods notified under RCM
 * as per Section 9(3) and 9(4) of CGST Act.
 * 
 * This implementation is part of TDD GREEN phase - making tests pass.
 */

export interface NotifiedRule {
  id: string;
  ruleType: 'SERVICE' | 'GOODS';
  category: 'NOTIFIED';
  hsnSacCodes: string[];
  description: string;
  gstRate: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
  notificationNo?: string;
  isActive: boolean;
  priority: number;
}

/**
 * Registry of all notified services and goods under RCM
 * Based on GST notifications and government rules
 */
export const NOTIFIED_SERVICES_REGISTRY: NotifiedRule[] = [
  // Legal Services (SAC 9982)
  {
    id: 'notified-legal-services',
    ruleType: 'SERVICE',
    category: 'NOTIFIED',
    hsnSacCodes: ['9982', '998211', '998212', '998213'],
    description: 'Legal services provided by advocates, attorneys, solicitors, barristers',
    gstRate: 18,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '13/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  
  // GTA Services (SAC 9967) - 5% rate
  {
    id: 'notified-gta-services-5',
    ruleType: 'SERVICE',
    category: 'NOTIFIED',
    hsnSacCodes: ['9967', '996711', '996713', '996714'],
    description: 'Goods Transport Agency services (road transport)',
    gstRate: 5,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '13/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  // GTA Services (SAC 9967) - 12% rate with higher priority
  {
    id: 'notified-gta-services-12',
    ruleType: 'SERVICE',
    category: 'NOTIFIED',
    hsnSacCodes: ['996712', '996715'],
    description: 'Goods Transport Agency services (air/water transport)',
    gstRate: 12,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '13/2017-Central Tax (Rate)',
    isActive: true,
    priority: 15, // Higher priority than 5% rate
  },
  
  // Director Services (SAC 9954)
  {
    id: 'notified-director-services',
    ruleType: 'SERVICE',
    category: 'NOTIFIED',
    hsnSacCodes: ['9954', '995411', '995412'],
    description: 'Director services provided to a company',
    gstRate: 18,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '13/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  
  // Insurance Agent Services (SAC 9971)
  {
    id: 'notified-insurance-agent-services',
    ruleType: 'SERVICE',
    category: 'NOTIFIED',
    hsnSacCodes: ['9971', '997111', '997112'],
    description: 'Insurance agent services',
    gstRate: 18,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '13/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  
  // Recovery Agent Services (SAC 9983)
  {
    id: 'notified-recovery-agent-services',
    ruleType: 'SERVICE',
    category: 'NOTIFIED',
    hsnSacCodes: ['9983', '998311', '998312'],
    description: 'Recovery agent services',
    gstRate: 18,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '13/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  
  // Sponsorship Services (SAC 9983) - different subcodes
  {
    id: 'notified-sponsorship-services',
    ruleType: 'SERVICE',
    category: 'NOTIFIED',
    hsnSacCodes: ['998321', '998322'],
    description: 'Sponsorship services',
    gstRate: 18,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '13/2017-Central Tax (Rate)',
    isActive: true,
    priority: 20, // Higher priority than recovery agent services
  },
  
  // Rent-a-Cab Services (SAC 9964)
  {
    id: 'notified-rent-a-cab-services',
    ruleType: 'SERVICE',
    category: 'NOTIFIED',
    hsnSacCodes: ['9964', '996411', '996412'],
    description: 'Rent-a-Cab services',
    gstRate: 5,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '13/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  
  // Works Contract Services (SAC 9954)
  {
    id: 'notified-works-contract-12',
    ruleType: 'SERVICE',
    category: 'NOTIFIED',
    hsnSacCodes: ['995421', '995422'],
    description: 'Works Contract services - construction (12% rate)',
    gstRate: 12,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '13/2017-Central Tax (Rate)',
    isActive: true,
    priority: 15, // Higher priority than director services to avoid pattern conflicts
  },
  {
    id: 'notified-works-contract-18',
    ruleType: 'SERVICE',
    category: 'NOTIFIED',
    hsnSacCodes: ['995423', '995424'],
    description: 'Works Contract services - specialized construction (18% rate)',
    gstRate: 18,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '13/2017-Central Tax (Rate)',
    isActive: true,
    priority: 15, // Higher priority than director services to avoid pattern conflicts
  },
];

export const NOTIFIED_GOODS_REGISTRY: NotifiedRule[] = [
  // Cashew Nuts (HSN 0801)
  {
    id: 'notified-cashew-nuts',
    ruleType: 'GOODS',
    category: 'NOTIFIED',
    hsnSacCodes: ['0801', '080110', '08011000', '08011100'],
    description: 'Cashew nuts, not shelled or peeled',
    gstRate: 5,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '8/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  
  // Tobacco Leaves (HSN 2401)
  {
    id: 'notified-tobacco-leaves',
    ruleType: 'GOODS',
    category: 'NOTIFIED',
    hsnSacCodes: ['2401', '240110', '24011000', '24012000'],
    description: 'Tobacco leaves (unmanufactured)',
    gstRate: 5,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '8/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  
  // Silk Yarn (HSN 5004-5006)
  {
    id: 'notified-silk-yarn-5004',
    ruleType: 'GOODS',
    category: 'NOTIFIED',
    hsnSacCodes: ['5004', '500400', '50040000'],
    description: 'Silk yarn (not put up for retail sale)',
    gstRate: 5,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '8/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  {
    id: 'notified-silk-yarn-5005',
    ruleType: 'GOODS',
    category: 'NOTIFIED',
    hsnSacCodes: ['5005', '500500', '50050000'],
    description: 'Silk yarn spun from silk waste (not put up for retail sale)',
    gstRate: 5,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '8/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  {
    id: 'notified-silk-yarn-5006',
    ruleType: 'GOODS',
    category: 'NOTIFIED',
    hsnSacCodes: ['5006', '500600', '50060000'],
    description: 'Silk yarn and yarn spun from silk waste, put up for retail sale',
    gstRate: 5,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '8/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  
  // Lottery Supply (HSN 9990) - 12% rate
  {
    id: 'notified-lottery-12',
    ruleType: 'GOODS',
    category: 'NOTIFIED',
    hsnSacCodes: ['9990', '999011', '99901100'],
    description: 'Lottery supply (authorized by State Government)',
    gstRate: 12,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '8/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  // Lottery Supply (HSN 9990) - 28% rate with higher priority
  {
    id: 'notified-lottery-28',
    ruleType: 'GOODS',
    category: 'NOTIFIED',
    hsnSacCodes: ['999012', '99901200', '99901210'],
    description: 'Lottery supply (State lottery with higher rate)',
    gstRate: 28,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '8/2017-Central Tax (Rate)',
    isActive: true,
    priority: 15, // Higher priority than 12% rate
  },
  
  // Bidi Wrapper Leaves (HSN 1404)
  {
    id: 'notified-bidi-wrapper-leaves',
    ruleType: 'GOODS',
    category: 'NOTIFIED',
    hsnSacCodes: ['1404', '140420', '14042000'],
    description: 'Bidi wrapper leaves (tendu), whether or not in bundles',
    gstRate: 18,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '8/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
  
  // Raw Cotton (HSN 5201)
  {
    id: 'notified-raw-cotton',
    ruleType: 'GOODS',
    category: 'NOTIFIED',
    hsnSacCodes: ['5201', '520100', '52010000'],
    description: 'Raw cotton (not carded or combed)',
    gstRate: 5,
    effectiveFrom: new Date('2017-07-01'),
    notificationNo: '8/2017-Central Tax (Rate)',
    isActive: true,
    priority: 10,
  },
];

/**
 * Combined registry of all notified rules
 */
export const ALL_NOTIFIED_RULES: NotifiedRule[] = [
  ...NOTIFIED_SERVICES_REGISTRY,
  ...NOTIFIED_GOODS_REGISTRY,
];

/**
 * Get all notified rules from registry
 */
export function getNotifiedRules(): NotifiedRule[] {
  return ALL_NOTIFIED_RULES.filter(rule => rule.isActive);
}

/**
 * Validate a single RCM rule structure and dates
 */
export function validateRCMRule(rule: NotifiedRule): boolean {
  try {
    // Basic structure validation
    if (!rule.id || !rule.ruleType || !rule.category) {
      return false;
    }
    
    if (!['SERVICE', 'GOODS'].includes(rule.ruleType)) {
      return false;
    }
    
    if (rule.category !== 'NOTIFIED') {
      return false;
    }
    
    if (!Array.isArray(rule.hsnSacCodes) || rule.hsnSacCodes.length === 0) {
      return false;
    }
    
    if (!rule.description || rule.description.trim().length === 0) {
      return false;
    }
    
    if (typeof rule.gstRate !== 'number' || rule.gstRate <= 0) {
      return false;
    }
    
    // Date validation
    if (!rule.effectiveFrom || !(rule.effectiveFrom instanceof Date)) {
      return false;
    }
    
    if (isNaN(rule.effectiveFrom.getTime())) {
      return false;
    }
    
    // Check effective date is not in future
    const currentDate = new Date();
    if (rule.effectiveFrom > currentDate) {
      return false;
    }
    
    // Check effectiveTo is after effectiveFrom (if provided)
    if (rule.effectiveTo) {
      if (!(rule.effectiveTo instanceof Date)) {
        return false;
      }
      
      if (isNaN(rule.effectiveTo.getTime())) {
        return false;
      }
      
      if (rule.effectiveTo <= rule.effectiveFrom) {
        return false;
      }
      
      // Check if rule has expired
      if (rule.effectiveTo < currentDate) {
        return false;
      }
    }
    
    if (typeof rule.priority !== 'number') {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}