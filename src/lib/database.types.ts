/** Minimal hand-written Database types for Ticketportaal tables we query. */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type DbUserRole = "gebruiker" | "manager" | "uitvoerder";
export type DbTicketType = "storing" | "wijziging" | "vraag" | "idee";
export type DbTicketSysteem =
  | "NetSuite"
  | "WMS"
  | "hardware"
  | "Outlook"
  | "overig";
export type DbTicketImpact = "stil" | "hinderlijk" | "wens";
export type DbTicketStatus =
  | "nieuw"
  | "ingepland"
  | "in_behandeling"
  | "wacht_op_melder"
  | "afgerond"
  | "afgewezen";
export type DbTicketPriority = "spoed" | "voorrang" | "belangrijk" | "normaal";
export type DbTicketSize = "S" | "M" | "L";

export interface Database {
  public: {
    Tables: {
      departments: {
        Row: {
          id: string;
          code: string;
          naam: string;
          actief: boolean;
          sort_order: number;
        };
      };
      profiles: {
        Row: {
          id: string;
          naam: string;
          email: string;
          rol: DbUserRole;
          afdeling_id: string | null;
          actief: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          naam: string;
          email: string;
          rol?: DbUserRole;
          afdeling_id?: string | null;
          actief?: boolean;
        };
        Update: {
          naam?: string;
          email?: string;
          rol?: DbUserRole;
          afdeling_id?: string | null;
          actief?: boolean;
        };
      };
      tickets: {
        Row: {
          id: string;
          ticketnummer: string;
          onderwerp: string;
          omschrijving: string;
          afdeling_id: string;
          type: DbTicketType;
          systeem: DbTicketSysteem;
          impact: DbTicketImpact;
          categorie: string | null;
          status: DbTicketStatus;
          prioriteit: DbTicketPriority;
          melder_id: string;
          eigenaar_id: string | null;
          streefdatum: string | null;
          omvang: DbTicketSize | null;
          oplossing_samenvatting: string | null;
          vertrouwelijk: boolean;
          closed_at: string | null;
          melder_bevestigd_at: string | null;
          netsuite_ref: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      ratings: {
        Row: {
          id: string;
          ticket_id: string;
          user_id: string;
          score: number;
          toelichting: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      comments: {
        Row: {
          id: string;
          ticket_id: string;
          user_id: string | null;
          body: string;
          source: "portal" | "email" | "system";
          external_message_id: string | null;
          in_reply_to: string | null;
          created_at: string;
        };
      };
      it_notes: {
        Row: {
          id: string;
          ticket_id: string;
          user_id: string;
          body: string;
          created_at: string;
          updated_at: string;
        };
      };
      ticket_attachments: {
        Row: {
          id: string;
          ticket_id: string;
          uploaded_by: string;
          storage_path: string;
          file_name: string;
          mime_type: string | null;
          byte_size: number | null;
          kind: "image" | "document" | "other";
          created_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          uploaded_by: string;
          storage_path: string;
          file_name: string;
          mime_type?: string | null;
          byte_size?: number | null;
          kind?: "image" | "document" | "other";
          created_at?: string;
        };
      };
    };
  };
}
