export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          address: string | null;
          municipality_number: string | null;
          property_id: string | null;
          status: "draft" | "active" | "completed" | "archived";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          address?: string | null;
          municipality_number?: string | null;
          property_id?: string | null;
          status?: "draft" | "active" | "completed" | "archived";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          address?: string | null;
          municipality_number?: string | null;
          property_id?: string | null;
          status?: "draft" | "active" | "completed" | "archived";
          created_at?: string;
          updated_at?: string;
        };
      };
      risk_assessments: {
        Row: {
          id: string;
          project_id: string;
          category: string;
          title: string;
          description: string | null;
          severity: "low" | "medium" | "high" | "critical";
          likelihood: "unlikely" | "possible" | "likely" | "certain";
          status: "identified" | "mitigated" | "accepted" | "resolved";
          mitigation: string | null;
          source: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          category: string;
          title: string;
          description?: string | null;
          severity: "low" | "medium" | "high" | "critical";
          likelihood: "unlikely" | "possible" | "likely" | "certain";
          status?: "identified" | "mitigated" | "accepted" | "resolved";
          mitigation?: string | null;
          source?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          category?: string;
          title?: string;
          description?: string | null;
          severity?: "low" | "medium" | "high" | "critical";
          likelihood?: "unlikely" | "possible" | "likely" | "certain";
          status?: "identified" | "mitigated" | "accepted" | "resolved";
          mitigation?: string | null;
          source?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          title: string;
          content: string;
          source_url: string | null;
          category: string | null;
          embedding: number[] | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          content: string;
          source_url?: string | null;
          category?: string | null;
          embedding?: number[] | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          content?: string;
          source_url?: string | null;
          category?: string | null;
          embedding?: number[] | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Functions: {
      match_documents: {
        Args: {
          query_embedding: string;
          match_threshold?: number;
          match_count?: number;
        };
        Returns: {
          id: string;
          title: string;
          content: string;
          source_url: string | null;
          category: string | null;
          metadata: Json | null;
          similarity: number;
        }[];
      };
    };
  };
}

export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type RiskAssessment = Database["public"]["Tables"]["risk_assessments"]["Row"];
export type Document = Database["public"]["Tables"]["documents"]["Row"];
