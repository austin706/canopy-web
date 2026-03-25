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
}

/**
 * Call Claude API either through Supabase Edge Function (preferred) or direct (fallback)
 */
const callAI = async (payload: Record<string, unknown>): Promise<Response> => {
  // Try Edge Function route if configured
  if (SUPABASE_URL) {
    try {
      // Always call scan-equipment function — it routes internally by action field
      const response = await supabase.functions.invoke('scan-equipment', {
        body: payload,
      });

      // Handle authentication errors from Edge Function
      if (response.error) {
        if (response.error?.status === 401) {
          throw new Error('Authentication failed. Please sign in again.');
        }
        throw new Error(`AI scan failed: ${response.error?.message || 'Unknown error'}`);
      }

      // supabase.functions.invoke returns { data, error }
      // Return only the data portion for consistency
      return new Response(JSON.stringify(response.data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      // Re-throw authentication errors and explicit scan failures
      if (error instanceof Error && (
        error.message.includes('Authentication failed') ||
        error.message.includes('AI scan failed')
      )) {
        throw error;
      }
      console.warn('Edge Function call failed:', error);
      throw new Error(
        'The AI scanner service is temporarily unavailable. Please try again later.'
      );
    }
  }

  // If we reach here, Edge Function is not configured
  throw new Error(
    'The AI scanner requires server-side configuration. Please ensure Supabase Edge Function is set up.'
  );
};

/**
 * Scan an equipment label photo using Claude Vision
 * Sends the image to Claude API (via Edge Function when available) and extracts structured equipment data
 */
export const scanEquipmentLabel = async (imageBase64: string): Promise<ScanResult> => {
  const response = await callAI({
    action: 'scan-equipment',
    imageBase64,
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
- install_date: manufacture or install date if visible
- fuel_type: gas, electric, propane, etc.
- efficiency_rating: SEER, EF, AFUE, etc.
- filter_size: if this is an HVAC system and filter size is visible
- additional_info: object with any other useful details from the label
- confidence: 0-1 score of how confident you are in the extracted data

Return ONLY valid JSON, no other text.`,
          },
        ],
      },
    ],
  });

  const data = await response.json();

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
  const content: any[] = [];

  if (imageBase64) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
    });
  }

  content.push({
    type: 'text',
    text: `You are a home maintenance expert analyzing a home inspection report for the Canopy app.

${documentText ? `INSPECTION REPORT TEXT:\n${documentText}\n\n` : 'Analyze the attached home inspection document image.\n\n'}Extract ALL actionable maintenance items, repairs, and recommendations from this inspection report.

Return a JSON array of task objects, each with:
- title: short task name (e.g., "Replace roof shingles in NE section")
- description: detailed explanation of what needs to be done and why
- priority: "urgent" (safety hazard / immediate), "high" (within 30 days), "medium" (within 6 months), "low" (within 1 year or maintenance item)
- category: one of hvac|plumbing|electrical|roof|outdoor|safety|general|appliance|structural|pest
- estimated_cost: approximate cost in dollars (0 if DIY)
- recommended_timeframe: "immediately", "within_30_days", "within_3_months", "within_6_months", "within_1_year", "annual_maintenance"
- inspection_section: the section of the inspection this came from (e.g., "Roof & Attic", "Plumbing", "Electrical", "Foundation", "HVAC")

Be thorough — extract every recommendation, concern, and suggested repair from the report.
Return ONLY valid JSON array, no other text.`,
  });

  const response = await callAI({
    action: 'parse-inspection',
    messages: [{ role: 'user', content }],
  });

  const data = await response.json();

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
