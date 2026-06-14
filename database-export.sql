-- VPN Node Tool - 数据库导出
-- 导出时间: 2026-06-14
-- 数据库类型: Supabase (PostgreSQL)

-- ==================== 表结构 ====================

-- 节点表
CREATE TABLE IF NOT EXISTS vpn_nodes (
  id SERIAL PRIMARY KEY,
  protocol VARCHAR(20) NOT NULL,
  address VARCHAR(255) NOT NULL,
  port INTEGER NOT NULL,
  account VARCHAR(255) DEFAULT '',
  password VARCHAR(255) DEFAULT '',
  node_name VARCHAR(128) NOT NULL,
  encryption VARCHAR(64) DEFAULT '',
  network VARCHAR(20) DEFAULT 'tcp',
  tls VARCHAR(20) DEFAULT '',
  sni VARCHAR(255) DEFAULT '',
  path VARCHAR(255) DEFAULT '',
  host VARCHAR(255) DEFAULT '',
  alter_id INTEGER DEFAULT 0,
  region VARCHAR(64) DEFAULT '',
  expiry_date VARCHAR(32) DEFAULT '',
  user_id UUID,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS vpn_nodes_sort_order_idx ON vpn_nodes(sort_order);
CREATE INDEX IF NOT EXISTS vpn_nodes_protocol_idx ON vpn_nodes(protocol);
CREATE INDEX IF NOT EXISTS vpn_nodes_user_id_idx ON vpn_nodes(user_id);

-- 管理员表
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 用户档案表
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  banned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
  key VARCHAR(128) PRIMARY KEY,
  value TEXT NOT NULL,
  description VARCHAR(255),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ==================== 数据导出 ====================

-- vpn_nodes (5 rows)
INSERT INTO vpn_nodes (protocol, address, port, account, password, node_name, encryption, network, tls, sni, path, host, alter_id, sort_order, expiry_date, region) VALUES
('socks5', '61.172.169.93', 7522, 'real8', '6652', 'MYK-上海152', '', 'tcp', '', '', '', '', 0, 0, '2026-07-12', ''),
('socks5', '112.65.92.8', 7522, 'real8', '6652', 'MYK-上海联通', '', 'tcp', '', '', '', '', 0, 1, '2026-07-12', ''),
('socks5', '114.80.237.19', 7522, 'real8', '6652', 'MYK-上海普陀电', '', 'tcp', '', '', '', '', 0, 3, '2026-07-12', ''),
('socks5', '61.172.168.44', 7522, 'real8', '6652', 'MYK-上海15', '', 'tcp', '', '', '', '', 0, 4, '2026-07-12', ''),
('socks5', '180.153.83.124', 7522, 'real8', '6652', 'MYK-上海浦东', '', 'tcp', '', '', '', '', 0, 5, '2026-07-12', '');

-- system_config (5 rows)
INSERT INTO system_config (key, value, description) VALUES
('android_filename', 'mlkVPN468_Android', '安卓订阅文件名'),
('android_port_suffix', '/', '安卓端口后缀（如/）'),
('ios_filename', 'mlkVPN468_IOS', 'IOS订阅文件名'),
('ios_rename_hash', '?remarks=', 'IOS将#号替换为'),
('ios_socks_prefix', 'socks', 'IOS socks5协议前缀改为');

-- 注意: admin_users 和 user_profiles 的 user_id 关联 auth.users，
-- 迁移到新 Supabase 项目后需要重新注册用户再手动关联
