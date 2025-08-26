export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      materials: {
        Row: {
          id: string
          name: string
          unit: 'ml' | 'g' | 'kg' | 'pcs'
          package_size: number
          purchase_price: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          unit: 'ml' | 'g' | 'kg' | 'pcs'
          package_size: number
          purchase_price: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          unit?: 'ml' | 'g' | 'kg' | 'pcs'
          package_size?: number
          purchase_price?: number
          created_at?: string
          updated_at?: string
        }
      }
      menu_items: {
        Row: {
          id: string
          name: string
          category: string
          price: number
          cost: number
          status: 'active' | 'inactive'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          category: string
          price: number
          cost: number
          status?: 'active' | 'inactive'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: string
          price?: number
          cost?: number
          status?: 'active' | 'inactive'
          created_at?: string
          updated_at?: string
        }
      }
      ingredients: {
        Row: {
          id: string
          menu_item_id: string
          material_id: string | null
          name: string
          quantity: number | null
          unit: 'ml' | 'g' | 'kg' | 'pcs' | null
          cost: number
          created_at: string
        }
        Insert: {
          id?: string
          menu_item_id: string
          material_id?: string | null
          name: string
          quantity?: number | null
          unit?: 'ml' | 'g' | 'kg' | 'pcs' | null
          cost: number
          created_at?: string
        }
        Update: {
          id?: string
          menu_item_id?: string
          material_id?: string | null
          name?: string
          quantity?: number | null
          unit?: 'ml' | 'g' | 'kg' | 'pcs' | null
          cost?: number
          created_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          customer_name: string | null
          total: number
          status: 'pending' | 'completed' | 'cancelled'
          date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_name?: string | null
          total: number
          status?: 'pending' | 'completed' | 'cancelled'
          date?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_name?: string | null
          total?: number
          status?: 'pending' | 'completed' | 'cancelled'
          date?: string
          created_at?: string
          updated_at?: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          menu_item_id: string
          quantity: number
          price_at_time: number
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          menu_item_id: string
          quantity: number
          price_at_time: number
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          menu_item_id?: string
          quantity?: number
          price_at_time?: number
          created_at?: string
        }
      }
      kds_tickets: {
        Row: {
          id: string
          order_id: string
          status: 'new' | 'preparing' | 'ready'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id: string
          status?: 'new' | 'preparing' | 'ready'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          status?: 'new' | 'preparing' | 'ready'
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      v_menu_items_with_ingredients: {
        Row: {
          id: string
          name: string
          category: string
          price: number
          cost: number
          status: 'active' | 'inactive'
          created_at: string
          updated_at: string
          ingredients: {
            id: string
            name: string
            quantity: number | null
            unit: 'ml' | 'g' | 'kg' | 'pcs' | null
            cost: number
            material_id: string | null
          }[]
        }
      }
      v_orders_with_items: {
        Row: {
          id: string
          customer_name: string | null
          total: number
          status: 'pending' | 'completed' | 'cancelled'
          date: string
          created_at: string
          updated_at: string
          items: {
            id: string
            menu_item_id: string
            quantity: number
            price_at_time: number
            menu_item: {
              id: string
              name: string
              category: string
              price: number
              cost: number
              status: 'active' | 'inactive'
            }
          }[]
        }
      }
    }
    Functions: {
      calculate_order_total: {
        Args: {
          order_items: Json[]
        }
        Returns: number
      }
    }
  }
}
