import { MenuItem, Material, Order } from '../types';
import { broadcastChange } from './sync';

const API_BASE_URL = 'http://localhost:3000/api';

// Local Storage Keys
const STORAGE_KEYS = {
  MATERIALS: 'kopi_materials',
  MENU_ITEMS: 'kopi_menu_items',
  ORDERS: 'kopi_orders',
  KDS_TICKETS: 'kopi_kds_tickets'
};

// Helper functions for local storage
function getFromStorage<T>(key: string): T[] {
  try {
    const data = localStorage.getItem(key);
    if (!data) return [];

    const parsedData = JSON.parse(data);
    return parsedData.map(item => {
      if (typeof item === 'object' && item !== null) {
        return {
          ...item,
          // Convert ISO strings back to Date objects
          date: item.date ? new Date(item.date) : undefined,
          // Ensure nested objects are properly reconstructed
          items: item.items ? 
            item.items.map(orderItem => ({
              ...orderItem,
              menuItem: { ...orderItem.menuItem }
            })) : undefined
        };
      }
      return item;
    });
  } catch (error) {
    console.error('Failed to load from local storage:', error);
    return [];
  }
}

function saveToStorage<T>(key: string, data: T[]): void {
  try {
    // Deep clone the data to handle circular references and preserve types
    const processedData = data.map(item => {
      if (typeof item === 'object' && item !== null) {
        return {
          ...item,
          // Convert Date objects to ISO strings
          date: item.hasOwnProperty('date') ? new Date(item.date).toISOString() : undefined,
          // Ensure nested objects are properly serialized
          items: item.hasOwnProperty('items') ? 
            item.items.map(orderItem => ({
              ...orderItem,
              menuItem: { ...orderItem.menuItem }
            })) : undefined
        };
      }
      return item;
    });
    localStorage.setItem(key, JSON.stringify(processedData));
  } catch (error) {
    console.error('Failed to save to local storage:', error);
  }
}

// Initial data loading from server with local storage fallback
export async function getAllMaterials(): Promise<Material[]> {
  try {
    // Get local data first
    const localMaterials = getFromStorage<Material>(STORAGE_KEYS.MATERIALS);
    
    // Try to get server data
    const response = await fetch(`${API_BASE_URL}/materials`);
    const serverMaterials = await response.json();
    
    // Only update storage if we got new data from server
    if (serverMaterials.length > 0) {
      saveToStorage(STORAGE_KEYS.MATERIALS, serverMaterials);
      return serverMaterials;
    }
    
    return localMaterials;
  } catch (error) {
    console.error('Failed to fetch materials from server, using local storage:', error);
    return getFromStorage<Material>(STORAGE_KEYS.MATERIALS);
  }
}

export async function getAllMenuItems(): Promise<MenuItem[]> {
  try {
    // Get local data first
    const localMenuItems = getFromStorage<MenuItem>(STORAGE_KEYS.MENU_ITEMS);
    
    // Try to get server data
    const response = await fetch(`${API_BASE_URL}/menu-items`);
    const serverMenuItems = await response.json();
    
    // Only update storage if we got new data from server
    if (serverMenuItems.length > 0) {
      saveToStorage(STORAGE_KEYS.MENU_ITEMS, serverMenuItems);
      return serverMenuItems;
    }
    
    return localMenuItems;
  } catch (error) {
    console.error('Failed to fetch menu items from server, using local storage:', error);
    return getFromStorage<MenuItem>(STORAGE_KEYS.MENU_ITEMS);
  }
}

export async function getAllOrders(): Promise<Order[]> {
  try {
    // Get local data first
    const localOrders = getFromStorage<Order>(STORAGE_KEYS.ORDERS);
    const processedLocalOrders = localOrders.map(order => ({
      ...order,
      date: new Date(order.date)
    }));
    
    // Try to get server data
    const response = await fetch(`${API_BASE_URL}/orders`);
    const serverOrders = await response.json();
    
    // Only update storage if we got new data from server
    if (serverOrders.length > 0) {
      const processedServerOrders = serverOrders.map((order: any) => ({
        ...order,
        date: new Date(order.date)
      }));
      saveToStorage(STORAGE_KEYS.ORDERS, processedServerOrders);
      return processedServerOrders;
    }
    
    return processedLocalOrders;
  } catch (error) {
    console.error('Failed to fetch orders from server, using local storage:', error);
    const storedOrders = getFromStorage<Order>(STORAGE_KEYS.ORDERS);
    return storedOrders.map(order => ({
      ...order,
      date: new Date(order.date)
    }));
  }
}

// Create operations
export async function createMaterial(material: Material): Promise<Material> {
  const materials = getFromStorage<Material>(STORAGE_KEYS.MATERIALS);
  materials.push(material);
  saveToStorage(STORAGE_KEYS.MATERIALS, materials);
  broadcastChange({ type: 'materials', action: 'create', data: material });
  return material;
}

