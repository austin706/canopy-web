// Auto-generated Supabase types from production schema.
// Generated: 2026-05-06 via mcp__supabase__generate_typescript_types
// Re-generate when schema changes; do NOT hand-edit.
//
// Usage:
//   import type { Database, Tables } from '@/types/database.generated';
//   type HomeAddOn = Tables<'home_add_ons'>; // exact production schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      add_on_categories: {
        Row: {
          active: boolean
          base_price_monthly: number
          canopy_margin_pct: number
          color: string | null
          created_at: string
          description: string
          display_name: string
          frequency: string
          icon: string | null
          id: string
          is_recurring: boolean
          max_price_monthly: number | null
          min_price_monthly: number | null
          name: string
          price_per_bathroom: number | null
          price_per_lot_sqft: number | null
          price_per_sqft: number | null
          price_per_story: number | null
          requires_home_feature: string | null
          requires_septic_type: string | null
          requires_sewer_type: string | null
          requires_water_source: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_price_monthly: number
          canopy_margin_pct?: number
          color?: string | null
          created_at?: string
          description: string
          display_name: string
          frequency: string
          icon?: string | null
          id: string
          is_recurring?: boolean
          max_price_monthly?: number | null
          min_price_monthly?: number | null
          name: string
          price_per_bathroom?: number | null
          price_per_lot_sqft?: number | null
          price_per_sqft?: number | null
          price_per_story?: number | null
          requires_home_feature?: string | null
          requires_septic_type?: string | null
          requires_sewer_type?: string | null
          requires_water_source?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_price_monthly?: number
          canopy_margin_pct?: number
          color?: string | null
          created_at?: string
          description?: string
          display_name?: string
          frequency?: string
          icon?: string | null
          id?: string
          is_recurring?: boolean
          max_price_monthly?: number | null
          min_price_monthly?: number | null
          name?: string
          price_per_bathroom?: number | null
          price_per_lot_sqft?: number | null
          price_per_sqft?: number | null
          price_per_story?: number | null
          requires_home_feature?: string | null
          requires_septic_type?: string | null
          requires_sewer_type?: string | null
          requires_water_source?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      add_on_providers: {
        Row: {
          active: boolean
          category_id: string
          company_name: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contracted_rate: number | null
          created_at: string
          current_property_count: number | null
          id: string
          insurance_verified: boolean | null
          license_number: string | null
          max_active_properties: number | null
          provider_id: string
          rate_notes: string | null
          rate_type: string | null
          service_radius_miles: number | null
          service_zip_codes: string[] | null
          stripe_connect_account_id: string | null
          stripe_connect_onboarding_complete: boolean | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id: string
          company_name: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contracted_rate?: number | null
          created_at?: string
          current_property_count?: number | null
          id?: string
          insurance_verified?: boolean | null
          license_number?: string | null
          max_active_properties?: number | null
          provider_id: string
          rate_notes?: string | null
          rate_type?: string | null
          service_radius_miles?: number | null
          service_zip_codes?: string[] | null
          stripe_connect_account_id?: string | null
          stripe_connect_onboarding_complete?: boolean | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contracted_rate?: number | null
          created_at?: string
          current_property_count?: number | null
          id?: string
          insurance_verified?: boolean | null
          license_number?: string | null
          max_active_properties?: number | null
          provider_id?: string
          rate_notes?: string | null
          rate_type?: string | null
          service_radius_miles?: number | null
          service_zip_codes?: string[] | null
          stripe_connect_account_id?: string | null
          stripe_connect_onboarding_complete?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "add_on_providers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "add_on_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      add_on_visits: {
        Row: {
          actual_date: string | null
          created_at: string
          duration_minutes: number | null
          follow_up_needed: boolean | null
          follow_up_notes: string | null
          home_add_on_id: string
          home_id: string
          id: string
          issues_found: Json | null
          materials_cost: number | null
          provider_id: string
          report_details: Json | null
          report_photos: string[] | null
          report_submitted_at: string | null
          report_summary: string | null
          scheduled_date: string
          scheduled_window: string | null
          status: string
          updated_at: string
        }
        Insert: {
          actual_date?: string | null
          created_at?: string
          duration_minutes?: number | null
          follow_up_needed?: boolean | null
          follow_up_notes?: string | null
          home_add_on_id: string
          home_id: string
          id?: string
          issues_found?: Json | null
          materials_cost?: number | null
          provider_id: string
          report_details?: Json | null
          report_photos?: string[] | null
          report_submitted_at?: string | null
          report_summary?: string | null
          scheduled_date: string
          scheduled_window?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          actual_date?: string | null
          created_at?: string
          duration_minutes?: number | null
          follow_up_needed?: boolean | null
          follow_up_notes?: string | null
          home_add_on_id?: string
          home_id?: string
          id?: string
          issues_found?: Json | null
          materials_cost?: number | null
          provider_id?: string
          report_details?: Json | null
          report_photos?: string[] | null
          report_submitted_at?: string | null
          report_summary?: string | null
          scheduled_date?: string
          scheduled_window?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "add_on_visits_home_add_on_id_fkey"
            columns: ["home_add_on_id"]
            isOneToOne: false
            referencedRelation: "home_add_ons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "add_on_visits_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      admin_billing_actions: {
        Row: {
          action: string
          admin_id: string
          amount_cents: number
          created_at: string
          details: Json
          id: string
          reason: string
          stripe_customer_id: string
          stripe_ref: string
          target_user_id: string
        }
        Insert: {
          action: string
          admin_id: string
          amount_cents: number
          created_at?: string
          details?: Json
          id?: string
          reason: string
          stripe_customer_id: string
          stripe_ref: string
          target_user_id: string
        }
        Update: {
          action?: string
          admin_id?: string
          amount_cents?: number
          created_at?: string
          details?: Json
          id?: string
          reason?: string
          stripe_customer_id?: string
          stripe_ref?: string
          target_user_id?: string
        }
        Relationships: []
      }
      affiliate_products: {
        Row: {
          active: boolean
          affiliate_url: string
          consumable_type: string | null
          created_at: string
          created_by: string | null
          equipment_category: string | null
          id: string
          item_key: string | null
          link_type: string | null
          notes: string | null
          price_estimate: number | null
          priority: number
          product_name: string
          quality_tier: string | null
          spec_pattern: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          affiliate_url: string
          consumable_type?: string | null
          created_at?: string
          created_by?: string | null
          equipment_category?: string | null
          id?: string
          item_key?: string | null
          link_type?: string | null
          notes?: string | null
          price_estimate?: number | null
          priority?: number
          product_name: string
          quality_tier?: string | null
          spec_pattern?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          affiliate_url?: string
          consumable_type?: string | null
          created_at?: string
          created_by?: string | null
          equipment_category?: string | null
          id?: string
          item_key?: string | null
          link_type?: string | null
          notes?: string | null
          price_estimate?: number | null
          priority?: number
          product_name?: string
          quality_tier?: string | null
          spec_pattern?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agent_applications: {
        Row: {
          agreed_to_terms: boolean
          agreed_to_terms_at: string | null
          bio: string | null
          brokerage: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          license_number: string | null
          license_state: string | null
          phone: string | null
          photo_url: string | null
          referral_source: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          service_area_zips: string[] | null
          status: string
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          agreed_to_terms?: boolean
          agreed_to_terms_at?: string | null
          bio?: string | null
          brokerage?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          license_number?: string | null
          license_state?: string | null
          phone?: string | null
          photo_url?: string | null
          referral_source?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_area_zips?: string[] | null
          status?: string
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          agreed_to_terms?: boolean
          agreed_to_terms_at?: string | null
          bio?: string | null
          brokerage?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          license_number?: string | null
          license_state?: string | null
          phone?: string | null
          photo_url?: string | null
          referral_source?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_area_zips?: string[] | null
          status?: string
          updated_at?: string
          years_experience?: number | null
        }
        Relationships: []
      }
      agent_client_notes: {
        Row: {
          agent_id: string
          category: string | null
          client_id: string
          created_at: string | null
          id: string
          note: string
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          category?: string | null
          client_id: string
          created_at?: string | null
          id?: string
          note: string
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          category?: string | null
          client_id?: string
          created_at?: string | null
          id?: string
          note?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_client_notes_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_home_qr_codes: {
        Row: {
          agent_id: string
          buyer_email: string | null
          buyer_name: string | null
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          expires_at: string | null
          gift_code_id: string | null
          home_data: Json | null
          home_id: string | null
          id: string
          notes: string | null
          qr_token: string
          status: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          buyer_email?: string | null
          buyer_name?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          expires_at?: string | null
          gift_code_id?: string | null
          home_data?: Json | null
          home_id?: string | null
          id?: string
          notes?: string | null
          qr_token?: string
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          buyer_email?: string | null
          buyer_name?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          expires_at?: string | null
          gift_code_id?: string | null
          home_data?: Json | null
          home_id?: string | null
          id?: string
          notes?: string | null
          qr_token?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_home_qr_codes_gift_code_id_fkey"
            columns: ["gift_code_id"]
            isOneToOne: false
            referencedRelation: "gift_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_home_qr_codes_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_link_requests: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          status: string
          updated_at: string
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_link_requests_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          accent_color: string | null
          application_id: string | null
          brokerage: string
          created_at: string | null
          email: string
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          photo_url: string | null
          slug: string
          user_id: string | null
        }
        Insert: {
          accent_color?: string | null
          application_id?: string | null
          brokerage: string
          created_at?: string | null
          email: string
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          photo_url?: string | null
          slug: string
          user_id?: string | null
        }
        Update: {
          accent_color?: string | null
          application_id?: string | null
          brokerage?: string
          created_at?: string | null
          email?: string
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          photo_url?: string | null
          slug?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "agent_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      builder_applications: {
        Row: {
          agreed_to_terms: boolean
          agreed_to_terms_at: string | null
          annual_home_volume: number | null
          bio: string | null
          company_name: string
          created_at: string
          email: string
          full_name: string
          home_types: string[] | null
          id: string
          license_number: string | null
          license_state: string | null
          logo_url: string | null
          phone: string | null
          price_range: string | null
          primary_markets: string | null
          referral_source: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          service_area_zips: string[] | null
          status: string
          updated_at: string
          website: string | null
          years_in_business: number | null
        }
        Insert: {
          agreed_to_terms?: boolean
          agreed_to_terms_at?: string | null
          annual_home_volume?: number | null
          bio?: string | null
          company_name: string
          created_at?: string
          email: string
          full_name: string
          home_types?: string[] | null
          id?: string
          license_number?: string | null
          license_state?: string | null
          logo_url?: string | null
          phone?: string | null
          price_range?: string | null
          primary_markets?: string | null
          referral_source?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_area_zips?: string[] | null
          status?: string
          updated_at?: string
          website?: string | null
          years_in_business?: number | null
        }
        Update: {
          agreed_to_terms?: boolean
          agreed_to_terms_at?: string | null
          annual_home_volume?: number | null
          bio?: string | null
          company_name?: string
          created_at?: string
          email?: string
          full_name?: string
          home_types?: string[] | null
          id?: string
          license_number?: string | null
          license_state?: string | null
          logo_url?: string | null
          phone?: string | null
          price_range?: string | null
          primary_markets?: string | null
          referral_source?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_area_zips?: string[] | null
          status?: string
          updated_at?: string
          website?: string | null
          years_in_business?: number | null
        }
        Relationships: []
      }
      builders: {
        Row: {
          annual_home_volume: number | null
          application_id: string | null
          bio: string | null
          company_name: string
          contact_name: string | null
          created_at: string
          email: string
          home_types: string[] | null
          id: string
          license_number: string | null
          license_state: string | null
          logo_url: string | null
          notes: string | null
          phone: string | null
          price_range: string | null
          primary_markets: string | null
          service_area_zips: string[] | null
          slug: string | null
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          annual_home_volume?: number | null
          application_id?: string | null
          bio?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string
          email: string
          home_types?: string[] | null
          id?: string
          license_number?: string | null
          license_state?: string | null
          logo_url?: string | null
          notes?: string | null
          phone?: string | null
          price_range?: string | null
          primary_markets?: string | null
          service_area_zips?: string[] | null
          slug?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          annual_home_volume?: number | null
          application_id?: string | null
          bio?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string
          email?: string
          home_types?: string[] | null
          id?: string
          license_number?: string | null
          license_state?: string | null
          logo_url?: string | null
          notes?: string | null
          phone?: string | null
          price_range?: string | null
          primary_markets?: string | null
          service_area_zips?: string[] | null
          slug?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "builders_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "builder_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      checkr_events: {
        Row: {
          event_id: string
          event_type: string
          object_id: string | null
          object_type: string | null
          payload: Json
          processed_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          object_id?: string | null
          object_type?: string | null
          payload: Json
          processed_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          object_id?: string | null
          object_type?: string | null
          payload?: Json
          processed_at?: string
        }
        Relationships: []
      }
      concierge_inquiries: {
        Row: {
          city: string | null
          contacted_at: string | null
          created_at: string
          email: string
          home_id: string | null
          id: string
          interested_categories: string[]
          notes: string | null
          state: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          city?: string | null
          contacted_at?: string | null
          created_at?: string
          email: string
          home_id?: string | null
          id?: string
          interested_categories?: string[]
          notes?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          city?: string | null
          contacted_at?: string | null
          created_at?: string
          email?: string
          home_id?: string | null
          id?: string
          interested_categories?: string[]
          notes?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pro_plus_inquiries_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pro_plus_inquiries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          created_at: string | null
          deleted_at: string | null
          file_url: string | null
          home_id: string
          id: string
          thumbnail_url: string | null
          title: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          deleted_at?: string | null
          file_url?: string | null
          home_id: string
          id?: string
          thumbnail_url?: string | null
          title: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          deleted_at?: string | null
          file_url?: string | null
          home_id?: string
          id?: string
          thumbnail_url?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string | null
          body_text: string | null
          category: string
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          name: string
          recipient_type: string
          subject: string
          template_key: string
          trigger_event: string
          updated_at: string
          variables: Json | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          category: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          name: string
          recipient_type: string
          subject: string
          template_key: string
          trigger_event: string
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          category?: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          name?: string
          recipient_type?: string
          subject?: string
          template_key?: string
          trigger_event?: string
          updated_at?: string
          variables?: Json | null
        }
        Relationships: []
      }
      email_unsubscribes: {
        Row: {
          email: string
          note: string | null
          source: string
          unsubscribed_at: string
        }
        Insert: {
          email: string
          note?: string | null
          source?: string
          unsubscribed_at?: string
        }
        Update: {
          email?: string
          note?: string | null
          source?: string
          unsubscribed_at?: string
        }
        Relationships: []
      }
      equipment: {
        Row: {
          category: string
          created_at: string | null
          deleted_at: string | null
          equipment_subtype: string | null
          estimated_replacement_cost: number | null
          expected_lifespan_years: number | null
          filter_count: number | null
          filter_model_number: string | null
          filter_replacement_interval_months: number | null
          filter_size: string | null
          filter_type: string | null
          fuel_type: string | null
          has_battery_backup: boolean | null
          home_id: string
          hose_bib_location: string | null
          id: string
          install_date: string | null
          is_frost_free: boolean | null
          is_tankless: boolean | null
          label_photo_url: string | null
          location_in_home: string | null
          make: string | null
          model: string | null
          name: string
          notes: string | null
          opener_type: string | null
          photo_url: string | null
          refrigerant_type: string | null
          remote_frequency: string | null
          replacement_quote_source: string | null
          seer_rating: number | null
          serial_number: string | null
          tank_size_gallons: number | null
          tech_metadata: Json | null
          tonnage: number | null
          updated_at: string | null
          warranty_expiry: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          deleted_at?: string | null
          equipment_subtype?: string | null
          estimated_replacement_cost?: number | null
          expected_lifespan_years?: number | null
          filter_count?: number | null
          filter_model_number?: string | null
          filter_replacement_interval_months?: number | null
          filter_size?: string | null
          filter_type?: string | null
          fuel_type?: string | null
          has_battery_backup?: boolean | null
          home_id: string
          hose_bib_location?: string | null
          id?: string
          install_date?: string | null
          is_frost_free?: boolean | null
          is_tankless?: boolean | null
          label_photo_url?: string | null
          location_in_home?: string | null
          make?: string | null
          model?: string | null
          name: string
          notes?: string | null
          opener_type?: string | null
          photo_url?: string | null
          refrigerant_type?: string | null
          remote_frequency?: string | null
          replacement_quote_source?: string | null
          seer_rating?: number | null
          serial_number?: string | null
          tank_size_gallons?: number | null
          tech_metadata?: Json | null
          tonnage?: number | null
          updated_at?: string | null
          warranty_expiry?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          deleted_at?: string | null
          equipment_subtype?: string | null
          estimated_replacement_cost?: number | null
          expected_lifespan_years?: number | null
          filter_count?: number | null
          filter_model_number?: string | null
          filter_replacement_interval_months?: number | null
          filter_size?: string | null
          filter_type?: string | null
          fuel_type?: string | null
          has_battery_backup?: boolean | null
          home_id?: string
          hose_bib_location?: string | null
          id?: string
          install_date?: string | null
          is_frost_free?: boolean | null
          is_tankless?: boolean | null
          label_photo_url?: string | null
          location_in_home?: string | null
          make?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          opener_type?: string | null
          photo_url?: string | null
          refrigerant_type?: string | null
          remote_frequency?: string | null
          replacement_quote_source?: string | null
          seer_rating?: number | null
          serial_number?: string | null
          tank_size_gallons?: number | null
          tech_metadata?: Json | null
          tonnage?: number | null
          updated_at?: string | null
          warranty_expiry?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_checklist: {
        Row: {
          created_at: string
          equipment_id: string | null
          equipment_type: string
          home_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          equipment_id?: string | null
          equipment_type: string
          home_id: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          equipment_id?: string | null
          equipment_type?: string
          home_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_checklist_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_checklist_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_consumables: {
        Row: {
          confidence: number | null
          consumable_type: string
          created_at: string | null
          detected_by: string | null
          equipment_id: string
          estimated_cost: number | null
          home_id: string
          id: string
          last_replaced_date: string | null
          name: string
          next_due_date: string | null
          notes: string | null
          part_number: string | null
          purchase_url: string | null
          quantity: number | null
          replacement_interval_months: number | null
          spec: string | null
          updated_at: string | null
        }
        Insert: {
          confidence?: number | null
          consumable_type: string
          created_at?: string | null
          detected_by?: string | null
          equipment_id: string
          estimated_cost?: number | null
          home_id: string
          id?: string
          last_replaced_date?: string | null
          name: string
          next_due_date?: string | null
          notes?: string | null
          part_number?: string | null
          purchase_url?: string | null
          quantity?: number | null
          replacement_interval_months?: number | null
          spec?: string | null
          updated_at?: string | null
        }
        Update: {
          confidence?: number | null
          consumable_type?: string
          created_at?: string | null
          detected_by?: string | null
          equipment_id?: string
          estimated_cost?: number | null
          home_id?: string
          id?: string
          last_replaced_date?: string | null
          name?: string
          next_due_date?: string | null
          notes?: string | null
          part_number?: string | null
          purchase_url?: string | null
          quantity?: number | null
          replacement_interval_months?: number | null
          spec?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_consumables_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_consumables_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_recall_matches: {
        Row: {
          created_at: string
          dismissed: boolean | null
          equipment_id: string
          id: string
          match_confidence: string | null
          match_type: string
          notified: boolean | null
          recall_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dismissed?: boolean | null
          equipment_id: string
          id?: string
          match_confidence?: string | null
          match_type?: string
          notified?: boolean | null
          recall_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          dismissed?: boolean | null
          equipment_id?: string
          id?: string
          match_confidence?: string | null
          match_type?: string
          notified?: boolean | null
          recall_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_recall_matches_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_recall_matches_recall_id_fkey"
            columns: ["recall_id"]
            isOneToOne: false
            referencedRelation: "equipment_recalls"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_recalls: {
        Row: {
          category_hint: string | null
          cpsc_recall_id: string
          created_at: string
          description: string | null
          hazard: string | null
          id: string
          manufacturer: string | null
          product_name: string | null
          raw_json: Json | null
          recall_date: string
          recall_number: string | null
          remedy: string | null
          title: string
          url: string | null
        }
        Insert: {
          category_hint?: string | null
          cpsc_recall_id: string
          created_at?: string
          description?: string | null
          hazard?: string | null
          id?: string
          manufacturer?: string | null
          product_name?: string | null
          raw_json?: Json | null
          recall_date: string
          recall_number?: string | null
          remedy?: string | null
          title: string
          url?: string | null
        }
        Update: {
          category_hint?: string | null
          cpsc_recall_id?: string
          created_at?: string
          description?: string | null
          hazard?: string | null
          id?: string
          manufacturer?: string | null
          product_name?: string | null
          raw_json?: Json | null
          recall_date?: string
          recall_number?: string | null
          remedy?: string | null
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      equipment_scan_cache: {
        Row: {
          additional_info: Json | null
          alerts: string[] | null
          capacity: string | null
          category: string | null
          confidence: number | null
          consumables: Json | null
          created_at: string | null
          efficiency_rating: string | null
          equipment_subtype: string | null
          estimated_lifespan_years: number | null
          filter_size: string | null
          fuel_type: string | null
          hit_count: number | null
          id: string
          make: string | null
          model_display: string | null
          model_number: string
          refrigerant_type: string | null
          serial_prefix: string | null
          tech_metadata: Json | null
          updated_at: string | null
        }
        Insert: {
          additional_info?: Json | null
          alerts?: string[] | null
          capacity?: string | null
          category?: string | null
          confidence?: number | null
          consumables?: Json | null
          created_at?: string | null
          efficiency_rating?: string | null
          equipment_subtype?: string | null
          estimated_lifespan_years?: number | null
          filter_size?: string | null
          fuel_type?: string | null
          hit_count?: number | null
          id?: string
          make?: string | null
          model_display?: string | null
          model_number: string
          refrigerant_type?: string | null
          serial_prefix?: string | null
          tech_metadata?: Json | null
          updated_at?: string | null
        }
        Update: {
          additional_info?: Json | null
          alerts?: string[] | null
          capacity?: string | null
          category?: string | null
          confidence?: number | null
          consumables?: Json | null
          created_at?: string | null
          efficiency_rating?: string | null
          equipment_subtype?: string | null
          estimated_lifespan_years?: number | null
          filter_size?: string | null
          fuel_type?: string | null
          hit_count?: number | null
          id?: string
          make?: string | null
          model_display?: string | null
          model_number?: string
          refrigerant_type?: string | null
          serial_prefix?: string | null
          tech_metadata?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      equipment_scan_guides: {
        Row: {
          category: string
          common_brands: string[] | null
          created_at: string
          display_name: string
          equipment_type: string
          every_home_should_have: boolean
          icon: string | null
          id: string
          is_active: boolean
          nameplate_description: string | null
          nameplate_location: string
          photo_url: string | null
          priority_order: number | null
          tips: string[] | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          category: string
          common_brands?: string[] | null
          created_at?: string
          display_name: string
          equipment_type: string
          every_home_should_have?: boolean
          icon?: string | null
          id?: string
          is_active?: boolean
          nameplate_description?: string | null
          nameplate_location: string
          photo_url?: string | null
          priority_order?: number | null
          tips?: string[] | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          category?: string
          common_brands?: string[] | null
          created_at?: string
          display_name?: string
          equipment_type?: string
          every_home_should_have?: boolean
          icon?: string | null
          id?: string
          is_active?: boolean
          nameplate_description?: string | null
          nameplate_location?: string
          photo_url?: string | null
          priority_order?: number | null
          tips?: string[] | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      gift_codes: {
        Row: {
          agent_id: string
          client_email: string | null
          client_name: string | null
          code: string
          created_at: string | null
          duration_months: number | null
          expires_at: string
          id: string
          pending_home: Json | null
          reactivation_email_sent_at: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          tier: string | null
        }
        Insert: {
          agent_id: string
          client_email?: string | null
          client_name?: string | null
          code: string
          created_at?: string | null
          duration_months?: number | null
          expires_at: string
          id?: string
          pending_home?: Json | null
          reactivation_email_sent_at?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          tier?: string | null
        }
        Update: {
          agent_id?: string
          client_email?: string | null
          client_name?: string | null
          code?: string
          created_at?: string | null
          duration_months?: number | null
          expires_at?: string
          id?: string
          pending_home?: Json | null
          reactivation_email_sent_at?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          tier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gift_codes_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_codes_redeemed_by_fkey"
            columns: ["redeemed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      home_add_ons: {
        Row: {
          approved_price: number | null
          assigned_provider_id: string | null
          billing_frequency: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          category_id: string
          created_at: string
          estimated_price: number | null
          home_id: string
          id: string
          last_service_date: string | null
          next_service_date: string | null
          paused_until: string | null
          quoted_price: number | null
          service_notes: string | null
          status: string
          status_changed_at: string
          stripe_checkout_session_id: string | null
          stripe_invoice_item_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          stripe_subscription_item_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_price?: number | null
          assigned_provider_id?: string | null
          billing_frequency?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          category_id: string
          created_at?: string
          estimated_price?: number | null
          home_id: string
          id?: string
          last_service_date?: string | null
          next_service_date?: string | null
          paused_until?: string | null
          quoted_price?: number | null
          service_notes?: string | null
          status?: string
          status_changed_at?: string
          stripe_checkout_session_id?: string | null
          stripe_invoice_item_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          stripe_subscription_item_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_price?: number | null
          assigned_provider_id?: string | null
          billing_frequency?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          category_id?: string
          created_at?: string
          estimated_price?: number | null
          home_id?: string
          id?: string
          last_service_date?: string | null
          next_service_date?: string | null
          paused_until?: string | null
          quoted_price?: number | null
          service_notes?: string | null
          status?: string
          status_changed_at?: string
          stripe_checkout_session_id?: string | null
          stripe_invoice_item_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          stripe_subscription_item_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "home_add_ons_assigned_provider_id_fkey"
            columns: ["assigned_provider_id"]
            isOneToOne: false
            referencedRelation: "add_on_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_add_ons_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "add_on_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_add_ons_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      home_inspections: {
        Row: {
          add_on_visit_id: string | null
          created_at: string
          duration_minutes: number | null
          findings: Json
          home_id: string
          id: string
          inspected_at: string
          inspector_credential_number: string | null
          inspector_id: string
          inspector_name: string
          inspector_payout_cents: number | null
          overall_grade: string
          pdf_certificate_url: string | null
          photo_urls: string[]
          price_charged_cents: number | null
          recommended_repairs: Json
          scheduled_at: string | null
          signature_version: number
          signed_at: string
          signed_record: string
          systems_inspected: Json
          updated_at: string
        }
        Insert: {
          add_on_visit_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          findings?: Json
          home_id: string
          id?: string
          inspected_at?: string
          inspector_credential_number?: string | null
          inspector_id: string
          inspector_name: string
          inspector_payout_cents?: number | null
          overall_grade: string
          pdf_certificate_url?: string | null
          photo_urls?: string[]
          price_charged_cents?: number | null
          recommended_repairs?: Json
          scheduled_at?: string | null
          signature_version?: number
          signed_at?: string
          signed_record: string
          systems_inspected?: Json
          updated_at?: string
        }
        Update: {
          add_on_visit_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          findings?: Json
          home_id?: string
          id?: string
          inspected_at?: string
          inspector_credential_number?: string | null
          inspector_id?: string
          inspector_name?: string
          inspector_payout_cents?: number | null
          overall_grade?: string
          pdf_certificate_url?: string | null
          photo_urls?: string[]
          price_charged_cents?: number | null
          recommended_repairs?: Json
          scheduled_at?: string | null
          signature_version?: number
          signed_at?: string
          signed_record?: string
          systems_inspected?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "home_inspections_add_on_visit_id_fkey"
            columns: ["add_on_visit_id"]
            isOneToOne: false
            referencedRelation: "add_on_visits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_inspections_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_inspections_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      home_join_requests: {
        Row: {
          created_at: string | null
          home_id: string
          id: string
          message: string | null
          owner_id: string
          requester_id: string
          responded_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          home_id: string
          id?: string
          message?: string | null
          owner_id: string
          requester_id: string
          responded_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          home_id?: string
          id?: string
          message?: string | null
          owner_id?: string
          requester_id?: string
          responded_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "home_join_requests_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      home_members: {
        Row: {
          created_at: string
          home_id: string
          id: string
          invite_email: string | null
          invite_status: string
          invited_by: string | null
          role: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          home_id: string
          id?: string
          invite_email?: string | null
          invite_status?: string
          invited_by?: string | null
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          home_id?: string
          id?: string
          invite_email?: string | null
          invite_status?: string
          invited_by?: string | null
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "home_members_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      home_sale_prep: {
        Row: {
          activated_at: string | null
          agent_notified_at: string | null
          completed_items: string[] | null
          created_at: string | null
          home_id: string
          id: string
          notes: string | null
          status: string | null
          target_list_date: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          agent_notified_at?: string | null
          completed_items?: string[] | null
          created_at?: string | null
          home_id: string
          id?: string
          notes?: string | null
          status?: string | null
          target_list_date?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activated_at?: string | null
          agent_notified_at?: string | null
          completed_items?: string[] | null
          created_at?: string | null
          home_id?: string
          id?: string
          notes?: string | null
          status?: string | null
          target_list_date?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      home_token_attestations: {
        Row: {
          attestor_name: string
          attestor_role: string
          attestor_user_id: string
          created_at: string | null
          home_id: string
          id: string
          signed_at: string | null
          statement: string
          updated_at: string | null
        }
        Insert: {
          attestor_name: string
          attestor_role: string
          attestor_user_id: string
          created_at?: string | null
          home_id: string
          id?: string
          signed_at?: string | null
          statement: string
          updated_at?: string | null
        }
        Update: {
          attestor_name?: string
          attestor_role?: string
          attestor_user_id?: string
          created_at?: string | null
          home_id?: string
          id?: string
          signed_at?: string | null
          statement?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "home_token_attestations_attestor_user_id_fkey"
            columns: ["attestor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_token_attestations_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      home_transfers: {
        Row: {
          accepted_at: string | null
          agent_attestation_note: string | null
          agent_attested_at: string | null
          created_at: string | null
          declined_at: string | null
          expires_at: string | null
          from_user_id: string
          home_id: string
          id: string
          initiated_at: string | null
          notes: string | null
          status: string | null
          to_email: string
          to_user_id: string | null
          transfer_token: string
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          agent_attestation_note?: string | null
          agent_attested_at?: string | null
          created_at?: string | null
          declined_at?: string | null
          expires_at?: string | null
          from_user_id: string
          home_id: string
          id?: string
          initiated_at?: string | null
          notes?: string | null
          status?: string | null
          to_email: string
          to_user_id?: string | null
          transfer_token?: string
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          agent_attestation_note?: string | null
          agent_attested_at?: string | null
          created_at?: string | null
          declined_at?: string | null
          expires_at?: string | null
          from_user_id?: string
          home_id?: string
          id?: string
          initiated_at?: string | null
          notes?: string | null
          status?: string | null
          to_email?: string
          to_user_id?: string | null
          transfer_token?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      homes: {
        Row: {
          address: string
          agent_attestation_note: string | null
          agent_attested_at: string | null
          basement_finished_pct: number | null
          bathrooms: number | null
          battery_storage_install_year: number | null
          bedrooms: number | null
          ceiling_height_ft: number | null
          ceiling_type: string | null
          certified_inspection_count: number
          city: string
          climate_zone: string | null
          construction_type: string | null
          cooling_type: string | null
          countertop_type: string | null
          created_at: string | null
          driveway_install_year: number | null
          driveway_material: string | null
          ductwork_insulated: boolean | null
          ductwork_type: string | null
          electrical_panel_amps: number | null
          electrical_panel_brand: string | null
          electrical_panel_year: number | null
          electrical_wiring_type: string | null
          ev_charger_install_year: number | null
          ev_charger_level: string | null
          exterior_door_material: string | null
          exterior_paint_year: number | null
          fence_install_year: number | null
          fence_type: string | null
          fireplace_count: number | null
          fireplace_details: Json | null
          fireplace_type: string | null
          flooring_install_year: number | null
          foundation_type: string | null
          frame_size: string | null
          garage_spaces: number | null
          gas_meter_location: string | null
          gas_service: boolean | null
          generator_capacity_kw: number | null
          generator_install_year: number | null
          generator_type: string | null
          google_place_id: string | null
          has_afci_breakers: boolean | null
          has_air_purifier: boolean | null
          has_attic_fan: boolean | null
          has_basement_waterproofing: boolean | null
          has_battery_storage: boolean | null
          has_deck: boolean | null
          has_erv_hrv: boolean | null
          has_ev_charger: boolean | null
          has_expansion_tank: boolean | null
          has_fence: boolean | null
          has_fire_extinguisher: boolean | null
          has_fireplace: boolean | null
          has_fountain: boolean | null
          has_french_drain: boolean | null
          has_generator: boolean | null
          has_gfci_outlets: boolean | null
          has_gutters: boolean | null
          has_house_wrap: boolean | null
          has_patio: boolean | null
          has_pool: boolean | null
          has_radon_mitigation: boolean | null
          has_radon_test: boolean | null
          has_recirculation_pump: boolean | null
          has_security_system: boolean | null
          has_smart_home_hub: boolean | null
          has_solar_panels: boolean | null
          has_sprinkler_system: boolean | null
          has_storm_doors: boolean | null
          has_storm_shelter: boolean | null
          has_storm_windows: boolean | null
          has_sump_pump: boolean | null
          has_vapor_barrier: boolean | null
          has_water_filtration: boolean | null
          has_water_softener: boolean | null
          has_whole_house_dehumidifier: boolean | null
          has_whole_house_fan: boolean | null
          has_whole_house_humidifier: boolean | null
          has_whole_house_surge_protector: boolean | null
          heating_type: string | null
          hose_bib_locations: string | null
          hvac_filter_returns: Json | null
          hvac_filter_size: string | null
          hvac_return_location: string | null
          id: string
          insulation_attic_depth_inches: number | null
          insulation_attic_type: string | null
          insulation_r_value_attic: number | null
          insulation_r_value_walls: number | null
          insulation_wall_type: string | null
          interior_wall_type: string | null
          known_asbestos: boolean | null
          known_lead_paint: boolean | null
          last_certified_inspection_at: string | null
          last_certified_inspection_id: string | null
          last_radon_level_pci: number | null
          latitude: number | null
          lawn_type: string | null
          longitude: number | null
          lot_size_sqft: number | null
          main_breaker_location: string | null
          normalized_address: string | null
          number_of_hvac_filters: number | null
          ownership_documents_url: string | null
          ownership_verification_date: string | null
          ownership_verification_method: string | null
          ownership_verification_notes: string | null
          ownership_verification_status: string | null
          ownership_verified: boolean | null
          parent_home_id: string | null
          patio_material: string | null
          photo_url: string | null
          plumbing_drain_install_year: number | null
          plumbing_drain_type: string | null
          plumbing_supply_install_year: number | null
          plumbing_supply_type: string | null
          pool_type: string | null
          primary_flooring: string | null
          record_completeness_score: number | null
          recycling_day: string | null
          recycling_frequency: string | null
          roof_age_years: number | null
          roof_install_year: number | null
          roof_type: string | null
          selling_soon: boolean
          septic_drainfield_type: string | null
          septic_install_year: number | null
          septic_last_inspected: string | null
          septic_last_pumped: string | null
          septic_tank_size_gallons: number | null
          septic_type: string | null
          sewer_type: string | null
          siding_install_year: number | null
          siding_type: string | null
          solar_capacity_kw: number | null
          solar_install_year: number | null
          solar_inverter_type: string | null
          solar_panel_count: number | null
          square_footage: number | null
          state: string
          stories: number | null
          stories_type: string | null
          structure_label: string | null
          structure_type: string | null
          sub_panel_locations: string | null
          trash_day: string | null
          trash_provider: string | null
          updated_at: string | null
          usda_zone: string | null
          user_id: string
          water_filtration_type: string | null
          water_meter_location: string | null
          water_shutoff_location: string | null
          water_source: string | null
          well_depth_ft: number | null
          well_last_tested: string | null
          well_pressure_tank_install_year: number | null
          well_pump_install_year: number | null
          well_pump_type: string | null
          window_frame_material: string | null
          window_glazing: string | null
          window_install_year: number | null
          yard_waste_day: string | null
          yard_waste_seasonal: boolean | null
          year_built: number | null
          year_renovated: number | null
          zip_code: string
          zip_plus4: string | null
        }
        Insert: {
          address: string
          agent_attestation_note?: string | null
          agent_attested_at?: string | null
          basement_finished_pct?: number | null
          bathrooms?: number | null
          battery_storage_install_year?: number | null
          bedrooms?: number | null
          ceiling_height_ft?: number | null
          ceiling_type?: string | null
          certified_inspection_count?: number
          city: string
          climate_zone?: string | null
          construction_type?: string | null
          cooling_type?: string | null
          countertop_type?: string | null
          created_at?: string | null
          driveway_install_year?: number | null
          driveway_material?: string | null
          ductwork_insulated?: boolean | null
          ductwork_type?: string | null
          electrical_panel_amps?: number | null
          electrical_panel_brand?: string | null
          electrical_panel_year?: number | null
          electrical_wiring_type?: string | null
          ev_charger_install_year?: number | null
          ev_charger_level?: string | null
          exterior_door_material?: string | null
          exterior_paint_year?: number | null
          fence_install_year?: number | null
          fence_type?: string | null
          fireplace_count?: number | null
          fireplace_details?: Json | null
          fireplace_type?: string | null
          flooring_install_year?: number | null
          foundation_type?: string | null
          frame_size?: string | null
          garage_spaces?: number | null
          gas_meter_location?: string | null
          gas_service?: boolean | null
          generator_capacity_kw?: number | null
          generator_install_year?: number | null
          generator_type?: string | null
          google_place_id?: string | null
          has_afci_breakers?: boolean | null
          has_air_purifier?: boolean | null
          has_attic_fan?: boolean | null
          has_basement_waterproofing?: boolean | null
          has_battery_storage?: boolean | null
          has_deck?: boolean | null
          has_erv_hrv?: boolean | null
          has_ev_charger?: boolean | null
          has_expansion_tank?: boolean | null
          has_fence?: boolean | null
          has_fire_extinguisher?: boolean | null
          has_fireplace?: boolean | null
          has_fountain?: boolean | null
          has_french_drain?: boolean | null
          has_generator?: boolean | null
          has_gfci_outlets?: boolean | null
          has_gutters?: boolean | null
          has_house_wrap?: boolean | null
          has_patio?: boolean | null
          has_pool?: boolean | null
          has_radon_mitigation?: boolean | null
          has_radon_test?: boolean | null
          has_recirculation_pump?: boolean | null
          has_security_system?: boolean | null
          has_smart_home_hub?: boolean | null
          has_solar_panels?: boolean | null
          has_sprinkler_system?: boolean | null
          has_storm_doors?: boolean | null
          has_storm_shelter?: boolean | null
          has_storm_windows?: boolean | null
          has_sump_pump?: boolean | null
          has_vapor_barrier?: boolean | null
          has_water_filtration?: boolean | null
          has_water_softener?: boolean | null
          has_whole_house_dehumidifier?: boolean | null
          has_whole_house_fan?: boolean | null
          has_whole_house_humidifier?: boolean | null
          has_whole_house_surge_protector?: boolean | null
          heating_type?: string | null
          hose_bib_locations?: string | null
          hvac_filter_returns?: Json | null
          hvac_filter_size?: string | null
          hvac_return_location?: string | null
          id?: string
          insulation_attic_depth_inches?: number | null
          insulation_attic_type?: string | null
          insulation_r_value_attic?: number | null
          insulation_r_value_walls?: number | null
          insulation_wall_type?: string | null
          interior_wall_type?: string | null
          known_asbestos?: boolean | null
          known_lead_paint?: boolean | null
          last_certified_inspection_at?: string | null
          last_certified_inspection_id?: string | null
          last_radon_level_pci?: number | null
          latitude?: number | null
          lawn_type?: string | null
          longitude?: number | null
          lot_size_sqft?: number | null
          main_breaker_location?: string | null
          normalized_address?: string | null
          number_of_hvac_filters?: number | null
          ownership_documents_url?: string | null
          ownership_verification_date?: string | null
          ownership_verification_method?: string | null
          ownership_verification_notes?: string | null
          ownership_verification_status?: string | null
          ownership_verified?: boolean | null
          parent_home_id?: string | null
          patio_material?: string | null
          photo_url?: string | null
          plumbing_drain_install_year?: number | null
          plumbing_drain_type?: string | null
          plumbing_supply_install_year?: number | null
          plumbing_supply_type?: string | null
          pool_type?: string | null
          primary_flooring?: string | null
          record_completeness_score?: number | null
          recycling_day?: string | null
          recycling_frequency?: string | null
          roof_age_years?: number | null
          roof_install_year?: number | null
          roof_type?: string | null
          selling_soon?: boolean
          septic_drainfield_type?: string | null
          septic_install_year?: number | null
          septic_last_inspected?: string | null
          septic_last_pumped?: string | null
          septic_tank_size_gallons?: number | null
          septic_type?: string | null
          sewer_type?: string | null
          siding_install_year?: number | null
          siding_type?: string | null
          solar_capacity_kw?: number | null
          solar_install_year?: number | null
          solar_inverter_type?: string | null
          solar_panel_count?: number | null
          square_footage?: number | null
          state: string
          stories?: number | null
          stories_type?: string | null
          structure_label?: string | null
          structure_type?: string | null
          sub_panel_locations?: string | null
          trash_day?: string | null
          trash_provider?: string | null
          updated_at?: string | null
          usda_zone?: string | null
          user_id: string
          water_filtration_type?: string | null
          water_meter_location?: string | null
          water_shutoff_location?: string | null
          water_source?: string | null
          well_depth_ft?: number | null
          well_last_tested?: string | null
          well_pressure_tank_install_year?: number | null
          well_pump_install_year?: number | null
          well_pump_type?: string | null
          window_frame_material?: string | null
          window_glazing?: string | null
          window_install_year?: number | null
          yard_waste_day?: string | null
          yard_waste_seasonal?: boolean | null
          year_built?: number | null
          year_renovated?: number | null
          zip_code: string
          zip_plus4?: string | null
        }
        Update: {
          address?: string
          agent_attestation_note?: string | null
          agent_attested_at?: string | null
          basement_finished_pct?: number | null
          bathrooms?: number | null
          battery_storage_install_year?: number | null
          bedrooms?: number | null
          ceiling_height_ft?: number | null
          ceiling_type?: string | null
          certified_inspection_count?: number
          city?: string
          climate_zone?: string | null
          construction_type?: string | null
          cooling_type?: string | null
          countertop_type?: string | null
          created_at?: string | null
          driveway_install_year?: number | null
          driveway_material?: string | null
          ductwork_insulated?: boolean | null
          ductwork_type?: string | null
          electrical_panel_amps?: number | null
          electrical_panel_brand?: string | null
          electrical_panel_year?: number | null
          electrical_wiring_type?: string | null
          ev_charger_install_year?: number | null
          ev_charger_level?: string | null
          exterior_door_material?: string | null
          exterior_paint_year?: number | null
          fence_install_year?: number | null
          fence_type?: string | null
          fireplace_count?: number | null
          fireplace_details?: Json | null
          fireplace_type?: string | null
          flooring_install_year?: number | null
          foundation_type?: string | null
          frame_size?: string | null
          garage_spaces?: number | null
          gas_meter_location?: string | null
          gas_service?: boolean | null
          generator_capacity_kw?: number | null
          generator_install_year?: number | null
          generator_type?: string | null
          google_place_id?: string | null
          has_afci_breakers?: boolean | null
          has_air_purifier?: boolean | null
          has_attic_fan?: boolean | null
          has_basement_waterproofing?: boolean | null
          has_battery_storage?: boolean | null
          has_deck?: boolean | null
          has_erv_hrv?: boolean | null
          has_ev_charger?: boolean | null
          has_expansion_tank?: boolean | null
          has_fence?: boolean | null
          has_fire_extinguisher?: boolean | null
          has_fireplace?: boolean | null
          has_fountain?: boolean | null
          has_french_drain?: boolean | null
          has_generator?: boolean | null
          has_gfci_outlets?: boolean | null
          has_gutters?: boolean | null
          has_house_wrap?: boolean | null
          has_patio?: boolean | null
          has_pool?: boolean | null
          has_radon_mitigation?: boolean | null
          has_radon_test?: boolean | null
          has_recirculation_pump?: boolean | null
          has_security_system?: boolean | null
          has_smart_home_hub?: boolean | null
          has_solar_panels?: boolean | null
          has_sprinkler_system?: boolean | null
          has_storm_doors?: boolean | null
          has_storm_shelter?: boolean | null
          has_storm_windows?: boolean | null
          has_sump_pump?: boolean | null
          has_vapor_barrier?: boolean | null
          has_water_filtration?: boolean | null
          has_water_softener?: boolean | null
          has_whole_house_dehumidifier?: boolean | null
          has_whole_house_fan?: boolean | null
          has_whole_house_humidifier?: boolean | null
          has_whole_house_surge_protector?: boolean | null
          heating_type?: string | null
          hose_bib_locations?: string | null
          hvac_filter_returns?: Json | null
          hvac_filter_size?: string | null
          hvac_return_location?: string | null
          id?: string
          insulation_attic_depth_inches?: number | null
          insulation_attic_type?: string | null
          insulation_r_value_attic?: number | null
          insulation_r_value_walls?: number | null
          insulation_wall_type?: string | null
          interior_wall_type?: string | null
          known_asbestos?: boolean | null
          known_lead_paint?: boolean | null
          last_certified_inspection_at?: string | null
          last_certified_inspection_id?: string | null
          last_radon_level_pci?: number | null
          latitude?: number | null
          lawn_type?: string | null
          longitude?: number | null
          lot_size_sqft?: number | null
          main_breaker_location?: string | null
          normalized_address?: string | null
          number_of_hvac_filters?: number | null
          ownership_documents_url?: string | null
          ownership_verification_date?: string | null
          ownership_verification_method?: string | null
          ownership_verification_notes?: string | null
          ownership_verification_status?: string | null
          ownership_verified?: boolean | null
          parent_home_id?: string | null
          patio_material?: string | null
          photo_url?: string | null
          plumbing_drain_install_year?: number | null
          plumbing_drain_type?: string | null
          plumbing_supply_install_year?: number | null
          plumbing_supply_type?: string | null
          pool_type?: string | null
          primary_flooring?: string | null
          record_completeness_score?: number | null
          recycling_day?: string | null
          recycling_frequency?: string | null
          roof_age_years?: number | null
          roof_install_year?: number | null
          roof_type?: string | null
          selling_soon?: boolean
          septic_drainfield_type?: string | null
          septic_install_year?: number | null
          septic_last_inspected?: string | null
          septic_last_pumped?: string | null
          septic_tank_size_gallons?: number | null
          septic_type?: string | null
          sewer_type?: string | null
          siding_install_year?: number | null
          siding_type?: string | null
          solar_capacity_kw?: number | null
          solar_install_year?: number | null
          solar_inverter_type?: string | null
          solar_panel_count?: number | null
          square_footage?: number | null
          state?: string
          stories?: number | null
          stories_type?: string | null
          structure_label?: string | null
          structure_type?: string | null
          sub_panel_locations?: string | null
          trash_day?: string | null
          trash_provider?: string | null
          updated_at?: string | null
          usda_zone?: string | null
          user_id?: string
          water_filtration_type?: string | null
          water_meter_location?: string | null
          water_shutoff_location?: string | null
          water_source?: string | null
          well_depth_ft?: number | null
          well_last_tested?: string | null
          well_pressure_tank_install_year?: number | null
          well_pump_install_year?: number | null
          well_pump_type?: string | null
          window_frame_material?: string | null
          window_glazing?: string | null
          window_install_year?: number | null
          yard_waste_day?: string | null
          yard_waste_seasonal?: boolean | null
          year_built?: number | null
          year_renovated?: number | null
          zip_code?: string
          zip_plus4?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homes_parent_home_id_fkey"
            columns: ["parent_home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_checklist_templates: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          items: Json
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          items?: Json
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          items?: Json
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string | null
          homeowner_id: string
          id: string
          invoice_id: string
          notes: string | null
          paid_at: string
          payment_method: string | null
          platform_fee: number | null
          provider_payout: number | null
          stripe_charge_id: string | null
          transaction_reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          homeowner_id: string
          id?: string
          invoice_id: string
          notes?: string | null
          paid_at?: string
          payment_method?: string | null
          platform_fee?: number | null
          provider_payout?: number | null
          stripe_charge_id?: string | null
          transaction_reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          homeowner_id?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          paid_at?: string
          payment_method?: string | null
          platform_fee?: number | null
          provider_payout?: number | null
          stripe_charge_id?: string | null
          transaction_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_homeowner_id_fkey"
            columns: ["homeowner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          due_date: string
          home_id: string
          homeowner_id: string
          homeowner_notes: string | null
          id: string
          invoice_number: string
          issued_date: string
          line_items: Json
          paid_at: string | null
          pro_notes: string | null
          pro_provider_id: string
          sent_at: string | null
          source_type: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          subtotal: number
          tax_amount: number | null
          tax_rate: number | null
          title: string
          total_amount: number
          updated_at: string | null
          viewed_at: string | null
        }
        Insert: {
          amount_paid?: number | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string
          home_id: string
          homeowner_id: string
          homeowner_notes?: string | null
          id?: string
          invoice_number: string
          issued_date?: string
          line_items?: Json
          paid_at?: string | null
          pro_notes?: string | null
          pro_provider_id: string
          sent_at?: string | null
          source_type?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal?: number
          tax_amount?: number | null
          tax_rate?: number | null
          title: string
          total_amount?: number
          updated_at?: string | null
          viewed_at?: string | null
        }
        Update: {
          amount_paid?: number | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string
          home_id?: string
          homeowner_id?: string
          homeowner_notes?: string | null
          id?: string
          invoice_number?: string
          issued_date?: string
          line_items?: Json
          paid_at?: string | null
          pro_notes?: string | null
          pro_provider_id?: string
          sent_at?: string | null
          source_type?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal?: number
          tax_amount?: number | null
          tax_rate?: number | null
          title?: string
          total_amount?: number
          updated_at?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_homeowner_id_fkey"
            columns: ["homeowner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_pro_provider_id_fkey"
            columns: ["pro_provider_id"]
            isOneToOne: false
            referencedRelation: "canopy_technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_pro_provider_id_fkey"
            columns: ["pro_provider_id"]
            isOneToOne: false
            referencedRelation: "partner_pros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_pro_provider_id_fkey"
            columns: ["pro_provider_id"]
            isOneToOne: false
            referencedRelation: "pro_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_log_edits: {
        Row: {
          edited_at: string | null
          edited_by: string
          field_changed: string
          id: string
          log_id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          edited_at?: string | null
          edited_by: string
          field_changed: string
          id?: string
          log_id: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          edited_at?: string | null
          edited_by?: string
          field_changed?: string
          id?: string
          log_id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: []
      }
      maintenance_logs: {
        Row: {
          category: string
          completed_by: string | null
          completed_date: string
          cost: number | null
          created_at: string | null
          description: string | null
          home_id: string
          id: string
          notes: string | null
          photos: Json | null
          source: string | null
          task_id: string | null
          title: string
          verified: boolean | null
          visit_id: string | null
        }
        Insert: {
          category: string
          completed_by?: string | null
          completed_date?: string
          cost?: number | null
          created_at?: string | null
          description?: string | null
          home_id: string
          id?: string
          notes?: string | null
          photos?: Json | null
          source?: string | null
          task_id?: string | null
          title: string
          verified?: boolean | null
          visit_id?: string | null
        }
        Update: {
          category?: string
          completed_by?: string | null
          completed_date?: string
          cost?: number | null
          created_at?: string | null
          description?: string | null
          home_id?: string
          id?: string
          notes?: string | null
          photos?: Json | null
          source?: string | null
          task_id?: string | null
          title?: string
          verified?: boolean | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_tasks: {
        Row: {
          applicable_months: number[] | null
          category: string
          completed_by: string | null
          completed_by_pro_id: string | null
          completed_date: string | null
          completion_notes: string | null
          completion_photo_url: string | null
          created_at: string | null
          created_by_pro_id: string | null
          created_by_user: boolean | null
          deleted_at: string | null
          description: string | null
          due_date: string
          equipment_id: string | null
          estimated_cost: number | null
          estimated_minutes: number | null
          frequency: string | null
          home_id: string
          id: string
          instructions: Json | null
          interval_days: number | null
          is_cleaning: boolean | null
          is_custom: boolean | null
          is_weather_triggered: boolean | null
          items_to_have_on_hand: string[] | null
          notes: string | null
          priority: string | null
          pro_provider_id: string | null
          reminder_days_before: number | null
          safety_warnings: string[] | null
          scheduled_time: string | null
          scheduling_type: string | null
          service_purpose: string | null
          status: string | null
          template_id: string | null
          template_version: number | null
          title: string
          updated_at: string | null
          weather_alert_id: string | null
          weather_trigger_type: string | null
        }
        Insert: {
          applicable_months?: number[] | null
          category: string
          completed_by?: string | null
          completed_by_pro_id?: string | null
          completed_date?: string | null
          completion_notes?: string | null
          completion_photo_url?: string | null
          created_at?: string | null
          created_by_pro_id?: string | null
          created_by_user?: boolean | null
          deleted_at?: string | null
          description?: string | null
          due_date: string
          equipment_id?: string | null
          estimated_cost?: number | null
          estimated_minutes?: number | null
          frequency?: string | null
          home_id: string
          id?: string
          instructions?: Json | null
          interval_days?: number | null
          is_cleaning?: boolean | null
          is_custom?: boolean | null
          is_weather_triggered?: boolean | null
          items_to_have_on_hand?: string[] | null
          notes?: string | null
          priority?: string | null
          pro_provider_id?: string | null
          reminder_days_before?: number | null
          safety_warnings?: string[] | null
          scheduled_time?: string | null
          scheduling_type?: string | null
          service_purpose?: string | null
          status?: string | null
          template_id?: string | null
          template_version?: number | null
          title: string
          updated_at?: string | null
          weather_alert_id?: string | null
          weather_trigger_type?: string | null
        }
        Update: {
          applicable_months?: number[] | null
          category?: string
          completed_by?: string | null
          completed_by_pro_id?: string | null
          completed_date?: string | null
          completion_notes?: string | null
          completion_photo_url?: string | null
          created_at?: string | null
          created_by_pro_id?: string | null
          created_by_user?: boolean | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string
          equipment_id?: string | null
          estimated_cost?: number | null
          estimated_minutes?: number | null
          frequency?: string | null
          home_id?: string
          id?: string
          instructions?: Json | null
          interval_days?: number | null
          is_cleaning?: boolean | null
          is_custom?: boolean | null
          is_weather_triggered?: boolean | null
          items_to_have_on_hand?: string[] | null
          notes?: string | null
          priority?: string | null
          pro_provider_id?: string | null
          reminder_days_before?: number | null
          safety_warnings?: string[] | null
          scheduled_time?: string | null
          scheduling_type?: string | null
          service_purpose?: string | null
          status?: string | null
          template_id?: string | null
          template_version?: number | null
          title?: string
          updated_at?: string | null
          weather_alert_id?: string | null
          weather_trigger_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tasks_completed_by_pro_id_fkey"
            columns: ["completed_by_pro_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_created_by_pro_id_fkey"
            columns: ["created_by_pro_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_pro_provider_id_fkey"
            columns: ["pro_provider_id"]
            isOneToOne: false
            referencedRelation: "canopy_technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_pro_provider_id_fkey"
            columns: ["pro_provider_id"]
            isOneToOne: false
            referencedRelation: "partner_pros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_pro_provider_id_fkey"
            columns: ["pro_provider_id"]
            isOneToOne: false
            referencedRelation: "pro_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string | null
          category: string
          created_at: string
          data: Json | null
          delivered_channels: string[] | null
          digest_batch_id: string | null
          digest_sent: boolean | null
          email_attempts: number
          email_clicked_at: string | null
          email_last_error: string | null
          email_next_retry_at: string | null
          email_opened_at: string | null
          email_permanently_failed: boolean
          emailed: boolean | null
          id: string
          push_attempts: number
          push_last_error: string | null
          push_next_retry_at: string | null
          push_permanently_failed: boolean
          pushed: boolean | null
          read: boolean
          recipient_email: string | null
          sms_attempts: number
          sms_last_error: string | null
          sms_next_retry_at: string | null
          sms_permanently_failed: boolean
          sms_sent: boolean | null
          title: string
          user_id: string | null
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          category?: string
          created_at?: string
          data?: Json | null
          delivered_channels?: string[] | null
          digest_batch_id?: string | null
          digest_sent?: boolean | null
          email_attempts?: number
          email_clicked_at?: string | null
          email_last_error?: string | null
          email_next_retry_at?: string | null
          email_opened_at?: string | null
          email_permanently_failed?: boolean
          emailed?: boolean | null
          id?: string
          push_attempts?: number
          push_last_error?: string | null
          push_next_retry_at?: string | null
          push_permanently_failed?: boolean
          pushed?: boolean | null
          read?: boolean
          recipient_email?: string | null
          sms_attempts?: number
          sms_last_error?: string | null
          sms_next_retry_at?: string | null
          sms_permanently_failed?: boolean
          sms_sent?: boolean | null
          title: string
          user_id?: string | null
        }
        Update: {
          action_url?: string | null
          body?: string | null
          category?: string
          created_at?: string
          data?: Json | null
          delivered_channels?: string[] | null
          digest_batch_id?: string | null
          digest_sent?: boolean | null
          email_attempts?: number
          email_clicked_at?: string | null
          email_last_error?: string | null
          email_next_retry_at?: string | null
          email_opened_at?: string | null
          email_permanently_failed?: boolean
          emailed?: boolean | null
          id?: string
          push_attempts?: number
          push_last_error?: string | null
          push_next_retry_at?: string | null
          push_permanently_failed?: boolean
          pushed?: boolean | null
          read?: boolean
          recipient_email?: string | null
          sms_attempts?: number
          sms_last_error?: string | null
          sms_next_retry_at?: string | null
          sms_permanently_failed?: boolean
          sms_sent?: boolean | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      onboarding_steps: {
        Row: {
          category: string
          created_at: string
          description: string | null
          estimated_minutes: number | null
          id: string
          is_active: boolean
          required: boolean
          sort_order: number
          title: string
          training_material_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          is_active?: boolean
          required?: boolean
          sort_order?: number
          title: string
          training_material_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          is_active?: boolean
          required?: boolean
          sort_order?: number
          title?: string
          training_material_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_steps_training_material_id_fkey"
            columns: ["training_material_id"]
            isOneToOne: false
            referencedRelation: "training_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_interest: {
        Row: {
          city: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          notified: boolean | null
          state: string | null
          tier_interest: string | null
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id?: string
          notified?: boolean | null
          state?: string | null
          tier_interest?: string | null
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          notified?: boolean | null
          state?: string | null
          tier_interest?: string | null
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      pro_monthly_visits: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          confirmation_nudge_sent: boolean | null
          confirmed_date: string | null
          confirmed_end_time: string | null
          confirmed_start_time: string | null
          created_at: string | null
          followup_email_sent: boolean | null
          home_id: string
          homeowner_confirmed_at: string | null
          homeowner_id: string
          homeowner_notes: string | null
          homeowner_rating: number | null
          homeowner_review: string | null
          homeowner_signature_data_url: string | null
          homeowner_signature_name: string | null
          homeowner_signed_at: string | null
          hours_before_cancellation: number | null
          id: string
          is_first_visit: boolean | null
          max_minutes: number | null
          payout_amount_cents: number | null
          payout_status: string | null
          photos: Json | null
          pro_notes: string | null
          pro_provider_id: string
          proposed_date: string | null
          proposed_time_slot: string | null
          rated_at: string | null
          reminder_sent: boolean | null
          same_month_rebookable: boolean | null
          selected_task_ids: string[] | null
          started_at: string | null
          status: string
          summary_sent_at: string | null
          time_spent_minutes: number | null
          updated_at: string | null
          visit_month: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          confirmation_nudge_sent?: boolean | null
          confirmed_date?: string | null
          confirmed_end_time?: string | null
          confirmed_start_time?: string | null
          created_at?: string | null
          followup_email_sent?: boolean | null
          home_id: string
          homeowner_confirmed_at?: string | null
          homeowner_id: string
          homeowner_notes?: string | null
          homeowner_rating?: number | null
          homeowner_review?: string | null
          homeowner_signature_data_url?: string | null
          homeowner_signature_name?: string | null
          homeowner_signed_at?: string | null
          hours_before_cancellation?: number | null
          id?: string
          is_first_visit?: boolean | null
          max_minutes?: number | null
          payout_amount_cents?: number | null
          payout_status?: string | null
          photos?: Json | null
          pro_notes?: string | null
          pro_provider_id: string
          proposed_date?: string | null
          proposed_time_slot?: string | null
          rated_at?: string | null
          reminder_sent?: boolean | null
          same_month_rebookable?: boolean | null
          selected_task_ids?: string[] | null
          started_at?: string | null
          status?: string
          summary_sent_at?: string | null
          time_spent_minutes?: number | null
          updated_at?: string | null
          visit_month: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          confirmation_nudge_sent?: boolean | null
          confirmed_date?: string | null
          confirmed_end_time?: string | null
          confirmed_start_time?: string | null
          created_at?: string | null
          followup_email_sent?: boolean | null
          home_id?: string
          homeowner_confirmed_at?: string | null
          homeowner_id?: string
          homeowner_notes?: string | null
          homeowner_rating?: number | null
          homeowner_review?: string | null
          homeowner_signature_data_url?: string | null
          homeowner_signature_name?: string | null
          homeowner_signed_at?: string | null
          hours_before_cancellation?: number | null
          id?: string
          is_first_visit?: boolean | null
          max_minutes?: number | null
          payout_amount_cents?: number | null
          payout_status?: string | null
          photos?: Json | null
          pro_notes?: string | null
          pro_provider_id?: string
          proposed_date?: string | null
          proposed_time_slot?: string | null
          rated_at?: string | null
          reminder_sent?: boolean | null
          same_month_rebookable?: boolean | null
          selected_task_ids?: string[] | null
          started_at?: string | null
          status?: string
          summary_sent_at?: string | null
          time_spent_minutes?: number | null
          updated_at?: string | null
          visit_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "pro_monthly_visits_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pro_monthly_visits_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pro_monthly_visits_homeowner_id_fkey"
            columns: ["homeowner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pro_monthly_visits_pro_provider_id_fkey"
            columns: ["pro_provider_id"]
            isOneToOne: false
            referencedRelation: "canopy_technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pro_monthly_visits_pro_provider_id_fkey"
            columns: ["pro_provider_id"]
            isOneToOne: false
            referencedRelation: "partner_pros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pro_monthly_visits_pro_provider_id_fkey"
            columns: ["pro_provider_id"]
            isOneToOne: false
            referencedRelation: "pro_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_payouts: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          failed_at: string | null
          id: string
          initiated_at: string
          paid_at: string | null
          provider_id: string
          provider_user_id: string | null
          status: string
          stripe_connect_account: string
          stripe_error: string | null
          stripe_transfer_id: string | null
          updated_at: string
          visit_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          failed_at?: string | null
          id?: string
          initiated_at?: string
          paid_at?: string | null
          provider_id: string
          provider_user_id?: string | null
          status?: string
          stripe_connect_account: string
          stripe_error?: string | null
          stripe_transfer_id?: string | null
          updated_at?: string
          visit_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          failed_at?: string | null
          id?: string
          initiated_at?: string
          paid_at?: string | null
          provider_id?: string
          provider_user_id?: string | null
          status?: string
          stripe_connect_account?: string
          stripe_error?: string | null
          stripe_transfer_id?: string | null
          updated_at?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pro_payouts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "canopy_technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pro_payouts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "partner_pros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pro_payouts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "pro_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pro_payouts_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: true
            referencedRelation: "pro_monthly_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_providers: {
        Row: {
          application_id: string | null
          assigned_zones: string[] | null
          background_check_completed_at: string | null
          background_check_date: string | null
          background_check_initiated_at: string | null
          background_check_result: Json | null
          background_check_status: string | null
          bio: string | null
          business_name: string
          certification_level: string | null
          checkr_candidate_id: string | null
          checkr_report_id: string | null
          commission_rate: number | null
          contact_name: string
          contract_signed_at: string | null
          contract_type: string | null
          created_at: string | null
          email: string
          employee_id: string | null
          flagged_low_rating: boolean | null
          hire_date: string | null
          id: string
          insurance_carrier: string | null
          insurance_expires_at: string | null
          insurance_info: string | null
          insurance_policy_number: string | null
          is_available: boolean | null
          license_expires_at: string | null
          license_number: string | null
          license_state: string | null
          max_daily_visits: number | null
          max_jobs_per_day: number | null
          onboarding_completed_at: string | null
          partner_since: string | null
          payment_terms: string | null
          phone: string
          provider_status: string | null
          provider_type: string
          rating: number | null
          schedule: Json | null
          service_area_miles: number | null
          service_area_zips: string[] | null
          service_categories: string[] | null
          specializations: string[] | null
          stripe_connect_account_id: string | null
          stripe_connect_onboarding_complete: boolean | null
          suspended_at: string | null
          suspension_reason: string | null
          total_reviews: number | null
          training_completed_at: string | null
          updated_at: string | null
          user_id: string | null
          years_experience: number | null
          zip_codes: string[] | null
        }
        Insert: {
          application_id?: string | null
          assigned_zones?: string[] | null
          background_check_completed_at?: string | null
          background_check_date?: string | null
          background_check_initiated_at?: string | null
          background_check_result?: Json | null
          background_check_status?: string | null
          bio?: string | null
          business_name: string
          certification_level?: string | null
          checkr_candidate_id?: string | null
          checkr_report_id?: string | null
          commission_rate?: number | null
          contact_name: string
          contract_signed_at?: string | null
          contract_type?: string | null
          created_at?: string | null
          email: string
          employee_id?: string | null
          flagged_low_rating?: boolean | null
          hire_date?: string | null
          id?: string
          insurance_carrier?: string | null
          insurance_expires_at?: string | null
          insurance_info?: string | null
          insurance_policy_number?: string | null
          is_available?: boolean | null
          license_expires_at?: string | null
          license_number?: string | null
          license_state?: string | null
          max_daily_visits?: number | null
          max_jobs_per_day?: number | null
          onboarding_completed_at?: string | null
          partner_since?: string | null
          payment_terms?: string | null
          phone: string
          provider_status?: string | null
          provider_type?: string
          rating?: number | null
          schedule?: Json | null
          service_area_miles?: number | null
          service_area_zips?: string[] | null
          service_categories?: string[] | null
          specializations?: string[] | null
          stripe_connect_account_id?: string | null
          stripe_connect_onboarding_complete?: boolean | null
          suspended_at?: string | null
          suspension_reason?: string | null
          total_reviews?: number | null
          training_completed_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          years_experience?: number | null
          zip_codes?: string[] | null
        }
        Update: {
          application_id?: string | null
          assigned_zones?: string[] | null
          background_check_completed_at?: string | null
          background_check_date?: string | null
          background_check_initiated_at?: string | null
          background_check_result?: Json | null
          background_check_status?: string | null
          bio?: string | null
          business_name?: string
          certification_level?: string | null
          checkr_candidate_id?: string | null
          checkr_report_id?: string | null
          commission_rate?: number | null
          contact_name?: string
          contract_signed_at?: string | null
          contract_type?: string | null
          created_at?: string | null
          email?: string
          employee_id?: string | null
          flagged_low_rating?: boolean | null
          hire_date?: string | null
          id?: string
          insurance_carrier?: string | null
          insurance_expires_at?: string | null
          insurance_info?: string | null
          insurance_policy_number?: string | null
          is_available?: boolean | null
          license_expires_at?: string | null
          license_number?: string | null
          license_state?: string | null
          max_daily_visits?: number | null
          max_jobs_per_day?: number | null
          onboarding_completed_at?: string | null
          partner_since?: string | null
          payment_terms?: string | null
          phone?: string
          provider_status?: string | null
          provider_type?: string
          rating?: number | null
          schedule?: Json | null
          service_area_miles?: number | null
          service_area_zips?: string[] | null
          service_categories?: string[] | null
          specializations?: string[] | null
          stripe_connect_account_id?: string | null
          stripe_connect_onboarding_complete?: boolean | null
          suspended_at?: string | null
          suspension_reason?: string | null
          total_reviews?: number | null
          training_completed_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          years_experience?: number | null
          zip_codes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "pro_providers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "provider_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_request_tasks: {
        Row: {
          created_at: string | null
          id: string
          request_id: string
          task_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          request_id: string
          task_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          request_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pro_request_tasks_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "pro_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pro_request_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_requests: {
        Row: {
          assigned_pro: string | null
          category: string
          completion_notes: string | null
          cost: number | null
          created_at: string | null
          declined_by: Json | null
          description: string
          home_id: string | null
          id: string
          photos: string[] | null
          preferred_day: string | null
          provider_id: string | null
          scheduled_date: string | null
          source: string | null
          status: string | null
          updated_at: string | null
          urgency: string | null
          user_id: string
        }
        Insert: {
          assigned_pro?: string | null
          category: string
          completion_notes?: string | null
          cost?: number | null
          created_at?: string | null
          declined_by?: Json | null
          description: string
          home_id?: string | null
          id?: string
          photos?: string[] | null
          preferred_day?: string | null
          provider_id?: string | null
          scheduled_date?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          urgency?: string | null
          user_id: string
        }
        Update: {
          assigned_pro?: string | null
          category?: string
          completion_notes?: string | null
          cost?: number | null
          created_at?: string | null
          declined_by?: Json | null
          description?: string
          home_id?: string | null
          id?: string
          photos?: string[] | null
          preferred_day?: string | null
          provider_id?: string | null
          scheduled_date?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          urgency?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pro_requests_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pro_requests_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "canopy_technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pro_requests_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "partner_pros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pro_requests_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "pro_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pro_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_service_appointments: {
        Row: {
          actual_cost: number | null
          cost_estimate: number | null
          created_at: string | null
          description: string | null
          home_id: string
          id: string
          items_to_have_on_hand: string[] | null
          notes: string | null
          pro_provider_id: string | null
          reminder_days_before: number | null
          request_id: string | null
          scheduled_date: string
          scheduled_time: string | null
          service_purpose: string | null
          status: string
          task_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          actual_cost?: number | null
          cost_estimate?: number | null
          created_at?: string | null
          description?: string | null
          home_id: string
          id?: string
          items_to_have_on_hand?: string[] | null
          notes?: string | null
          pro_provider_id?: string | null
          reminder_days_before?: number | null
          request_id?: string | null
          scheduled_date: string
          scheduled_time?: string | null
          service_purpose?: string | null
          status?: string
          task_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          actual_cost?: number | null
          cost_estimate?: number | null
          created_at?: string | null
          description?: string | null
          home_id?: string
          id?: string
          items_to_have_on_hand?: string[] | null
          notes?: string | null
          pro_provider_id?: string | null
          reminder_days_before?: number | null
          request_id?: string | null
          scheduled_date?: string
          scheduled_time?: string | null
          service_purpose?: string | null
          status?: string
          task_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pro_service_appointments_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pro_service_appointments_pro_provider_id_fkey"
            columns: ["pro_provider_id"]
            isOneToOne: false
            referencedRelation: "canopy_technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pro_service_appointments_pro_provider_id_fkey"
            columns: ["pro_provider_id"]
            isOneToOne: false
            referencedRelation: "partner_pros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pro_service_appointments_pro_provider_id_fkey"
            columns: ["pro_provider_id"]
            isOneToOne: false
            referencedRelation: "pro_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pro_service_appointments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "pro_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pro_service_appointments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_visit_allocations: {
        Row: {
          allocated_visits: number | null
          created_at: string | null
          forfeited_visits: number | null
          homeowner_id: string
          id: string
          updated_at: string | null
          used_visits: number | null
          visit_month: string
        }
        Insert: {
          allocated_visits?: number | null
          created_at?: string | null
          forfeited_visits?: number | null
          homeowner_id: string
          id?: string
          updated_at?: string | null
          used_visits?: number | null
          visit_month: string
        }
        Update: {
          allocated_visits?: number | null
          created_at?: string | null
          forfeited_visits?: number | null
          homeowner_id?: string
          id?: string
          updated_at?: string | null
          used_visits?: number | null
          visit_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "pro_visit_allocations_homeowner_id_fkey"
            columns: ["homeowner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          admin_override: boolean
          admin_override_at: string | null
          admin_override_by: string | null
          agent_id: string | null
          avatar_url: string | null
          calendar_token: string | null
          created_at: string | null
          current_period_end: string | null
          custom_pro_rate: number | null
          email: string | null
          full_name: string
          gift_code: string | null
          home_detail_depth: string | null
          id: string
          last_active_at: string | null
          maintenance_depth: string | null
          notification_preferences: Json | null
          onboarding_complete: boolean | null
          phone: string | null
          pro_welcome_sent: boolean | null
          push_token: string | null
          revenuecat_customer_id: string | null
          role: string | null
          setup_checklist_state: Json | null
          show_cleaning_tasks: boolean | null
          show_pro_tasks: boolean | null
          sms_verified: boolean | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_expires_at: string | null
          subscription_source: string | null
          subscription_status: string | null
          subscription_tier: string | null
          task_category_overrides: Json | null
          task_reminder_days_before: number | null
          timezone: string | null
          updated_at: string | null
          visit_sms_opt_in: boolean
          weather_alerts_enabled: boolean | null
          web_push_subscription: Json | null
        }
        Insert: {
          admin_override?: boolean
          admin_override_at?: string | null
          admin_override_by?: string | null
          agent_id?: string | null
          avatar_url?: string | null
          calendar_token?: string | null
          created_at?: string | null
          current_period_end?: string | null
          custom_pro_rate?: number | null
          email?: string | null
          full_name: string
          gift_code?: string | null
          home_detail_depth?: string | null
          id: string
          last_active_at?: string | null
          maintenance_depth?: string | null
          notification_preferences?: Json | null
          onboarding_complete?: boolean | null
          phone?: string | null
          pro_welcome_sent?: boolean | null
          push_token?: string | null
          revenuecat_customer_id?: string | null
          role?: string | null
          setup_checklist_state?: Json | null
          show_cleaning_tasks?: boolean | null
          show_pro_tasks?: boolean | null
          sms_verified?: boolean | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_expires_at?: string | null
          subscription_source?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          task_category_overrides?: Json | null
          task_reminder_days_before?: number | null
          timezone?: string | null
          updated_at?: string | null
          visit_sms_opt_in?: boolean
          weather_alerts_enabled?: boolean | null
          web_push_subscription?: Json | null
        }
        Update: {
          admin_override?: boolean
          admin_override_at?: string | null
          admin_override_by?: string | null
          agent_id?: string | null
          avatar_url?: string | null
          calendar_token?: string | null
          created_at?: string | null
          current_period_end?: string | null
          custom_pro_rate?: number | null
          email?: string | null
          full_name?: string
          gift_code?: string | null
          home_detail_depth?: string | null
          id?: string
          last_active_at?: string | null
          maintenance_depth?: string | null
          notification_preferences?: Json | null
          onboarding_complete?: boolean | null
          phone?: string | null
          pro_welcome_sent?: boolean | null
          push_token?: string | null
          revenuecat_customer_id?: string | null
          role?: string | null
          setup_checklist_state?: Json | null
          show_cleaning_tasks?: boolean | null
          show_pro_tasks?: boolean | null
          sms_verified?: boolean | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_expires_at?: string | null
          subscription_source?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          task_category_overrides?: Json | null
          task_reminder_days_before?: number | null
          timezone?: string | null
          updated_at?: string | null
          visit_sms_opt_in?: boolean
          weather_alerts_enabled?: boolean | null
          web_push_subscription?: Json | null
        }
        Relationships: []
      }
      property_assessments: {
        Row: {
          approved_by_admin: boolean | null
          assessment_data: Json
          assessment_notes: string | null
          category_id: string
          condition_rating: number | null
          created_at: string
          home_add_on_id: string
          home_id: string
          id: string
          photos: string[] | null
          price_justification: string | null
          provider_id: string
          recommended_price: number | null
          submitted_at: string
        }
        Insert: {
          approved_by_admin?: boolean | null
          assessment_data?: Json
          assessment_notes?: string | null
          category_id: string
          condition_rating?: number | null
          created_at?: string
          home_add_on_id: string
          home_id: string
          id?: string
          photos?: string[] | null
          price_justification?: string | null
          provider_id: string
          recommended_price?: number | null
          submitted_at?: string
        }
        Update: {
          approved_by_admin?: boolean | null
          assessment_data?: Json
          assessment_notes?: string | null
          category_id?: string
          condition_rating?: number | null
          created_at?: string
          home_add_on_id?: string
          home_id?: string
          id?: string
          photos?: string[] | null
          price_justification?: string | null
          provider_id?: string
          recommended_price?: number | null
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_assessments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "add_on_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_assessments_home_add_on_id_fkey"
            columns: ["home_add_on_id"]
            isOneToOne: false
            referencedRelation: "home_add_ons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_assessments_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_applications: {
        Row: {
          agreed_to_terms: boolean
          agreed_to_terms_at: string | null
          bio: string | null
          business_name: string
          contact_name: string
          created_at: string
          email: string
          id: string
          insurance_carrier: string
          insurance_expires_at: string
          insurance_policy_number: string
          license_number: string
          license_state: string
          phone: string
          requested_type: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          service_area_zips: string[]
          service_categories: string[]
          status: string
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          agreed_to_terms?: boolean
          agreed_to_terms_at?: string | null
          bio?: string | null
          business_name: string
          contact_name: string
          created_at?: string
          email: string
          id?: string
          insurance_carrier: string
          insurance_expires_at: string
          insurance_policy_number: string
          license_number: string
          license_state: string
          phone: string
          requested_type?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_area_zips?: string[]
          service_categories?: string[]
          status?: string
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          agreed_to_terms?: boolean
          agreed_to_terms_at?: string | null
          bio?: string | null
          business_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          insurance_carrier?: string
          insurance_expires_at?: string
          insurance_policy_number?: string
          license_number?: string
          license_state?: string
          phone?: string
          requested_type?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_area_zips?: string[]
          service_categories?: string[]
          status?: string
          updated_at?: string
          years_experience?: number | null
        }
        Relationships: []
      }
      provider_onboarding_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          provider_id: string
          status: string
          step_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          provider_id: string
          status?: string
          step_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          provider_id?: string
          status?: string
          step_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_onboarding_progress_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "canopy_technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_onboarding_progress_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "partner_pros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_onboarding_progress_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "pro_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_onboarding_progress_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "onboarding_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_services: {
        Row: {
          certified_at: string | null
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          proficiency: string
          provider_id: string
          service_key: string
        }
        Insert: {
          certified_at?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          proficiency?: string
          provider_id: string
          service_key: string
        }
        Update: {
          certified_at?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          proficiency?: string
          provider_id?: string
          service_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "canopy_technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "partner_pros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "pro_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_templates: {
        Row: {
          category: string
          created_at: string | null
          default_tax_rate: number | null
          description: string | null
          id: string
          is_active: boolean | null
          line_items: Json
          name: string
          provider_id: string
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          default_tax_rate?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          line_items?: Json
          name: string
          provider_id: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          default_tax_rate?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          line_items?: Json
          name?: string
          provider_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_templates_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "canopy_technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_templates_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "partner_pros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_templates_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "pro_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          converted_at: string | null
          converted_to_invoice_id: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          home_id: string
          homeowner_approved_at: string | null
          homeowner_id: string
          homeowner_notes: string | null
          homeowner_rejected_at: string | null
          id: string
          issued_date: string
          line_items: Json
          pro_notes: string | null
          pro_provider_id: string
          quote_number: string
          sent_at: string | null
          service_type: string | null
          status: string
          subtotal: number
          tax_amount: number | null
          tax_rate: number | null
          title: string
          total_amount: number
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          converted_at?: string | null
          converted_to_invoice_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          home_id: string
          homeowner_approved_at?: string | null
          homeowner_id: string
          homeowner_notes?: string | null
          homeowner_rejected_at?: string | null
          id?: string
          issued_date?: string
          line_items?: Json
          pro_notes?: string | null
          pro_provider_id: string
          quote_number: string
          sent_at?: string | null
          service_type?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number | null
          tax_rate?: number | null
          title: string
          total_amount?: number
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          converted_at?: string | null
          converted_to_invoice_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          home_id?: string
          homeowner_approved_at?: string | null
          homeowner_id?: string
          homeowner_notes?: string | null
          homeowner_rejected_at?: string | null
          id?: string
          issued_date?: string
          line_items?: Json
          pro_notes?: string | null
          pro_provider_id?: string
          quote_number?: string
          sent_at?: string | null
          service_type?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number | null
          tax_rate?: number | null
          title?: string
          total_amount?: number
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_converted_to_invoice_id_fkey"
            columns: ["converted_to_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_homeowner_id_fkey"
            columns: ["homeowner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_pro_provider_id_fkey"
            columns: ["pro_provider_id"]
            isOneToOne: false
            referencedRelation: "canopy_technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_pro_provider_id_fkey"
            columns: ["pro_provider_id"]
            isOneToOne: false
            referencedRelation: "partner_pros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_pro_provider_id_fkey"
            columns: ["pro_provider_id"]
            isOneToOne: false
            referencedRelation: "pro_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          function_name: string
          id: string
          request_count: number
          user_id: string
          window_start: string
        }
        Insert: {
          function_name: string
          id?: string
          request_count?: number
          user_id: string
          window_start?: string
        }
        Update: {
          function_name?: string
          id?: string
          request_count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      reference_data: {
        Row: {
          active: boolean
          created_at: string
          id: string
          key: string
          label: string
          sort_order: number
          type: string
          updated_at: string
          value: Json
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          key: string
          label: string
          sort_order?: number
          type: string
          updated_at?: string
          value?: Json
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          key?: string
          label?: string
          sort_order?: number
          type?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      secure_notes: {
        Row: {
          category: string
          content: string
          created_at: string | null
          deleted_at: string | null
          home_id: string
          id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          deleted_at?: string | null
          home_id: string
          id?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          deleted_at?: string | null
          home_id?: string
          id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "secure_notes_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      service_area_services: {
        Row: {
          base_price_cents: number | null
          category: string
          created_at: string
          estimated_minutes: number | null
          id: string
          is_active: boolean
          notes: string | null
          service_area_id: string
          service_key: string
          service_label: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          base_price_cents?: number | null
          category: string
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          is_active?: boolean
          notes?: string | null
          service_area_id: string
          service_key: string
          service_label: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          base_price_cents?: number | null
          category?: string
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          is_active?: boolean
          notes?: string | null
          service_area_id?: string
          service_key?: string
          service_label?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_area_services_service_area_id_fkey"
            columns: ["service_area_id"]
            isOneToOne: false
            referencedRelation: "service_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      service_areas: {
        Row: {
          city_name: string | null
          coverage_radius_miles: number | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          launched_at: string | null
          max_providers: number | null
          notes: string | null
          pricing_tier: string | null
          region_name: string | null
          state: string
          updated_at: string | null
          zip_code: string
        }
        Insert: {
          city_name?: string | null
          coverage_radius_miles?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          launched_at?: string | null
          max_providers?: number | null
          notes?: string | null
          pricing_tier?: string | null
          region_name?: string | null
          state: string
          updated_at?: string | null
          zip_code: string
        }
        Update: {
          city_name?: string | null
          coverage_radius_miles?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          launched_at?: string | null
          max_providers?: number | null
          notes?: string | null
          pricing_tier?: string | null
          region_name?: string | null
          state?: string
          updated_at?: string | null
          zip_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_areas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          error: string | null
          event_id: string
          event_type: string
          processed_at: string | null
          processing_duration_ms: number | null
          received_at: string
        }
        Insert: {
          error?: string | null
          event_id: string
          event_type: string
          processed_at?: string | null
          processing_duration_ms?: number | null
          received_at?: string
        }
        Update: {
          error?: string | null
          event_id?: string
          event_type?: string
          processed_at?: string | null
          processing_duration_ms?: number | null
          received_at?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          app_version: string | null
          category: string
          created_at: string
          device_info: Json | null
          email: string
          id: string
          message: string
          name: string
          priority: string | null
          resolved_at: string | null
          screenshot_url: string | null
          status: string
          steps_to_reproduce: string | null
          subject: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          category: string
          created_at?: string
          device_info?: Json | null
          email: string
          id?: string
          message: string
          name: string
          priority?: string | null
          resolved_at?: string | null
          screenshot_url?: string | null
          status?: string
          steps_to_reproduce?: string | null
          subject: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          category?: string
          created_at?: string
          device_info?: Json | null
          email?: string
          id?: string
          message?: string
          name?: string
          priority?: string | null
          resolved_at?: string | null
          screenshot_url?: string | null
          status?: string
          steps_to_reproduce?: string | null
          subject?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      task_templates: {
        Row: {
          active: boolean
          add_on_category: string | null
          ai_confidence: number | null
          ai_source_equipment_id: string | null
          applicable_months: number[] | null
          category: string
          consumable_replacement_months: number | null
          consumable_spec: string | null
          created_at: string
          description: string | null
          equipment_keyed: boolean
          estimated_cost_high: number | null
          estimated_cost_low: number | null
          estimated_minutes: number | null
          excludes_equipment_subtype: string[] | null
          frequency: string
          id: string
          instructions: string | null
          instructions_json: Json | null
          interval_days: number | null
          is_cleaning: boolean
          is_weather_triggered: boolean | null
          items_to_have_on_hand: string[] | null
          priority: string
          pro_recommended: boolean | null
          regions: string[] | null
          requires_construction_type: string[] | null
          requires_countertop_type: string[] | null
          requires_equipment: string | null
          requires_equipment_subtype: string[] | null
          requires_feature: string | null
          requires_flooring_type: string[] | null
          requires_foundation_type: string[] | null
          requires_home_type: string[] | null
          requires_pool_type: string[] | null
          requires_septic_type: string[] | null
          requires_sewer_type: string[] | null
          requires_water_source: string[] | null
          safety_warnings: string[] | null
          scheduling_type: string
          service_purpose: string | null
          service_type: Database["public"]["Enums"]["service_type_enum"]
          sort_order: number
          source: string
          task_level: string
          template_version: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          add_on_category?: string | null
          ai_confidence?: number | null
          ai_source_equipment_id?: string | null
          applicable_months?: number[] | null
          category: string
          consumable_replacement_months?: number | null
          consumable_spec?: string | null
          created_at?: string
          description?: string | null
          equipment_keyed?: boolean
          estimated_cost_high?: number | null
          estimated_cost_low?: number | null
          estimated_minutes?: number | null
          excludes_equipment_subtype?: string[] | null
          frequency?: string
          id?: string
          instructions?: string | null
          instructions_json?: Json | null
          interval_days?: number | null
          is_cleaning?: boolean
          is_weather_triggered?: boolean | null
          items_to_have_on_hand?: string[] | null
          priority?: string
          pro_recommended?: boolean | null
          regions?: string[] | null
          requires_construction_type?: string[] | null
          requires_countertop_type?: string[] | null
          requires_equipment?: string | null
          requires_equipment_subtype?: string[] | null
          requires_feature?: string | null
          requires_flooring_type?: string[] | null
          requires_foundation_type?: string[] | null
          requires_home_type?: string[] | null
          requires_pool_type?: string[] | null
          requires_septic_type?: string[] | null
          requires_sewer_type?: string[] | null
          requires_water_source?: string[] | null
          safety_warnings?: string[] | null
          scheduling_type?: string
          service_purpose?: string | null
          service_type?: Database["public"]["Enums"]["service_type_enum"]
          sort_order?: number
          source?: string
          task_level?: string
          template_version?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          add_on_category?: string | null
          ai_confidence?: number | null
          ai_source_equipment_id?: string | null
          applicable_months?: number[] | null
          category?: string
          consumable_replacement_months?: number | null
          consumable_spec?: string | null
          created_at?: string
          description?: string | null
          equipment_keyed?: boolean
          estimated_cost_high?: number | null
          estimated_cost_low?: number | null
          estimated_minutes?: number | null
          excludes_equipment_subtype?: string[] | null
          frequency?: string
          id?: string
          instructions?: string | null
          instructions_json?: Json | null
          interval_days?: number | null
          is_cleaning?: boolean
          is_weather_triggered?: boolean | null
          items_to_have_on_hand?: string[] | null
          priority?: string
          pro_recommended?: boolean | null
          regions?: string[] | null
          requires_construction_type?: string[] | null
          requires_countertop_type?: string[] | null
          requires_equipment?: string | null
          requires_equipment_subtype?: string[] | null
          requires_feature?: string | null
          requires_flooring_type?: string[] | null
          requires_foundation_type?: string[] | null
          requires_home_type?: string[] | null
          requires_pool_type?: string[] | null
          requires_septic_type?: string[] | null
          requires_sewer_type?: string[] | null
          requires_water_source?: string[] | null
          safety_warnings?: string[] | null
          scheduling_type?: string
          service_purpose?: string | null
          service_type?: Database["public"]["Enums"]["service_type_enum"]
          sort_order?: number
          source?: string
          task_level?: string
          template_version?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      technician_documents: {
        Row: {
          agreement_text_hash: string | null
          agreement_version: string | null
          created_at: string | null
          document_type: string
          expires_at: string | null
          file_path: string | null
          id: string
          metadata: Json | null
          notes: string | null
          provider_id: string
          signature_data_url: string | null
          signed_at: string | null
          signer_ip: string | null
          signer_name: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          agreement_text_hash?: string | null
          agreement_version?: string | null
          created_at?: string | null
          document_type: string
          expires_at?: string | null
          file_path?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          provider_id: string
          signature_data_url?: string | null
          signed_at?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          agreement_text_hash?: string | null
          agreement_version?: string | null
          created_at?: string | null
          document_type?: string
          expires_at?: string | null
          file_path?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          provider_id?: string
          signature_data_url?: string | null
          signed_at?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technician_documents_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "canopy_technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_documents_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "partner_pros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_documents_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "pro_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_onboarding: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          notes: string | null
          provider_id: string
          score: number | null
          status: string
          step_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          provider_id: string
          score?: number | null
          status?: string
          step_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          provider_id?: string
          score?: number | null
          status?: string
          step_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_onboarding_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "canopy_technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_onboarding_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "partner_pros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_onboarding_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "pro_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_onboarding_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "onboarding_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonial_requests: {
        Row: {
          completed_task_count: number
          id: string
          last_event_at: string
          pro_visit_count: number
          sent_at: string
          signup_age_days: number
          status: string
          user_id: string
        }
        Insert: {
          completed_task_count?: number
          id?: string
          last_event_at?: string
          pro_visit_count?: number
          sent_at?: string
          signup_age_days?: number
          status?: string
          user_id: string
        }
        Update: {
          completed_task_count?: number
          id?: string
          last_event_at?: string
          pro_visit_count?: number
          sent_at?: string
          signup_age_days?: number
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          category_chips: string[] | null
          city: string | null
          created_at: string
          first_name: string
          home_id: string | null
          id: string
          neighborhood: string | null
          quote: string
          rating: number
          rejection_reason: string | null
          source: string
          state: string | null
          status: string
          submitted_at: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          category_chips?: string[] | null
          city?: string | null
          created_at?: string
          first_name: string
          home_id?: string | null
          id?: string
          neighborhood?: string | null
          quote: string
          rating: number
          rejection_reason?: string | null
          source?: string
          state?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          category_chips?: string[] | null
          city?: string | null
          created_at?: string
          first_name?: string
          home_id?: string | null
          id?: string
          neighborhood?: string | null
          quote?: string
          rating?: number
          rejection_reason?: string | null
          source?: string
          state?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "testimonials_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      training_materials: {
        Row: {
          category: string
          content_body: string | null
          content_type: string
          content_url: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          is_active: boolean
          required_for_level: string[] | null
          sort_order: number | null
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          content_body?: string | null
          content_type: string
          content_url?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          required_for_level?: string[] | null
          sort_order?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content_body?: string | null
          content_type?: string
          content_url?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          required_for_level?: string[] | null
          sort_order?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_ai_usage: {
        Row: {
          chat_count: number
          created_at: string | null
          id: string
          month: string
          photo_scan_count: number
          text_lookup_count: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          chat_count?: number
          created_at?: string | null
          id?: string
          month: string
          photo_scan_count?: number
          text_lookup_count?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          chat_count?: number
          created_at?: string | null
          id?: string
          month?: string
          photo_scan_count?: number
          text_lookup_count?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_ai_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      usps_tokens: {
        Row: {
          created_at: string
          expiresAt: number
          id: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expiresAt: number
          id?: string
          token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expiresAt?: number
          id?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      vault_pins: {
        Row: {
          created_at: string | null
          id: string
          pin_hash: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          pin_hash: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          pin_hash?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      visit_inspection_items: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          inspection_id: string
          item_key: string
          label: string
          notes: string | null
          photos: Json | null
          sort_order: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          inspection_id: string
          item_key: string
          label: string
          notes?: string | null
          photos?: Json | null
          sort_order?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          inspection_id?: string
          item_key?: string
          label?: string
          notes?: string | null
          photos?: Json | null
          sort_order?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visit_inspection_items_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "visit_inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_inspections: {
        Row: {
          checklist_name: string
          completed_at: string | null
          created_at: string | null
          equipment_category: string | null
          equipment_id: string | null
          equipment_name: string | null
          id: string
          overall_condition: string | null
          pro_notes: string | null
          started_at: string | null
          status: string | null
          template_id: string | null
          updated_at: string | null
          visit_id: string
        }
        Insert: {
          checklist_name: string
          completed_at?: string | null
          created_at?: string | null
          equipment_category?: string | null
          equipment_id?: string | null
          equipment_name?: string | null
          id?: string
          overall_condition?: string | null
          pro_notes?: string | null
          started_at?: string | null
          status?: string | null
          template_id?: string | null
          updated_at?: string | null
          visit_id: string
        }
        Update: {
          checklist_name?: string
          completed_at?: string | null
          created_at?: string | null
          equipment_category?: string | null
          equipment_id?: string | null
          equipment_name?: string | null
          id?: string
          overall_condition?: string | null
          pro_notes?: string | null
          started_at?: string | null
          status?: string | null
          template_id?: string | null
          updated_at?: string | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_inspections_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_inspections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "inspection_checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_inspections_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "pro_monthly_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_photos: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          inspection_id: string | null
          photo_type: string | null
          taken_at: string | null
          url: string
          visit_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          inspection_id?: string | null
          photo_type?: string | null
          taken_at?: string | null
          url: string
          visit_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          inspection_id?: string | null
          photo_type?: string | null
          taken_at?: string | null
          url?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_photos_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "visit_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_photos_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "pro_monthly_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      warranties: {
        Row: {
          category: string
          claim_email: string | null
          claim_phone: string | null
          claim_url: string | null
          cost_cents: number | null
          coverage_type: string
          created_at: string
          document_urls: string[]
          end_date: string
          equipment_id: string | null
          home_id: string | null
          id: string
          notes: string | null
          policy_number: string | null
          provider: string | null
          reminder_30d_sent_at: string | null
          reminder_7d_sent_at: string | null
          reminder_90d_sent_at: string | null
          start_date: string
          status: string
          title: string
          transferred_with_home: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          claim_email?: string | null
          claim_phone?: string | null
          claim_url?: string | null
          cost_cents?: number | null
          coverage_type?: string
          created_at?: string
          document_urls?: string[]
          end_date: string
          equipment_id?: string | null
          home_id?: string | null
          id?: string
          notes?: string | null
          policy_number?: string | null
          provider?: string | null
          reminder_30d_sent_at?: string | null
          reminder_7d_sent_at?: string | null
          reminder_90d_sent_at?: string | null
          start_date?: string
          status?: string
          title: string
          transferred_with_home?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          claim_email?: string | null
          claim_phone?: string | null
          claim_url?: string | null
          cost_cents?: number | null
          coverage_type?: string
          created_at?: string
          document_urls?: string[]
          end_date?: string
          equipment_id?: string | null
          home_id?: string | null
          id?: string
          notes?: string | null
          policy_number?: string | null
          provider?: string | null
          reminder_30d_sent_at?: string | null
          reminder_7d_sent_at?: string | null
          reminder_90d_sent_at?: string | null
          start_date?: string
          status?: string
          title?: string
          transferred_with_home?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranties_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_events_processed: {
        Row: {
          alert_event: string | null
          alert_expires: string | null
          alert_onset: string | null
          alert_severity: string | null
          created_at: string
          home_id: string
          id: string
          nws_alert_id: string
          task_id: string | null
          trigger_type: string
        }
        Insert: {
          alert_event?: string | null
          alert_expires?: string | null
          alert_onset?: string | null
          alert_severity?: string | null
          created_at?: string
          home_id: string
          id?: string
          nws_alert_id: string
          task_id?: string | null
          trigger_type: string
        }
        Update: {
          alert_event?: string | null
          alert_expires?: string | null
          alert_onset?: string | null
          alert_severity?: string | null
          created_at?: string
          home_id?: string
          id?: string
          nws_alert_id?: string
          task_id?: string | null
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "weather_events_processed_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weather_events_processed_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      canopy_technicians: {
        Row: {
          application_id: string | null
          assigned_zones: string[] | null
          background_check_date: string | null
          background_check_status: string | null
          bio: string | null
          business_name: string | null
          certification_level: string | null
          commission_rate: number | null
          contact_name: string | null
          contract_signed_at: string | null
          contract_type: string | null
          created_at: string | null
          email: string | null
          employee_id: string | null
          flagged_low_rating: boolean | null
          hire_date: string | null
          id: string | null
          insurance_carrier: string | null
          insurance_expires_at: string | null
          insurance_info: string | null
          insurance_policy_number: string | null
          is_available: boolean | null
          license_expires_at: string | null
          license_number: string | null
          license_state: string | null
          max_daily_visits: number | null
          max_jobs_per_day: number | null
          onboarding_completed_at: string | null
          partner_since: string | null
          payment_terms: string | null
          phone: string | null
          provider_status: string | null
          provider_type: string | null
          rating: number | null
          schedule: Json | null
          service_area_miles: number | null
          service_area_zips: string[] | null
          service_categories: string[] | null
          specializations: string[] | null
          suspended_at: string | null
          suspension_reason: string | null
          total_reviews: number | null
          training_completed_at: string | null
          updated_at: string | null
          user_id: string | null
          years_experience: number | null
          zip_codes: string[] | null
        }
        Insert: {
          application_id?: string | null
          assigned_zones?: string[] | null
          background_check_date?: string | null
          background_check_status?: string | null
          bio?: string | null
          business_name?: string | null
          certification_level?: string | null
          commission_rate?: number | null
          contact_name?: string | null
          contract_signed_at?: string | null
          contract_type?: string | null
          created_at?: string | null
          email?: string | null
          employee_id?: string | null
          flagged_low_rating?: boolean | null
          hire_date?: string | null
          id?: string | null
          insurance_carrier?: string | null
          insurance_expires_at?: string | null
          insurance_info?: string | null
          insurance_policy_number?: string | null
          is_available?: boolean | null
          license_expires_at?: string | null
          license_number?: string | null
          license_state?: string | null
          max_daily_visits?: number | null
          max_jobs_per_day?: number | null
          onboarding_completed_at?: string | null
          partner_since?: string | null
          payment_terms?: string | null
          phone?: string | null
          provider_status?: string | null
          provider_type?: string | null
          rating?: number | null
          schedule?: Json | null
          service_area_miles?: number | null
          service_area_zips?: string[] | null
          service_categories?: string[] | null
          specializations?: string[] | null
          suspended_at?: string | null
          suspension_reason?: string | null
          total_reviews?: number | null
          training_completed_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          years_experience?: number | null
          zip_codes?: string[] | null
        }
        Update: {
          application_id?: string | null
          assigned_zones?: string[] | null
          background_check_date?: string | null
          background_check_status?: string | null
          bio?: string | null
          business_name?: string | null
          certification_level?: string | null
          commission_rate?: number | null
          contact_name?: string | null
          contract_signed_at?: string | null
          contract_type?: string | null
          created_at?: string | null
          email?: string | null
          employee_id?: string | null
          flagged_low_rating?: boolean | null
          hire_date?: string | null
          id?: string | null
          insurance_carrier?: string | null
          insurance_expires_at?: string | null
          insurance_info?: string | null
          insurance_policy_number?: string | null
          is_available?: boolean | null
          license_expires_at?: string | null
          license_number?: string | null
          license_state?: string | null
          max_daily_visits?: number | null
          max_jobs_per_day?: number | null
          onboarding_completed_at?: string | null
          partner_since?: string | null
          payment_terms?: string | null
          phone?: string | null
          provider_status?: string | null
          provider_type?: string | null
          rating?: number | null
          schedule?: Json | null
          service_area_miles?: number | null
          service_area_zips?: string[] | null
          service_categories?: string[] | null
          specializations?: string[] | null
          suspended_at?: string | null
          suspension_reason?: string | null
          total_reviews?: number | null
          training_completed_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          years_experience?: number | null
          zip_codes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "pro_providers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "provider_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_pros: {
        Row: {
          application_id: string | null
          assigned_zones: string[] | null
          background_check_date: string | null
          background_check_status: string | null
          bio: string | null
          business_name: string | null
          certification_level: string | null
          commission_rate: number | null
          contact_name: string | null
          contract_signed_at: string | null
          contract_type: string | null
          created_at: string | null
          email: string | null
          employee_id: string | null
          flagged_low_rating: boolean | null
          hire_date: string | null
          id: string | null
          insurance_carrier: string | null
          insurance_expires_at: string | null
          insurance_info: string | null
          insurance_policy_number: string | null
          is_available: boolean | null
          license_expires_at: string | null
          license_number: string | null
          license_state: string | null
          max_daily_visits: number | null
          max_jobs_per_day: number | null
          onboarding_completed_at: string | null
          partner_since: string | null
          payment_terms: string | null
          phone: string | null
          provider_status: string | null
          provider_type: string | null
          rating: number | null
          schedule: Json | null
          service_area_miles: number | null
          service_area_zips: string[] | null
          service_categories: string[] | null
          specializations: string[] | null
          suspended_at: string | null
          suspension_reason: string | null
          total_reviews: number | null
          training_completed_at: string | null
          updated_at: string | null
          user_id: string | null
          years_experience: number | null
          zip_codes: string[] | null
        }
        Insert: {
          application_id?: string | null
          assigned_zones?: string[] | null
          background_check_date?: string | null
          background_check_status?: string | null
          bio?: string | null
          business_name?: string | null
          certification_level?: string | null
          commission_rate?: number | null
          contact_name?: string | null
          contract_signed_at?: string | null
          contract_type?: string | null
          created_at?: string | null
          email?: string | null
          employee_id?: string | null
          flagged_low_rating?: boolean | null
          hire_date?: string | null
          id?: string | null
          insurance_carrier?: string | null
          insurance_expires_at?: string | null
          insurance_info?: string | null
          insurance_policy_number?: string | null
          is_available?: boolean | null
          license_expires_at?: string | null
          license_number?: string | null
          license_state?: string | null
          max_daily_visits?: number | null
          max_jobs_per_day?: number | null
          onboarding_completed_at?: string | null
          partner_since?: string | null
          payment_terms?: string | null
          phone?: string | null
          provider_status?: string | null
          provider_type?: string | null
          rating?: number | null
          schedule?: Json | null
          service_area_miles?: number | null
          service_area_zips?: string[] | null
          service_categories?: string[] | null
          specializations?: string[] | null
          suspended_at?: string | null
          suspension_reason?: string | null
          total_reviews?: number | null
          training_completed_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          years_experience?: number | null
          zip_codes?: string[] | null
        }
        Update: {
          application_id?: string | null
          assigned_zones?: string[] | null
          background_check_date?: string | null
          background_check_status?: string | null
          bio?: string | null
          business_name?: string | null
          certification_level?: string | null
          commission_rate?: number | null
          contact_name?: string | null
          contract_signed_at?: string | null
          contract_type?: string | null
          created_at?: string | null
          email?: string | null
          employee_id?: string | null
          flagged_low_rating?: boolean | null
          hire_date?: string | null
          id?: string | null
          insurance_carrier?: string | null
          insurance_expires_at?: string | null
          insurance_info?: string | null
          insurance_policy_number?: string | null
          is_available?: boolean | null
          license_expires_at?: string | null
          license_number?: string | null
          license_state?: string | null
          max_daily_visits?: number | null
          max_jobs_per_day?: number | null
          onboarding_completed_at?: string | null
          partner_since?: string | null
          payment_terms?: string | null
          phone?: string | null
          provider_status?: string | null
          provider_type?: string | null
          rating?: number | null
          schedule?: Json | null
          service_area_miles?: number | null
          service_area_zips?: string[] | null
          service_categories?: string[] | null
          specializations?: string[] | null
          suspended_at?: string | null
          suspension_reason?: string | null
          total_reviews?: number | null
          training_completed_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          years_experience?: number | null
          zip_codes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "pro_providers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "provider_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      warranties_with_expiry: {
        Row: {
          category: string | null
          claim_email: string | null
          claim_phone: string | null
          claim_url: string | null
          cost_cents: number | null
          coverage_type: string | null
          created_at: string | null
          days_until_expiry: number | null
          document_urls: string[] | null
          end_date: string | null
          equipment_id: string | null
          home_id: string | null
          id: string | null
          notes: string | null
          policy_number: string | null
          provider: string | null
          reminder_30d_sent_at: string | null
          reminder_7d_sent_at: string | null
          reminder_90d_sent_at: string | null
          start_date: string | null
          status: string | null
          title: string | null
          transferred_with_home: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          category?: string | null
          claim_email?: string | null
          claim_phone?: string | null
          claim_url?: string | null
          cost_cents?: number | null
          coverage_type?: string | null
          created_at?: string | null
          days_until_expiry?: never
          document_urls?: string[] | null
          end_date?: string | null
          equipment_id?: string | null
          home_id?: string | null
          id?: string | null
          notes?: string | null
          policy_number?: string | null
          provider?: string | null
          reminder_30d_sent_at?: string | null
          reminder_7d_sent_at?: string | null
          reminder_90d_sent_at?: string | null
          start_date?: string | null
          status?: string | null
          title?: string | null
          transferred_with_home?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string | null
          claim_email?: string | null
          claim_phone?: string | null
          claim_url?: string | null
          cost_cents?: number | null
          coverage_type?: string | null
          created_at?: string | null
          days_until_expiry?: never
          document_urls?: string[] | null
          end_date?: string | null
          equipment_id?: string | null
          home_id?: string | null
          id?: string | null
          notes?: string | null
          policy_number?: string | null
          provider?: string | null
          reminder_30d_sent_at?: string | null
          reminder_7d_sent_at?: string | null
          reminder_90d_sent_at?: string | null
          start_date?: string | null
          status?: string | null
          title?: string | null
          transferred_with_home?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warranties_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_home_transfer: {
        Args: { p_new_owner_id: string; p_transfer_id: string }
        Returns: undefined
      }
      acquire_home_generation_lock: {
        Args: { p_home_id: string }
        Returns: boolean
      }
      add_home_token_attestation: {
        Args: {
          p_attestor_role?: string
          p_home_id: string
          p_statement: string
        }
        Returns: {
          attestor_name: string
          attestor_role: string
          attestor_user_id: string
          created_at: string | null
          home_id: string
          id: string
          signed_at: string | null
          statement: string
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "home_token_attestations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assign_pro_request_with_capacity_check: {
        Args: { p_provider_id: string; p_request_id: string }
        Returns: {
          assigned: boolean
          provider_id: string
          reason: string
          request_id: string
        }[]
      }
      cancel_subscription_from_webhook: {
        Args: { p_new_status: string; p_user_id: string }
        Returns: {
          admin_override: boolean
        }[]
      }
      check_and_increment_ai_usage: {
        Args: { p_feature: string; p_user_id: string }
        Returns: Json
      }
      claim_agent_qr_code: {
        Args: { p_qr_token: string; p_user_id: string }
        Returns: string
      }
      complete_task_with_recurrence: {
        Args: {
          p_completed_by?: string
          p_completed_by_pro_id?: string
          p_cost?: number
          p_next_task?: Json
          p_notes?: string
          p_photo_url?: string
          p_task_id: string
        }
        Returns: Json
      }
      compute_next_retry_at: { Args: { attempt: number }; Returns: string }
      delete_user_and_data: { Args: { target_user_id: string }; Returns: Json }
      dismiss_recall_match: { Args: { p_match_id: string }; Returns: undefined }
      dl7_find_testimonial_candidates: {
        Args: {
          cap?: number
          min_age_days?: number
          min_tasks?: number
          min_visits?: number
        }
        Returns: {
          completed_task_count: number
          email: string
          first_name: string
          pro_visit_count: number
          signup_age_days: number
          user_id: string
        }[]
      }
      expire_subscriptions: { Args: never; Returns: undefined }
      export_user_data: { Args: { target_user_id: string }; Returns: Json }
      generate_calendar_token: { Args: never; Returns: string }
      generate_weather_task: {
        Args: {
          p_action_items?: string[]
          p_alert_event: string
          p_alert_expires: string
          p_alert_onset: string
          p_alert_severity: string
          p_description: string
          p_home_id: string
          p_nws_alert_id: string
          p_title: string
          p_trigger_type: string
          p_user_id: string
        }
        Returns: string
      }
      get_accessible_home_ids: { Args: never; Returns: string[] }
      get_notifications_for_retry: {
        Args: { p_limit?: number }
        Returns: {
          action_url: string
          body: string
          category: string
          id: string
          recipient_email: string
          retry_email: boolean
          retry_push: boolean
          retry_sms: boolean
          title: string
          user_id: string
        }[]
      }
      has_vault_pin: { Args: { p_user_id?: string }; Returns: boolean }
      increment_forfeited_visits: {
        Args: { p_homeowner_id: string; p_visit_month: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_agent_for_user: { Args: { target_user_id: string }; Returns: boolean }
      kick_notification_retry_worker: { Args: never; Returns: undefined }
      list_stale_template_tasks: {
        Args: { p_home_id: string }
        Returns: {
          current_template_version: number
          task_id: string
          task_template_version: number
          task_title: string
          template_id: string
        }[]
      }
      log_admin_action: {
        Args: {
          p_action: string
          p_admin_id: string
          p_entity_id?: string
          p_entity_type?: string
          p_ip_address?: string
          p_new_values?: Json
          p_old_values?: Json
          p_user_agent?: string
        }
        Returns: string
      }
      notify_gift_reactivation_window: {
        Args: never
        Returns: {
          notified_count: number
        }[]
      }
      promote_visit_to_home_inspection: {
        Args: { p_overall_grade?: string; p_visit_id: string }
        Returns: {
          add_on_visit_id: string | null
          created_at: string
          duration_minutes: number | null
          findings: Json
          home_id: string
          id: string
          inspected_at: string
          inspector_credential_number: string | null
          inspector_id: string
          inspector_name: string
          inspector_payout_cents: number | null
          overall_grade: string
          pdf_certificate_url: string | null
          photo_urls: string[]
          price_charged_cents: number | null
          recommended_repairs: Json
          scheduled_at: string | null
          signature_version: number
          signed_at: string
          signed_record: string
          systems_inspected: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "home_inspections"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      prune_weather_events_ledger: { Args: never; Returns: number }
      record_certified_inspection: {
        Args: {
          p_add_on_visit_id: string
          p_duration_minutes: number
          p_findings: Json
          p_home_id: string
          p_inspector_credential_number: string
          p_inspector_name: string
          p_inspector_payout_cents: number
          p_overall_grade: string
          p_photo_urls: string[]
          p_price_charged_cents: number
          p_recommended_repairs: Json
          p_systems_inspected: Json
        }
        Returns: {
          add_on_visit_id: string | null
          created_at: string
          duration_minutes: number | null
          findings: Json
          home_id: string
          id: string
          inspected_at: string
          inspector_credential_number: string | null
          inspector_id: string
          inspector_name: string
          inspector_payout_cents: number | null
          overall_grade: string
          pdf_certificate_url: string | null
          photo_urls: string[]
          price_charged_cents: number | null
          recommended_repairs: Json
          scheduled_at: string | null
          signature_version: number
          signed_at: string
          signed_record: string
          systems_inspected: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "home_inspections"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_notification_failure: {
        Args: { p_channel: string; p_error: string; p_notification_id: string }
        Returns: undefined
      }
      remove_vault_pin: { Args: { p_user_id?: string }; Returns: undefined }
      send_subscription_expiry_warnings: { Args: never; Returns: undefined }
      set_vault_pin: {
        Args: { p_pin?: string; p_user_id?: string }
        Returns: undefined
      }
      transition_add_on_status: {
        Args: { p_data?: Json; p_home_add_on_id: string; p_new_status: string }
        Returns: Json
      }
      update_subscription_from_webhook: {
        Args: {
          p_cancel_at_period_end: boolean
          p_current_period_end: number
          p_plan: string
          p_stripe_status: string
          p_stripe_subscription_id: string
          p_user_id: string
        }
        Returns: {
          old_status: string
          old_tier: string
        }[]
      }
      verify_vault_pin: {
        Args: { p_pin?: string; p_user_id?: string }
        Returns: boolean
      }
    }
    Enums: {
      service_type_enum: "diy" | "canopy_visit" | "canopy_pro" | "licensed_pro"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      service_type_enum: ["diy", "canopy_visit", "canopy_pro", "licensed_pro"],
    },
  },
} as const
