/**
 * src/data/supplierDatabase.js
 * Master supplier registry with risk scores, geopolitical flags,
 * reliability metrics, alternate-source mappings.
 */

const SUPPLIERS = [
  // ── Semiconductors / Electronics ─────────────────────────────────────────
  {
    id: 'SUP001', name: 'TSMC', country: 'Taiwan', region: 'Asia-Pacific',
    category: 'Semiconductor', tier: 1,
    riskScore: 61, reliability: 72, onTimeDelivery: 88,
    geopoliticalRisk: 'Critical', leadTimeDays: 90,
    costIndex: 100, currency: 'USD',
    parts: ['MCU', 'ADAS Chips', 'Power IC', 'Sensor IC'],
    certifications: ['IATF16949', 'ISO9001', 'AEC-Q100'],
    paymentTerms: 'Net-60', annualSpend: 42000000,
    riskFlags: ['Taiwan-China tension', 'Single-source dependency', 'Allocation cuts Q3'],
    alternateIds: ['SUP002', 'SUP003', 'SUP004'],
    coordinates: { lat: 24.1, lng: 120.7 }
  },
  {
    id: 'SUP002', name: 'STMicroelectronics', country: 'Italy', region: 'Europe',
    category: 'Semiconductor', tier: 1,
    riskScore: 88, reliability: 91, onTimeDelivery: 94,
    geopoliticalRisk: 'Low', leadTimeDays: 12,
    costIndex: 108, currency: 'EUR',
    parts: ['SPC58 MCU', 'ADAS SoC', 'Motor Driver IC'],
    certifications: ['IATF16949', 'ISO9001', 'AEC-Q100', 'ISO26262-ASIL-D'],
    paymentTerms: 'Net-45', annualSpend: 8000000,
    riskFlags: [],
    alternateIds: ['SUP003', 'SUP004'],
    coordinates: { lat: 45.5, lng: 8.9 }
  },
  {
    id: 'SUP003', name: 'Infineon Technologies', country: 'Germany', region: 'Europe',
    category: 'Semiconductor', tier: 1,
    riskScore: 90, reliability: 93, onTimeDelivery: 95,
    geopoliticalRisk: 'Low', leadTimeDays: 18,
    costIndex: 105, currency: 'EUR',
    parts: ['AURIX TC3xx', 'OPTIGA TPM', 'CoolMOS'],
    certifications: ['IATF16949', 'AEC-Q100', 'ISO26262-ASIL-D'],
    paymentTerms: 'Net-45', annualSpend: 6500000,
    riskFlags: [],
    alternateIds: ['SUP002', 'SUP004'],
    coordinates: { lat: 48.1, lng: 11.6 }
  },
  {
    id: 'SUP004', name: 'NXP Semiconductors', country: 'Netherlands', region: 'Europe',
    category: 'Semiconductor', tier: 1,
    riskScore: 87, reliability: 90, onTimeDelivery: 93,
    geopoliticalRisk: 'Low', leadTimeDays: 14,
    costIndex: 106, currency: 'EUR',
    parts: ['S32K MCU', 'S32G Network Proc', 'FS65 SBC'],
    certifications: ['IATF16949', 'AEC-Q100', 'ISO26262-ASIL-D'],
    paymentTerms: 'Net-45', annualSpend: 7200000,
    riskFlags: [],
    alternateIds: ['SUP002', 'SUP003'],
    coordinates: { lat: 52.4, lng: 4.9 }
  },
  // ── Battery / Energy Storage ──────────────────────────────────────────────
  {
    id: 'SUP010', name: 'CATL', country: 'China', region: 'Asia-Pacific',
    category: 'Battery', tier: 1,
    riskScore: 72, reliability: 85, onTimeDelivery: 87,
    geopoliticalRisk: 'Medium', leadTimeDays: 45,
    costIndex: 100, currency: 'CNY',
    parts: ['NMC Cell', 'LFP Cell', 'BMS Module'],
    certifications: ['IATF16949', 'UN38.3', 'IEC62133'],
    paymentTerms: 'Net-60', annualSpend: 65000000,
    riskFlags: ['US-China trade tensions', 'Export control risk'],
    alternateIds: ['SUP011', 'SUP012'],
    coordinates: { lat: 26.1, lng: 117.1 }
  },
  {
    id: 'SUP011', name: 'Tata Chemicals (EV Batt)', country: 'India', region: 'South Asia',
    category: 'Battery', tier: 1,
    riskScore: 84, reliability: 80, onTimeDelivery: 85,
    geopoliticalRisk: 'Low', leadTimeDays: 20,
    costIndex: 95, currency: 'INR',
    parts: ['LFP Cell', 'Pouch Cell'],
    certifications: ['IATF16949', 'BIS', 'UN38.3'],
    paymentTerms: 'Net-30', annualSpend: 12000000,
    riskFlags: ['Scaling capacity'],
    alternateIds: ['SUP012'],
    coordinates: { lat: 19.0, lng: 72.9 }
  },
  {
    id: 'SUP012', name: 'Samsung SDI', country: 'South Korea', region: 'Asia-Pacific',
    category: 'Battery', tier: 1,
    riskScore: 80, reliability: 88, onTimeDelivery: 91,
    geopoliticalRisk: 'Low', leadTimeDays: 35,
    costIndex: 110, currency: 'KRW',
    parts: ['NMC 811 Cell', 'Prismatic Module'],
    certifications: ['IATF16949', 'IEC62133', 'UL'],
    paymentTerms: 'Net-60', annualSpend: 18000000,
    riskFlags: [],
    alternateIds: ['SUP011'],
    coordinates: { lat: 37.4, lng: 127.1 }
  },
  // ── Steel / Metals ────────────────────────────────────────────────────────
  {
    id: 'SUP020', name: 'Tata Steel', country: 'India', region: 'South Asia',
    category: 'Steel', tier: 1,
    riskScore: 89, reliability: 92, onTimeDelivery: 94,
    geopoliticalRisk: 'Low', leadTimeDays: 10,
    costIndex: 98, currency: 'INR',
    parts: ['HRC Coil', 'CR Sheet', 'HSLA Steel', 'Galvanized Sheet'],
    certifications: ['IATF16949', 'ISO9001', 'BIS'],
    paymentTerms: 'Net-30', annualSpend: 28000000,
    riskFlags: [],
    alternateIds: ['SUP021'],
    coordinates: { lat: 22.8, lng: 86.2 }
  },
  {
    id: 'SUP021', name: 'POSCO', country: 'South Korea', region: 'Asia-Pacific',
    category: 'Steel', tier: 1,
    riskScore: 76, reliability: 86, onTimeDelivery: 88,
    geopoliticalRisk: 'Medium', leadTimeDays: 25,
    costIndex: 102, currency: 'KRW',
    parts: ['Advanced HiForm Steel', 'Electrical Steel'],
    certifications: ['IATF16949', 'ISO9001'],
    paymentTerms: 'Net-60', annualSpend: 14000000,
    riskFlags: ['Tariff risk +12%'],
    alternateIds: ['SUP020'],
    coordinates: { lat: 36.0, lng: 129.4 }
  },
  // ── Cobalt / Raw Materials ────────────────────────────────────────────────
  {
    id: 'SUP030', name: 'Glencore (DRC)', country: 'DRC', region: 'Africa',
    category: 'Raw Material', tier: 2,
    riskScore: 48, reliability: 65, onTimeDelivery: 70,
    geopoliticalRisk: 'Critical', leadTimeDays: 60,
    costIndex: 100, currency: 'USD',
    parts: ['Cobalt Hydroxide', 'Cobalt Metal'],
    certifications: ['ISO9001'],
    paymentTerms: 'Net-90', annualSpend: 9500000,
    riskFlags: ['DRC export levy +15%', 'Political instability', 'Single-country 73% global supply'],
    alternateIds: ['SUP031', 'SUP032'],
    coordinates: { lat: -10.7, lng: 25.5 }
  },
  {
    id: 'SUP031', name: 'Glencore (Australia)', country: 'Australia', region: 'Oceania',
    category: 'Raw Material', tier: 2,
    riskScore: 82, reliability: 84, onTimeDelivery: 86,
    geopoliticalRisk: 'Low', leadTimeDays: 40,
    costIndex: 114, currency: 'AUD',
    parts: ['Cobalt Sulfate', 'Nickel-Cobalt Mix'],
    certifications: ['ISO9001', 'ISO14001'],
    paymentTerms: 'Net-60', annualSpend: 3000000,
    riskFlags: [],
    alternateIds: ['SUP032'],
    coordinates: { lat: -32.0, lng: 148.6 }
  },
  {
    id: 'SUP032', name: 'MP Materials', country: 'USA', region: 'North America',
    category: 'Raw Material', tier: 2,
    riskScore: 85, reliability: 80, onTimeDelivery: 82,
    geopoliticalRisk: 'Low', leadTimeDays: 30,
    costIndex: 118, currency: 'USD',
    parts: ['Rare Earth Oxide', 'Neodymium'],
    certifications: ['ISO9001'],
    paymentTerms: 'Net-45', annualSpend: 2500000,
    riskFlags: ['Limited capacity scaling'],
    alternateIds: [],
    coordinates: { lat: 35.3, lng: -115.5 }
  },
  // ── Wiring / Harness ──────────────────────────────────────────────────────
  {
    id: 'SUP040', name: 'Aptiv', country: 'Mexico', region: 'North America',
    category: 'Wiring Harness', tier: 1,
    riskScore: 91, reliability: 95, onTimeDelivery: 97,
    geopoliticalRisk: 'Low', leadTimeDays: 8,
    costIndex: 96, currency: 'USD',
    parts: ['Main Harness', 'Engine Harness', 'Door Module'],
    certifications: ['IATF16949', 'ISO9001', 'UL'],
    paymentTerms: 'Net-30', annualSpend: 22000000,
    riskFlags: [],
    alternateIds: ['SUP041'],
    coordinates: { lat: 25.7, lng: -100.3 }
  },
  {
    id: 'SUP041', name: 'Motherson Sumi', country: 'India', region: 'South Asia',
    category: 'Wiring Harness', tier: 1,
    riskScore: 87, reliability: 90, onTimeDelivery: 92,
    geopoliticalRisk: 'Low', leadTimeDays: 12,
    costIndex: 90, currency: 'INR',
    parts: ['Complete Harness Set', 'High-Voltage Harness'],
    certifications: ['IATF16949', 'ISO9001'],
    paymentTerms: 'Net-30', annualSpend: 16000000,
    riskFlags: [],
    alternateIds: [],
    coordinates: { lat: 28.5, lng: 77.2 }
  },
  // ── ADAS / Vision Systems ─────────────────────────────────────────────────
  {
    id: 'SUP050', name: 'Valeo', country: 'France', region: 'Europe',
    category: 'ADAS', tier: 1,
    riskScore: 87, reliability: 91, onTimeDelivery: 93,
    geopoliticalRisk: 'Low', leadTimeDays: 20,
    costIndex: 105, currency: 'EUR',
    parts: ['Camera Module', 'Lidar', 'Ultrasonic Sensors'],
    certifications: ['IATF16949', 'ISO26262-ASIL-C'],
    paymentTerms: 'Net-45', annualSpend: 11000000,
    riskFlags: [],
    alternateIds: ['SUP051'],
    coordinates: { lat: 48.9, lng: 2.3 }
  },
  {
    id: 'SUP051', name: 'Bosch India', country: 'India', region: 'South Asia',
    category: 'Electronics', tier: 1,
    riskScore: 94, reliability: 97, onTimeDelivery: 97,
    geopoliticalRisk: 'Low', leadTimeDays: 14,
    costIndex: 100, currency: 'INR',
    parts: ['ECU', 'Fuel Injectors', 'ABS Module', 'Sensor Array'],
    certifications: ['IATF16949', 'ISO9001', 'ISO26262-ASIL-B'],
    paymentTerms: 'Net-30', annualSpend: 31000000,
    riskFlags: [],
    alternateIds: [],
    coordinates: { lat: 12.9, lng: 77.6 }
  },
  // ── Thermal / HVAC ────────────────────────────────────────────────────────
  {
    id: 'SUP060', name: 'Denso', country: 'Japan', region: 'Asia-Pacific',
    category: 'Thermal', tier: 1,
    riskScore: 79, reliability: 87, onTimeDelivery: 84,
    geopoliticalRisk: 'Low', leadTimeDays: 30,
    costIndex: 108, currency: 'JPY',
    parts: ['AC Compressor', 'Radiator', 'Thermal Management Module'],
    certifications: ['IATF16949', 'ISO9001'],
    paymentTerms: 'Net-60', annualSpend: 19000000,
    riskFlags: ['Shipping delay Q2 +12 days'],
    alternateIds: ['SUP061'],
    coordinates: { lat: 34.7, lng: 137.1 }
  },
  {
    id: 'SUP061', name: 'Subros', country: 'India', region: 'South Asia',
    category: 'Thermal', tier: 1,
    riskScore: 85, reliability: 88, onTimeDelivery: 90,
    geopoliticalRisk: 'Low', leadTimeDays: 10,
    costIndex: 88, currency: 'INR',
    parts: ['AC Compressor', 'Condenser', 'Evaporator'],
    certifications: ['IATF16949', 'ISO9001'],
    paymentTerms: 'Net-30', annualSpend: 9000000,
    riskFlags: [],
    alternateIds: [],
    coordinates: { lat: 28.6, lng: 77.2 }
  }
];

module.exports = { SUPPLIERS };
