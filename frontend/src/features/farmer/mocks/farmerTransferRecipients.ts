export const FARMER_TRANSFER_PREVIEW_RECIPIENTS = [
  {
    label: 'Farmer B',
    address: '0xFA00000000000000000000000000000000000001',
    description: 'Role farmer, không phải Logistics',
    eligible: false,
  },
  {
    label: 'Logistics',
    address: '0x1000000000000000000000000000000000000001',
    description: 'Role Logistics trong fixture mô phỏng',
    eligible: true,
  },
  {
    label: 'Retailer',
    address: '0xBE00000000000000000000000000000000000001',
    description: 'Role retailer, không phải Logistics',
    eligible: false,
  },
  {
    label: 'Ví chưa cấp quyền',
    address: '0xEE00000000000000000000000000000000000001',
    description: 'Chưa được cấp role Logistics',
    eligible: false,
  },
] as const

export const FARMER_TRANSFER_PREVIEW_LOGISTICS = FARMER_TRANSFER_PREVIEW_RECIPIENTS[1]
