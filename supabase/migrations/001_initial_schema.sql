-- Create custom types
CREATE TYPE order_status AS ENUM ('pending', 'completed', 'cancelled');
CREATE TYPE menu_item_status AS ENUM ('active', 'inactive');
CREATE TYPE unit_type AS ENUM ('ml', 'g', 'kg', 'pcs');
CREATE TYPE kds_ticket_status AS ENUM ('new', 'preparing', 'ready');

-- Create materials table
CREATE TABLE materials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    unit unit_type NOT NULL,
    package_size INTEGER NOT NULL CHECK (package_size > 0),
    purchase_price INTEGER NOT NULL CHECK (purchase_price >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create menu_items table
CREATE TABLE menu_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price >= 0),
    cost INTEGER NOT NULL CHECK (cost >= 0),
    status menu_item_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ingredients table (for menu items)
CREATE TABLE ingredients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    quantity DECIMAL(10,2),
    unit unit_type,
    cost INTEGER NOT NULL CHECK (cost >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create orders table
CREATE TABLE orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_name TEXT,
    total INTEGER NOT NULL CHECK (total >= 0),
    status order_status NOT NULL DEFAULT 'pending',
    additional TEXT,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create order_items table
CREATE TABLE order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_at_time INTEGER NOT NULL CHECK (price_at_time >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create kds_tickets table
CREATE TABLE kds_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status kds_ticket_status NOT NULL DEFAULT 'new',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_materials_name ON materials(name);
CREATE INDEX idx_menu_items_category ON menu_items(category);
CREATE INDEX idx_menu_items_status ON menu_items(status);
CREATE INDEX idx_ingredients_menu_item ON ingredients(menu_item_id);
CREATE INDEX idx_orders_date ON orders(date);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_kds_tickets_order ON kds_tickets(order_id);
CREATE INDEX idx_kds_tickets_status ON kds_tickets(status);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_materials_updated_at
    BEFORE UPDATE ON materials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_menu_items_updated_at
    BEFORE UPDATE ON menu_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kds_tickets_updated_at
    BEFORE UPDATE ON kds_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries
CREATE OR REPLACE VIEW v_menu_items_with_ingredients AS
SELECT 
    mi.*,
    COALESCE(
        json_agg(
            json_build_object(
                'id', i.id,
                'name', i.name,
                'quantity', i.quantity,
                'unit', i.unit,
                'cost', i.cost,
                'material_id', i.material_id
            )
        ) FILTER (WHERE i.id IS NOT NULL),
        '[]'::json
    ) as ingredients
FROM menu_items mi
LEFT JOIN ingredients i ON i.menu_item_id = mi.id
GROUP BY mi.id;

CREATE OR REPLACE VIEW v_orders_with_items AS
SELECT 
    o.id,
    o.customer_name,
    o.total,
    o.status,
    o.additional,
    o.date,
    o.created_at,
    o.updated_at,
    COALESCE(
        json_agg(
            json_build_object(
                'id', oi.id,
                'menu_item_id', oi.menu_item_id,
                'quantity', oi.quantity,
                'price_at_time', oi.price_at_time,
                'menu_item', json_build_object(
                    'id', mi.id,
                    'name', mi.name,
                    'category', mi.category,
                    'price', mi.price,
                    'cost', mi.cost,
                    'status', mi.status
                )
            )
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'::json
    ) as items,
    COALESCE(
        json_agg(
            json_build_object(
                'id', kt.id,
                'status', kt.status,
                'created_at', kt.created_at,
                'updated_at', kt.updated_at
            )
        ) FILTER (WHERE kt.id IS NOT NULL),
        '[]'::json
    ) as kds_tickets
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
LEFT JOIN kds_tickets kt ON kt.order_id = o.id
GROUP BY o.id;

-- Enable Row Level Security (RLS)
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE kds_tickets ENABLE ROW LEVEL SECURITY;

-- Create policies (allowing all operations for now - you can restrict this later)
CREATE POLICY "Enable all for authenticated users" ON materials FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated users" ON menu_items FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated users" ON ingredients FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated users" ON orders FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated users" ON order_items FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated users" ON kds_tickets FOR ALL USING (true);