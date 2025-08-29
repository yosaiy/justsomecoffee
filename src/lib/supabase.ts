import { createClient } from '@supabase/supabase-js';
// Temporarily commenting out database types import until it's available
// import { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// PIN Authentication functions
export const verifyPin = async (pin: string) => {
  const { data, error } = await supabase
    .from('pin_settings')
    .select('pin_code')
    .single();
  
  if (error) throw error;
  return data?.pin_code === pin;
};

export const updatePin = async (currentPin: string, newPin: string) => {
  // First verify current PIN
  const isValid = await verifyPin(currentPin);
  if (!isValid) {
    throw new Error('Current PIN is incorrect');
  }

  // Update PIN
  const { error } = await supabase
    .from('pin_settings')
    .update({ 
      pin_code: newPin,
      updated_at: new Date().toISOString()
    })
    .eq('id', 1);  // We only have one row

  if (error) throw error;
  return true;
};

// Real-time subscription channels
export const subscribeToMenuItems = (callback: (payload: any) => void) => {
  return supabase
    .channel('menu-items-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'menu_items'
      },
      callback
    )
    .subscribe();
};

export const subscribeToOrders = (callback: (payload: any) => void) => {
  return supabase
    .channel('orders-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders'
      },
      callback
    )
    .subscribe();
};

export const subscribeToMaterials = (callback: (payload: any) => void) => {
  return supabase
    .channel('materials-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'materials'
      },
      callback
    )
    .subscribe();
};

export const subscribeToKdsTickets = (callback: (payload: any) => void) => {
  return supabase
    .channel('kds-tickets-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'kds_tickets'
      },
      callback
    )
    .subscribe();
};

// Helper functions for type-safe queries
export const getMenuItems = async () => {
  const { data, error } = await supabase
    .from('v_menu_items_with_ingredients')
    .select('*');
  
  if (error) throw error;
  return data;
};

export const getOrders = async () => {
  const { data, error } = await supabase
    .from('v_orders_with_items')
    .select(`
      id,
      customer_name,
      phone,
      total,
      status,
      payment,
      additional,
      date,
      created_at,
      updated_at,
      items,
      kds_tickets
    `)
    .order('date', { ascending: false });
  
  if (error) throw error;
  return data;
};

export const getMaterials = async () => {
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .order('name');
  
  if (error) throw error;
  return data;
};

const sendWebhook = async (orderData: any) => {
  try {
    const { data: webhookSettings } = await supabase
      .from('webhook_settings')
      .select('*')
      .single();

    if (!webhookSettings?.is_enabled || !webhookSettings?.url) return;

    const webhookPayload = {
      event: 'new_order',
      timestamp: new Date().toISOString(),
      data: orderData
    };

    await fetch(webhookSettings.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload)
    });
  } catch (error) {
    console.error('Failed to send webhook:', error);
    // Don't throw error - webhook failure shouldn't stop order creation
  }
};

export const createOrder = async (order: {
  customer_name?: string;
  phone?: string | null;
  additional?: string | null;
  date?: string;
  items: {
    menu_item_id: string;
    quantity: number;
    price_at_time: number;
  }[];
}) => {
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .insert({
      customer_name: order.customer_name || null,
      phone: order.phone || null,
      additional: order.additional || null,
      date: order.date || new Date().toISOString(),
      total: order.items.reduce((sum, item) => sum + (item.price_at_time * item.quantity), 0),
      status: 'pending'
    })
    .select()
    .single();

  if (orderError) throw orderError;

  const orderItems = order.items.map(item => ({
    order_id: orderData.id,
    ...item
  }));

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems);

  if (itemsError) throw itemsError;

  // Create KDS ticket
  const { error: kdsError } = await supabase
    .from('kds_tickets')
    .insert({
      order_id: orderData.id,
      status: 'new'
    });

  if (kdsError) throw kdsError;

  // Send webhook notification
  // Get menu item names
  const menuItemPromises = order.items.map(item =>
    supabase.from('menu_items').select('name').eq('id', item.menu_item_id).single()
  );
  const menuItemResults = await Promise.all(menuItemPromises);
  
  await sendWebhook({
    ...orderData,
    items: order.items.map((item, index) => ({
      ...item,
      name: menuItemResults[index].data?.name
    }))
  });

  return orderData;
};

export const updateOrderStatus = async (orderId: string, status: 'completed' | 'cancelled') => {
  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId);

  if (error) throw error;
};

export const updateKdsTicketStatus = async (orderId: string, status: 'new' | 'preparing' | 'ready') => {
  const { error } = await supabase
    .from('kds_tickets')
    .update({ status })
    .eq('order_id', orderId);

  if (error) throw error;
};

export const createMenuItem = async (menuItem: {
  name: string;
  category: string;
  price: number;
  ingredients: {
    material_id?: string;
    name: string;
    quantity?: number;
    unit?: 'ml' | 'g' | 'kg' | 'pcs';
    cost: number;
  }[];
}) => {
  const totalCost = menuItem.ingredients.reduce((sum, ing) => sum + ing.cost, 0);

  const { data: itemData, error: itemError } = await supabase
    .from('menu_items')
    .insert({
      name: menuItem.name,
      category: menuItem.category,
      price: menuItem.price,
      cost: totalCost,
      status: 'active'
    })
    .select()
    .single();

  if (itemError) throw itemError;

  const ingredients = menuItem.ingredients.map(ing => ({
    menu_item_id: itemData.id,
    ...ing
  }));

  const { error: ingredientsError } = await supabase
    .from('ingredients')
    .insert(ingredients);

  if (ingredientsError) throw ingredientsError;

  return itemData;
};

export const updateMenuItem = async (
  menuItemId: string,
  updates: {
    name?: string;
    category?: string;
    price?: number;
    status?: 'active' | 'inactive';
    ingredients?: {
      id?: string;
      material_id?: string;
      name: string;
      quantity?: number;
      unit?: 'ml' | 'g' | 'kg' | 'pcs';
      cost: number;
    }[];
  }
) => {
  // Calculate updates for menu item
  const menuItemUpdates = { ...updates } as any;
  
  if (updates.ingredients) {
    const totalCost = updates.ingredients.reduce((sum, ing) => sum + ing.cost, 0);
    menuItemUpdates.cost = totalCost;

    // Delete existing ingredients
    await supabase
      .from('ingredients')
      .delete()
      .eq('menu_item_id', menuItemId);
    // Insert new ingredients
    const ingredients = updates.ingredients?.map(ing => ({
      menu_item_id: menuItemId,
      material_id: ing.material_id,
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      cost: ing.cost
    }));

    const { error: ingredientsError } = await supabase
      .from('ingredients')
      .insert(ingredients);

    if (ingredientsError) throw ingredientsError;
  }

  const { error } = await supabase
    .from('menu_items')
    .update(menuItemUpdates)
    .eq('id', menuItemId);

  if (error) throw error;
};

export const createMaterial = async (material: {
  name: string;
  unit: 'ml' | 'g' | 'kg' | 'pcs';
  package_size: number;
  purchase_price: number;
}) => {
  const { data, error } = await supabase
    .from('materials')
    .insert(material)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateMaterial = async (
  materialId: string,
  updates: {
    name?: string;
    unit?: 'ml' | 'g' | 'kg' | 'pcs';
    package_size?: number;
    purchase_price?: number;
  }
) => {
  const { error } = await supabase
    .from('materials')
    .update(updates)
    .eq('id', materialId);

  if (error) throw error;
};

export const deleteMaterial = async (materialId: string) => {
  const { error } = await supabase
    .from('materials')
    .delete()
    .eq('id', materialId);

  if (error) throw error;
};
