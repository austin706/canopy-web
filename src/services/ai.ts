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

/** Thrown when the user has exceeded their AI usage limit for their tier. */
export class AiUsageLimitError extends Error {
  public readonly currentUsage: number;
  public readonly limit: number;
  public readonly tier: string;
  public readonly upgradeRequired: boolean;

  constructor(data: { message: string; current_usage: number; limit: number; tier: string }) {
    super(data.message);
    this.name = 'AiUsageLimitError';
    this.currentUsage = data.current_usage;
    this.limit = data.limit;
    this.tier = data.tier;
    this.upgradeRequired = true;
  }
}

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

  // Get auth token for Edge Function call
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  if (!token) {
    throw new Error('Please sign in again to use the scanner.');
  }

  try {
    // Use raw fetch instead of supabase.functions.invoke for better error handling
    // and to avoid SDK payload size/timeout issues with large base64 images
    console.log('[AI] Calling scan-equipment Edge Function, action:', payload.action);
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/scan-equipment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (response.status === 401) {
      throw new Error('Authentication failed. Please sign in again.');
    }

    // Handle usage limit exceeded (429 from edge function rate limiting)
    if (response.status === 429) {
      try {
        const limitData = await response.json();
        if (limitData.error === 'usage_limit_exceeded') {
          throw new AiUsageLimitError(limitData);
        }
      } catch (e) {
        if (e instanceof AiUsageLimitError) throw e;
      }
      throw new Error('Too many requests. Please try again later.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI] Edge Function error:', response.status, errorText);
      throw new Error(`AI scan failed: ${errorText || response.statusText}`);
    }

    return response;
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
      `AI scan failed: Failed to send a request to the Edge Function. ${error instanceof Error ? error.message : 'Please try again later.'}`
    );
  }
};

/**
 * Scan an equipment label photo using Claude Vision
 * Sends the image to Claude API (via Edge Function when available) and extracts structured equipment data
 */
