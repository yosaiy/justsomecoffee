-- Update the view to include payment column (keeping exact original column order)
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
    ) as kds_tickets,
    o.phone,
    o.payment
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
LEFT JOIN kds_tickets kt ON kt.order_id = o.id
GROUP BY o.id, o.customer_name, o.total, o.status, o.additional, o.date, o.created_at, o.updated_at, o.phone, o.payment;