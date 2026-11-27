/** Minimal hand-written Database types for Ticketportaal tables we query. */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type DbUserRole = "gebruiker" | "manager" | "uitvoerder";
export type DbTicketType =
  | "storing"
  | "wijziging"
  | "vraag"
  | "idee"
  | "procesverbetering";
export type DbTicketSysteem =
  | "Artikelen"
  | "Hardware"
  | "Netsuite"
  | "Netsuite transportplanning"
  | "Netsuite WMS"
  | "Outlook"
  | "Overig"
  | "Software"
  | "Telefonie"
  | "Ticketportaal"
  | "Werkplek";
export type DbTicketImpact = "stil" | "hinderlijk" | "wens";
export type DbTicketStatus =
  | "nieuw"
  | "ingepland"
  | "in_behandeling"
  | "wacht_op_melder"
  | "wacht_op_publicatie"
  | "afgerond"
  | "afgewezen";
export type DbTicketPriority = "spoed" | "hoog" | "gemiddeld" | "laag";
export type DbTicketSize = "S" | "M" | "L" | "XL" | "XXL";

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
        Insert: {
          id?: string;
          onderwerp: string;
          omschrijving: string;
          type: DbTicketType;
          systeem: DbTicketSysteem;
          impact: DbTicketImpact;
          status?: DbTicketStatus;
          prioriteit?: DbTicketPriority;
          melder_id: string;
          eigenaar_id?: string | null;
          streefdatum?: string | null;
          omvang?: DbTicketSize | null;
          oplossing_samenvatting?: string | null;
        };
        Update: {
          onderwerp?: string;
          omschrijving?: string;
          type?: DbTicketType;
          systeem?: DbTicketSysteem;
          status?: DbTicketStatus;
          prioriteit?: DbTicketPriority;
          melder_id?: string;
          eigenaar_id?: string | null;
          streefdatum?: string | null;
          omvang?: DbTicketSize | null;
          oplossing_samenvatting?: string | null;
          vertrouwelijk?: boolean;
        };
      };
      ticket_departments: {
        Row: {
          ticket_id: string;
          department_id: string;
        };
        Insert: {
          ticket_id: string;
          department_id: string;
        };
      };
      ticket_watchers: {
        Row: {
          ticket_id: string;
          user_id: string;
          reason: string;
          created_at: string;
        };
        Insert: {
          ticket_id: string;
          user_id: string;
          reason?: string;
          created_at?: string;
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
          comment_id: string | null;
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
          comment_id?: string | null;
        };
      };
      ticket_links: {
        Row: {
          id: string;
          from_ticket_id: string;
          to_ticket_id: string;
          link_type:
            | "duplicate"
            | "related"
            | "parent"
            | "blocks"
            | "blocked_by";
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          from_ticket_id: string;
          to_ticket_id: string;
          link_type:
            | "duplicate"
            | "related"
            | "parent"
            | "blocks"
            | "blocked_by";
          created_by?: string | null;
          created_at?: string;
        };
      };
    };
  };
}