export const scanEquipmentLabel = async (imageBase64: string): Promise<ScanResult> => {
  // Detect media type from base64 header bytes (handles cases where compression
  // fallback sends non-JPEG data). Default to JPEG since our compression outputs JPEG.
  let mediaType = 'image/jpeg';
  if (imageBase64.startsWith('iVBOR')) mediaType = 'image/png';
  else if (imageBase64.startsWith('UklGR')) mediaType = 'image/webp';
  else if (imageBase64.startsWith('R0lGO')) mediaType = 'image/gif';

  const response = await callAI({
    action: 'scan-equipment',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageBase64 },
          },
          {
            type: 'text',
            text: `You are analyzing an equipment label photo for a home maintenance app called Canopy.
Extract all identifiable information and return a JSON object with these fields:
- make: manufacturer/brand name
- model: model number
- serial_number: serial number if visible
- capacity: capacity (tonnage, gallons, BTU, etc.)
- install_date: install date OR manufacture date if visible (YYYY-MM-DD format). IMPORTANT: If no install date is shown, use the manufacture/production date as a fallback. Most labels show a manufacture date — always populate this field if ANY date is visible on the label.
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
  let result: ScanResult;
  if (data.content && Array.isArray(data.content)) {
    let text = data.content[0]?.text || '';
    // Strip markdown code fences if Claude wrapped the JSON
    text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    try {
      result = JSON.parse(text);
    } catch {
      console.error('[AI] Failed to parse response text:', text.slice(0, 200));
      throw new Error('Failed to parse AI response');
    }
  } else {
    // Already parsed by Edge Function
    result = data as ScanResult;
  }

  // Defensive normalization — ensure fields are the expected types so renderers don't crash
  if (!result.additional_info || typeof result.additional_info !== 'object') result.additional_info = {};
  // Flatten any nested objects in additional_info to strings (React error #31 prevention)
  for (const [k, v] of Object.entries(result.additional_info)) {
    if (v !== null && typeof v === 'object') {
      result.additional_info[k] = JSON.stringify(v);
    } else if (typeof v !== 'string') {
      result.additional_info[k] = String(v ?? '');
    }
  }
  if (result.alerts && !Array.isArray(result.alerts)) result.alerts = [];
  if (Array.isArray(result.alerts)) {
    result.alerts = result.alerts.map(a => typeof a === 'string' ? a : JSON.stringify(a));
  }
  if (typeof result.confidence !== 'number') result.confidence = 0.5;
  return result;
};

/**
 * Look up equipment details by model number and/or serial number using Claude AI.
 * Fallback for when the image scanner fails — user types in the numbers manually.
 */
export const lookupByModelNumber = async (modelNumber: string, serialNumber?: string): Promise<ScanResult> => {
  const parts: string[] = [];
  if (modelNumber) parts.push(`Model number: ${modelNumber}`);
  if (serialNumber) parts.push(`Serial number: ${serialNumber}`);
  const inputText = parts.join('\n');

  const response = await callAI({
    action: 'scan-equipment',
    messages: [
      {
        role: 'user',
        content: `You are an equipment identification expert for a home maintenance app called Canopy.
A homeowner has manually entered the following information from their equipment label:

${inputText}

Based on the model number (and serial number if provided), identify the equipment and return a JSON object with these fields:
- make: manufacturer/brand name (decode from model number prefix if possible — e.g., "CAPF" = Goodman, "TUH1" = Trane, "58TP" = Carrier)
- model: the full model number as provided
- serial_number: the serial number if provided, otherwise null
- capacity: capacity if deducible from model number (tonnage, gallons, BTU, etc.)
- install_date: null (cannot determine from model number alone)
- fuel_type: gas, electric, propane, etc. if deducible
- efficiency_rating: SEER, EF, AFUE, etc. if deducible
- filter_size: null unless deducible
- category: map to ONE of these exact values: hvac, water_heater, appliance, roof, plumbing, electrical, outdoor, safety, pool, garage
- equipment_subtype: specific type like "Evaporator Coil", "Gas Furnace", "Condenser Unit", "Heat Pump", "Tankless Water Heater", "Tank Water Heater", "Dishwasher", "Refrigerator", "Garage Door Opener", etc.
- estimated_lifespan_years: typical lifespan for this equipment type in years
- refrigerant_type: if this is a cooling/HVAC system, the refrigerant type
- alerts: array of actionable alerts (e.g., R22 phase-out, known recalls)
- additional_info: object with any other useful details you can determine from the model number
- confidence: 0-1 score — use lower confidence (0.3-0.6) if you're guessing based on partial info, higher (0.7-1.0) if you recognize the model number

Even if you cannot identify the exact model, make your best guess based on the model number patterns. Many HVAC manufacturers encode equipment type, capacity, and efficiency in their model numbers.

Return ONLY valid JSON, no other text.`,
      },
    ],
  });

  const data = await response.json();

  if (data._error) {
    const errorDetail = data.anthropic_error
      ? JSON.stringify(data.anthropic_error)
      : data.message || 'Unknown AI error';
    throw new Error(`AI lookup error: ${errorDetail}`);
  }

  let result: ScanResult;
  if (data.content && Array.isArray(data.content)) {
    let text = data.content[0]?.text || '';
    text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error('Failed to parse AI response');
    }
  } else {
    result = data as ScanResult;
  }

  // Defensive normalization
  if (!result.additional_info || typeof result.additional_info !== 'object') result.additional_info = {};
  for (const [k, v] of Object.entries(result.additional_info)) {
    if (v !== null && typeof v === 'object') {
      result.additional_info[k] = JSON.stringify(v);
    } else if (typeof v !== 'string') {
      result.additional_info[k] = String(v ?? '');
    }
  }
  if (result.alerts && !Array.isArray(result.alerts)) result.alerts = [];
  if (Array.isArray(result.alerts)) {
    result.alerts = result.alerts.map(a => typeof a === 'string' ? a : JSON.stringify(a));
  }
  if (typeof result.confidence !== 'number') result.confidence = 0.5;
  return result;
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
