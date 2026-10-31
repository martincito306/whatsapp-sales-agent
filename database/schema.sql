-- ==============================================================================
-- NOVACLOUD DIGITAL - ESQUEMA COMPLETO CON RLS Y CATÁLOGO SAAS (POSTGRESQL / SUPABASE)
-- ==============================================================================

-- 1. Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Eliminar tablas si existen para permitir re-ejecución limpia
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS combo_products CASCADE;
DROP TABLE IF EXISTS combos CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS faqs CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;

-- 2. TABLA DE CONFIGURACIÓN DEL SISTEMA
CREATE TABLE system_settings (
    key VARCHAR(50) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLA DE CLIENTES
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255),
    state VARCHAR(50) DEFAULT 'NEW',
    bot_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    last_interaction TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABLA DE PRODUCTOS
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    duration_days INT NOT NULL,
    duration_text VARCHAR(50) DEFAULT '30 días',
    is_available BOOLEAN DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. TABLA DE COMBOS / PAQUETES EMPRESARIALES
CREATE TABLE combos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    combo_number INT UNIQUE,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    duration_text VARCHAR(50) DEFAULT '30 días',
    is_available BOOLEAN DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABLA DE PEDIDOS (ORDERS)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_code VARCHAR(20) UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    combo_number INT,
    total_price DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDIENTE_PAGO',
    receipt_url TEXT,
    delivery_notes TEXT,
    payment_method VARCHAR(50) DEFAULT 'Transferencia',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. TABLA DE CONVERSACIONES (MEMORIA Y AUDITORÍA)
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. TABLA DE PREGUNTAS FRECUENTES (FAQS)
CREATE TABLE faqs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- ==============================================================================
-- 9. SEGURIDAD: ACTIVAR ROW LEVEL SECURITY (RLS) EN TODAS LAS TABLAS
-- Bloquea cualquier acceso directo desde la API pública (anon/publishable key).
-- Solo el backend autenticado (service_role / conexión directa segura) puede operar.
-- ==============================================================================
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 10. CONFIGURACIÓN Y CATÁLOGO DEMOSTRATIVO (100% CUMPLIMIENTO META COMMERCE)
-- ==============================================================================
INSERT INTO system_settings (key, value, description) VALUES
('bot_active', 'true'::jsonb, 'Estado global del bot (true: activo, false: pausado)'),
('auto_delivery', 'false'::jsonb, 'Entrega automática de licencias (true: activada, false: verificación manual)'),
('business_info', '{"name": "NovaCloud Digital", "currency": "COP", "admin_phone": "573000000000"}'::jsonb, 'Información del negocio'),
('payment_methods', '{"nequi": {"account": "3000000000", "name": "NovaCloud SAS", "active": true}, "bancolombia": {"account": "000-000000-00", "name": "NovaCloud SAS", "active": true}}'::jsonb, 'Métodos de pago configurables');

INSERT INTO faqs (question, answer) VALUES
('¿Cuánto demora la activación de mi licencia o servicio?', 'Una vez nuestro equipo verifique tu comprobante de pago, tu licencia o entorno cloud se activa y entrega en un plazo de 5 a 15 minutos.'),
('¿Qué métodos de pago aceptan?', 'Aceptamos transferencias digitales vía Nequi y Bancolombia configuradas en nuestro sistema.'),
('¿Cuentan con soporte técnico y garantía?', 'Sí, todos nuestros planes incluyen soporte técnico 24/7 y garantía de disponibilidad durante todo el ciclo contratado.'),
('¿Cómo recibo mis accesos?', 'Tras la validación del pago por un administrador, enviamos tu clave de licencia o credenciales de acceso directamente por este chat.');

-- PRODUCTOS INDIVIDUALES (SaaS, Cloud & Herramientas para Desarrolladores)
INSERT INTO products (name, category, price, duration_days, duration_text, is_available, description) VALUES
('Cloud VPS Starter (2 vCPU / 4GB RAM)', 'Cloud & Hosting', 25000, 30, '30 días', TRUE, 'Servidor privado virtual Linux SSD NVMe'),
('Cloud VPS Pro (4 vCPU / 8GB RAM)', 'Cloud & Hosting', 45000, 30, '30 días', TRUE, 'Servidor de alto rendimiento para producción'),
('PostgreSQL Managed DB (10GB)', 'Bases de Datos', 20000, 30, '30 días', TRUE, 'Base de datos PostgreSQL administrada con backups diarios'),
('Licencia UI/UX Design Kit Pro', 'Diseño & Frontend', 30000, 365, '1 año', TRUE, 'Más de 500 componentes Tailwind y Figma listos para producción'),
('API Gateway & Rate Limiter SaaS', 'Seguridad', 18000, 30, '30 días', TRUE, 'Protección DDoS y monitoreo de endpoints REST'),
('Curso Intensivo Node.js & Microservicios', 'Educación Dev', 35000, 365, 'Acceso anual', TRUE, 'Arquitectura limpia, Docker, testing y despliegue cloud'),
('Curso Integración IA Generativa & LLMs', 'Educación Dev', 40000, 365, 'Acceso anual', TRUE, 'Ingeniería de prompts, RAG, agentes y Function Calling'),
('Monitor Uptime & Alertas 24/7', 'DevOps', 12000, 30, '30 días', TRUE, 'Monitoreo cada 30 segundos con alertas por Webhook y Telegram'),
('Certificado SSL Wildcard Anual', 'Seguridad', 28000, 365, '1 año', TRUE, 'Cifrado TLS 1.3 para dominio principal y subdominios'),
('Asesoría Arquitectura de Software (1 Hora)', 'Consultoría', 60000, 7, '1 sesión', TRUE, 'Revisión de código, seguridad y escalabilidad en vivo');

-- COMBOS / BUNDLES EMPRESARIALES
INSERT INTO combos (combo_number, name, price, duration_text, is_available, description) VALUES
(1, 'Pack Indie Hacker (VPS Starter + PostgreSQL Managed)', 38000, '30 días', TRUE, 'Combo #1: Ahorra $7.000 contratando servidor y base de datos juntos'),
(2, 'Pack Producción Segura (VPS Pro + PostgreSQL + SSL + Monitor)', 75000, '30 días', TRUE, 'Combo #2: Infraestructura completa lista para clientes reales'),
(3, 'Pack Full-Stack AI Developer (Curso Node.js + Curso IA + UI Kit)', 85000, '1 año', TRUE, 'Combo #3: Todo el stack formativo y visual con ahorro de $20.000'),
(4, 'Pack Blindaje Web (API Gateway + SSL Wildcard + Monitor 24/7)', 48000, '30 días', TRUE, 'Combo #4: Seguridad perimetral y observabilidad continua'),
(5, 'Pack Lanzamiento Startup (VPS Pro + DB + UI Kit + 1h Consultoría)', 120000, '30 días', TRUE, 'Combo #5: Infraestructura + Diseño + Acompañamiento de un arquitecto senior');
