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
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (token) {
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
        return response;
      }
    } catch (error) {
      console.warn('Edge Function call failed, falling back to direct API:', error);
    }
  }

  // Fallback: direct API call (development or Edge Function unavailable)
  if (!SUPABASE_URL) {
    console.warn(
      'VITE_SUPABASE_URL not configured. Calling Anthropic API directly from client. ' +
      'In production, configure Supabase Edge Function for security.'
    );
  }

  if (!CLAUDE_API_KEY) {
    throw new Error(
      'Neither Supabase Edge Function nor Anthropic API key is configured'
    );
  }

  // Build the direct API request based on payload action
  const action = (payload as Record<string, unknown>).action as string;
  const messages = (payload as Record<string, unknown>).messages as unknown;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: action === 'scan-equipment' ? 1024 : 2048,
      messages,
    }),
  });

  return response;
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

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI scan failed: ${error}`);
  }

  const data = await response.json();
  const text = data.content[0].text;

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Failed to parse AI response');
  }
};
