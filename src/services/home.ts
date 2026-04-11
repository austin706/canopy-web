// ===============================================================
// Home & Property Management Domain
// ===============================================================
import { supabase } from './supabaseClient';
import type { Home } from '@/types';

// --- Home Profile ---

export const getHome = async (userId: string) => {
  const { data, error } = await supabase.from('homes').select('*').eq('user_id', userId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

// createHome is deprecated — use upsertHome instead
// export const createHome = async (home: any) => { ... };

export const upsertHome = async (home: Partial<Home>) => {
  const { data, error } = await supabase.from('homes').upsert(home).select().single();
  if (error) throw error;
  return data;
};

export const getClientHome = async (clientUserId: string) => {
  const { data, error } = await supabase.from('homes').select('*').eq('user_id', clientUserId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

export const upsertClientHome = async (home: Partial<Home>) => {
  const { data, error } = await supabase.from('homes').upsert(home).select().single();
  if (error) throw error;
  return data;
};

// --- Multi-Property Support ---

/** Get all homes for a user */
export const getUserHomes = async (userId: string) => {
  const { data, error } = await supabase
    .from('homes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

/** Check if an address is already claimed by another user */
export const checkAddressClaimed = async (
  address: string,
  city: string,
  state: string,
  zipCode: string,
  excludeUserId?: string
): Promise<{ claimed: boolean; homeId?: string; ownerId?: string }> => {
  let query = supabase
    .from('homes')
    .select('id, user_id')
    .ilike('address', address.trim())
    .ilike('city', city.trim())
    .ilike('state', state.trim())
    .eq('zip_code', zipCode.trim());

  if (excludeUserId) {
    query = query.neq('user_id', excludeUserId);
  }

  const { data, error } = await query.limit(1);
  if (error) throw error;

  if (data && data.length > 0) {
    return { claimed: true, homeId: data[0].id, ownerId: data[0].user_id };
  }
  return { claimed: false };
};

/** Request to join an existing home */
export const createHomeJoinRequest = async (
  homeId: string,
  requesterId: string,
  ownerId: string,
  message?: string
) => {
  const { data, error } = await supabase
    .from('home_join_requests')
    .insert({
      home_id: homeId,
      requester_id: requesterId,
      owner_id: ownerId,
      message: message || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

/** Get pending join requests for a home owner */
export const getHomeJoinRequests = async (ownerId: string) => {
  const { data, error } = await supabase
    .from('home_join_requests')
    .select('*, homes(address, city, state), requester:profiles!home_join_requests_requester_id_fkey(full_name, email)')
    .eq('owner_id', ownerId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

/** Approve a join request — adds the requester as a home_member on the canonical home
 *  (NO cloning — google_place_id is unique per physical property, so the requester
 *   shares the single canonical home record via home_members). */
export const approveHomeJoinRequest = async (requestId: string) => {
  // Get the request details
  const { data: request, error: reqErr } = await supabase
    .from('home_join_requests')
    .select('id, home_id, requester_id, owner_id')
    .eq('id', requestId)
    .single();
  if (reqErr || !request) throw reqErr || new Error('Request not found');

  // Add requester as accepted home_member (upsert handles re-approval after a decline)
  const { error: memberErr } = await supabase
    .from('home_members')
    .upsert(
      {
        home_id: request.home_id,
        user_id: request.requester_id,
        role: 'editor',
        invite_status: 'accepted',
        invited_by: request.owner_id,
      },
      { onConflict: 'home_id,user_id' },
    );
  if (memberErr) throw memberErr;

  // Mark request as approved
  const { error: updErr } = await supabase
    .from('home_join_requests')
    .update({ status: 'approved', responded_at: new Date().toISOString() })
    .eq('id', requestId);
  if (updErr) throw updErr;

  return { home_id: request.home_id, user_id: request.requester_id };
};

/** Deny a join request */
export const denyHomeJoinRequest = async (requestId: string) => {
  const { error } = await supabase
    .from('home_join_requests')
    .update({ status: 'denied', responded_at: new Date().toISOString() })
    .eq('id', requestId);
  if (error) throw error;
};

// --- Additional Structures ---

export const STRUCTURE_TYPES = {
  guest_house: 'Guest House',
  detached_garage: 'Detached Garage',
  workshop: 'Workshop',
  adu: 'ADU / In-Law Suite',
  barn: 'Barn / Outbuilding',
  pool_house: 'Pool House',
  shed: 'Shed',
  other: 'Other',
} as const;

export type StructureType = keyof typeof STRUCTURE_TYPES;

/** Get all structures (child homes) for a parent home */
export const getStructures = async (parentHomeId: string): Promise<Home[]> => {
  const { data, error } = await supabase
    .from('homes')
    .select('*')
    .eq('parent_home_id', parentHomeId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

/** Add a new structure to a home */
export const addStructure = async (
  parentHomeId: string,
  structureType: StructureType,
  label: string
): Promise<Home> => {
  // Fetch parent home to copy address details
  const { data: parentHome, error: parentErr } = await supabase
    .from('homes')
    .select('*')
    .eq('id', parentHomeId)
    .single();
  if (parentErr || !parentHome) throw parentErr || new Error('Parent home not found');

  // Create new structure record with parent's address and location data
  const newStructure: Partial<Home> = {
    user_id: parentHome.user_id,
    address: parentHome.address,
    city: parentHome.city,
    state: parentHome.state,
    zip_code: parentHome.zip_code,
    latitude: parentHome.latitude,
    longitude: parentHome.longitude,
    parent_home_id: parentHomeId,
    structure_type: structureType,
    structure_label: label,
    // Initialize default values
    stories: 1,
    bedrooms: 0,
    bathrooms: 0,
    garage_spaces: 0,
    has_pool: false,
    has_deck: false,
    has_sprinkler_system: false,
    has_fireplace: false,
    created_at: new Date().toISOString(),
  };

  const { data: created, error } = await supabase
    .from('homes')
    .insert(newStructure)
    .select()
    .single();
  if (error) throw error;
  return created;
};

/** Delete a structure (child home) */
export const deleteStructure = async (structureId: string): Promise<void> => {
  const { error } = await supabase.from('homes').delete().eq('id', structureId);
  if (error) throw error;
};

// --- Home Members ---

export interface HomeMember {
  id: string;
  home_id: string;
  user_id: string | null;
  role: 'owner' | 'editor' | 'viewer';
  invite_email: string | null;
  invite_status: 'pending' | 'accepted' | 'declined';
  invited_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  profile?: { full_name: string; email: string } | null;
}

export const getHomeMembers = async (homeId: string): Promise<HomeMember[]> => {
  const { data, error } = await supabase
    .from('home_members')
    .select('*, profile:profiles!home_members_user_id_fkey(full_name, email)')
    .eq('home_id', homeId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as HomeMember[];
};

export const inviteHomeMember = async (homeId: string, email: string, role: 'editor' | 'viewer', invitedBy: string) => {
  // Check if there's already a user with this email
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('email', email)
    .single();

  const { data, error } = await supabase
    .from('home_members')
    .insert({
      home_id: homeId,
      user_id: existingProfile?.id || null,
      invite_email: !existingProfile ? email : null,
      role,
      invite_status: 'pending',
      invited_by: invitedBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const acceptHomeInvite = async (memberId: string, userId: string) => {
  const { data, error } = await supabase
    .from('home_members')
    .update({
      user_id: userId,
      invite_status: 'accepted',
      updated_at: new Date().toISOString(),
    })
    .eq('id', memberId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const declineHomeInvite = async (memberId: string) => {
  const { error } = await supabase
    .from('home_members')
    .update({
      invite_status: 'declined',
      updated_at: new Date().toISOString(),
    })
    .eq('id', memberId);

  if (error) throw error;
};

export const removeHomeMember = async (memberId: string) => {
  const { error } = await supabase
    .from('home_members')
    .delete()
    .eq('id', memberId);

  if (error) throw error;
};

export const updateHomeMemberRole = async (memberId: string, role: 'owner' | 'editor' | 'viewer') => {
  const { data, error } = await supabase
    .from('home_members')
    .update({
      role,
      updated_at: new Date().toISOString(),
    })
    .eq('id', memberId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getPendingInvites = async (email: string) => {
  const { data, error } = await supabase
    .from('home_members')
    .select('*, home:homes(address, city, state)')
    .eq('invite_email', email)
    .eq('invite_status', 'pending');

  if (error) throw error;
  return data || [];
};

export const getMyMemberships = async (userId: string) => {
  const { data, error } = await supabase
    .from('home_members')
    .select('*, home:homes(*)')
    .eq('user_id', userId)
    .eq('invite_status', 'accepted')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
};