export async function createMenuItem(item: MenuItem): Promise<MenuItem> {
  const menuItems = getFromStorage<MenuItem>(STORAGE_KEYS.MENU_ITEMS);
  menuItems.push(item);
  saveToStorage(STORAGE_KEYS.MENU_ITEMS, menuItems);
  broadcastChange({ type: 'menuItems', action: 'create', data: item });
  return item;
}

export async function createOrder(order: Order): Promise<Order> {
  const orders = getFromStorage<Order>(STORAGE_KEYS.ORDERS);
  orders.push(order);
  saveToStorage(STORAGE_KEYS.ORDERS, orders);
  broadcastChange({ type: 'orders', action: 'create', data: order });
  return order;
}

// Update operations
export async function updateMaterial(material: Material): Promise<Material> {
  const materials = getFromStorage<Material>(STORAGE_KEYS.MATERIALS);
  const index = materials.findIndex(m => m.id === material.id);
  if (index !== -1) {
    materials[index] = material;
    saveToStorage(STORAGE_KEYS.MATERIALS, materials);
  }
  broadcastChange({ type: 'materials', action: 'update', data: material });
  return material;
}

export async function updateMenuItem(item: MenuItem): Promise<MenuItem> {
  const menuItems = getFromStorage<MenuItem>(STORAGE_KEYS.MENU_ITEMS);
  const index = menuItems.findIndex(i => i.id === item.id);
  if (index !== -1) {
    menuItems[index] = item;
    saveToStorage(STORAGE_KEYS.MENU_ITEMS, menuItems);
  }
  broadcastChange({ type: 'menuItems', action: 'update', data: item });
  return item;
}

export async function updateOrder(order: Order): Promise<Order> {
  const orders = getFromStorage<Order>(STORAGE_KEYS.ORDERS);
  const index = orders.findIndex(o => o.id === order.id);
  if (index !== -1) {
    orders[index] = order;
    saveToStorage(STORAGE_KEYS.ORDERS, orders);
  }
  broadcastChange({ type: 'orders', action: 'update', data: order });
  return order;
}

// Delete operations
export async function deleteMaterial(id: string): Promise<void> {
  const materials = getFromStorage<Material>(STORAGE_KEYS.MATERIALS);
  const filtered = materials.filter(m => m.id !== id);
  saveToStorage(STORAGE_KEYS.MATERIALS, filtered);
  broadcastChange({ type: 'materials', action: 'delete', id });
}

export async function deleteMenuItem(id: string): Promise<void> {
  const menuItems = getFromStorage<MenuItem>(STORAGE_KEYS.MENU_ITEMS);
  const filtered = menuItems.filter(i => i.id !== id);
  saveToStorage(STORAGE_KEYS.MENU_ITEMS, filtered);
  broadcastChange({ type: 'menuItems', action: 'delete', id });
}

export async function deleteOrder(id: string): Promise<void> {
  const orders = getFromStorage<Order>(STORAGE_KEYS.ORDERS);
  const filtered = orders.filter(o => o.id !== id);
  saveToStorage(STORAGE_KEYS.ORDERS, filtered);
  broadcastChange({ type: 'orders', action: 'delete', id });
}

// KDS Tickets
export async function getKdsTickets(): Promise<Record<string, { status: 'new' | 'preparing' | 'ready' }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/kds-tickets`);
    const tickets = await response.json();
    localStorage.setItem(STORAGE_KEYS.KDS_TICKETS, JSON.stringify(tickets));
    return tickets;
  } catch (error) {
    console.error('Failed to fetch KDS tickets from server, using local storage:', error);
    const storedTickets = localStorage.getItem(STORAGE_KEYS.KDS_TICKETS);
    return storedTickets ? JSON.parse(storedTickets) : {};
  }
}

export async function updateKdsTicket(orderId: string, status: 'new' | 'preparing' | 'ready'): Promise<void> {
  const tickets = JSON.parse(localStorage.getItem(STORAGE_KEYS.KDS_TICKETS) || '{}');
  tickets[orderId] = { status };
  localStorage.setItem(STORAGE_KEYS.KDS_TICKETS, JSON.stringify(tickets));
  broadcastChange({ 
    type: 'kdsTickets', 
    action: 'update', 
    data: { orderId, status }
  });
}

export async function deleteKdsTicket(orderId: string): Promise<void> {
  const tickets = JSON.parse(localStorage.getItem(STORAGE_KEYS.KDS_TICKETS) || '{}');
  delete tickets[orderId];
  localStorage.setItem(STORAGE_KEYS.KDS_TICKETS, JSON.stringify(tickets));
  broadcastChange({ 
    type: 'kdsTickets', 
    action: 'delete', 
    id: orderId 
  });
}

// Initialize database and load initial data from server
export async function initDB(): Promise<void> {
  try {
    // Load all data types from server
    await Promise.all([
      getAllMaterials(),
      getAllMenuItems(),
      getAllOrders(),
      getKdsTickets()
    ]);
    console.log('Database initialized with server data and local storage backup');
  } catch (error) {
    console.error('Failed to initialize database from server, using local storage:', error);
  }
}