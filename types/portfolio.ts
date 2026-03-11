// Portfolio vehicle stored in Supabase
export interface PortfolioVehicle {
  id: string
  user_id: string

  // Core identity
  make: string
  model: string
  year: number
  trim?: string | null

  // Purchase info
  purchase_price: number
  purchase_date?: string | null
  purchase_mileage?: number | null

  // Vehicle specs
  current_mileage?: number | null
  fuel_type?: string | null
  transmission?: string | null
  body_type?: string | null
  exterior_color?: string | null
  interior_color?: string | null
  num_doors?: number | null
  num_seats?: number | null
  engine_displacement_cc?: number | null
  power_kw?: number | null
  power_hp?: number | null
  drivetrain?: string | null

  // Documentation
  vin?: string | null
  license_plate?: string | null
  condition?: string | null
  modifications?: string | null
  notes?: string | null
  image_url?: string | null

  // Market valuation
  current_market_value?: number | null
  market_value_updated_at?: string | null
  valuation_source?: string | null
  valuation_sample_size?: number | null

  // Metadata
  created_at: string
  updated_at: string
  is_active: boolean
}

// For creating/updating vehicles (omit server-generated fields)
export type PortfolioVehicleInsert = Omit<
  PortfolioVehicle,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'is_active' | 'current_market_value' | 'market_value_updated_at' | 'valuation_source' | 'valuation_sample_size'
>

export type PortfolioVehicleUpdate = Partial<PortfolioVehicleInsert>

// Service record for a vehicle
export interface ServiceRecord {
  id: string
  vehicle_id: string
  user_id: string
  service_type: string
  description?: string | null
  cost?: number | null
  currency: string
  service_date: string
  mileage_at_service?: number | null
  provider?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
}

export type ServiceRecordInsert = Omit<ServiceRecord, 'id' | 'user_id' | 'created_at' | 'updated_at'>

export type ServiceRecordUpdate = Partial<Omit<ServiceRecordInsert, 'vehicle_id'>>

// Valuation history snapshot
export interface ValuationSnapshot {
  id: string
  vehicle_id: string
  user_id: string
  market_value: number
  sample_size?: number | null
  median_price?: number | null
  min_price?: number | null
  max_price?: number | null
  source: string
  recorded_at: string
}

// Valuation API response from Flask
export interface ValuationResponse {
  estimated_value: number
  median_price: number
  mean_price: number
  p25: number
  p75: number
  min_price: number
  max_price: number
  sample_size: number
  regression_estimate?: number | null
}

// Valuation API request
export interface ValuationRequest {
  make: string
  model: string
  year: number
  mileage_km: number
  body_type?: string
  transmission?: string
  fuel_type?: string
  power_kw?: number
}

// Dropdown option lists for the add-vehicle wizard
export const FUEL_TYPES = ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'Plugin Hybrid', 'LPG', 'CNG'] as const
export const TRANSMISSIONS = ['Manual', 'Automatic'] as const
export const BODY_TYPES = ['Sedan', 'SUV', 'Wagon', 'Coupe', 'Convertible', 'Hatchback', 'Van', 'Pickup', 'Other'] as const
export const DRIVETRAINS = ['FWD', 'RWD', 'AWD'] as const
export const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor'] as const
export const EXTERIOR_COLORS = ['Black', 'White', 'Silver', 'Grey', 'Blue', 'Red', 'Green', 'Brown', 'Beige', 'Yellow', 'Orange', 'Gold', 'Other'] as const
export const INTERIOR_COLORS = ['Black', 'Beige', 'Brown', 'Grey', 'White', 'Red', 'Blue', 'Other'] as const
export const SERVICE_TYPES = ['Oil Change', 'Brake Pads', 'Brake Discs', 'Tires', 'Battery', 'Inspection / MOT', 'Air Filter', 'Spark Plugs', 'Timing Belt', 'Clutch', 'Suspension', 'Bodywork', 'Paint', 'Other'] as const
