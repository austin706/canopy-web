// ═══════════════════════════════════════════════════════════════
// AI Service — Claude Vision for Photo Scanning (Web version)
// ═══════════════════════════════════════════════════════════════
//
// DUAL-MODE ROUTING:
// This service routes AI requests through a Supabase Edge Function when available,
// keeping the Anthropic API key server-side for security. The Edge Function is
// preferred over direct API calls from the client. In development or when the
// Edge Function URL is not configured, it falls back to direct API calls with a warning.
//
// Environment variables:
// - VITE_SUPABASE_URL: Supabase project URL (enables Edge Function routing)
// - VITE_AI_API_KEY: Anthropic API key (fallback for direct client calls)

import { supabase } from './supabase';

const CLAUDE_API_KEY = import.meta.env.VITE_AI_API_KEY || '';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

export interface ScanResult {
  make: string;
  model: string;
  serial_number?: string;
  capacity?: string;
  install_date?: string;
  fuel_type?: string;
  efficiency_rating?: string;
  filter_size?: string;
  additional_info: Record<string, string>;
  confidence: number;
  // Enhanced scan fields (v2)
  category?: string;           // Mapped to our categories: hvac, water_heater, appliance, etc.
  equipment_subtype?: string;  // e.g., "Evaporator Coil", "Gas Furnace", "Tankless Water Heater"
  estimated_lifespan_years?: number;
  refrigerant_type?: string;   // e.g., "R22", "R410A", "R32"
  alerts?: string[];           // Actionable alerts like "Uses R22 refrigerant (phased out since 2020)"
}

/**
 * Call Claude API through Supabase Edge Function (scan-equipment)
 * Routes all AI actions through a single Edge Function that keeps the API key server-side.
 */
