-- ------------------------------------------------------------------
-- Administrador global de la plataforma.
--   email:    admin@marketpro.local
--   password: Admin123*      <-- CAMBIAR en cualquier entorno real
-- Para generar otro hash: npm run hash-password -- "NuevaClave"
-- ------------------------------------------------------------------
INSERT INTO platform_users (email, password_hash, full_name)
VALUES (
  'admin@marketpro.local',
  'scrypt$16384$8$1$FcRgG7epnhcU-wuqln5wkg$UiK1TN9VxhwxwIklnkwLypXbIQus8FTS3sA5PRVNXM9oN3u8FfoYzTnV7OwpjXSf5mParHsKbnBuz9dDrobgnA',
  'Administrador de plataforma'
)
ON CONFLICT DO NOTHING;