const callAI = async (payload: Record<string, unknown>): Promise<Response> => {
  if (!SUPABASE_URL) {
    throw new Error(
      'The AI scanner requires server-side configuration. Please ensure Supabase Edge Function is set up.'
    );
  }

  try {
    // Always call scan-equipment function — it routes internally by action field
    console.log('[AI] Calling scan-equipment Edge Function, action:', payload.action);
    const response = await supabase.functions.invoke('scan-equipment', {
      body: payload,
    });

    // Handle errors from Edge Function
    if (response.error) {
      const status = (response.error as any)?.status;
      const msg = response.error?.message || 'Unknown error';
      console.error('[AI] Edge Function error:', status, msg);

      if (status === 401) {
        throw new Error('Authentication failed. Please sign in again.');
      }
      throw new Error(`AI scan failed: ${msg}`);
    }

    // supabase.functions.invoke returns { data, error }
    return new Response(JSON.stringify(response.data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    // Re-throw known errors with their original message
    if (error instanceof Error && (
      error.message.includes('Authentication failed') ||
      error.message.includes('AI scan failed')
    )) {
      throw error;
    }
    console.error('[AI] Edge Function call failed:', error);
    throw new Error(
      `The AI scanner service is temporarily unavailable. ${error instanceof Error ? error.message : 'Please try again later.'}`
    );
  }
};

/**
 * Scan an equipment label photo using Claude Vision
 * Sends the image to Claude API (via Edge Function when available) and extracts structured equipment data
 */
export const scanEquipmentLabel = async (imageBase64: string): Promise<ScanResult> => {
  // Note: imageBase64 is only sent inside messages (not duplicated at top level)
  // to keep payload size within Supabase Edge Function limits
  const response = await callAI({
    action: 'scan-equipment',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
          },
          {
            type: 'text',
            text: `You are analyzing an equipment label photo for a home maintenance app called Canopy.
Extract all identifiable information and return a JSON object with these fields:
- make: manufacturer/brand name
- model: model number
- serial_number: serial number if visible
- capacity: capacity (tonnage, gallons, BTU, etc.)
- install_date: manufacture or install date if visible (YYYY-MM-DD format)
- fuel_type: gas, electric, propane, etc.
- efficiency_rating: SEER, EF, AFUE, etc.
- filter_size: if this is an HVAC system and filter size is visible
- category: map to ONE of these exact values based on what the equipment is: hvac, water_heater, appliance, roof, plumbing, electrical, outdoor, safety, pool, garage
- equipment_subtype: specific type like "Evaporator Coil", "Gas Furnace", "Condenser Unit", "Heat Pump", "Tankless Water Heater", "Tank Water Heater", "Dishwasher", "Refrigerator", "Garage Door Opener", etc.
- estimated_lifespan_years: typical lifespan for this equipment type in years (e.g., gas furnace=20, evaporator coil=15, water heater=12, AC condenser=15)
- refrigerant_type: if this is a cooling/HVAC system, the refrigerant type (e.g., "R22", "R410A", "R32", "R454B")
- alerts: array of actionable alerts for the homeowner, such as:
  - "Uses R22 refrigerant, which was phased out in 2020. Repairs may be costly — plan for replacement."
  - "This unit is over 15 years old and approaching end of life."
  - Any safety recalls or known issues for this model if you recognize it
- additional_info: object with any other useful details from the label
- confidence: 0-1 score of how confident you are in the extracted data

IMPORTANT: Identify the SPECIFIC piece of equipment on the label. For example, a Goodman CAPF model is an evaporator coil (part of the AC system), NOT a furnace — even if the coil is mounted on a furnace. Be precise about what the label describes.

Return ONLY valid JSON, no other text.`,
          },
        ],
      },
    ],
  });

  const data = await response.json();

  // Check for error response from Edge Function (v10+ returns 200 with _error flag)
  if (data._error) {
    const errorDetail = data.anthropic_error
      ? JSON.stringify(data.anthropic_error)
      : data.message || 'Unknown AI error';
    console.error('[AI] Anthropic error details:', data);
    throw new Error(`AI scan error: ${errorDetail}`);
  }

  // Edge Function returns parsed ScanResult directly;
  // Direct API returns Anthropic format: { content: [{ text: "..." }] }
  if (data.content && Array.isArray(data.content)) {
    const text = data.content[0].text;
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Failed to parse AI response');
    }
  }

  // Already parsed by Edge Function
  return data as ScanResult;
};

/**
 * Parse a home inspection document/report using Claude
 * Extracts maintenance recommendations and schedules tasks
 */
export interface InspectionTask {
  title: string;
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  category: string;
  estimated_cost: number;
  recommended_timeframe: string;
  inspection_section: string;
}

export const parseHomeInspection = async (
  documentText: string,
  imageBase64?: string,
): Promise<InspectionTask[]> => {
  // Send documentText and imageBase64 as top-level fields for the edge function
  // The edge function constructs its own Anthropic messages from these
  const response = await callAI({
    action: 'parse-inspection',
    documentText: documentText || undefined,
    imageBase64: imageBase64 || undefined,
  });

  const data = await response.json();

  // Check for error response from Edge Function (v10+ returns 200 with _error flag)
  if (data._error) {
    const errorDetail = data.anthropic_error
      ? JSON.stringify(data.anthropic_error)
      : data.message || 'Unknown AI error';
    console.error('[AI] Anthropic error details:', data);
    throw new Error(`AI analysis error: ${errorDetail}`);
  }

  let tasks: InspectionTask[];
  if (data.content && Array.isArray(data.content)) {
    const text = data.content[0].text;
    try {
      tasks = JSON.parse(text);
    } catch {
      throw new Error('Failed to parse inspection analysis');
    }
  } else if (Array.isArray(data)) {
    tasks = data;
  } else if (data.tasks && Array.isArray(data.tasks)) {
    tasks = data.tasks;
  } else {
    throw new Error('Unexpected response format from inspection analysis');
  }

  return tasks;
};
